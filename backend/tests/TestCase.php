<?php

namespace Tests;

use Illuminate\Foundation\Http\Middleware\ValidateCsrfToken;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Spatie\Permission\PermissionRegistrar;

abstract class TestCase extends BaseTestCase
{
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
        foreach ([
            'APP_ENV' => 'testing',
            'CACHE_STORE' => 'array',
            'DB_CONNECTION' => 'sqlite',
            'DB_DATABASE' => ':memory:',
            'DB_URL' => '',
            'QUEUE_CONNECTION' => 'sync',
            'SESSION_DRIVER' => 'array',
        ] as $key => $value) {
            putenv("{$key}={$value}");
            $_ENV[$key] = $value;
            $_SERVER[$key] = $value;
        }
    }
}
