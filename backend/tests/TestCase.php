<?php

namespace Tests;

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

    protected function setUp(): void
    {
        $this->forceTestingEnvironment();

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
