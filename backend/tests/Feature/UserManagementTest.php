<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
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
        $target = User::factory()->create([
            'username' => 'target-cashier',
            'email' => 'target-cashier@hospital.local',
        ]);
        $target->assignRole('cajero');
        $target->createToken('terminal-caja');

        $this->actingAs($admin)
            ->postJson("/api/admin/users/{$target->id}/reset-password", [
                'password' => 'Temporary123!',
            ])
            ->assertOk()
            ->assertJsonPath('data.must_change_password', true);

        $target->refresh();
        $this->assertTrue(Hash::check('Temporary123!', $target->password));
        $this->assertTrue($target->must_change_password);
        $this->assertDatabaseMissing('personal_access_tokens', [
            'tokenable_type' => User::class,
            'tokenable_id' => $target->id,
        ]);

        $audit = AuditLog::query()
            ->where('action', 'user.password_reset')
            ->where('entity_type', User::class)
            ->where('entity_id', $target->id)
            ->firstOrFail();

        $this->assertSame($admin->id, $audit->user_id);
        $this->assertSame('success', $audit->result);
        $this->assertSame(true, $audit->new_values['must_change_password'] ?? null);
        $this->assertArrayNotHasKey('password', $audit->new_values ?? []);
        $this->assertArrayNotHasKey('password', $audit->old_values ?? []);
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

    public function test_admin_can_toggle_user_active_state_but_cannot_disable_self(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $admin = $this->userWithRole('admin');
        $target = User::factory()->create([
            'username' => 'target-cashier-promo',
            'email' => 'target-cashier-promo@hospital.local',
        ]);
        $target->assignRole('cajero');

        $this->actingAs($admin)
            ->postJson("/api/admin/users/{$target->id}/toggle-active")
            ->assertOk()
            ->assertJsonPath('data.active', false);

        $this->assertFalse($target->refresh()->active);
        $this->assertNotNull($target->deactivated_at);

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
                'password' => 'Temporary123!',
            ])
            ->assertForbidden();
    }

    public function test_admin_cannot_reset_own_password_from_user_management(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $admin = $this->userWithRole('admin');
        $originalPassword = $admin->password;

        $this->actingAs($admin)
            ->postJson("/api/admin/users/{$admin->id}/reset-password", [
                'password' => 'Temporary123!',
            ])
            ->assertForbidden();

        $admin->refresh();
        $this->assertSame($originalPassword, $admin->password);
        $this->assertDatabaseMissing('audit_logs', [
            'action' => 'user.password_reset',
            'entity_type' => User::class,
            'entity_id' => $admin->id,
        ]);
    }

    public function test_user_manager_without_admin_assignment_permission_cannot_create_admin(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $manager = User::factory()->create();
        $manager->givePermissionTo(['users.create', 'users.view']);

        $this->actingAs($manager)
            ->postJson('/api/admin/users', [
                'name' => 'Nuevo Admin',
                'email' => 'nuevo-admin@hospital.local',
                'username' => 'nuevo-admin',
                'password' => 'Temporary123!',
                'role' => 'admin',
                'active' => true,
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('role');
    }

    public function test_user_manager_without_admin_assignment_permission_cannot_create_elevated_operational_roles(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $manager = User::factory()->create();
        $manager->givePermissionTo(['users.create', 'users.view']);

        foreach (['supervisor', 'auditor'] as $role) {
            $this->actingAs($manager)
                ->postJson('/api/admin/users', [
                    'name' => "Nuevo {$role}",
                    'email' => "nuevo-{$role}@hospital.local",
                    'username' => "nuevo-{$role}",
                    'password' => 'Temporary123!',
                    'role' => $role,
                    'active' => true,
                ])
                ->assertUnprocessable()
                ->assertJsonValidationErrors('role');
        }

        $this->assertDatabaseMissing('users', [
            'username' => 'nuevo-supervisor',
        ]);
        $this->assertDatabaseMissing('users', [
            'username' => 'nuevo-auditor',
        ]);
    }

    public function test_user_manager_without_admin_assignment_permission_cannot_assign_custom_role_with_advanced_receipt_permission(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $manager = User::factory()->create();
        $manager->givePermissionTo(['users.create', 'users.view']);
        $role = Role::query()->create([
            'name' => 'soporte_recibos_avanzado',
            'guard_name' => 'web',
        ]);
        $role->givePermissionTo('receipt_settings.advanced');

        $this->actingAs($manager)
            ->postJson('/api/admin/users', [
                'name' => 'Soporte Recibos',
                'email' => 'soporte-recibos@hospital.local',
                'username' => 'soporte-recibos',
                'password' => 'Temporary123!',
                'role' => 'soporte_recibos_avanzado',
                'active' => true,
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('role');

        $this->assertDatabaseMissing('users', [
            'username' => 'soporte-recibos',
        ]);
    }

    public function test_user_editor_rejects_unknown_role_on_create(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $admin = $this->userWithRole('admin');

        $this->actingAs($admin)
            ->postJson('/api/admin/users', [
                'name' => 'Rol Fantasma',
                'email' => 'rol-fantasma@hospital.local',
                'username' => 'rol-fantasma',
                'password' => 'Temporary123!',
                'role' => 'rol_inexistente',
                'active' => true,
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('role');

        $this->assertDatabaseMissing('users', [
            'username' => 'rol-fantasma',
        ]);
    }

    public function test_user_manager_without_admin_assignment_permission_cannot_promote_user_to_admin(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $manager = User::factory()->create();
        $manager->givePermissionTo(['users.update', 'users.view']);
        $target = User::factory()->create([
            'username' => 'target-cashier-promote',
            'email' => 'target-cashier-promote@hospital.local',
        ]);
        $target->assignRole('cajero');

        $this->actingAs($manager)
            ->patchJson("/api/admin/users/{$target->id}", [
                'name' => $target->name,
                'email' => $target->email,
                'username' => $target->username,
                'role' => 'admin',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('role');
    }

    public function test_user_manager_without_admin_assignment_permission_cannot_promote_user_to_elevated_operational_role(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $manager = User::factory()->create();
        $manager->givePermissionTo(['users.update', 'users.view']);
        $target = User::factory()->create([
            'username' => 'target-cashier-supervisor',
            'email' => 'target-cashier-supervisor@hospital.local',
        ]);
        $target->assignRole('cajero');

        $this->actingAs($manager)
            ->patchJson("/api/admin/users/{$target->id}", [
                'name' => $target->name,
                'email' => $target->email,
                'username' => $target->username,
                'role' => 'supervisor',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('role');

        $this->assertTrue($target->refresh()->hasRole('cajero'));
        $this->assertFalse($target->hasRole('supervisor'));
    }

    public function test_user_manager_without_admin_assignment_permission_cannot_demote_admin(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $manager = User::factory()->create();
        $manager->givePermissionTo(['users.update', 'users.view']);
        $admin = User::factory()->create([
            'username' => 'protected-admin-demote',
            'email' => 'protected-admin-demote@hospital.local',
        ]);
        $admin->assignRole('admin');

        $this->actingAs($manager)
            ->patchJson("/api/admin/users/{$admin->id}", [
                'name' => $admin->name,
                'email' => $admin->email,
                'username' => $admin->username,
                'role' => 'cajero',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('role');

        $this->assertTrue($admin->refresh()->hasRole('admin'));
        $this->assertFalse($admin->hasRole('cajero'));
    }

    public function test_user_manager_without_admin_assignment_permission_cannot_reset_or_deactivate_admin(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $manager = User::factory()->create();
        $manager->givePermissionTo(['users.update', 'users.disable', 'users.view']);
        $admin = User::factory()->create([
            'username' => 'protected-admin-actions',
            'email' => 'protected-admin-actions@hospital.local',
        ]);
        $admin->assignRole('admin');
        $originalPassword = $admin->password;

        $this->actingAs($manager)
            ->postJson("/api/admin/users/{$admin->id}/reset-password", [
                'password' => 'Temporary123!',
            ])
            ->assertForbidden();

        $this->actingAs($manager)
            ->postJson("/api/admin/users/{$admin->id}/toggle-active")
            ->assertForbidden();

        $admin->refresh();
        $this->assertTrue($admin->active);
        $this->assertSame($originalPassword, $admin->password);
    }

    public function test_admin_can_create_user_with_direct_module_permissions(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $admin = $this->userWithRole('admin');

        $response = $this->actingAs($admin)
            ->postJson('/api/admin/users', [
                'name' => 'Caja Laboratorio',
                'email' => 'caja-laboratorio@hospital.local',
                'username' => 'caja-laboratorio',
                'password' => 'Temporary123!',
                'role' => 'cajero',
                'permissions' => ['catalog.view', 'invoices.create'],
                'active' => true,
            ])
            ->assertCreated()
            ->assertJsonPath('data.direct_permissions', ['catalog.view', 'invoices.create'])
            ->assertJsonPath('data.permissions', ['catalog.view', 'invoices.create']);

        $created = User::query()->where('username', 'caja-laboratorio')->firstOrFail();

        $this->assertTrue($created->hasDirectPermission('catalog.view'));
        $this->assertTrue($created->hasDirectPermission('invoices.create'));
        $this->assertTrue($created->hasRole('cajero'));
        $this->assertSame($created->id, $response->json('data.id'));

        $audit = AuditLog::query()
            ->where('action', 'user.created')
            ->where('entity_type', User::class)
            ->where('entity_id', $created->id)
            ->firstOrFail();

        $this->assertSame($admin->id, $audit->user_id);
        $this->assertSame('success', $audit->result);
        $this->assertSame(['cajero'], $audit->new_values['roles'] ?? null);
        $this->assertSame(['catalog.view', 'invoices.create'], $audit->new_values['direct_permissions'] ?? null);
        $this->assertSame(['catalog.view', 'invoices.create'], $audit->new_values['effective_permissions'] ?? null);
        $this->assertArrayNotHasKey('password', $audit->new_values ?? []);
        $this->assertArrayNotHasKey('password', $audit->old_values ?? []);
    }

    public function test_admin_cannot_create_active_user_with_empty_direct_module_permissions(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $admin = $this->userWithRole('admin');

        $this->actingAs($admin)
            ->postJson('/api/admin/users', [
                'name' => 'Sin Modulos',
                'email' => 'sin-modulos@hospital.local',
                'username' => 'sin-modulos',
                'password' => 'Temporary123!',
                'role' => 'cajero',
                'permissions' => [],
                'active' => true,
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('permissions');
    }

    public function test_admin_can_prepare_inactive_user_with_empty_direct_module_permissions(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $admin = $this->userWithRole('admin');

        $this->actingAs($admin)
            ->postJson('/api/admin/users', [
                'name' => 'Pendiente Modulos',
                'email' => 'pendiente-modulos@hospital.local',
                'username' => 'pendiente-modulos',
                'password' => 'Temporary123!',
                'role' => 'cajero',
                'permissions' => [],
                'active' => false,
            ])
            ->assertCreated()
            ->assertJsonPath('data.active', false)
            ->assertJsonPath('data.direct_permissions', [])
            ->assertJsonPath('data.permissions', []);
    }

    public function test_admin_cannot_reactivate_exact_access_user_without_module_permissions(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $admin = $this->userWithRole('admin');
        $target = User::factory()->create([
            'username' => 'inactive-empty-perms',
            'email' => 'inactive-empty-perms@hospital.local',
            'active' => false,
            'deactivated_at' => now(),
        ]);
        $target->assignRole('cajero');
        $target->syncPermissions([User::EXACT_ACCESS_MARKER_PERMISSION]);

        $this->actingAs($admin)
            ->postJson("/api/admin/users/{$target->id}/toggle-active")
            ->assertUnprocessable()
            ->assertJsonValidationErrors('permissions');

        $this->assertFalse($target->refresh()->active);
    }

    public function test_admin_can_update_user_direct_module_permissions(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $admin = $this->userWithRole('admin');
        $target = User::factory()->create([
            'username' => 'target-direct-perms',
            'email' => 'target-direct-perms@hospital.local',
        ]);
        $target->assignRole('cajero');
        $target->givePermissionTo('catalog.view');

        $this->actingAs($admin)
            ->patchJson("/api/admin/users/{$target->id}", [
                'name' => $target->name,
                'email' => $target->email,
                'username' => $target->username,
                'role' => 'cajero',
                'permissions' => ['cash.view', 'payments.view'],
            ])
            ->assertOk()
            ->assertJsonPath('data.direct_permissions', ['cash.view', 'payments.view'])
            ->assertJsonPath('data.permissions', ['cash.view', 'payments.view']);

        $target->refresh();

        $this->assertFalse($target->hasDirectPermission('catalog.view'));
        $this->assertTrue($target->hasDirectPermission('cash.view'));
        $this->assertTrue($target->hasDirectPermission('payments.view'));
    }

    public function test_admin_cannot_update_active_user_to_empty_direct_module_permissions(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $admin = $this->userWithRole('admin');
        $target = User::factory()->create([
            'username' => 'target-empty-perms',
            'email' => 'target-empty-perms@hospital.local',
            'active' => true,
        ]);
        $target->assignRole('cajero');
        $target->givePermissionTo('catalog.view');

        $this->actingAs($admin)
            ->patchJson("/api/admin/users/{$target->id}", [
                'name' => $target->name,
                'email' => $target->email,
                'username' => $target->username,
                'role' => 'cajero',
                'permissions' => [],
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('permissions');
    }

    public function test_direct_module_permissions_override_role_permissions_for_authorization(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $target = User::factory()->create([
            'username' => 'exact-access-user',
            'email' => 'exact-access-user@hospital.local',
        ]);
        $target->assignRole('cajero');
        $target->syncPermissions([User::EXACT_ACCESS_MARKER_PERMISSION, 'reports.view']);

        $this->assertTrue($target->can('reports.view'));
        $this->assertFalse($target->can('cash.open'));
        $this->assertFalse($target->can('invoices.create'));
    }

    public function test_regular_direct_permissions_still_augment_role_without_exact_marker(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $target = User::factory()->create([
            'username' => 'augmented-access-user',
            'email' => 'augmented-access-user@hospital.local',
        ]);
        $target->assignRole('cajero');
        $target->givePermissionTo('patients.mark_dialysis_prescription');

        $this->assertTrue($target->can('patients.mark_dialysis_prescription'));
        $this->assertTrue($target->can('cash.open'));
        $this->assertTrue($target->can('invoices.create'));
    }

    public function test_user_manager_cannot_assign_protected_direct_permissions(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $manager = User::factory()->create();
        $manager->givePermissionTo(['users.create', 'users.view']);

        $this->actingAs($manager)
            ->postJson('/api/admin/users', [
                'name' => 'Gestor peligroso',
                'email' => 'gestor-peligroso@hospital.local',
                'username' => 'gestor-peligroso',
                'password' => 'Temporary123!',
                'role' => 'cajero',
                'permissions' => ['users.assign_admin_role'],
                'active' => true,
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('permissions');
    }

    public function test_user_manager_without_role_management_permission_cannot_assign_any_direct_permissions(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $manager = User::factory()->create();
        $manager->givePermissionTo(['users.create', 'users.view']);

        $this->actingAs($manager)
            ->postJson('/api/admin/users', [
                'name' => 'Gestor Caja',
                'email' => 'gestor-caja@hospital.local',
                'username' => 'gestor-caja',
                'password' => 'Temporary123!',
                'role' => 'cajero',
                'permissions' => ['payments.void'],
                'active' => true,
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('permissions');
    }

    public function test_user_editor_rejects_roles_from_other_guards(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $admin = $this->userWithRole('admin');
        Role::query()->create([
            'name' => 'api_only_operator',
            'guard_name' => 'api',
        ]);

        $this->actingAs($admin)
            ->postJson('/api/admin/users', [
                'name' => 'Rol Api',
                'email' => 'rol-api@hospital.local',
                'username' => 'rol-api',
                'password' => 'Temporary123!',
                'role' => 'api_only_operator',
                'active' => true,
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('role');
    }

    public function test_user_editor_rejects_internal_exact_permission_marker_from_payload(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $admin = $this->userWithRole('admin');

        $this->actingAs($admin)
            ->postJson('/api/admin/users', [
                'name' => 'Marcador Interno',
                'email' => 'marcador-interno@hospital.local',
                'username' => 'marcador-interno',
                'password' => 'Temporary123!',
                'role' => 'cajero',
                'permissions' => [User::EXACT_ACCESS_MARKER_PERMISSION],
                'active' => true,
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('permissions.0');
    }

    public function test_user_editor_rejects_inoperable_permissions_hidden_from_catalog(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $admin = $this->userWithRole('admin');
        Permission::query()->firstOrCreate([
            'name' => 'backups.restore',
            'guard_name' => 'web',
        ]);

        foreach (['backups.restore', 'receipts.void'] as $permission) {
            $permissionSlug = str_replace('.', '-', $permission);
            $this->actingAs($admin)
                ->postJson('/api/admin/users', [
                    'name' => 'Permiso Inoperable',
                    'email' => 'permiso-inoperable-'.$permissionSlug.'@hospital.local',
                    'username' => 'permiso-inoperable-'.$permissionSlug,
                    'password' => 'Temporary123!',
                    'role' => 'cajero',
                    'permissions' => [$permission],
                    'active' => true,
                ])
                ->assertUnprocessable()
                ->assertJsonValidationErrors('permissions.0');
        }
    }

    public function test_user_editor_rejects_legacy_custom_roles_with_reserved_admin_permissions(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $admin = $this->userWithRole('admin');

        $legacyRole = Role::query()->create([
            'name' => 'legacy_admin_proxy',
            'guard_name' => 'web',
        ]);
        $legacyRole->givePermissionTo('users.assign_admin_role');

        $this->actingAs($admin)
            ->postJson('/api/admin/users', [
                'name' => 'Legacy Admin Proxy',
                'email' => 'legacy-admin-proxy@hospital.local',
                'username' => 'legacy-admin-proxy',
                'password' => 'Temporary123!',
                'role' => 'legacy_admin_proxy',
                'active' => true,
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('role');
    }

    public function test_user_manager_cannot_assign_case_variant_admin_role_without_admin_assignment_permission(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $manager = User::factory()->create();
        $manager->givePermissionTo(['users.create', 'users.view']);

        Role::query()
            ->where('name', 'admin')
            ->where('guard_name', 'web')
            ->firstOrFail()
            ->forceFill(['name' => 'Admin'])
            ->save();

        $this->actingAs($manager)
            ->postJson('/api/admin/users', [
                'name' => 'Admin Mayuscula',
                'email' => 'admin-mayuscula@hospital.local',
                'username' => 'admin-mayuscula',
                'password' => 'Temporary123!',
                'role' => 'Admin',
                'active' => true,
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('role');
    }

    public function test_admin_cannot_change_own_direct_permissions_from_user_editor(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $admin = User::factory()->create([
            'username' => 'self-admin-direct',
            'email' => 'self-admin-direct@hospital.local',
        ]);
        $admin->assignRole('admin');

        $this->actingAs($admin)
            ->patchJson("/api/admin/users/{$admin->id}", [
                'name' => $admin->name,
                'email' => $admin->email,
                'username' => $admin->username,
                'role' => 'admin',
                'permissions' => ['catalog.view'],
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('permissions');
    }

    private function userWithRole(string $role): User
    {
        $user = User::factory()->create();
        $user->assignRole($role);

        return $user;
    }
}
