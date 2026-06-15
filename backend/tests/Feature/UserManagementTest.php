<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Spatie\Permission\PermissionRegistrar;
use Tests\TestCase;

class UserManagementTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }

    public function test_admin_can_reset_user_password_and_force_change_on_next_login(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $admin = $this->userWithRole('admin');
        $target = User::factory()->create([
            'username' => 'target-cashier',
            'email' => 'target-cashier@hospital.local',
        ]);
        $target->assignRole('cajero');
        $target->createToken('terminal-caja');

        $this->actingAs($admin)
            ->postJson("/api/admin/users/{$target->id}/reset-password", [
                'password' => 'Temporary123',
            ])
            ->assertOk()
            ->assertJsonPath('data.must_change_password', true);

        $target->refresh();
        $this->assertTrue(Hash::check('Temporary123', $target->password));
        $this->assertTrue($target->must_change_password);
        $this->assertDatabaseMissing('personal_access_tokens', [
            'tokenable_type' => User::class,
            'tokenable_id' => $target->id,
        ]);
    }

    public function test_admin_can_list_users_but_cashier_cannot(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $admin = $this->userWithRole('admin');
        $cashier = $this->userWithRole('cajero');

        $this->actingAs($admin)
            ->getJson('/api/admin/users')
            ->assertOk()
            ->assertJsonFragment([
                'username' => $cashier->username,
            ]);

        $this->actingAs($cashier)
            ->getJson('/api/admin/users')
            ->assertForbidden();
    }

    public function test_admin_can_toggle_user_active_state_but_cannot_disable_self(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $admin = $this->userWithRole('admin');
        $target = User::factory()->create([
            'username' => 'target-cashier-promo',
            'email' => 'target-cashier-promo@hospital.local',
        ]);
        $target->assignRole('cajero');

        $this->actingAs($admin)
            ->postJson("/api/admin/users/{$target->id}/toggle-active")
            ->assertOk()
            ->assertJsonPath('data.active', false);

        $this->assertFalse($target->refresh()->active);
        $this->assertNotNull($target->deactivated_at);

        $this->actingAs($admin)
            ->postJson("/api/admin/users/{$admin->id}/toggle-active")
            ->assertUnprocessable()
            ->assertJsonValidationErrors('active');

        $this->assertTrue($admin->refresh()->active);
    }

    public function test_toggle_user_active_requires_disable_permission(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $cashier = $this->userWithRole('cajero');
        $target = $this->userWithRole('cajero');

        $this->actingAs($cashier)
            ->postJson("/api/admin/users/{$target->id}/toggle-active")
            ->assertForbidden();
    }

    public function test_reset_user_password_requires_backend_password_policy(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $admin = $this->userWithRole('admin');
        $target = $this->userWithRole('cajero');

        $this->actingAs($admin)
            ->postJson("/api/admin/users/{$target->id}/reset-password", [
                'password' => 'abcdefghij',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('password');
    }

    public function test_reset_user_password_requires_users_update_permission(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $cashier = $this->userWithRole('cajero');
        $target = $this->userWithRole('cajero');

        $this->actingAs($cashier)
            ->postJson("/api/admin/users/{$target->id}/reset-password", [
                'password' => 'Temporary123',
            ])
            ->assertForbidden();
    }

    public function test_user_manager_without_admin_assignment_permission_cannot_create_admin(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $manager = User::factory()->create();
        $manager->givePermissionTo(['users.create', 'users.view']);

        $this->actingAs($manager)
            ->postJson('/api/admin/users', [
                'name' => 'Nuevo Admin',
                'email' => 'nuevo-admin@hospital.local',
                'username' => 'nuevo-admin',
                'password' => 'Temporary123',
                'role' => 'admin',
                'active' => true,
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('role');
    }

    public function test_user_manager_without_admin_assignment_permission_cannot_promote_user_to_admin(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $manager = User::factory()->create();
        $manager->givePermissionTo(['users.update', 'users.view']);
        $target = User::factory()->create([
            'username' => 'target-cashier-promote',
            'email' => 'target-cashier-promote@hospital.local',
        ]);
        $target->assignRole('cajero');

        $this->actingAs($manager)
            ->patchJson("/api/admin/users/{$target->id}", [
                'name' => $target->name,
                'email' => $target->email,
                'username' => $target->username,
                'role' => 'admin',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('role');
    }

    private function userWithRole(string $role): User
    {
        $user = User::factory()->create();
        $user->assignRole($role);

        return $user;
    }
}
