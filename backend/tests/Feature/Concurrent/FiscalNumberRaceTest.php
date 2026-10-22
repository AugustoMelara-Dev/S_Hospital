<?php

declare(strict_types=1);

namespace Tests\Feature\Concurrent;

use App\Models\CashRegisterSession;
use App\Models\Category;
use App\Models\FiscalSequence;
use App\Models\FiscalSetting;
use App\Models\Invoice;
use App\Models\Service;
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
 * Real-concurrency smoke for the fiscal correlative.
 *
 * Launches TWO independent PHP CLI processes (Symfony Process over
 * proc_open) against a real MySQL/MariaDB database. Both workers wait on a
 * shared wall-clock instant and then race to call
 * App\Actions\Billing\CreateInvoiceAction, which serialises fiscal numbers
 * with lockForUpdate() over fiscal_sequences. The in-memory SQLite driver
 * used by the rest of the suite shares a single connection, so it cannot
 * reproduce this contention.
 *
 * The test prepares its own disposable baseline (category, service,
 * cashiers, cash sessions and an active fiscal sequence) instead of
 * depending on seeders, and removes it afterwards. Schema is created on
 * demand with `migrate` when a filtered run targets an empty database.
 *
 * Run it explicitly:
 *   HOSPITAL_RUN_CONCURRENT_TESTS=1 \
 *     DB_CONNECTION=mysql DB_HOST=127.0.0.1 DB_PORT=3306 \
 *     DB_DATABASE=s_hospital_test_race DB_USERNAME=hospital \
 *     DB_PASSWORD=change-me
 *     vendor/bin/phpunit -c phpunit.mysql.xml --group=concurrent
 *
 * An empty DB_PASSWORD is accepted (local XAMPP root). The test skips
 * itself with an explicit reason when the environment cannot provide a
 * real external database or proc_open is unavailable.
 */
#[Group('concurrent')]
class FiscalNumberRaceTest extends TestCase
{
    private ?int $createdFiscalSettingId = null;

    private ?int $createdFiscalSequenceId = null;

    protected function setUp(): void
    {
        parent::setUp();

        $reason = $this->skipReason();
        if ($reason !== null) {
            $this->markTestSkipped($reason);
        }
    }

    public function test_two_processes_obtain_distinct_fiscal_numbers(): void
    {
        $this->ensureDatabaseSchema();

        $runId = bin2hex(random_bytes(4));

        try {
            $this->prepareDisposableBaseline($runId);

            $startAt = microtime(true) + 5.0;
            $workerA = $this->startWorker($runId, 'a', $startAt);
            $workerB = $this->startWorker($runId, 'b', $startAt);

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

            $numbers = array_merge(
                $this->parseInvoiceNumbers($workerA->getOutput()),
                $this->parseInvoiceNumbers($workerB->getOutput()),
            );

            $this->assertCount(2, $numbers, 'Each process must emit exactly one invoice number. Got: '.implode(',', $numbers));
            $this->assertCount(2, array_unique($numbers), 'Concurrent emissions must yield distinct correlatives. Got: '.implode(',', $numbers));
            $this->assertGreaterThanOrEqual(1, min($numbers), 'Correlatives must stay inside the authorized range. Got: '.implode(',', $numbers));
            $this->assertSame(1, max($numbers) - min($numbers), 'A serialized lock must hand out consecutive correlatives. Got: '.implode(',', $numbers));
        } finally {
            $this->cleanupRun($runId);
        }
    }

    private function skipReason(): ?string
    {
        if (getenv('HOSPITAL_RUN_CONCURRENT_TESTS') !== '1') {
            return 'Set HOSPITAL_RUN_CONCURRENT_TESTS=1 to enable the real two-process fiscal race test.';
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

    private function prepareDisposableBaseline(string $runId): void
    {
        if (FiscalSetting::query()->doesntExist()) {
            $settings = FiscalSetting::query()->create([
                'hospital_name' => 'Hospital Race',
                'rtn' => '00000000000000',
                'default_tax_rate' => '15.00',
                'receipt_paper_size' => 'half_letter',
            ]);
            $this->createdFiscalSettingId = $settings->id;
        }

        $activeSequence = FiscalSequence::query()
            ->where('document_type', 'invoice')
            ->where('active', true)
            ->first();

        if ($activeSequence === null) {
            $sequence = FiscalSequence::query()->create([
                'document_type' => 'invoice',
                'prefix' => "RACE-{$runId}",
                'min_number' => 1,
                'max_number' => 99999999,
                'current_number' => 0,
                'cai' => "RACE-CAI-{$runId}",
                'valid_until' => now()->addYear()->toDateString(),
                'active' => true,
            ]);
            $this->createdFiscalSequenceId = $sequence->id;
        }

        $category = Category::query()->create([
            'name' => "Race {$runId}",
            'slug' => "race-{$runId}",
            'active' => true,
        ]);

        Service::query()->create([
            'category_id' => $category->id,
            'name' => "Race {$runId}",
            'slug' => "race-{$runId}",
            'price' => '10.00',
            'taxable' => true,
            'active' => true,
            'visible_in_billing' => true,
            'is_billable' => true,
        ]);

        foreach (['a', 'b'] as $worker) {
            $user = User::factory()->create([
                'username' => "race-{$runId}-{$worker}",
                'name' => "Race {$runId} {$worker}",
                'email' => "race-{$runId}-{$worker}@hospital.local",
                'must_change_password' => false,
                'active' => true,
            ]);

            CashRegisterSession::query()->create([
                'user_id' => $user->id,
                'open_user_id' => $user->id,
                'opening_amount' => '500.00',
                'status' => CashRegisterSession::STATUS_OPEN,
                'opened_at' => now(),
            ]);
        }
    }

    private function startWorker(string $runId, string $worker, float $startAt): Process
    {
        $script = base_path('tests/Concurrent/fiscal_race_worker.php');

        $process = new Process(
            [PHP_BINARY, $script],
            base_path(),
            $this->buildWorkerEnv($runId, $worker, $startAt),
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
    private function buildWorkerEnv(string $runId, string $worker, float $startAt): array
    {
        $env = [
            'HOSPITAL_RACE_RUN_ID' => $runId,
            'HOSPITAL_RACE_WORKER' => $worker,
            'HOSPITAL_RACE_START_AT' => sprintf('%.6F', $startAt),
            'HOSPITAL_RACE_OUTPUT' => 'json',
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
    private function parseInvoiceNumbers(string $stdout): array
    {
        $numbers = [];
        foreach (preg_split('/\R/', $stdout) ?: [] as $line) {
            $line = trim($line);
            if ($line === '' || ! str_contains($line, '"invoice_number"')) {
                continue;
            }

            $decoded = json_decode($line, true);
            if (! is_array($decoded) || ! isset($decoded['invoice_number'])) {
                continue;
            }

            $suffix = substr($decoded['invoice_number'], strrpos($decoded['invoice_number'], '-') + 1);
            $numbers[] = (int) $suffix;
        }

        return $numbers;
    }

    /**
     * Removes the synthetic rows created by this test.
     *
     * These rows were created seconds ago by this harness inside a
     * disposable external database (TestCase refuses DB_DATABASE values
     * without the `s_hospital_test_` prefix). The application never deletes
     * invoices; raw FK-safe deletes are used here only as test hygiene so
     * repeated runs do not accumulate fixtures in the disposable schema.
     */
    private function cleanupRun(string $runId): void
    {
        try {
            $userIds = User::query()
                ->where('username', 'like', "race-{$runId}-%")
                ->pluck('id')
                ->all();

            $invoiceIds = $userIds === []
                ? []
                : Invoice::query()->whereIn('issued_by', $userIds)->pluck('id')->all();

            if ($invoiceIds !== []) {
                DB::table('institutional_receipt_print_events')
                    ->whereIn('institutional_receipt_id', function ($query) use ($invoiceIds): void {
                        $query->select('id')->from('institutional_receipts')->whereIn('invoice_id', $invoiceIds);
                    })
                    ->delete();
                DB::table('institutional_receipts')->whereIn('invoice_id', $invoiceIds)->delete();
                DB::table('payments')->whereIn('invoice_id', $invoiceIds)->delete();
                DB::table('invoice_items')->whereIn('invoice_id', $invoiceIds)->delete();
                DB::table('invoices')->whereIn('id', $invoiceIds)->delete();
            }

            if ($userIds !== []) {
                DB::table('payments')->whereIn('user_id', $userIds)->delete();
                AuditAdmin::run(fn (): int => DB::table('audit_logs')->whereIn('user_id', $userIds)->delete());
                DB::table('cash_register_sessions')->whereIn('user_id', $userIds)->delete();
                DB::table('users')->whereIn('id', $userIds)->delete();
            }

            if ($this->createdFiscalSequenceId !== null) {
                $stillReferenced = DB::table('invoices')
                    ->where('fiscal_sequence_id', $this->createdFiscalSequenceId)
                    ->exists();

                if (! $stillReferenced) {
                    DB::table('fiscal_sequences')->where('id', $this->createdFiscalSequenceId)->delete();
                }
            }

            DB::table('services')->where('slug', "race-{$runId}")->delete();
            DB::table('categories')->where('slug', "race-{$runId}")->delete();

            if ($this->createdFiscalSettingId !== null) {
                DB::table('fiscal_settings')->where('id', $this->createdFiscalSettingId)->delete();
            }
        } catch (\Throwable $exception) {
            // Cleanup is best effort: the external database is disposable
            // and the suite owns it. Never mask the test result with it.
            fwrite(STDERR, '[FiscalNumberRaceTest] cleanup warning: '.$exception->getMessage().PHP_EOL);
        } finally {
            $this->createdFiscalSequenceId = null;
            $this->createdFiscalSettingId = null;
        }
    }
}
