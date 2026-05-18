<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class InitialAdminCommandTest extends TestCase
{
    use RefreshDatabase;

    public function test_initial_admin_command_creates_admin_with_required_password_change(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);

        $this->artisan('auth:create-initial-admin', [
            '--username' => 'admin.local',
            '--email' => 'admin.local@hospital.test',
            '--password' => 'Temporary123',
        ])->assertSuccessful();

        $admin = User::query()->where('username', 'admin.local')->firstOrFail();

        $this->assertTrue($admin->active);
        $this->assertTrue($admin->must_change_password);
        $this->assertTrue($admin->hasRole('admin'));
    }

    public function test_initial_admin_command_refuses_when_admin_exists(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);

        $existingAdmin = User::factory()->create();
        $existingAdmin->assignRole('admin');

        $this->artisan('auth:create-initial-admin', [
            '--username' => 'admin.local',
            '--email' => 'admin.local@hospital.test',
            '--password' => 'Temporary123',
        ])->assertFailed();
    }
}
