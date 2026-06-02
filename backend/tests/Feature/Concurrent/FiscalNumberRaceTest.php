<?php

declare(strict_types=1);

namespace Tests\Feature\Concurrent;

use Symfony\Component\Process\Process;
use Tests\TestCase;

/**
 * Real-concurrency smoke for the fiscal correlative.
 *
 * This test launches two PHP processes that race to call
 * App\Actions\Billing\CreateInvoiceAction against a real MySQL/MariaDB
 * database (the in-memory SQLite driver used by the rest of the suite
 * serialises writes through its single connection, so it cannot
 * reproduce the lockForUpdate path under real contention).
 *
 * Run it explicitly:
 *   HOSPITAL_DB_CONNECTION=mysql HOSPITAL_DB_HOST=127.0.0.1 \
 *     HOSPITAL_DB_PORT=3306 HOSPITAL_DB_DATABASE=hospital_concurrent_test \
 *     vendor/bin/phpunit --group=concurrent --filter FiscalNumberRaceTest
 *
 * The test skips itself on Windows when MySQL is not configured so
 * regular CI runs are not blocked.
 */
class FiscalNumberRaceTest extends TestCase
{
    private const GROUP = 'concurrent';

    protected function setUp(): void
    {
        parent::setUp();

        if (! $this->canRun()) {
            $this->markTestSkipped(
                'Set HOSPITAL_RUN_CONCURRENT_TESTS=1 and provide a real MySQL/MariaDB '
                .'connection through the standard DB_* env variables to enable this race test.',
            );
        }
    }

    public function test_two_processes_obtain_distinct_fiscal_numbers(): void
    {
        $runId = 'race-'.bin2hex(random_bytes(4));
        $output = $this->spawnWorkers($runId);

        $this->assertSame(0, $output['exitCode'], "Worker harness exited non-zero:\n".$output['stderr']);

        $numbers = $this->parseInvoiceNumbers($output['stdout']);

        $this->assertCount(2, $numbers, 'Each process must emit exactly one invoice number. Got: '.implode(',', $numbers));
        $this->assertCount(
            2,
            array_unique($numbers),
            'Concurrent emissions must yield distinct correlatives. Got: '.implode(',', $numbers),
        );
    }

    /**
     * @return array{exitCode: int, stdout: string, stderr: string}
     */
    private function spawnWorkers(string $runId): array
    {
        $script = base_path('tests/Concurrent/fiscal_race_worker.php');
        $env = $this->buildWorkerEnv($runId);

        $process = new Process(['php', $script], base_path(), $env, null, 30);
        $process->run();

        return [
            'exitCode' => $process->getExitCode() ?? 1,
            'stdout' => $process->getOutput(),
            'stderr' => $process->getErrorOutput(),
        ];
    }

    /**
     * @return array<string, string>
     */
    private function buildWorkerEnv(string $runId): array
    {
        $env = [
            'HOSPITAL_RACE_RUN_ID' => $runId,
            'HOSPITAL_RACE_OUTPUT' => 'json',
        ];

        foreach (['DB_CONNECTION', 'DB_HOST', 'DB_PORT', 'DB_DATABASE', 'DB_USERNAME', 'DB_PASSWORD'] as $key) {
            $value = getenv($key);
            if ($value === false) {
                continue;
            }
            $env[$key] = $value;
        }

        return array_merge($env, [
            'APP_ENV' => 'testing',
            'APP_KEY' => 'base64:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
            'CACHE_STORE' => 'array',
            'SESSION_DRIVER' => 'array',
            'QUEUE_CONNECTION' => 'sync',
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

    private function canRun(): bool
    {
        if (getenv('HOSPITAL_RUN_CONCURRENT_TESTS') !== '1') {
            return false;
        }

        $required = ['DB_HOST', 'DB_PORT', 'DB_DATABASE', 'DB_USERNAME', 'DB_PASSWORD'];
        foreach ($required as $key) {
            if (getenv($key) === false || getenv($key) === '') {
                return false;
            }
        }

        if (getenv('DB_CONNECTION') === 'sqlite') {
            return false;
        }

        return true;
    }
}
