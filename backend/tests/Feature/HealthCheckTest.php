<?php

namespace Tests\Feature;

use Tests\TestCase;

class HealthCheckTest extends TestCase
{
    public function test_up_endpoint_is_available(): void
    {
        $response = $this->get('/up');

        $response->assertOk();
    }

    public function test_api_health_endpoint_returns_json(): void
    {
        $response = $this->getJson('/api/health');

        $response
            ->assertOk()
            ->assertJson([
                'status' => 'ok',
                'service' => 'Hospital Billing OS',
            ]);
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
}
