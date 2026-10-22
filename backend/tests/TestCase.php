<?php

namespace Tests;

use Illuminate\Contracts\Console\Kernel;
use Illuminate\Foundation\Http\Middleware\ValidateCsrfToken;
use Illuminate\Foundation\Testing\RefreshDatabaseState;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Str;
use Illuminate\Testing\TestResponse;
use Spatie\Permission\PermissionRegistrar;

abstract class TestCase extends BaseTestCase
{
    protected bool $autoIdempotencyKeyForTests = true;

    /**
     * Opt-in flag for test classes that execute DDL on MySQL/MariaDB.
     *
     * MySQL/MariaDB issue an implicit COMMIT for DDL (ALTER/DROP/CREATE,
     * `migrate`, `migrate:fresh`, `Schema::drop`, ...). That commit breaks the
     * transaction RefreshDatabase opened for the running test, so its teardown
     * rollback no longer removes the rows it created and every later test in
     * the same process sees leaked data (for example the fiscal_settings
     * singleton row). When a class sets this flag the disposable schema is
     * rebuilt once after the class ends, right before the next test boots, so
     * the rest of the transactional suite runs against a clean migrated
     * database without paying a full migration for every test.
     */
    protected static bool $resetSchemaAfterDdl = false;

    /** Set by a DDL class in tearDownAfterClass; consumed by the next setUp. */
    private static bool $schemaDirtyAfterDdl = false;

    /**
     * Opt-in flag for classes whose own tests commit data on MySQL/MariaDB even
     * without explicit DDL (e.g. a command that seeds inside the test). The
     * disposable schema is rebuilt after every test of the class.
     */
    protected bool $resetSchemaPerTest = false;

    protected function setUp(): void
    {
        $this->forceTestingEnvironment();

        if (self::$schemaDirtyAfterDdl) {
            self::$schemaDirtyAfterDdl = false;

            // Only the external MySQL/MariaDB job can suffer the implicit DDL
            // commit; the SQLite :memory: fast path keeps its own schema.
            if (in_array(getenv('DB_CONNECTION'), ['mysql', 'mariadb'], true)) {
                $this->rebuildDisposableSchema();
            }
        }

        parent::setUp();

        $this->withoutMiddleware(ValidateCsrfToken::class);
        $this->withoutMiddleware(ThrottleRequests::class);

        config([
            'cache.default' => 'array',
            'permission.cache.store' => 'array',
        ]);

        app(PermissionRegistrar::class)->forgetCachedPermissions();

        $this->beforeApplicationDestroyed(function (): void {
            app(PermissionRegistrar::class)->forgetCachedPermissions();
        });
    }

    protected function tearDown(): void
    {
        if ($this->resetSchemaPerTest && $this->app !== null
            && in_array(getenv('DB_CONNECTION'), ['mysql', 'mariadb'], true)) {
            try {
                $connection = $this->app['db']->connection();

                $this->app->make(Kernel::class)
                    ->call('migrate:fresh', ['--force' => true]);

                RefreshDatabaseState::$migrated = true;

                // DDL committed behind Laravel's back; keep the teardown
                // rollback from failing on a missing transaction.
                if (method_exists($connection, 'setTransactionLevel')) {
                    $connection->setTransactionLevel(0);
                }
            } catch (\Throwable $exception) {
                fwrite(STDERR, '[TestCase] per-test schema reset failed: '.$exception->getMessage().PHP_EOL);
            }
        }

        parent::tearDown();
    }

    public static function tearDownAfterClass(): void
    {
        parent::tearDownAfterClass();

        if (static::$resetSchemaAfterDdl) {
            self::$schemaDirtyAfterDdl = true;
        }
    }

    /**
     * Rebuild the disposable schema outside any open transaction. A DDL test
     * left a committed transaction behind, so this runs a fresh application
     * boot before RefreshDatabase starts the next test transaction.
     */
    private function rebuildDisposableSchema(): void
    {
        try {
            $app = require dirname(__DIR__).'/bootstrap/app.php';
            $kernel = $app->make(Kernel::class);
            $kernel->bootstrap();

            $exitCode = $kernel->call('migrate:fresh', ['--force' => true]);

            if ($exitCode !== 0) {
                fwrite(STDERR, '[TestCase] migrate:fresh returned '.$exitCode.' while resetting after DDL.'.PHP_EOL);
            }

            RefreshDatabaseState::$migrated = true;
        } catch (\Throwable $exception) {
            fwrite(STDERR, '[TestCase] schema reset after DDL failed: '.$exception->getMessage().PHP_EOL);
        }
    }

    private function forceTestingEnvironment(): void
    {
        $allowExternalTestDatabase = getenv('HOSPITAL_TEST_ALLOW_EXTERNAL_DB') === '1';

        $values = [
            'APP_ENV' => 'testing',
            'APP_URL' => 'http://127.0.0.1:8000',
            'CACHE_STORE' => 'array',
            'CORS_ALLOWED_ORIGINS' => '',
            'CORS_ALLOWED_ORIGIN_PATTERNS' => '',
            'PUSHER_CLIENT_HOST' => '127.0.0.1',
            'PUSHER_CLIENT_PORT' => '6001',
            'PUSHER_CLIENT_SCHEME' => 'http',
            'QUEUE_CONNECTION' => 'sync',
            'SANCTUM_STATEFUL_DOMAINS' => '',
            'SESSION_DRIVER' => 'array',
            'HOSPITAL_BACKUP_ENCRYPTION_KEY' => 'testing-local-backup-encryption-key',
        ];

        if ($allowExternalTestDatabase) {
            $database = (string) getenv('DB_DATABASE');

            if (! str_starts_with($database, 's_hospital_test_')) {
                throw new \RuntimeException("Refusing external test database without safe s_hospital_test_ prefix: {$database}");
            }

            if (getenv('HOSPITAL_TEST_DB_ALREADY_MIGRATED') === '1') {
                RefreshDatabaseState::$migrated = true;
            }
        } else {
            $values += [
                'DB_CONNECTION' => 'sqlite',
                'DB_DATABASE' => ':memory:',
                'DB_URL' => '',
            ];
        }

        foreach ($values as $key => $value) {
            putenv("{$key}={$value}");
            $_ENV[$key] = $value;
            $_SERVER[$key] = $value;
        }
    }

    public function postJson($uri, array $data = [], array $headers = [], $options = 0): TestResponse
    {
        if ($this->autoIdempotencyKeyForTests && $this->routeRequiresIdempotencyForTest((string) $uri)) {
            $lowerHeaders = array_change_key_case($headers, CASE_LOWER);
            $defaultHeaders = property_exists($this, 'defaultHeaders') && is_array($this->defaultHeaders)
                ? array_change_key_case($this->defaultHeaders, CASE_LOWER)
                : [];

            if (! array_key_exists('idempotency-key', $lowerHeaders) && ! array_key_exists('idempotency-key', $defaultHeaders)) {
                $headers['Idempotency-Key'] = 'test-'.(string) Str::uuid();
            }
        }

        return parent::postJson($uri, $data, $headers, $options);
    }

    protected function withoutAutomaticIdempotencyKeyForTests(): void
    {
        $this->autoIdempotencyKeyForTests = false;
    }

    private function routeRequiresIdempotencyForTest(string $uri): bool
    {
        $path = parse_url($uri, PHP_URL_PATH) ?: $uri;
        $path = '/'.ltrim($path, '/');

        return $path === '/api/invoices'
            || $path === '/api/backups'
            || $path === '/api/cash-sessions/open'
            || $path === '/api/institutional-receipts'
            || preg_match('#^/api/cash-sessions/[^/]+/close$#', $path) === 1
            || preg_match('#^/api/invoices/[^/]+/payments$#', $path) === 1
            || preg_match('#^/api/invoices/[^/]+/void$#', $path) === 1
            || preg_match('#^/api/invoices/[^/]+/reverse$#', $path) === 1
            || preg_match('#^/api/invoices/[^/]+/payments/[^/]+/void$#', $path) === 1
            || preg_match('#^/api/payments/[^/]+/void$#', $path) === 1
            || preg_match('#^/api/invoices/[^/]+/reprint$#', $path) === 1
            || preg_match('#^/api/institutional-receipts/[^/]+/pdf$#', $path) === 1
            || preg_match('#^/api/institutional-receipts/[^/]+/print-events$#', $path) === 1;
    }
}
