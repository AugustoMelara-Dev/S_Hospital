<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class LastAdminProtectionTest extends TestCase
{
    use RefreshDatabase;

    public function test_only_admin_user_cannot_self_demote(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $admin = User::factory()->create();
        $admin->assignRole('admin');

        $this->actingAs($admin)
            ->patchJson("/api/admin/users/{$admin->id}", [
                'name' => $admin->name,
                'email' => $admin->email,
                'username' => $admin->username,
                'role' => 'cajero',
            ])
            ->assertStatus(422)
            ->assertJsonPath('errors.role.0', fn ($message) => is_string($message) && $message !== '');
    }

    public function test_admin_with_assign_admin_role_can_demote_other_admin(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $actor = User::factory()->create();
        $actor->assignRole('admin');

        $target = User::factory()->create();
        $target->assignRole('admin');

        $this->actingAs($actor)
            ->patchJson("/api/admin/users/{$target->id}", [
                'name' => $target->name,
                'email' => $target->email,
                'username' => $target->username,
                'role' => 'supervisor',
            ])
            ->assertOk();
    }
}
