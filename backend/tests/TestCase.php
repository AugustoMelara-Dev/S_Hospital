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
        parent::setUp();

        $this->withoutMiddleware(ValidateCsrfToken::class);
        $this->withoutMiddleware(ThrottleRequests::class);

        app(PermissionRegistrar::class)->forgetCachedPermissions();

        $this->beforeApplicationDestroyed(function (): void {
            app(PermissionRegistrar::class)->forgetCachedPermissions();
        });
    }
}
