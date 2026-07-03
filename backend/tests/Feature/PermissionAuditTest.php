<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Actions\Reports\OperationalMetricsService;
use App\Models\BackupLog;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class PermissionAuditTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);
    }

    public function test_attaching_a_role_creates_an_audit_log_entry(): void
    {
        $admin = User::factory()->create([
            'username' => 'admin-audit',
            'email' => 'admin-audit@hospital.local',
            'password' => Hash::make('Password123!'),
            'must_change_password' => false,
            'active' => true,
        ])->assignRole('admin');

        $subject = User::factory()->create([
            'username' => 'cajero-audit',
            'email' => 'cajero-audit@hospital.local',
            'password' => Hash::make('Password123!'),
            'must_change_password' => false,
            'active' => true,
        ]);

        $this->actingAs($admin, 'web');

        $cajeroRole = Role::findByName('cajero');
        $subject->assignRole($cajeroRole);

        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $admin->id,
            'action' => 'role.attached',
            'entity_type' => User::class,
            'entity_id' => $subject->id,
        ]);

        $payload = json_decode((string) DB::table('audit_logs')
            ->where('action', 'role.attached')
            ->latest('id')
            ->value('new_values'), true);
        $this->assertIsArray($payload);
        $this->assertSame('cajero', $payload['role_name'] ?? null);
        $this->assertArrayNotHasKey('password', $payload);
    }

    public function test_syncing_a_role_records_detach_and_attach_entries(): void
    {
        $admin = User::factory()->create([
            'username' => 'admin-sync-audit',
            'email' => 'admin-sync-audit@hospital.local',
            'password' => Hash::make('Password123!'),
            'must_change_password' => false,
            'active' => true,
        ])->assignRole('admin');

        $subject = User::factory()->create([
            'username' => 'supervisor-sync-audit',
            'email' => 'supervisor-sync-audit@hospital.local',
            'password' => Hash::make('Password123!'),
            'must_change_password' => false,
            'active' => true,
        ])->assignRole('cajero');

        $this->actingAs($admin, 'web');

        $subject->syncRoles(['supervisor']);

        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $admin->id,
            'action' => 'role.detached',
            'entity_type' => User::class,
            'entity_id' => $subject->id,
        ]);

        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $admin->id,
            'action' => 'role.attached',
            'entity_type' => User::class,
            'entity_id' => $subject->id,
        ]);
    }

    public function test_creating_a_role_creates_an_audit_log_entry(): void
    {
        $admin = User::factory()->create([
            'username' => 'admin-role',
            'email' => 'admin-role@hospital.local',
            'password' => Hash::make('Password123!'),
            'must_change_password' => false,
            'active' => true,
        ])->assignRole('admin');

        $this->actingAs($admin, 'web');

        Role::create(['name' => 'supervisor-caja', 'guard_name' => 'web']);

        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $admin->id,
            'action' => 'created',
            'entity_type' => Role::class,
        ]);
    }

    public function test_permission_audit_write_failure_is_observable_without_breaking_permission_change(): void
    {
        $admin = User::factory()->create([
            'username' => 'admin-audit-failure',
            'email' => 'admin-audit-failure@hospital.local',
            'password' => Hash::make('Password123!'),
            'must_change_password' => false,
            'active' => true,
        ])->assignRole('admin');

        $subject = User::factory()->create([
            'username' => 'subject-audit-failure',
            'email' => 'subject-audit-failure@hospital.local',
            'password' => Hash::make('Password123!'),
            'must_change_password' => false,
            'active' => true,
        ]);

        $this->actingAs($admin, 'web');
        Cache::forget('permission_audit_observer:last_failure');
        Log::spy();

        Schema::drop('audit_logs');

        $subject->assignRole('cajero');

        $this->assertTrue($subject->fresh()->hasRole('cajero'));
        Log::shouldHaveReceived('warning')
            ->with('Permission audit write failed', \Mockery::on(
                fn (array $context): bool => ($context['action'] ?? null) === 'role.attached'
                    && ($context['entity_type'] ?? null) === User::class
                    && ($context['entity_id'] ?? null) === $subject->id
            ));

        $failure = Cache::get('permission_audit_observer:last_failure');
        $this->assertIsArray($failure);
        $this->assertSame('role.attached', $failure['action'] ?? null);
        $this->assertSame(User::class, $failure['entity_type'] ?? null);

        $snapshot = app(OperationalMetricsService::class)->snapshot();
        $this->assertSame('role.attached', $snapshot['audit']['permission_audit_observer']['last_failure']['action'] ?? null);

        $score = app(OperationalMetricsService::class)->overallHealthScore();
        $this->assertContains('permission_audit_observer_failed', $score['issues']);
    }

    public function test_default_supervisor_role_does_not_manage_catalog_prices(): void
    {
        $supervisor = User::factory()->create([
            'username' => 'supervisor-catalog-readonly',
            'email' => 'supervisor-catalog-readonly@hospital.local',
            'password' => Hash::make('Password123!'),
            'must_change_password' => false,
            'active' => true,
        ])->assignRole('supervisor');

        $this->assertTrue($supervisor->can('catalog.view'));
        $this->assertFalse($supervisor->can('catalog.manage'));
    }

    public function test_user_policy_uses_seeded_user_management_permissions_only(): void
    {
        $target = User::factory()->create([
            'username' => 'target-policy-user',
            'email' => 'target-policy-user@hospital.local',
        ]);
        $viewer = User::factory()->create();
        $creator = User::factory()->create();
        $updater = User::factory()->create();
        $disabler = User::factory()->create();

        $viewer->givePermissionTo('users.view');
        $creator->givePermissionTo('users.create');
        $updater->givePermissionTo('users.update');
        $disabler->givePermissionTo('users.disable');

        $this->assertDatabaseMissing('permissions', ['name' => 'users.manage']);
        $this->assertDatabaseMissing('permissions', ['name' => 'users.reset_password']);
        $this->assertContains('users.create', RolesAndPermissionsSeeder::PERMISSIONS);
        $this->assertContains('users.update', RolesAndPermissionsSeeder::PERMISSIONS);
        $this->assertContains('users.disable', RolesAndPermissionsSeeder::PERMISSIONS);
        $this->assertSame(0, Permission::query()->whereIn('name', ['users.manage', 'users.reset_password'])->count());

        $this->assertTrue(Gate::forUser($viewer)->allows('viewAny', User::class));
        $this->assertTrue(Gate::forUser($creator)->allows('create', User::class));
        $this->assertTrue(Gate::forUser($updater)->allows('update', $target));
        $this->assertTrue(Gate::forUser($updater)->allows('resetPassword', $target));
        $this->assertFalse(Gate::forUser($updater)->allows('resetPassword', $updater));
        $this->assertTrue(Gate::forUser($disabler)->allows('toggleActive', $target));
        $this->assertFalse(Gate::forUser($disabler)->allows('toggleActive', $disabler));
    }

    public function test_backup_restore_is_not_seeded_or_authorizable_from_the_app(): void
    {
        $admin = User::factory()->create([
            'username' => 'admin-backup-restore-policy',
            'email' => 'admin-backup-restore-policy@hospital.local',
            'password' => Hash::make('Password123!'),
            'must_change_password' => false,
            'active' => true,
        ])->assignRole('admin');

        $auditor = User::factory()->create([
            'username' => 'auditor-backup-restore-policy',
            'email' => 'auditor-backup-restore-policy@hospital.local',
            'password' => Hash::make('Password123!'),
            'must_change_password' => false,
            'active' => true,
        ])->assignRole('auditor');

        $backup = BackupLog::query()->create([
            'filename' => 'hospital-backup-policy-test.sql.enc',
            'path' => 'backups/hospital-backup-policy-test.sql.enc',
            'disk' => 'local',
            'status' => BackupLog::STATUS_SUCCESS,
            'type' => BackupLog::TYPE_MANUAL,
            'created_by' => $admin->id,
            'completed_at' => now(),
        ]);

        $this->assertNotContains('backups.restore', RolesAndPermissionsSeeder::PERMISSIONS);
        $this->assertDatabaseMissing('permissions', ['name' => 'backups.restore']);
        $this->assertFalse($admin->can('backups.restore'));
        $this->assertFalse($auditor->can('backups.restore'));
        $this->assertFalse(Gate::forUser($admin)->allows('restore', $backup));
        $this->assertFalse(Gate::forUser($auditor)->allows('restore', $backup));
    }

    public function test_app_permission_checks_are_seeded_or_documented_legacy_scope(): void
    {
        $allowedLegacyScopes = [
            'area_services.view',
        ];

        $checkedPermissions = [];

        foreach ([base_path('app'), base_path('routes')] as $directory) {
            $files = new \RecursiveIteratorIterator(
                new \RecursiveDirectoryIterator($directory, \FilesystemIterator::SKIP_DOTS),
            );

            foreach ($files as $file) {
                if (! $file instanceof \SplFileInfo || $file->getExtension() !== 'php') {
                    continue;
                }

                $contents = (string) file_get_contents($file->getPathname());

                preg_match_all("/\\bcan\\(\\s*['\"]([a-z_]+\\.[a-z0-9_.]+)['\"]\\s*\\)/", $contents, $canMatches);
                preg_match_all('/permission:([a-z_]+\\.[a-z0-9_.]+)/', $contents, $middlewareMatches);

                $checkedPermissions = [
                    ...$checkedPermissions,
                    ...$canMatches[1],
                    ...$middlewareMatches[1],
                ];
            }
        }

        $checkedPermissions = array_values(array_unique($checkedPermissions));
        sort($checkedPermissions);

        $missing = array_values(array_diff(
            $checkedPermissions,
            RolesAndPermissionsSeeder::PERMISSIONS,
            $allowedLegacyScopes,
        ));

        $this->assertSame([], $missing);
        $this->assertContains('area_services.view', $checkedPermissions);
        $this->assertNotContains('area_services.view', RolesAndPermissionsSeeder::PERMISSIONS);
    }
}
