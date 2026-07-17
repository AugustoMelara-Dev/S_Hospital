<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SecurityHeadersTest extends TestCase
{
    use RefreshDatabase;

    public function test_security_headers_present_on_public_endpoints(): void
    {
        $endpoints = ['/up', '/api/health', '/login', '/verify-email', '/api/system/health'];

        foreach ($endpoints as $endpoint) {
            $response = $this->get($endpoint);
            $this->assertSame('nosniff', $response->headers->get('X-Content-Type-Options'), "X-Content-Type-Options missing on {$endpoint}");
            $this->assertSame('DENY', $response->headers->get('X-Frame-Options'), "X-Frame-Options missing on {$endpoint}");
            $this->assertSame('same-origin', $response->headers->get('Referrer-Policy'), "Referrer-Policy missing on {$endpoint}");
            $this->assertNotEmpty($response->headers->get('Permissions-Policy'), "Permissions-Policy missing on {$endpoint}");
        }
    }

    public function test_cross_origin_opener_policy_is_not_sent_on_plain_http_lan_ip(): void
    {
        $this
            ->get('http://192.168.1.3:8081/login')
            ->assertOk()
            ->assertHeaderMissing('Cross-Origin-Opener-Policy');

        $this
            ->get('http://127.0.0.1:8081/login')
            ->assertOk()
            ->assertHeader('Cross-Origin-Opener-Policy', 'same-origin');
    }

    public function test_csp_blocks_object_embeds_and_unwanted_frames(): void
    {
        $response = $this->get('/up');
        $csp = (string) $response->headers->get('Content-Security-Policy');

        $this->assertStringContainsString("object-src 'none'", $csp);
        $this->assertStringContainsString("frame-ancestors 'none'", $csp);
        $this->assertStringContainsString("base-uri 'self'", $csp);
        $this->assertStringContainsString("form-action 'self'", $csp);
    }

    public function test_csp_includes_manifest_src_and_connect_extensions(): void
    {
        $response = $this->get('/up');
        $csp = (string) $response->headers->get('Content-Security-Policy');

        $this->assertStringContainsString("manifest-src 'self'", $csp);
        $this->assertStringContainsString("connect-src 'self' ws://127.0.0.1:6001 wss://127.0.0.1:6001", $csp);
    }

    public function test_csp_rejects_invalid_websocket_authority_configuration(): void
    {
        config()->set('broadcasting.connections.pusher.client_options', [
            'host' => 'hospital.local ws://attacker.invalid',
            'port' => '70000',
        ]);

        $csp = (string) $this->get('/up')->headers->get('Content-Security-Policy');

        $this->assertStringContainsString("connect-src 'self'", $csp);
        $this->assertStringNotContainsString('attacker.invalid', $csp);
        $this->assertStringNotContainsString('ws://hospital.local', $csp);
    }

    public function test_csp_serializes_ipv6_websocket_authority_with_brackets(): void
    {
        config()->set('broadcasting.connections.pusher.client_options', [
            'host' => '::1',
            'port' => 7001,
        ]);

        $csp = (string) $this->get('/up')->headers->get('Content-Security-Policy');

        $this->assertStringContainsString("connect-src 'self' ws://[::1]:7001 wss://[::1]:7001", $csp);
    }

    public function test_csp_report_only_channel_points_at_the_csp_endpoint(): void
    {
        $response = $this->get('/up');
        $reportOnly = (string) $response->headers->get('Content-Security-Policy-Report-Only');

        $this->assertStringContainsString('report-uri /api/system/csp-report', $reportOnly);
    }

    public function test_csp_emits_a_per_request_nonce_for_scripts_and_declares_style_policy(): void
    {
        $first = $this->get('/up');
        $second = $this->get('/up');

        $firstCsp = (string) $first->headers->get('Content-Security-Policy');
        $secondCsp = (string) $second->headers->get('Content-Security-Policy');

        $this->assertMatchesRegularExpression("/script-src 'self' 'nonce-[A-Fa-f0-9]{32}'/", $firstCsp);
        $this->assertStringContainsString("style-src 'self' 'unsafe-inline'", $firstCsp);
        $this->assertStringContainsString("style-src-elem 'self' 'unsafe-inline'", $firstCsp);
        $this->assertStringNotContainsString("script-src 'self' 'unsafe-inline'", $firstCsp);

        preg_match("/'nonce-([A-Fa-f0-9]{32})'/", $firstCsp, $firstMatch);
        preg_match("/'nonce-([A-Fa-f0-9]{32})'/", $secondCsp, $secondMatch);

        $this->assertNotEmpty($firstMatch[1] ?? '');
        $this->assertNotEmpty($secondMatch[1] ?? '');
        $this->assertNotSame($firstMatch[1], $secondMatch[1], 'Nonce must rotate between requests.');
    }

    public function test_csp_in_production_keeps_scripts_strict_while_styles_remain_explicitly_allowed(): void
    {
        $this->app->detectEnvironment(fn () => 'production');

        $response = $this->get('/up');
        $csp = (string) $response->headers->get('Content-Security-Policy');

        $this->assertStringNotContainsString("'unsafe-eval'", $csp);
        $this->assertMatchesRegularExpression("/script-src 'self' 'nonce-[A-Fa-f0-9]{32}'/", $csp);
        $this->assertStringContainsString("style-src 'self' 'unsafe-inline'", $csp);
        $this->assertStringContainsString("style-src-elem 'self' 'unsafe-inline'", $csp);
    }

    public function test_authenticated_api_responses_are_not_indexable(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user, 'web')->getJson('/api/auth/me');

        $response->assertOk();
        $this->assertSame('noindex, nofollow, noarchive', $response->headers->get('X-Robots-Tag'));
    }
}
