<?php

declare(strict_types=1);

namespace Tests\Feature;

use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CsrfFlowTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);
    }

    public function test_unauthenticated_post_to_a_protected_endpoint_returns_401(): void
    {
        $response = $this->postJson('/api/invoices', [
            'patient_name' => 'Paciente de prueba',
            'items' => [],
        ]);

        $response->assertStatus(401);
    }

    public function test_unauthenticated_get_to_a_protected_endpoint_returns_401(): void
    {
        $response = $this->getJson('/api/cash-sessions/current');

        $response->assertStatus(401);
    }

    public function test_health_endpoint_is_publicly_readable(): void
    {
        $response = $this->getJson('/api/system/health');

        $response->assertOk();
    }

    public function test_setup_status_endpoint_is_publicly_readable(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);

        $response = $this->getJson('/api/system/setup-status');

        $response->assertOk();
    }

    public function test_login_endpoint_accepts_unauthenticated_post(): void
    {
        $response = $this->postJson('/api/auth/login', [
            'login' => 'no-existe',
            'password' => 'wrong',
        ]);

        $response->assertStatus(422);
    }

    public function test_session_endpoint_is_publicly_readable(): void
    {
        $response = $this->getJson('/api/auth/session');

        $response->assertOk();
        $this->assertNull($response->json('data'));
    }
}
