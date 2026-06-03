<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Http\Controllers\CspReportController;
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

    public function test_csp_report_endpoint_rejects_oversized_payloads(): void
    {
        $payload = str_repeat('a', 5000);

        $response = $this->call(
            'POST',
            '/api/system/csp-report',
            [],
            [],
            [],
            ['CONTENT_TYPE' => 'application/csp-report'],
            $payload,
        );

        $response->assertStatus(413);
    }

    public function test_csp_report_endpoint_rejects_unexpected_content_types(): void
    {
        $response = $this->call(
            'POST',
            '/api/system/csp-report',
            [],
            [],
            [],
            ['CONTENT_TYPE' => 'text/plain'],
            'hello world',
        );

        $response->assertStatus(415);
    }

    public function test_csp_report_endpoint_scrubs_secrets_and_urls(): void
    {
        $controller = new CspReportController;
        $reflection = new \ReflectionMethod($controller, 'scrub');
        $reflection->setAccessible(true);

        $scrubbed = $reflection->invoke(
            $controller,
            'PASSWORD=MyPassword123 https://hospital.local/login?token=SECRET123',
        );

        $this->assertStringContainsString('PASSWORD=[redacted]', $scrubbed);
        $this->assertStringNotContainsString('MyPassword123', $scrubbed);
        $this->assertStringContainsString('[url-redacted]', $scrubbed);
        $this->assertStringNotContainsString('SECRET123', $scrubbed);
    }

    public function test_csp_report_endpoint_is_rate_limited(): void
    {
        $routes = app('router')->getRoutes();
        $route = null;

        foreach ($routes as $candidate) {
            if ($candidate->uri() === 'api/system/csp-report') {
                $route = $candidate;
                break;
            }
        }

        $this->assertNotNull($route, 'api/system/csp-report route must exist');
        $this->assertContains('throttle:30,1', $route->middleware(), 'csp-report must be rate limited');
    }
}
