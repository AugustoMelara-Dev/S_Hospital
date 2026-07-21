<?php

namespace Tests\Feature;

use Illuminate\Session\Middleware\StartSession;
use Laravel\Sanctum\Http\Middleware\EnsureFrontendRequestsAreStateful;
use Tests\TestCase;

class HealthCheckTest extends TestCase
{
    public function test_up_endpoint_is_available(): void
    {
        $response = $this->get('/up');

        $response
            ->assertOk()
            ->assertJsonPath('status', 'ok')
            ->assertJsonPath('database', 'ok');
    }

    public function test_api_health_endpoint_returns_json(): void
    {
        $response = $this->getJson('/api/health');

        $response
            ->assertOk()
            ->assertJson([
                'status' => 'ok',
                'service' => 'Sistema de Caja Hospitalaria',
            ]);
    }

    public function test_responses_include_security_headers(): void
    {
        $this->getJson('/api/health')
            ->assertOk()
            ->assertHeader('X-Content-Type-Options', 'nosniff')
            ->assertHeader('X-Frame-Options', 'DENY')
            ->assertHeader('Referrer-Policy', 'same-origin')
            ->assertHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
            ->assertHeader('Content-Security-Policy');
    }

    public function test_local_vite_origin_can_request_sanctum_csrf_cookie(): void
    {
        $response = $this
            ->withHeaders([
                'Origin' => 'http://127.0.0.1:5173',
                'Access-Control-Request-Method' => 'GET',
            ])
            ->options('/sanctum/csrf-cookie');

        $response
            ->assertNoContent()
            ->assertHeader('Access-Control-Allow-Origin', 'http://127.0.0.1:5173')
            ->assertHeader('Access-Control-Allow-Credentials', 'true');

        $this->assertContains('127.0.0.1:5173', config('sanctum.stateful'));
    }

    public function test_lan_vite_origin_is_not_allowed_by_default_for_credentialed_cors(): void
    {
        $response = $this
            ->withHeaders([
                'Origin' => 'http://192.168.56.2:5173',
                'Access-Control-Request-Method' => 'GET',
            ])
            ->options('/sanctum/csrf-cookie');

        $response
            ->assertNoContent()
            ->assertHeaderMissing('Access-Control-Allow-Origin');
    }

    public function test_local_vite_preflight_allows_idempotency_header_and_exposes_paper_warning(): void
    {
        $response = $this
            ->withHeaders([
                'Origin' => 'http://127.0.0.1:5173',
                'Access-Control-Request-Method' => 'POST',
                'Access-Control-Request-Headers' => 'Idempotency-Key, X-XSRF-TOKEN',
            ])
            ->options('/api/invoices');

        $response
            ->assertNoContent()
            ->assertHeader('Access-Control-Allow-Origin', 'http://127.0.0.1:5173')
            ->assertHeader('Access-Control-Allow-Credentials', 'true');

        $allowedMethods = $response->headers->get('Access-Control-Allow-Methods', '');
        $allowedHeaders = strtolower($response->headers->get('Access-Control-Allow-Headers', ''));

        $this->assertStringContainsString('POST', $allowedMethods);
        $this->assertStringContainsString('idempotency-key', $allowedHeaders);
        $this->assertStringContainsString('x-xsrf-token', $allowedHeaders);

        $actualResponse = $this
            ->withHeaders(['Origin' => 'http://127.0.0.1:5173'])
            ->getJson('/api/health');

        $actualResponse
            ->assertOk()
            ->assertHeader('Access-Control-Allow-Origin', 'http://127.0.0.1:5173');

        $this->assertStringContainsString('X-S-Hospital-Paper-Size-Warning', $actualResponse->headers->get('Access-Control-Expose-Headers', ''));
    }

    public function test_health_endpoint_has_rate_limit_applied(): void
    {
        $routes = app('router')->getRoutes();
        $healthRoute = null;
        $upRoute = null;

        foreach ($routes as $route) {
            if ($route->uri() === 'api/system/health') {
                $healthRoute = $route;
            }
            if ($route->uri() === 'api/health') {
                $upRoute = $route;
            }
        }

        $this->assertNotNull($healthRoute, 'api/system/health route must exist');
        $this->assertNotNull($upRoute, 'api/health route must exist');
        $this->assertContains('throttle:public-read', $healthRoute->middleware(), 'api/system/health must use the isolated public-read bucket');
        $this->assertContains('throttle:public-read', $upRoute->middleware(), 'api/health must use the isolated public-read bucket');
    }

    public function test_public_operational_routes_do_not_start_sessions(): void
    {
        foreach (['api/health', 'api/system/health', 'api/system/echo-config', 'api/system/csp-report'] as $uri) {
            $route = collect(app('router')->getRoutes())
                ->first(fn ($candidate): bool => $candidate->uri() === $uri);

            $this->assertNotNull($route, "{$uri} route must exist");
            $this->assertNotContains(EnsureFrontendRequestsAreStateful::class, $route->gatherMiddleware(), "{$uri} must not rotate SPA session cookies.");
            $this->assertNotContains(StartSession::class, $route->gatherMiddleware(), "{$uri} must not start session storage.");
        }
    }
}
