<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class AuthTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_can_login_with_username(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);

        $user = User::factory()->create([
            'username' => 'admin.local',
            'email' => 'admin.local@example.test',
            'password' => Hash::make('Password123!'),
        ]);
        $user->assignRole('admin');

        $response = $this->postJson('/api/auth/login', [
            'login' => 'admin.local',
            'password' => 'Password123!',
        ]);

        $response->assertOk()
            ->assertJsonPath('data.username', 'admin.local')
            ->assertJsonPath('data.roles.0', 'admin')
            ->assertJsonPath('data.must_change_password', false);
    }

    public function test_user_can_login_with_email(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);

        $user = User::factory()->create([
            'username' => 'supervisor.local',
            'email' => 'supervisor.local@example.test',
            'password' => Hash::make('Password123!'),
        ]);
        $user->assignRole('supervisor');

        $response = $this->postJson('/api/auth/login', [
            'login' => 'supervisor.local@example.test',
            'password' => 'Password123!',
        ]);

        $response->assertOk()
            ->assertJsonPath('data.username', 'supervisor.local');
    }

    public function test_invalid_login_is_rejected(): void
    {
        User::factory()->create([
            'username' => 'admin.local',
            'password' => Hash::make('Password123!'),
        ]);

        $this->postJson('/api/auth/login', [
            'login' => 'admin.local',
            'password' => 'wrong-password',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors('login');
    }

    public function test_authenticated_user_can_read_me(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);

        $user = User::factory()->create();
        $user->assignRole('cajero');

        $this->actingAs($user)
            ->getJson('/api/auth/me')
            ->assertOk()
            ->assertJsonPath('data.id', $user->id)
            ->assertJsonPath('data.roles.0', 'cajero');
    }

    public function test_me_requires_authentication(): void
    {
        $this->getJson('/api/auth/me')
            ->assertUnauthorized();
    }

    public function test_user_can_logout(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->postJson('/api/auth/logout')
            ->assertOk()
            ->assertJsonPath('ok', true);
    }

    public function test_must_change_password_is_reported_and_blocks_protected_operations(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);

        $user = User::factory()->create([
            'must_change_password' => true,
        ]);
        $user->assignRole('admin');

        $this->actingAs($user)
            ->getJson('/api/auth/me')
            ->assertOk()
            ->assertJsonPath('data.must_change_password', true);

        $this->actingAs($user)
            ->getJson('/api/settings/fiscal')
            ->assertForbidden()
            ->assertJsonPath('must_change_password', true);
    }
}
