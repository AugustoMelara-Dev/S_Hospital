<?php

declare(strict_types=1);

namespace Tests\Feature\Concurrent;

use App\Actions\Cash\CloseCashSessionAction;
use App\Models\CashRegisterSession;
use App\Models\User;
use App\Support\AuditAdmin;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use PHPUnit\Framework\Attributes\Group;
use Spatie\Permission\Models\Permission;
use Symfony\Component\Process\Exception\ProcessTimedOutException;
use Symfony\Component\Process\Process;
use Tests\TestCase;

/**
 * M-W2-FIN-01 (mandato §7 y §19): concurrencia real de cajas sobre MariaDB.
 *
 * Lanza DOS procesos PHP CLI independientes (Symfony Process sobre proc_open)
 * contra una base desechable. Cada worker espera el mismo instante de arranque
 * y compite por la misma operacion; el arnes no comparte la conexion ni el
 * proceso, por lo que los locks GET_LOCK / lockForUpdate y el indice unico
 * `(cash_register_id, open_marker)` se ejercitan de verdad. SQLite en memoria
 * comparte una sola conexion y no puede reproducir esta contencion.
 *
 * Casos:
 *   1. dos aperturas en la MISMA caja  -> exactamente una gana;
 *   2. dos aperturas en cajas DISTINTAS -> ambas ganan;
 *   3. el mismo usuario abriendo dos veces (cajas distintas) -> bloqueado por
 *      `unique(open_user_id)`;
 *   4. cierre contra cobro (carrera) -> ningun pago publicado en caja cerrada;
 *   5. reintento tras commit con la misma Idempotency-Key -> replay sin duplicar.
 *
 * Ejecutar:
 *   HOSPITAL_RUN_CONCURRENT_TESTS=1 HOSPITAL_TEST_ALLOW_EXTERNAL_DB=1 \
 *   DB_CONNECTION=mysql DB_HOST=127.0.0.1 DB_PORT=3306 \
 *   DB_DATABASE=s_hospital_test_sh_ai_fin_01 DB_USERNAME=root \
 *   DB_PASSWORD=change-me
 *   vendor/bin/phpunit -c phpunit.mysql.xml --group=concurrent
 */
#[Group('concurrent')]
class CashSessionConcurrencyTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $reason = $this->skipReason();
        if ($reason !== null) {
            $this->markTestSkipped($reason);
        }
    }

    public function test_two_simultaneous_opens_on_the_same_register_allow_exactly_one(): void
    {
        $this->ensureDatabaseSchema();
        $runId = bin2hex(random_bytes(4));

        try {
            $registerId = $this->register('principal');
            $this->cashier("cash-{$runId}-a");
            $this->cashier("cash-{$runId}-b");

            $startAt = microtime(true) + 4.0;
            $workers = [
                $this->startOpenWorker($runId, 'a', $startAt, "cash-{$runId}-a", 'principal'),
                $this->startOpenWorker($runId, 'b', $startAt, "cash-{$runId}-b", 'principal'),
            ];

            $this->waitForWorkers($workers);
            $results = $this->collectResults($workers);

            $opened = array_values(array_filter($results, static fn (array $row): bool => ($row['outcome'] ?? null) === 'opened'));
            $this->assertCount(1, $opened, 'Solo una apertura debe ganar. Resultados: '.json_encode($results));
            $this->assertSame(
                1,
                (int) DB::table('cash_register_sessions')->where('cash_register_id', $registerId)->where('open_marker', 1)->count(),
                'El indice unico por caja debe dejar exactamente una sesion abierta.',
            );
        } finally {
            $this->cleanupRun($runId);
        }
    }

    public function test_two_simultaneous_opens_on_distinct_registers_both_win(): void
    {
        $this->ensureDatabaseSchema();
        $runId = bin2hex(random_bytes(4));

        try {
            $primary = $this->register('principal');
            $secondary = $this->register('ventanilla');
            $this->cashier("cash-{$runId}-a");
            $this->cashier("cash-{$runId}-b");

            $startAt = microtime(true) + 4.0;
            $workers = [
                $this->startOpenWorker($runId, 'a', $startAt, "cash-{$runId}-a", 'principal'),
                $this->startOpenWorker($runId, 'b', $startAt, "cash-{$runId}-b", 'ventanilla'),
            ];

            $this->waitForWorkers($workers);
            $results = $this->collectResults($workers);

            $opened = array_values(array_filter($results, static fn (array $row): bool => ($row['outcome'] ?? null) === 'opened'));
            $this->assertCount(2, $opened, 'Dos cajas distintas deben poder abrir a la vez. Resultados: '.json_encode($results));
            $this->assertSame(1, (int) DB::table('cash_register_sessions')->where('cash_register_id', $primary)->where('open_marker', 1)->count());
            $this->assertSame(1, (int) DB::table('cash_register_sessions')->where('cash_register_id', $secondary)->where('open_marker', 1)->count());
        } finally {
            $this->cleanupRun($runId);
        }
    }

    public function test_same_user_cannot_hold_two_open_sessions_across_registers(): void
    {
        $this->ensureDatabaseSchema();
        $runId = bin2hex(random_bytes(4));

        try {
            $this->register('principal');
            $this->register('ventanilla');
            $this->cashier("cash-{$runId}-same");

            $startAt = microtime(true) + 4.0;
            $workers = [
                $this->startOpenWorker($runId, 'a', $startAt, "cash-{$runId}-same", 'principal'),
                $this->startOpenWorker($runId, 'b', $startAt, "cash-{$runId}-same", 'ventanilla'),
            ];

            $this->waitForWorkers($workers);
            $results = $this->collectResults($workers);

            $opened = array_values(array_filter($results, static fn (array $row): bool => ($row['outcome'] ?? null) === 'opened'));
            $rejected = array_values(array_filter($results, static fn (array $row): bool => ($row['outcome'] ?? null) === 'rejected'));

            $this->assertCount(1, $opened, 'Un usuario no puede mantener dos sesiones abiertas. Resultados: '.json_encode($results));
            $this->assertCount(1, $rejected);
            $this->assertStringContainsString(
                'usted ya tiene',
                strtolower(json_encode($rejected[0]['errors'] ?? [])),
                'El rechazo debe venir del unique(open_user_id): el usuario ya tiene una caja abierta.',
            );

            $userId = (int) User::query()->where('username', "cash-{$runId}-same")->value('id');
            $this->assertSame(
                1,
                (int) DB::table('cash_register_sessions')->where('open_user_id', $userId)->count(),
                'unique(open_user_id) debe conservarse.',
            );
        } finally {
            $this->cleanupRun($runId);
        }
    }

    public function test_close_and_payment_race_never_leaves_a_posted_payment_on_a_closed_session(): void
    {
        $this->ensureDatabaseSchema();
        $runId = bin2hex(random_bytes(4));

        try {
            $registerId = $this->register('principal');
            $secondaryRegisterId = $this->register('ventanilla');
            $cashier = $this->cashier("cash-{$runId}-race");
            $sessionId = $this->openSession($cashier, $registerId);

            // La factura pertenece a OTRA caja (el esquema exige caja en una
            // factura pagada). Para la conciliacion de esta sesion no esta
            // pendiente, asi que el cierre puede ganar; si el cobro gana, la
            // factura queda pagada con un pago en esta sesion y el cierre debe
            // rechazarse por recibo institucional faltante.
            $otherCashier = $this->cashier("cash-{$runId}-other");
            $otherSessionId = $this->openSession($otherCashier, $secondaryRegisterId);
            $invoiceId = $this->issuedInvoice($runId, 'u', $cashier->id, $otherSessionId, '10.00');

            $startAt = microtime(true) + 4.0;
            $workers = [
                $this->startClosePaymentWorker($runId, 'close', $startAt, $cashier->username, $sessionId, $invoiceId, '10.00'),
                $this->startClosePaymentWorker($runId, 'pay', $startAt, $cashier->username, $sessionId, $invoiceId, '10.00'),
            ];

            $this->waitForWorkers($workers);
            $results = $this->collectResults($workers);

            $status = (string) DB::table('cash_register_sessions')->where('id', $sessionId)->value('status');
            $postedPayments = (int) DB::table('payments')
                ->where('cash_session_id', $sessionId)
                ->where('status', 'posted')
                ->count();

            // Invariante central: jamas un pago publicado sobre una caja cerrada.
            if ($postedPayments > 0) {
                $this->assertSame('open', $status, 'Un pago publicado no puede pertenecer a una caja cerrada. Resultados: '.json_encode($results));
            }

            if ($status === 'closed') {
                $this->assertSame(0, $postedPayments, 'La caja cerrada no puede contener pagos publicados.');
                $row = (array) DB::table('cash_register_sessions')->where('id', $sessionId)->first();
                $this->assertNull($row['open_marker']);
                $this->assertNull($row['open_user_id']);
            }

            $openingCents = (int) round(((float) '0.00') * 100);
            $cashCents = (int) DB::table('payments')
                ->where('cash_session_id', $sessionId)
                ->where('status', 'posted')
                ->where('method', 'cash')
                ->sum('amount_cents');
            $expected = DB::table('cash_register_sessions')->where('id', $sessionId)->value('expected_amount');
            if ($status === 'closed') {
                $this->assertSame(
                    $openingCents + $cashCents,
                    (int) round(((float) $expected) * 100),
                    'El esperado de una caja cerrada debe reconciliar con sus pagos en efectivo.',
                );
            }
        } finally {
            $this->cleanupRun($runId);
        }
    }

    public function test_retry_with_the_same_idempotency_key_after_commit_replays_without_duplicate(): void
    {
        $this->ensureDatabaseSchema();
        $runId = bin2hex(random_bytes(4));

        try {
            $this->register('principal');
            $cashier = $this->cashier("cash-{$runId}-idem");
            $cashier->givePermissionTo(Permission::findOrCreate('cash.open', 'web'));
            $cashier->givePermissionTo(Permission::findOrCreate('cash.view', 'web'));

            $key = "idem-{$runId}";
            $body = ['opening_amount' => '50.00'];
            $headers = ['Idempotency-Key' => $key];

            $first = $this->actingAs($cashier)->postJson('/api/cash-sessions/open', $body, $headers);
            $first->assertCreated();
            $sessionId = $first->json('data.id');
            $this->assertNotEmpty($sessionId);

            // Retry del navegador despues del commit: misma clave y mismo cuerpo.
            $second = $this->actingAs($cashier)->postJson('/api/cash-sessions/open', $body, $headers);
            $second->assertCreated();
            $this->assertSame($sessionId, $second->json('data.id'), 'El replay debe devolver la misma sesion, no una nueva.');
            $this->assertSame('true', (string) $second->headers->get('Idempotent-Replay'));

            $this->assertSame(1, (int) DB::table('cash_register_sessions')->where('user_id', $cashier->id)->where('open_marker', 1)->count());
            $this->assertSame(1, (int) DB::table('cash_movements')->where('cash_session_id', $sessionId)->where('type', 'opening')->count());
        } finally {
            $this->cleanupRun($runId);
        }
    }

    public function test_close_preserves_opened_at_and_releases_the_register_slot(): void
    {
        $this->ensureDatabaseSchema();
        $runId = bin2hex(random_bytes(4));

        try {
            $registerId = $this->register('principal');
            $cashier = $this->cashier("cash-{$runId}-close");
            $sessionId = $this->openSession($cashier, $registerId);

            $openedAtBefore = (string) DB::table('cash_register_sessions')->where('id', $sessionId)->value('opened_at');

            // Se documenta el entorno: si MariaDB no tuviera el ON UPDATE
            // implicito, esta prueba no demostraria que la neutralizacion sirve.
            $extra = (string) DB::table('information_schema.COLUMNS')
                ->where('TABLE_SCHEMA', DB::connection()->getDatabaseName())
                ->where('TABLE_NAME', 'cash_register_sessions')
                ->where('COLUMN_NAME', 'opened_at')
                ->value('EXTRA');

            app(CloseCashSessionAction::class)->execute(
                CashRegisterSession::query()->findOrFail($sessionId),
                ['closing_amount' => '0.00'],
                $cashier,
            );

            $row = (array) DB::table('cash_register_sessions')->where('id', $sessionId)->first();
            $this->assertSame('closed', $row['status']);
            $this->assertNull($row['open_marker']);
            $this->assertNull($row['open_user_id']);
            $this->assertSame(
                $openedAtBefore,
                (string) $row['opened_at'],
                'opened_at debe sobrevivir al cierre (EXTRA schema='.$extra.').',
            );
        } finally {
            $this->cleanupRun($runId);
        }
    }

    private function skipReason(): ?string
    {
        if (getenv('HOSPITAL_RUN_CONCURRENT_TESTS') !== '1') {
            return 'Set HOSPITAL_RUN_CONCURRENT_TESTS=1 to enable the real multi-process cash concurrency tests.';
        }

        $connection = getenv('DB_CONNECTION');
        if (! in_array($connection, ['mysql', 'mariadb'], true)) {
            return 'Requires a real MySQL/MariaDB DB_CONNECTION; the SQLite in-memory suite cannot reproduce lock contention.';
        }

        foreach (['DB_HOST', 'DB_PORT', 'DB_DATABASE', 'DB_USERNAME'] as $key) {
            $value = getenv($key);
            if ($value === false || $value === '') {
                return "Requires {$key} to point at a disposable MySQL/MariaDB database.";
            }
        }

        if (! str_starts_with((string) getenv('DB_DATABASE'), 's_hospital_test_')) {
            return 'Disposable database must use the s_hospital_test_ prefix enforced by Tests\\TestCase.';
        }

        if (! function_exists('proc_open')) {
            return 'proc_open is disabled in this PHP runtime; independent worker processes cannot be spawned.';
        }

        return null;
    }

    private function ensureDatabaseSchema(): void
    {
        if (Schema::hasTable('invoices')) {
            return;
        }

        $exitCode = Artisan::call('migrate', ['--force' => true]);

        $this->assertSame(
            0,
            $exitCode,
            'Disposable database schema could not be created with `migrate`: '.PHP_EOL.Artisan::output(),
        );
    }

    private function register(string $code): int
    {
        $existing = DB::table('cash_registers')->where('code', $code)->value('id');

        if ($existing !== null) {
            return (int) $existing;
        }

        return (int) DB::table('cash_registers')->insertGetId([
            'code' => $code,
            'name' => 'Caja '.$code,
            'active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function cashier(string $username): User
    {
        return User::query()->create([
            'username' => $username,
            'name' => $username,
            'email' => $username.'@hospital.local',
            'password' => bcrypt('testing-only'),
            'active' => true,
            'must_change_password' => false,
        ]);
    }

    private function openSession(User $cashier, int $registerId): int
    {
        return (int) DB::table('cash_register_sessions')->insertGetId([
            'cash_register_id' => $registerId,
            'open_marker' => 1,
            'user_id' => $cashier->id,
            'open_user_id' => $cashier->id,
            'opening_amount' => '0.00',
            'status' => 'open',
            'opened_at' => now(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function issuedInvoice(string $runId, string $suffix, int $userId, ?int $sessionId, string $total): int
    {
        $cents = (int) round(((float) $total) * 100);
        $sequenceId = $this->fiscalSequenceId($runId);

        return (int) DB::table('invoices')->insertGetId([
            'invoice_number' => "CASH-{$runId}-{$suffix}",
            'fiscal_sequence_id' => $sequenceId,
            'patient_name' => "Race {$runId}",
            'subtotal' => $total,
            'subtotal_cents' => $cents,
            'tax_amount' => '0.00',
            'tax_amount_cents' => 0,
            'discount_amount' => '0.00',
            'discount_amount_cents' => 0,
            'total' => $total,
            'total_cents' => $cents,
            'paid_amount' => '0.00',
            'paid_amount_cents' => 0,
            'balance_due' => $total,
            'balance_due_cents' => $cents,
            'status' => 'issued',
            'cash_session_id' => $sessionId,
            'issued_by' => $userId,
            'issued_at' => now(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function fiscalSequenceId(string $runId): int
    {
        $existing = DB::table('fiscal_sequences')->where('prefix', "CASH-{$runId}")->value('id');

        if ($existing !== null) {
            return (int) $existing;
        }

        return (int) DB::table('fiscal_sequences')->insertGetId([
            'document_type' => 'invoice',
            'prefix' => "CASH-{$runId}",
            'min_number' => 1,
            'max_number' => 99999999,
            'current_number' => 0,
            'cai' => "CASH-CAI-{$runId}",
            'valid_until' => now()->addYear()->toDateString(),
            'active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function startOpenWorker(string $runId, string $worker, float $startAt, string $username, string $registerCode): Process
    {
        return $this->startWorker('cash_open_worker.php', $runId, $worker, $startAt, [
            'HOSPITAL_RACE_USERNAME' => $username,
            'HOSPITAL_RACE_REGISTER_CODE' => $registerCode,
        ]);
    }

    private function startClosePaymentWorker(
        string $runId,
        string $role,
        float $startAt,
        string $username,
        int $sessionId,
        int $invoiceId,
        string $amount,
    ): Process {
        return $this->startWorker('cash_close_payment_worker.php', $runId, $role, $startAt, [
            'HOSPITAL_RACE_ROLE' => $role,
            'HOSPITAL_RACE_USERNAME' => $username,
            'HOSPITAL_RACE_SESSION_ID' => (string) $sessionId,
            'HOSPITAL_RACE_INVOICE_ID' => (string) $invoiceId,
            'HOSPITAL_RACE_AMOUNT' => $amount,
        ]);
    }

    /**
     * @param  array<string, string>  $extra
     */
    private function startWorker(string $script, string $runId, string $worker, float $startAt, array $extra): Process
    {
        $process = new Process(
            [PHP_BINARY, base_path('tests/Concurrent/'.$script)],
            base_path(),
            $this->buildWorkerEnv($runId, $worker, $startAt, $extra),
            null,
            90,
        );

        $process->start();

        return $process;
    }

    /**
     * @param  list<Process>  $workers
     */
    private function waitForWorkers(array $workers): void
    {
        try {
            foreach ($workers as $worker) {
                $worker->wait();
            }
        } catch (ProcessTimedOutException $exception) {
            foreach ($workers as $worker) {
                if ($worker->isRunning()) {
                    $worker->stop(1);
                }
            }

            $this->fail('Concurrent workers timed out: '.$exception->getMessage());
        }
    }

    /**
     * @param  list<Process>  $workers
     * @return list<array<string, mixed>>
     */
    private function collectResults(array $workers): array
    {
        $results = [];

        foreach ($workers as $index => $worker) {
            $this->assertSame(
                0,
                $worker->getExitCode(),
                "Worker #{$index} failed:".PHP_EOL.$worker->getErrorOutput().$worker->getOutput(),
            );

            foreach ($this->parseLines($worker->getOutput()) as $row) {
                $results[] = $row;
            }
        }

        return $results;
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function parseLines(string $stdout): array
    {
        $rows = [];

        foreach (preg_split('/\R/', $stdout) ?: [] as $line) {
            $line = trim($line);
            if ($line === '' || ! str_starts_with($line, '{')) {
                continue;
            }

            $decoded = json_decode($line, true);
            if (is_array($decoded)) {
                $rows[] = $decoded;
            }
        }

        return $rows;
    }

    /**
     * @param  array<string, string>  $extra
     * @return array<string, string>
     */
    private function buildWorkerEnv(string $runId, string $worker, float $startAt, array $extra): array
    {
        $env = array_merge([
            'HOSPITAL_RACE_RUN_ID' => $runId,
            'HOSPITAL_RACE_WORKER' => $worker,
            'HOSPITAL_RACE_START_AT' => sprintf('%.6F', $startAt),
        ], $extra);

        foreach (['DB_CONNECTION', 'DB_HOST', 'DB_PORT', 'DB_DATABASE', 'DB_USERNAME', 'DB_PASSWORD'] as $key) {
            $value = getenv($key);
            if ($value !== false) {
                $env[$key] = $value;
            }
        }

        return array_merge($env, [
            'APP_ENV' => 'testing',
            'APP_KEY' => 'base64:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
            'CACHE_STORE' => 'array',
            'SESSION_DRIVER' => 'array',
            'QUEUE_CONNECTION' => 'sync',
            'BROADCAST_CONNECTION' => 'null',
        ]);
    }

    /**
     * Higiene del arnes: la base es desechable y la aplicacion nunca borra
     * facturas; aqui se limpian las filas sinteticas de esta corrida para que
     * repetir la suite no acumule fixtures.
     */
    private function cleanupRun(string $runId): void
    {
        try {
            $userIds = User::query()->where('username', 'like', "cash-{$runId}-%")->pluck('id')->all();

            $sessionIds = $userIds === []
                ? []
                : DB::table('cash_register_sessions')->whereIn('user_id', $userIds)->pluck('id')->all();

            $invoiceIds = $userIds === []
                ? []
                : DB::table('invoices')->whereIn('issued_by', $userIds)->pluck('id')->all();

            if ($sessionIds !== []) {
                $extra = DB::table('invoices')->whereIn('cash_session_id', $sessionIds)->pluck('id')->all();
                $invoiceIds = array_values(array_unique(array_merge($invoiceIds, $extra)));
            }

            if ($invoiceIds !== []) {
                DB::table('institutional_receipt_print_events')
                    ->whereIn('institutional_receipt_id', function ($query) use ($invoiceIds): void {
                        $query->select('id')->from('institutional_receipts')->whereIn('invoice_id', $invoiceIds);
                    })
                    ->delete();
                // institutional_receipts.payment_id -> payments: primero el recibo.
                DB::table('institutional_receipts')->whereIn('invoice_id', $invoiceIds)->delete();
                DB::table('invoice_items')->whereIn('invoice_id', $invoiceIds)->delete();
            }

            if ($sessionIds !== []) {
                // cash_movements.payment_id -> payments y .cash_session_id -> sessions:
                // los movimientos se borran antes que pagos y sesiones.
                DB::table('cash_movements')->whereIn('cash_session_id', $sessionIds)->delete();
            }

            if ($userIds !== []) {
                DB::table('cash_movements')->whereIn('user_id', $userIds)->delete();
                DB::table('payments')->whereIn('user_id', $userIds)->delete();
            }

            if ($invoiceIds !== []) {
                DB::table('payments')->whereIn('invoice_id', $invoiceIds)->delete();
            }

            if ($sessionIds !== []) {
                DB::table('payments')->whereIn('cash_session_id', $sessionIds)->delete();
            }

            if ($invoiceIds !== []) {
                DB::table('invoices')->whereIn('id', $invoiceIds)->delete();
            }

            if ($sessionIds !== []) {
                DB::table('cash_register_sessions')->whereIn('id', $sessionIds)->delete();
            }

            DB::table('fiscal_sequences')->where('prefix', "CASH-{$runId}")->delete();

            if ($userIds !== []) {
                DB::table('idempotency_keys')->whereIn('user_id', $userIds)->delete();
                DB::table('model_has_permissions')->whereIn('model_id', $userIds)->delete();
                DB::table('model_has_roles')->whereIn('model_id', $userIds)->delete();
                AuditAdmin::run(fn (): int => DB::table('audit_logs')->whereIn('user_id', $userIds)->delete());
                DB::table('users')->whereIn('id', $userIds)->delete();
            }
        } catch (\Throwable $exception) {
            // Best effort: the external database is disposable and owned by
            // this harness. Never mask the test result with cleanup.
            fwrite(STDERR, '[CashSessionConcurrencyTest] cleanup warning: '.$exception->getMessage().PHP_EOL);
        }
    }
}
