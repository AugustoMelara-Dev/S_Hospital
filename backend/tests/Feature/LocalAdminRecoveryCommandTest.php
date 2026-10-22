<?php

namespace Tests\Feature;

use App\Actions\Auth\WindowsAdministratorAuthorizer;
use App\Models\AuditLog;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class LocalAdminRecoveryCommandTest extends TestCase
{
    use RefreshDatabase;

    public function test_windows_wrapper_uses_only_absolute_protected_runtime_paths(): void
    {
        $script = file_get_contents(base_path('../scripts/recover_hospital_access.ps1'));

        $this->assertIsString($script);
        $this->assertStringNotContainsString("-FilePath 'powershell.exe'", $script);
        $this->assertStringNotContainsString("Get-Command 'php.exe'", $script);
        $this->assertStringContainsString('SpecialFolder]::System', $script);
        $this->assertStringContainsString('SpecialFolder]::ProgramFiles', $script);
        $this->assertStringContainsString('apunta fuera de su ubicación autorizada', $script);
    }

    public function test_elevated_local_recovery_resets_only_active_admin_and_revokes_access(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $this->authorizeWindowsRecovery();

        $admin = User::factory()->create([
            'username' => 'admin.local',
            'email' => 'admin.local@hospital.test',
            'must_change_password' => false,
        ]);
        $admin->assignRole('admin');
        $admin->createToken('terminal-anterior');

        DB::table('sessions')->insert([
            'id' => 'previous-session',
            'user_id' => $admin->id,
            'payload' => 'synthetic',
            'last_activity' => now()->timestamp,
        ]);

        $this->artisan('auth:recover-local-admin')
            ->expectsQuestion('Usuario o correo del administrador', 'admin.local')
            ->expectsQuestion('Motivo de la recuperación', 'Contraseña olvidada por el administrador titular.')
            ->expectsQuestion('Nueva contraseña temporal', 'NuevaTemporal123!')
            ->expectsQuestion('Repita la contraseña temporal', 'NuevaTemporal123!')
            ->expectsOutput('Acceso recuperado. Inicie sesión y cambie la contraseña temporal.')
            ->assertSuccessful();

        $admin->refresh();

        $this->assertTrue(Hash::check('NuevaTemporal123!', $admin->password));
        $this->assertTrue($admin->must_change_password);
        $this->assertTrue($admin->hasRole('admin'));
        $this->assertDatabaseMissing('personal_access_tokens', [
            'tokenable_type' => User::class,
            'tokenable_id' => $admin->id,
        ]);
        $this->assertDatabaseMissing('sessions', ['user_id' => $admin->id]);

        $audit = AuditLog::query()
            ->where('action', 'user.password_recovered_locally')
            ->where('entity_id', $admin->id)
            ->firstOrFail();

        $this->assertNull($audit->user_id);
        $this->assertSame('Contraseña olvidada por el administrador titular.', $audit->reason);
        $this->assertSame(true, $audit->new_values['must_change_password'] ?? null);
        $this->assertSame(true, $audit->new_values['sessions_revoked'] ?? null);
        $this->assertSame('S-1-5-21-TEST-1001', $audit->new_values['windows_sid'] ?? null);
        $this->assertSame('HOSPITAL\\Soporte', $audit->new_values['windows_account'] ?? null);
        $this->assertStringNotContainsString('NuevaTemporal123!', (string) $audit->toJson());
    }

    public function test_recovery_is_refused_without_elevated_windows_authorization(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $this->denyWindowsRecovery();

        $admin = User::factory()->create(['password' => Hash::make('Original123!')]);
        $admin->assignRole('admin');

        $this->artisan('auth:recover-local-admin')
            ->expectsOutput('Este procedimiento requiere autorización de administrador de Windows.')
            ->assertExitCode(10);

        $this->assertTrue(Hash::check('Original123!', $admin->fresh()->password));
        $this->assertDatabaseMissing('audit_logs', [
            'action' => 'user.password_recovered_locally',
        ]);
    }

    public function test_recovery_rejects_non_admin_target_and_does_not_expose_password(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $this->authorizeWindowsRecovery();

        $cashier = User::factory()->create([
            'username' => 'cajero.local',
            'password' => Hash::make('Original123!'),
        ]);
        $cashier->assignRole('cajero');

        $this->artisan('auth:recover-local-admin')
            ->expectsQuestion('Usuario o correo del administrador', 'cajero.local')
            ->expectsQuestion('Motivo de la recuperación', 'Solicitud comprobada en sitio.')
            ->expectsQuestion('Nueva contraseña temporal', 'NuevaTemporal123!')
            ->expectsQuestion('Repita la contraseña temporal', 'NuevaTemporal123!')
            ->expectsOutput('No se encontró un administrador activo con ese usuario o correo.')
            ->assertExitCode(11);

        $this->assertTrue(Hash::check('Original123!', $cashier->fresh()->password));
        $this->assertDatabaseMissing('audit_logs', [
            'action' => 'user.password_recovered_locally',
        ]);
    }

    private function authorizeWindowsRecovery(): void
    {
        $this->app->instance(WindowsAdministratorAuthorizer::class, new class extends WindowsAdministratorAuthorizer
        {
            public function authorization(): ?array
            {
                return ['sid' => 'S-1-5-21-TEST-1001', 'account' => 'HOSPITAL\\Soporte'];
            }
        });
    }

    private function denyWindowsRecovery(): void
    {
        $this->app->instance(WindowsAdministratorAuthorizer::class, new class extends WindowsAdministratorAuthorizer
        {
            public function authorization(): ?array
            {
                return null;
            }
        });
    }
}
