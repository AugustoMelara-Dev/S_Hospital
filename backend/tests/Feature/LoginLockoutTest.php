<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class LoginLockoutTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);
    }

    public function test_login_succeeds_and_records_a_successful_attempt(): void
    {
        User::factory()->create([
            'username' => 'cajero-test',
            'email' => 'cajero-test@hospital.local',
            'password' => Hash::make('Password123!'),
            'must_change_password' => false,
            'active' => true,
        ])->assignRole('cajero');

        $response = $this->postJson('/api/auth/login', [
            'login' => 'cajero-test',
            'password' => 'Password123!',
        ]);

        $response->assertOk();

        $this->assertDatabaseHas('login_attempts', [
            'login' => 'cajero-test',
            'success' => true,
        ]);
    }

    public function test_login_lockout_engages_after_five_failed_attempts(): void
    {
        User::factory()->create([
            'username' => 'cajero-test',
            'email' => 'cajero-test@hospital.local',
            'password' => Hash::make('Password123!'),
            'must_change_password' => false,
            'active' => true,
        ])->assignRole('cajero');

        for ($i = 0; $i < 5; $i++) {
            $this->postJson('/api/auth/login', [
                'login' => 'cajero-test',
                'password' => 'wrong-password',
            ])->assertStatus(422);
        }

        $response = $this->postJson('/api/auth/login', [
            'login' => 'cajero-test',
            'password' => 'Password123!',
        ]);

        $response->assertStatus(423)
            ->assertJsonPath('lockout_minutes', 15);

        $this->assertDatabaseCount('login_attempts', 5);
    }

    public function test_lockout_does_not_block_a_different_user_from_the_same_ip(): void
    {
        User::factory()->create([
            'username' => 'usuario-a',
            'email' => 'a@hospital.local',
            'password' => Hash::make('Password123!'),
            'must_change_password' => false,
            'active' => true,
        ])->assignRole('cajero');

        User::factory()->create([
            'username' => 'usuario-b',
            'email' => 'b@hospital.local',
            'password' => Hash::make('Password123!'),
            'must_change_password' => false,
            'active' => true,
        ])->assignRole('cajero');

        for ($i = 0; $i < 5; $i++) {
            $this->postJson('/api/auth/login', [
                'login' => 'usuario-a',
                'password' => 'wrong-password',
            ])->assertStatus(422);
        }

        $this->postJson('/api/auth/login', [
            'login' => 'usuario-a',
            'password' => 'Password123!',
        ])->assertStatus(423);

        $this->postJson('/api/auth/login', [
            'login' => 'usuario-b',
            'password' => 'Password123!',
        ])->assertOk();
    }

    public function test_ip_lockout_engages_after_ten_failed_attempts_with_different_logins(): void
    {
        User::factory()->create([
            'username' => 'usuario-ip',
            'email' => 'ip@hospital.local',
            'password' => Hash::make('Password123!'),
            'must_change_password' => false,
            'active' => true,
        ])->assignRole('cajero');

        for ($i = 0; $i < 10; $i++) {
            $this->postJson('/api/auth/login', [
                'login' => 'no-existe-' . $i,
                'password' => 'wrong-password',
            ])->assertStatus(422);
        }

        $response = $this->postJson('/api/auth/login', [
            'login' => 'usuario-ip',
            'password' => 'Password123!',
        ]);

        $response->assertStatus(423);
    }

    public function test_lockout_response_carries_safe_message(): void
    {
        for ($i = 0; $i < 5; $i++) {
            $this->postJson('/api/auth/login', [
                'login' => 'cualquiera',
                'password' => 'wrong',
            ])->assertStatus(422);
        }

        $response = $this->postJson('/api/auth/login', [
            'login' => 'cualquiera',
            'password' => 'wrong',
        ]);

        $response->assertStatus(423)
            ->assertJsonPath('message', 'Cuenta bloqueada por intentos fallidos. Espere 15 minutos o pida a un supervisor que reactive su usuario.')
            ->assertJsonPath('lockout_minutes', 15);
    }
}
