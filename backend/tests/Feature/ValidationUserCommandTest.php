<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Tests\TestCase;

class ValidationUserCommandTest extends TestCase
{
    use RefreshDatabase;

    protected function tearDown(): void
    {
        putenv('HOSPITAL_ALLOW_FINAL_VALIDATION_USERS');
        putenv('HOSPITAL_CONFIRM_VALIDATION_USER');
        putenv('HOSPITAL_VALIDATION_USER_PASSWORD');

        parent::tearDown();
    }

    public function test_command_refuses_without_explicit_validation_guard(): void
    {
        putenv('HOSPITAL_CONFIRM_VALIDATION_USER=concurrency.final.validacion');

        $this->artisan('hospital:validation-user', [
            'action' => 'create',
            '--username' => 'concurrency.final.validacion',
            '--password' => 'Validation123!',
        ])->assertFailed();
    }

    public function test_command_creates_non_admin_exact_permission_validation_user_without_echoing_password(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        putenv('HOSPITAL_ALLOW_FINAL_VALIDATION_USERS=1');
        putenv('HOSPITAL_CONFIRM_VALIDATION_USER=concurrency.final.validacion');

        $exitCode = Artisan::call('hospital:validation-user', [
            'action' => 'create',
            '--username' => 'concurrency.final.validacion',
            '--password' => 'Validation123!',
            '--json' => true,
        ]);

        $this->assertSame(0, $exitCode);
        $this->assertStringNotContainsString('Validation123!', Artisan::output());

        $user = User::query()->where('username', 'concurrency.final.validacion')->firstOrFail();
        $this->assertTrue($user->active);
        $this->assertFalse($user->must_change_password);
        $this->assertTrue($user->hasRole('cajero'));
        $this->assertTrue($user->usesExactDirectPermissionMap());
        $this->assertTrue($user->can('audit.view'));
        $this->assertTrue($user->can('reports.managerial.view'));
        $this->assertTrue($user->can('reports.export'));
        $this->assertFalse($user->can('users.assign_admin_role'));
    }

    public function test_command_accepts_password_from_environment_without_echoing_it(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        putenv('HOSPITAL_ALLOW_FINAL_VALIDATION_USERS=1');
        putenv('HOSPITAL_CONFIRM_VALIDATION_USER=load.final.validacion');
        putenv('HOSPITAL_VALIDATION_USER_PASSWORD=EnvValidation123!');

        $exitCode = Artisan::call('hospital:validation-user', [
            'action' => 'create',
            '--username' => 'load.final.validacion',
            '--json' => true,
        ]);

        $this->assertSame(0, $exitCode);
        $this->assertStringNotContainsString('EnvValidation123!', Artisan::output());
        $this->assertDatabaseHas('users', [
            'username' => 'load.final.validacion',
            'active' => true,
        ]);
    }

    public function test_command_disables_validation_user_idempotently(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        putenv('HOSPITAL_ALLOW_FINAL_VALIDATION_USERS=1');
        putenv('HOSPITAL_CONFIRM_VALIDATION_USER=smoke.final.validacion');

        $this->artisan('hospital:validation-user', [
            'action' => 'create',
            '--username' => 'smoke.final.validacion',
            '--password' => 'Validation123!',
        ])->assertSuccessful();

        $this->artisan('hospital:validation-user', [
            'action' => 'disable',
            '--username' => 'smoke.final.validacion',
            '--json' => true,
        ])->assertSuccessful();

        $user = User::query()->where('username', 'smoke.final.validacion')->firstOrFail();
        $this->assertFalse($user->active);
        $this->assertNotNull($user->deactivated_at);

        putenv('HOSPITAL_CONFIRM_VALIDATION_USER=smoke.missing.validacion');
        $this->artisan('hospital:validation-user', [
            'action' => 'disable',
            '--username' => 'smoke.missing.validacion',
            '--json' => true,
        ])->assertSuccessful();
    }

    public function test_command_refuses_admin_role_for_temporary_validation_user(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        putenv('HOSPITAL_ALLOW_FINAL_VALIDATION_USERS=1');
        putenv('HOSPITAL_CONFIRM_VALIDATION_USER=load.final.validacion');

        $this->artisan('hospital:validation-user', [
            'action' => 'create',
            '--username' => 'load.final.validacion',
            '--password' => 'Validation123!',
            '--role' => 'admin',
        ])->assertFailed();
    }
}
