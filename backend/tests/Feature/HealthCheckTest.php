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
}
