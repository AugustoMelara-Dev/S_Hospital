<?php

declare(strict_types=1);

namespace Tests\Feature;

use Tests\TestCase;

class AppKeyRotationTest extends TestCase
{
    public function test_rotate_app_key_script_exists_and_uses_random_bytes(): void
    {
        $script = base_path('../scripts/rotate-app-key.ps1');
        $this->assertFileExists($script, 'rotate-app-key.ps1 must exist');

        $content = (string) file_get_contents($script);
        $this->assertStringContainsString('RandomNumberGenerator', $content, 'rotate-app-key.ps1 must use cryptographically strong RandomNumberGenerator');
        $this->assertStringContainsString('GetBytes', $content, 'rotate-app-key.ps1 must call GetBytes');
        $this->assertStringContainsString('base64:', $content, 'rotate-app-key.ps1 must produce base64: prefixed keys');
        $this->assertStringContainsString('WhatIf', $content, 'rotate-app-key.ps1 must support -WhatIf for safe preview');
        $this->assertStringContainsString('config:cache', $content, 'rotate-app-key.ps1 must refresh Laravel config cache');
    }

    public function test_root_env_has_non_placeholder_app_key(): void
    {
        $envPath = base_path('.env');
        if (! is_file($envPath)) {
            $this->markTestSkipped('No root .env present in this test environment.');
        }

        $content = (string) file_get_contents($envPath);
        if (! preg_match('/^APP_KEY=(.+)$/m', $content, $matches)) {
            $this->fail('APP_KEY not found in root .env');
        }

        $value = trim($matches[1]);
        $this->assertStringStartsWith('base64:', $value, 'APP_KEY must be base64-prefixed');
        $this->assertNotSame(
            'base64:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
            $value,
            'APP_KEY must not be the phpunit placeholder',
        );
        $this->assertGreaterThanOrEqual(40, strlen(substr($value, 7)), 'APP_KEY base64 payload must be at least 32 random bytes');
    }

    public function test_backend_phpunit_app_key_is_the_documented_placeholder(): void
    {
        // The phpunit.xml forces APP_KEY to a fixed placeholder for
        // deterministic encryption across runs. This test pins the
        // contract so a future refactor does not silently change it
        // and break the test suite.
        $phpunitXml = (string) file_get_contents(base_path('phpunit.xml'));
        $this->assertStringContainsString('APP_KEY" value="base64:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="', $phpunitXml);
    }

    public function test_no_env_real_production_secrets_in_tracked_templates(): void
    {
        $envTemplates = [
            base_path('.env.example'),
            base_path('backend/.env.example'),
            base_path('backend/.env.docker.example'),
            base_path('frontend/.env.example'),
        ];

        foreach ($envTemplates as $template) {
            if (! is_file($template)) {
                continue;
            }

            $content = (string) file_get_contents($template);

            // Examples must not contain real-looking secrets. A 32+ char
            // base64 key would be a red flag. The license salt must be
            // empty in templates.
            $this->assertDoesNotMatchRegularExpression(
                '/APP_KEY=base64:[A-Za-z0-9+\/=]{40,}/',
                $content,
                "$template must not contain a real APP_KEY"
            );

            if (str_contains($template, 'backend')) {
                $this->assertStringNotContainsString(
                    'HOSPITAL_LICENSE_SALT=production',
                    $content,
                    "$template must not pin a production license salt"
                );
            }
        }
    }
}
