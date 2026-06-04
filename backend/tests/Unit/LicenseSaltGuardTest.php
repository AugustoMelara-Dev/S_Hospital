<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Providers\AppServiceProvider;
use RuntimeException;
use Tests\TestCase;

class LicenseSaltGuardTest extends TestCase
{
    public function test_short_or_missing_license_salt_passes_in_testing(): void
    {
        config()->set('app.license_salt', 'short');
        config()->set('app.env', 'testing');

        $provider = new AppServiceProvider($this->app);
        $provider->boot();

        $this->assertTrue(true);
    }

    public function test_short_license_salt_throws_in_production(): void
    {
        config()->set('app.license_salt', 'only-15-chars');
        $_ENV['APP_ENV'] = 'production';
        $_SERVER['APP_ENV'] = 'production';

        $provider = new AppServiceProvider($this->app);

        try {
            $provider->boot();
            $this->fail('Expected RuntimeException for short salt in production');
        } catch (RuntimeException $e) {
            $this->assertStringContainsString('HOSPITAL_LICENSE_SALT must be at least 32', $e->getMessage());
        } finally {
            $_ENV['APP_ENV'] = 'testing';
            $_SERVER['APP_ENV'] = 'testing';
        }
    }

    public function test_missing_license_salt_throws_in_production(): void
    {
        config()->set('app.license_salt', '');
        $_ENV['APP_ENV'] = 'production';
        $_SERVER['APP_ENV'] = 'production';

        $provider = new AppServiceProvider($this->app);

        try {
            $provider->boot();
            $this->fail('Expected RuntimeException for missing salt in production');
        } catch (RuntimeException $e) {
            $this->assertTrue(true);
        } finally {
            $_ENV['APP_ENV'] = 'testing';
            $_SERVER['APP_ENV'] = 'testing';
        }
    }

    public function test_long_enough_license_salt_passes_in_production(): void
    {
        config()->set('app.license_salt', str_repeat('a', 32));
        $_ENV['APP_ENV'] = 'production';
        $_SERVER['APP_ENV'] = 'production';

        $provider = new AppServiceProvider($this->app);

        try {
            $provider->boot();
            $this->assertTrue(true);
        } finally {
            $_ENV['APP_ENV'] = 'testing';
            $_SERVER['APP_ENV'] = 'testing';
        }
    }
}
