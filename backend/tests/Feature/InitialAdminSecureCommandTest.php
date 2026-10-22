<?php

namespace Tests\Feature;

use App\Actions\Auth\WindowsAdministratorAuthorizer;
use App\Models\AuditLog;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Testing\PendingCommand;
use Tests\TestCase;

class InitialAdminSecureCommandTest extends TestCase
{
    use RefreshDatabase;

    protected static bool $resetSchemaAfterDdl = true;

    private bool $auditFailureTriggerCreated = false;

    protected function tearDown(): void
    {
        // Even DROP TRIGGER IF EXISTS implicitly commits on MariaDB. Running
        // it for unrelated cases would commit their administrator fixtures.
        if ($this->auditFailureTriggerCreated) {
            DB::unprepared('DROP TRIGGER IF EXISTS fail_initial_admin_audit');
        }

        parent::tearDown();
    }

    public function test_elevated_setup_creates_one_audited_admin_with_forced_password_change(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $this->authorizeWindowsOperation();

        $this->validCommand()
            ->expectsOutput('Administrador creado. Inicie sesión y cambie la contraseña temporal.')
            ->assertSuccessful();

        $admin = User::query()->where('username', 'admin.local')->firstOrFail();
        $this->assertTrue($admin->active);
        $this->assertTrue($admin->must_change_password);
        $this->assertTrue($admin->hasRole('admin'));
        $this->assertTrue(Hash::check('TemporalSegura123!', $admin->password));

        $audit = AuditLog::query()->where('action', 'user.initial_admin_created_locally')->firstOrFail();
        $this->assertNull($audit->user_id);
        $this->assertSame($admin->id, $audit->entity_id);
        $this->assertSame('S-1-5-21-TEST-1001', $audit->new_values['windows_sid'] ?? null);
        $this->assertStringNotContainsString('TemporalSegura123!', (string) $audit->toJson());
    }

    public function test_setup_refuses_without_windows_administrator_authorization(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $this->denyWindowsOperation();

        $this->artisan('auth:create-initial-admin-secure')
            ->expectsOutput('Este procedimiento requiere autorización de administrador de Windows.')
            ->assertExitCode(10);

        $this->assertDatabaseCount('users', 0);
    }

    public function test_setup_refuses_weak_password(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $this->authorizeWindowsOperation();

        $this->commandWithPassword('debil')
            ->expectsOutputToContain('12 caracteres')
            ->assertExitCode(11);

        $this->assertDatabaseCount('users', 0);
    }

    public function test_setup_never_overwrites_an_existing_active_admin(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $this->authorizeWindowsOperation();
        $existing = User::factory()->create([
            'username' => 'existing.admin',
            'password' => Hash::make('Existing123!'),
        ]);
        $existing->assignRole('admin');

        $this->validCommand()
            ->expectsOutputToContain('Ya existe un administrador activo')
            ->assertExitCode(11);

        $this->assertDatabaseCount('users', 1);
        $this->assertTrue(Hash::check('Existing123!', $existing->fresh()->password));
    }

    public function test_setup_rolls_back_user_when_audit_cannot_be_written(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $this->authorizeWindowsOperation();

        if (DB::connection()->getDriverName() === 'sqlite') {
            DB::unprepared(<<<'SQL'
CREATE TRIGGER fail_initial_admin_audit
BEFORE INSERT ON audit_logs
WHEN NEW.action = 'user.initial_admin_created_locally'
BEGIN
    SELECT RAISE(ABORT, 'synthetic audit failure');
END
SQL);
        } else {
            // CREATE TRIGGER commits implicitly. End RefreshDatabase's outer
            // transaction explicitly so the command starts a real transaction,
            // rather than a savepoint whose underlying transaction is gone.
            DB::commit();
            DB::unprepared(<<<'SQL'
CREATE TRIGGER fail_initial_admin_audit
BEFORE INSERT ON audit_logs
FOR EACH ROW
BEGIN
    IF NEW.action = 'user.initial_admin_created_locally' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'synthetic audit failure';
    END IF;
END
SQL);
        }

        $this->auditFailureTriggerCreated = true;

        $this->validCommand()
            ->expectsOutput('No se pudo completar la configuración inicial.')
            ->assertExitCode(13);

        $this->assertDatabaseCount('users', 0);
        $this->assertDatabaseMissing('audit_logs', ['action' => 'user.initial_admin_created_locally']);
    }

    private function validCommand(): PendingCommand
    {
        return $this->commandWithPassword('TemporalSegura123!');
    }

    private function commandWithPassword(string $password): PendingCommand
    {
        return $this->artisan('auth:create-initial-admin-secure')
            ->expectsQuestion('Nombre del administrador', 'Administración Hospitalaria')
            ->expectsQuestion('Usuario', 'admin.local')
            ->expectsQuestion('Correo', 'admin.local@hospital.test')
            ->expectsQuestion('Contraseña temporal', $password)
            ->expectsQuestion('Repita la contraseña temporal', $password);
    }

    private function authorizeWindowsOperation(): void
    {
        $this->app->instance(WindowsAdministratorAuthorizer::class, new class extends WindowsAdministratorAuthorizer
        {
            public function authorization(): ?array
            {
                return ['sid' => 'S-1-5-21-TEST-1001', 'account' => 'HOSPITAL\\Soporte'];
            }
        });
    }

    private function denyWindowsOperation(): void
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
