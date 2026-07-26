<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ActiveAdminStatusCommandTest extends TestCase
{
    use RefreshDatabase;

    public function test_command_returns_json_success_when_active_admin_exists(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $admin = User::factory()->create(['active' => true]);
        $admin->assignRole('admin');

        $this->artisan('auth:has-active-admin', ['--json' => true])
            ->expectsOutput(json_encode([
                'active_admin_exists' => true,
            ], JSON_THROW_ON_ERROR))
            ->assertSuccessful();
    }

    public function test_command_returns_json_failure_when_no_active_admin_exists(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);

        $this->artisan('auth:has-active-admin', ['--json' => true])
            ->expectsOutput(json_encode([
                'active_admin_exists' => false,
            ], JSON_THROW_ON_ERROR))
            ->assertFailed();
    }
}
