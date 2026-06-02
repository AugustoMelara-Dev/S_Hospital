<?php

declare(strict_types=1);

namespace Tests\Feature;

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
        $this->assertStringContainsString("connect-src 'self' ws: wss:", $csp);
    }

    public function test_csp_report_only_channel_points_at_the_csp_endpoint(): void
    {
        $response = $this->get('/up');
        $reportOnly = (string) $response->headers->get('Content-Security-Policy-Report-Only');

        $this->assertStringContainsString('report-uri /api/system/csp-report', $reportOnly);
    }
}
