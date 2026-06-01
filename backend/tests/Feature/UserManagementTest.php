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
