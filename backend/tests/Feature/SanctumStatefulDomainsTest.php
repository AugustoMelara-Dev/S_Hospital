<?php

declare(strict_types=1);

namespace Tests\Feature;

use Illuminate\Http\Request;
use Laravel\Sanctum\Http\Middleware\EnsureFrontendRequestsAreStateful;
use RuntimeException;
use Tests\TestCase;

class SanctumStatefulDomainsTest extends TestCase
{
    /**
     * @var array<string, string|false>
     */
    private array $previousEnvironment = [];

    protected function tearDown(): void
    {
        foreach ($this->previousEnvironment as $key => $value) {
            if ($value === false) {
                putenv($key);
                unset($_ENV[$key], $_SERVER[$key]);
            } else {
                putenv("{$key}={$value}");
                $_ENV[$key] = $value;
                $_SERVER[$key] = $value;
            }
        }

        $this->previousEnvironment = [];

        parent::tearDown();
    }

    public function test_tls_dns_origin_is_added_to_the_stateful_domains_in_production(): void
    {
        $config = $this->loadSanctumConfig([
            'APP_ENV' => 'production',
            'APP_URL' => 'https://hospital.local',
            'CORS_ALLOWED_ORIGINS' => 'https://hospital.local',
            'SANCTUM_STATEFUL_DOMAINS' => '192.168.1.10,192.168.1.10:8000',
        ]);

        $stateful = $config['stateful'];

        $this->assertContains('hospital.local', $stateful);
        $this->assertContains('192.168.1.10', $stateful);
        $this->assertContains('192.168.1.10:8000', $stateful);
    }

    public function test_stateful_middleware_accepts_the_tls_dns_origin_after_derivation(): void
    {
        $request = Request::create(
            'https://hospital.local/api/auth/session',
            'GET',
            [],
            [],
            [],
            ['HTTP_REFERER' => 'https://hospital.local/login']
        );

        // Scenario that failed before the fix: the TLS overlay listed only the
        // SERVER_IP forms, so the DNS origin was not stateful.
        config(['sanctum.stateful' => ['192.168.1.10', '192.168.1.10:8000']]);
        $this->assertFalse(EnsureFrontendRequestsAreStateful::fromFrontend($request));

        $config = $this->loadSanctumConfig([
            'APP_ENV' => 'production',
            'APP_URL' => 'https://hospital.local',
            'CORS_ALLOWED_ORIGINS' => 'https://hospital.local',
            'SANCTUM_STATEFUL_DOMAINS' => '192.168.1.10,192.168.1.10:8000',
        ]);
        config(['sanctum.stateful' => $config['stateful']]);

        $this->assertTrue(EnsureFrontendRequestsAreStateful::fromFrontend($request));
    }

    public function test_tls_origin_with_a_custom_port_keeps_host_and_host_port(): void
    {
        $config = $this->loadSanctumConfig([
            'APP_ENV' => 'production',
            'APP_URL' => 'https://hospital.local:8443',
            'CORS_ALLOWED_ORIGINS' => '',
            'SANCTUM_STATEFUL_DOMAINS' => '192.168.1.10',
        ]);

        $this->assertContains('hospital.local', $config['stateful']);
        $this->assertContains('hospital.local:8443', $config['stateful']);
    }

    public function test_default_https_port_keeps_only_the_bare_host(): void
    {
        $config = $this->loadSanctumConfig([
            'APP_ENV' => 'production',
            'APP_URL' => 'https://hospital.local:443',
            'CORS_ALLOWED_ORIGINS' => '',
            'SANCTUM_STATEFUL_DOMAINS' => '192.168.1.10',
        ]);

        $this->assertContains('hospital.local', $config['stateful']);
        $this->assertNotContains('hospital.local:443', $config['stateful']);
    }

    public function test_http_origin_with_a_custom_port_also_adds_the_host_port_form(): void
    {
        $config = $this->loadSanctumConfig([
            'APP_ENV' => 'production',
            'APP_URL' => 'http://hospital.local:8000',
            'CORS_ALLOWED_ORIGINS' => '',
            'SANCTUM_STATEFUL_DOMAINS' => '192.168.1.10',
        ]);

        $this->assertContains('hospital.local', $config['stateful']);
        $this->assertContains('hospital.local:8000', $config['stateful']);
    }

    public function test_wildcards_and_invalid_origins_are_ignored(): void
    {
        $config = $this->loadSanctumConfig([
            'APP_ENV' => 'production',
            'APP_URL' => 'https://hospital.local',
            'CORS_ALLOWED_ORIGINS' => '*,not a url,https://hospital.local',
            'SANCTUM_STATEFUL_DOMAINS' => '192.168.1.10',
        ]);

        $this->assertContains('hospital.local', $config['stateful']);
        $this->assertNotContains('*', $config['stateful']);
        $this->assertNotContains('not a url', $config['stateful']);
    }

    public function test_embedded_wildcard_origins_are_never_derived(): void
    {
        $config = $this->loadSanctumConfig([
            'APP_ENV' => 'production',
            'APP_URL' => 'https://*.x',
            'CORS_ALLOWED_ORIGINS' => 'https://hospital.local,https://*.evil.example,http://hosp*ital.local',
            'SANCTUM_STATEFUL_DOMAINS' => '192.168.1.10',
        ]);

        $this->assertContains('hospital.local', $config['stateful']);
        $this->assertNotContains('*.x', $config['stateful']);
        $this->assertNotContains('*.evil.example', $config['stateful']);
        $this->assertNotContains('hosp*ital.local', $config['stateful']);

        foreach ($config['stateful'] as $domain) {
            $this->assertStringNotContainsString('*', (string) $domain);
        }
    }

    public function test_embedded_wildcard_does_not_turn_unrelated_hosts_stateful(): void
    {
        $request = Request::create(
            'https://evil.x/api/auth/session',
            'GET',
            [],
            [],
            [],
            ['HTTP_REFERER' => 'https://evil.x/login']
        );

        $config = $this->loadSanctumConfig([
            'APP_ENV' => 'production',
            'APP_URL' => 'https://*.x',
            'CORS_ALLOWED_ORIGINS' => '',
            'SANCTUM_STATEFUL_DOMAINS' => '192.168.1.10',
        ]);

        config(['sanctum.stateful' => $config['stateful']]);

        // Before the hardening, `*.x` was derived and Str::is('*.x/*',
        // 'evil.x/login/') === true, so any host under .x became stateful.
        $this->assertFalse(EnsureFrontendRequestsAreStateful::fromFrontend($request));
    }

    public function test_schemeless_and_malformed_origins_are_not_derived(): void
    {
        $config = $this->loadSanctumConfig([
            'APP_ENV' => 'production',
            'APP_URL' => '//hospital.local',
            'CORS_ALLOWED_ORIGINS' => 'https://hospital local,not a url,*,ftp://hospital.local,https://hospital.local:0',
            'SANCTUM_STATEFUL_DOMAINS' => '192.168.1.10',
        ]);

        $this->assertSame(['192.168.1.10'], $config['stateful']);
    }

    public function test_production_fail_closed_is_not_bypassed_by_wildcard_origins(): void
    {
        $this->expectException(RuntimeException::class);

        $this->loadSanctumConfig([
            'APP_ENV' => 'production',
            'APP_URL' => 'https://*.hospital.local',
            'CORS_ALLOWED_ORIGINS' => 'https://*.hospital.local',
            'SANCTUM_STATEFUL_DOMAINS' => '',
        ]);
    }

    public function test_production_still_requires_explicit_stateful_domains(): void
    {
        $this->expectException(RuntimeException::class);

        $this->loadSanctumConfig([
            'APP_ENV' => 'production',
            'APP_URL' => 'https://hospital.local',
            'CORS_ALLOWED_ORIGINS' => 'https://hospital.local',
            'SANCTUM_STATEFUL_DOMAINS' => '',
        ]);
    }

    /**
     * @param  array<string, string>  $environment
     * @return array<string, mixed>
     */
    private function loadSanctumConfig(array $environment): array
    {
        foreach ($environment as $key => $value) {
            if (! array_key_exists($key, $this->previousEnvironment)) {
                $previous = getenv($key);
                $this->previousEnvironment[$key] = $previous === false ? false : $previous;
            }

            putenv("{$key}={$value}");
            $_ENV[$key] = $value;
            $_SERVER[$key] = $value;
        }

        return require base_path('config/sanctum.php');
    }
}
