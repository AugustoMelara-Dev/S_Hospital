<?php

declare(strict_types=1);

namespace Tests\Feature\Concurrent;

use App\Models\AuditLog;
use App\Models\FiscalSequence;
use App\Models\Invoice;
use App\Models\User;
use App\Support\AuditAdmin;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use PHPUnit\Framework\Attributes\Group;
use Symfony\Component\Process\Exception\ProcessTimedOutException;
use Symfony\Component\Process\Process;
use Tests\TestCase;

/**
 * Real-concurrency smoke for the durable legacy reprint counter (T3-004).
 *
 * Launches TWO independent PHP CLI processes (Symfony Process over proc_open)
 * against a real MySQL/MariaDB database. Both workers wait on a shared
 * wall-clock instant and then call App\Actions\Receipts\ReprintReceiptAction on
 * the same invoice. The action serialises the counter increment with
 * lockForUpdate() over the invoices row; this test proves the lock really hands
 * out #1 and #2 without repeats nor gaps.
 *
 * The SQLite in-memory suite shares a single connection and cannot reproduce
 * lock contention, so this test is gated and skipped by default.
 *
 * Run it explicitly:
 *   HOSPITAL_RUN_CONCURRENT_TESTS=1 \
 *     DB_CONNECTION=mysql DB_HOST=127.0.0.1 DB_PORT=3306 \
 *     DB_DATABASE=s_hospital_test_race DB_USERNAME=hospital \
 *     DB_PASSWORD=change-me
 *     vendor/bin/phpunit -c phpunit.mysql.xml --filter LegacyReprintRaceTest
 *
 * The test provisions its own synthetic invoice/user/sequence and removes them
 * afterwards; it never touches production data.
 */
#[Group('concurrent')]
class LegacyReprintRaceTest extends TestCase
{
    private ?int $createdSequenceId = null;

    private ?int $createdUserId = null;

    protected function setUp(): void
    {
        parent::setUp();

        $reason = $this->skipReason();
        if ($reason !== null) {
            $this->markTestSkipped($reason);
        }
    }

    public function test_two_processes_obtain_consecutive_durable_reprint_numbers(): void
    {
        $this->ensureDatabaseSchema();

        $invoiceId = $this->prepareDisposableBaseline();

        try {
            $startAt = microtime(true) + 5.0;
            $workerA = $this->startWorker($invoiceId, 'a', $startAt);
            $workerB = $this->startWorker($invoiceId, 'b', $startAt);

            $this->waitForWorkers([$workerA, $workerB]);

            $this->assertSame(
                0,
                $workerA->getExitCode(),
                'Worker A failed:'.PHP_EOL.$workerA->getErrorOutput().$workerA->getOutput(),
            );
            $this->assertSame(
                0,
                $workerB->getExitCode(),
                'Worker B failed:'.PHP_EOL.$workerB->getErrorOutput().$workerB->getOutput(),
            );

            $counters = array_merge(
                $this->parseCounters($workerA->getOutput()),
                $this->parseCounters($workerB->getOutput()),
            );

            sort($counters);

            $this->assertSame(
                [1, 2],
                $counters,
                'The row lock must hand out consecutive durable counters #1 and #2. Got: '.implode(',', $counters),
            );

            $labels = array_merge(
                $this->parseLabels($workerA->getOutput()),
                $this->parseLabels($workerB->getOutput()),
            );

            sort($labels);

            $this->assertSame(
                ['REIMPRESIÓN #1', 'REIMPRESIÓN #2'],
                $labels,
                'Each worker must emit the numbered label matching its durable counter. Got: '.implode(' | ', $labels),
            );

            $this->assertDatabaseHas('invoices', [
                'id' => $invoiceId,
                'legacy_reprint_count' => 2,
            ]);

            $this->assertSame(2, AuditLog::query()
                ->where('entity_type', Invoice::class)
                ->where('entity_id', $invoiceId)
                ->where('action', 'invoice.reprinted')
                ->count());
        } finally {
            $this->cleanupBaseline($invoiceId);
        }
    }

    private function skipReason(): ?string
    {
        if (getenv('HOSPITAL_RUN_CONCURRENT_TESTS') !== '1') {
            return 'Set HOSPITAL_RUN_CONCURRENT_TESTS=1 to enable the real two-process legacy reprint race test.';
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

        if (! function_exists('proc_open')) {
            return 'proc_open is disabled in this PHP runtime; two real CLI worker processes cannot be spawned.';
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

    private function prepareDisposableBaseline(): int
    {
        $runId = bin2hex(random_bytes(4));

        $user = User::factory()->create([
            'username' => "reprint-race-{$runId}",
            'name' => "Reprint Race {$runId}",
            'email' => "reprint-race-{$runId}@hospital.local",
            'must_change_password' => false,
            'active' => true,
        ]);
        $this->createdUserId = $user->id;

        $sequence = FiscalSequence::query()->create([
            'document_type' => 'invoice',
            'prefix' => "RR-{$runId}",
            'min_number' => 1,
            'max_number' => 99999999,
            'current_number' => 0,
            'cai' => "REPRINT-RACE-{$runId}",
            'valid_until' => now()->addYear()->toDateString(),
            'active' => false,
        ]);
        $this->createdSequenceId = $sequence->id;

        return Invoice::query()->create([
            'invoice_number' => 'RR-'.$runId,
            'fiscal_sequence_id' => $sequence->id,
            'patient_name' => "Paciente Carrera {$runId}",
            'subtotal' => '15.00',
            'subtotal_cents' => 1500,
            'tax_amount' => '2.25',
            'tax_amount_cents' => 225,
            'discount_amount' => '0.00',
            'discount_amount_cents' => 0,
            'total' => '17.25',
            'total_cents' => 1725,
            'paid_amount' => '0.00',
            'paid_amount_cents' => 0,
            'balance_due' => '17.25',
            'balance_due_cents' => 1725,
            'status' => Invoice::STATUS_ISSUED,
            'issued_by' => $user->id,
            'issued_at' => now(),
        ])->id;
    }

    private function startWorker(int $invoiceId, string $worker, float $startAt): Process
    {
        $script = base_path('tests/Concurrent/legacy_reprint_race_worker.php');

        $process = new Process(
            [PHP_BINARY, $script],
            base_path(),
            $this->buildWorkerEnv($invoiceId, $worker, $startAt),
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
     * @return array<string, string>
     */
    private function buildWorkerEnv(int $invoiceId, string $worker, float $startAt): array
    {
        $env = [
            'HOSPITAL_REPRINT_INVOICE_ID' => (string) $invoiceId,
            'HOSPITAL_REPRINT_USER_ID' => (string) $this->createdUserId,
            'HOSPITAL_REPRINT_WORKER' => $worker,
            'HOSPITAL_REPRINT_START_AT' => sprintf('%.6F', $startAt),
        ];

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
     * @return list<int>
     */
    private function parseCounters(string $stdout): array
    {
        $counters = [];
        foreach ($this->parseWorkerLines($stdout) as $decoded) {
            if (isset($decoded['legacy_reprint_count'])) {
                $counters[] = (int) $decoded['legacy_reprint_count'];
            }
        }

        return $counters;
    }

    /**
     * @return list<string>
     */
    private function parseLabels(string $stdout): array
    {
        $labels = [];
        foreach ($this->parseWorkerLines($stdout) as $decoded) {
            if (isset($decoded['copy_label']) && is_string($decoded['copy_label'])) {
                $labels[] = $decoded['copy_label'];
            }
        }

        return $labels;
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function parseWorkerLines(string $stdout): array
    {
        $decodedLines = [];
        foreach (preg_split('/\R/', $stdout) ?: [] as $line) {
            $line = trim($line);
            if ($line === '' || $line[0] !== '{') {
                continue;
            }

            $decoded = json_decode($line, true);
            if (is_array($decoded)) {
                $decodedLines[] = $decoded;
            }
        }

        return $decodedLines;
    }

    /**
     * Removes only the synthetic rows created by this test. The application
     * never deletes invoices; these raw FK-safe deletes are test hygiene inside
     * a disposable `s_hospital_test_` database.
     */
    private function cleanupBaseline(int $invoiceId): void
    {
        try {
            AuditAdmin::run(function () use ($invoiceId): void {
                DB::table('audit_logs')
                    ->where('entity_type', Invoice::class)
                    ->where('entity_id', $invoiceId)
                    ->delete();
            });

            DB::table('invoices')->where('id', $invoiceId)->delete();

            if ($this->createdSequenceId !== null) {
                DB::table('fiscal_sequences')->where('id', $this->createdSequenceId)->delete();
            }

            if ($this->createdUserId !== null) {
                AuditAdmin::run(function (): void {
                    DB::table('audit_logs')->where('user_id', $this->createdUserId)->delete();
                });
                DB::table('users')->where('id', $this->createdUserId)->delete();
            }
        } catch (\Throwable $exception) {
            // Cleanup is best effort: the external database is disposable and
            // the suite owns it. Never mask the test result with it.
            fwrite(STDERR, '[LegacyReprintRaceTest] cleanup warning: '.$exception->getMessage().PHP_EOL);
        } finally {
            $this->createdSequenceId = null;
            $this->createdUserId = null;
        }
    }
}
