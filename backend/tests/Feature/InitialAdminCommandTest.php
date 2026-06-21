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
            '--password' => 'Temporary123!',
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
            '--password' => 'Temporary123!',
        ])->assertFailed();
    }

    public function test_initial_admin_command_accepts_password_from_environment(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);

        $previousPassword = getenv('HOSPITAL_INITIAL_ADMIN_PASSWORD');
        putenv('HOSPITAL_INITIAL_ADMIN_PASSWORD=Temporary123!');

        try {
            $this->artisan('auth:create-initial-admin', [
                '--username' => 'admin.env',
                '--email' => 'admin.env@hospital.test',
            ])->assertSuccessful();
        } finally {
            $previousPassword === false
                ? putenv('HOSPITAL_INITIAL_ADMIN_PASSWORD')
                : putenv("HOSPITAL_INITIAL_ADMIN_PASSWORD={$previousPassword}");
        }

        $admin = User::query()->where('username', 'admin.env')->firstOrFail();

        $this->assertTrue($admin->hasRole('admin'));
    }

    public function test_initial_admin_command_requires_a_password_source(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);

        $previousPassword = getenv('HOSPITAL_INITIAL_ADMIN_PASSWORD');
        putenv('HOSPITAL_INITIAL_ADMIN_PASSWORD');

        try {
            $this->artisan('auth:create-initial-admin', [
                '--username' => 'admin.missing',
                '--email' => 'admin.missing@hospital.test',
            ])->assertFailed();
        } finally {
            $previousPassword === false
                ? putenv('HOSPITAL_INITIAL_ADMIN_PASSWORD')
                : putenv("HOSPITAL_INITIAL_ADMIN_PASSWORD={$previousPassword}");
        }

        $this->assertDatabaseMissing('users', [
            'username' => 'admin.missing',
        ]);
    }

    public function test_initial_admin_command_rejects_weak_temporary_password(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);

        $this->artisan('auth:create-initial-admin', [
            '--username' => 'admin.weak',
            '--email' => 'admin.weak@hospital.test',
            '--password' => '1234567890',
        ])->assertFailed();

        $this->assertDatabaseMissing('users', [
            'username' => 'admin.weak',
        ]);
    }
}
