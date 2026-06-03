<?php

namespace Tests\Unit;

use Tests\TestCase;

class ProductionConfigDefaultsTest extends TestCase
{
    private function readConfig(string $relativePath): string
    {
        $path = __DIR__.'/../../config/'.$relativePath;

        $this->assertFileExists($path, "Expected config file to exist at {$path}");

        $contents = file_get_contents($path);

        $this->assertNotFalse($contents, "Could not read config file at {$path}");

        return $contents;
    }

    public function test_database_default_falls_back_to_mysql_not_sqlite(): void
    {
        $config = $this->readConfig('database.php');

        $this->assertStringContainsString(
            "'default' => env('DB_CONNECTION', 'mysql')",
            $config,
            'Database default must be mysql so a missing DB_CONNECTION env in production fails closed instead of silently using sqlite.'
        );
        $this->assertStringNotContainsString(
            "'default' => env('DB_CONNECTION', 'sqlite')",
            $config,
            'Database default must not be sqlite. The hospital billing system requires MySQL/MariaDB.'
        );
    }

    public function test_queue_connections_defer_jobs_until_after_commit(): void
    {
        $config = $this->readConfig('queue.php');

        foreach (['database', 'beanstalkd', 'sqs', 'redis'] as $connection) {
            $block = $this->extractConnectionBlock($config, $connection);

            $this->assertStringContainsString(
                "'after_commit' => true",
                $block,
                "Queue connection '{$connection}' must declare 'after_commit' => true so jobs dispatched inside a DB transaction are not orphaned on rollback."
            );
        }
    }

    public function test_sync_queue_connection_does_not_apply_after_commit_semantics(): void
    {
        $config = $this->readConfig('queue.php');

        $this->assertStringContainsString(
            "'sync' => [\n            'driver' => 'sync',\n        ]",
            $config,
            'Sync queue driver must remain synchronous and should not be wrapped in after_commit semantics.'
        );
    }

    private function extractConnectionBlock(string $config, string $connection): string
    {
        $marker = "'{$connection}' => [";
        $start = strpos($config, $marker);

        $this->assertNotFalse($start, "Queue connection '{$connection}' block not found in config/queue.php");

        $depth = 0;
        $offset = $start;
        $length = strlen($config);

        while ($offset < $length) {
            $char = $config[$offset];
            if ($char === '[') {
                $depth++;
            } elseif ($char === ']') {
                $depth--;
                if ($depth === 0) {
                    return substr($config, $start, $offset - $start + 1);
                }
            }
            $offset++;
        }

        $this->fail("Queue connection '{$connection}' block is not properly closed in config/queue.php");

        return '';
    }
}
