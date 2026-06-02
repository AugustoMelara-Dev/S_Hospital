<?php

declare(strict_types=1);

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CspReportControllerTest extends TestCase
{
    use RefreshDatabase;

    public function test_csp_endpoint_returns_security_headers(): void
    {
        $response = $this->get('/up');

        $response->assertOk();
        $this->assertSame('nosniff', $response->headers->get('X-Content-Type-Options'));
        $this->assertSame('DENY', $response->headers->get('X-Frame-Options'));
        $this->assertSame('same-origin', $response->headers->get('Referrer-Policy'));
        $this->assertSame('camera=(), microphone=(), geolocation=()', $response->headers->get('Permissions-Policy'));
        $this->assertNotEmpty($response->headers->get('Content-Security-Policy'));
        $this->assertNotEmpty($response->headers->get('Content-Security-Policy-Report-Only'));
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

    public function test_csp_report_endpoint_accepts_payload_and_returns_204(): void
    {
        $payload = json_encode([
            'csp-report' => [
                'document-uri' => 'http://127.0.0.1:8000/login',
                'violated-directive' => 'script-src',
                'blocked-uri' => 'eval',
            ],
        ]);

        $response = $this->call(
            'POST',
            '/api/system/csp-report',
            [],
            [],
            [],
            ['CONTENT_TYPE' => 'application/csp-report'],
            $payload ?: '{}',
        );

        $response->assertNoContent();
    }
}
