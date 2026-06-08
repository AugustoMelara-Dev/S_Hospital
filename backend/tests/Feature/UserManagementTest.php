<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\Area;
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
        $target = $this->userWithRole('cajero');

        $this->actingAs($admin)
            ->postJson("/api/admin/users/{$target->id}/reset-password", [
                'password' => 'Temporary123',
            ])
            ->assertOk()
            ->assertJsonPath('data.must_change_password', true);

        $target->refresh();
        $this->assertTrue(Hash::check('Temporary123', $target->password));
        $this->assertTrue($target->must_change_password);
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

    public function test_admin_assigns_area_to_area_user_and_role_requires_area(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $admin = $this->userWithRole('admin');
        $area = Area::query()->create([
            'name' => 'Laboratorio',
            'slug' => 'laboratorio',
            'active' => true,
        ]);

        $this->actingAs($admin)
            ->postJson('/api/admin/users', [
                'name' => 'Usuario de Laboratorio',
                'email' => 'laboratorio@example.test',
                'username' => 'laboratorio_local',
                'password' => 'Temporary123',
                'role' => 'area',
                'area_id' => $area->id,
                'active' => true,
            ])
            ->assertCreated()
            ->assertJsonPath('data.roles.0', 'area')
            ->assertJsonPath('data.area_id', $area->id)
            ->assertJsonPath('data.area.name', 'Laboratorio');

        $this->actingAs($admin)
            ->postJson('/api/admin/users', [
                'name' => 'Usuario sin area',
                'email' => 'area-sin-asignar@example.test',
                'username' => 'area.sin.asignar',
                'password' => 'Temporary123',
                'role' => 'area',
                'active' => true,
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('area_id');
    }

    public function test_admin_can_toggle_user_active_state_but_cannot_disable_self(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $admin = $this->userWithRole('admin');
        $target = $this->userWithRole('cajero');

        $this->actingAs($admin)
            ->postJson("/api/admin/users/{$target->id}/toggle-active")
            ->assertOk()
            ->assertJsonPath('data.active', false);

        $this->assertFalse($target->refresh()->active);

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

    private function userWithRole(string $role): User
    {
        $user = User::factory()->create();
        $user->assignRole($role);

        return $user;
    }
}
