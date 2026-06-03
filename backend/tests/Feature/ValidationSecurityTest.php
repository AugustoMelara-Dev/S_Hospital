<?php

declare(strict_types=1);

namespace Tests\Feature;

use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ValidationSecurityTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);
    }

    public function test_login_validation_does_not_echo_the_password_in_the_response(): void
    {
        $response = $this->postJson('/api/auth/login', [
            'login' => 'usuario',
            'password' => '',
        ]);

        $response->assertStatus(422);

        $body = json_encode($response->json());
        $this->assertStringNotContainsString('PasswordSuperSecreto', $body);
    }

    public function test_change_password_validation_does_not_echo_the_password_in_the_response(): void
    {
        $response = $this->postJson('/api/auth/change-password', [
            'current_password' => '',
            'password' => 'NewPassword123',
            'password_confirmation' => 'NewPassword123',
        ]);

        $response->assertStatus(401);

        $body = json_encode($response->json());
        $this->assertStringNotContainsString('NewPassword123', $body);
    }

    public function test_invoice_creation_validation_does_not_echo_optional_payload(): void
    {
        $response = $this->postJson('/api/invoices', [
            'patient_name' => '',
            'items' => [],
        ]);

        $response->assertStatus(401);
        $this->assertStringNotContainsString('items', json_encode($response->json()));
    }

    public function test_cash_session_open_validation_does_not_echo_opening_amount(): void
    {
        $response = $this->postJson('/api/cash-sessions/open', [
            'opening_amount' => '9999999999999.99',
            'notes' => 'should be rejected for being too large',
        ]);

        $response->assertStatus(401);

        $body = json_encode($response->json());
        $this->assertStringNotContainsString('9999999999999.99', $body);
    }

    public function test_payment_creation_validation_keeps_amount_field_short(): void
    {
        $response = $this->postJson('/api/invoices/1/payments', [
            'method' => 'cash',
            'amount' => 'not-a-number',
        ]);

        $response->assertStatus(401);

        $body = json_encode($response->json());
        $this->assertStringNotContainsString('not-a-number', $body);
    }
}
