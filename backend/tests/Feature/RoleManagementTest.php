<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;
use Tests\TestCase;

class RoleManagementTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }

    public function test_admin_can_list_roles_with_permission_catalog_grouped_by_module(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $admin = $this->userWithRole('admin');

        $response = $this->actingAs($admin)
            ->getJson('/api/admin/roles')
            ->assertOk()
            ->assertJsonFragment(['name' => 'auditor'])
            ->assertJsonFragment(['name' => 'soporte_tecnico'])
            ->assertJsonFragment(['module' => 'settings'])
            ->assertJsonFragment(['name' => 'catalog.manage']);

        $this->assertStringNotContainsString(User::EXACT_ACCESS_MARKER_PERMISSION, $response->getContent());
        $this->assertStringNotContainsString('receipts.void', $response->getContent());
        $this->assertStringNotContainsString('reports.view', $response->getContent());
    }

    public function test_permission_catalog_labels_operational_settings_as_human_configuration_rule(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $admin = $this->userWithRole('admin');

        $response = $this->actingAs($admin)
            ->getJson('/api/admin/roles')
            ->assertOk()
            ->json('permission_catalog');

        $settingsGroup = collect($response)->firstWhere('module', 'settings');

        $this->assertSame('Configuracion', $settingsGroup['label'] ?? null);
        $permission = collect($settingsGroup['permissions'] ?? [])
            ->firstWhere('name', 'settings.operational.update');

        $this->assertSame('settings', $permission['module'] ?? null);
        $this->assertSame('Editar reglas operativas', $permission['label'] ?? null);
    }

    public function test_permission_catalog_uses_human_labels_for_operational_permissions(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $admin = $this->userWithRole('admin');

        $catalog = collect($this->actingAs($admin)
            ->getJson('/api/admin/roles')
            ->assertOk()
            ->json('permission_catalog'));

        $permissions = $catalog
            ->flatMap(fn (array $group): array => $group['permissions'] ?? [])
            ->keyBy('name');

        $this->assertSame('Cerrar o revisar cajas de otros cajeros', $permissions['cash.close_any']['label'] ?? null);
        $this->assertSame('Ver reporte de caja', $permissions['reports.cash_session.view']['label'] ?? null);
        $this->assertSame('Ver reportes ejecutivos', $permissions['reports.managerial.view']['label'] ?? null);
        $this->assertSame('Soporte tecnico de impresion', $permissions['receipt_settings.advanced']['label'] ?? null);
        $this->assertSame('Editar usuarios y roles', $permissions['users.update']['label'] ?? null);
        $this->assertSame('Marcar receta de dialisis', $permissions['patients.mark_dialysis_prescription']['label'] ?? null);
    }

    public function test_permission_catalog_marks_elevated_permissions_with_risk_metadata(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $admin = $this->userWithRole('admin');

        $catalog = collect($this->actingAs($admin)
            ->getJson('/api/admin/roles')
            ->assertOk()
            ->json('permission_catalog'));

        $permissions = $catalog
            ->flatMap(fn (array $group): array => $group['permissions'] ?? [])
            ->keyBy('name');

        $this->assertSame(true, $permissions['backups.download']['critical'] ?? null);
        $this->assertSame('critical', $permissions['backups.download']['risk_level'] ?? null);
        $this->assertSame('Permite descargar respaldos con datos hospitalarios.', $permissions['backups.download']['risk_label'] ?? null);

        $this->assertSame(false, $permissions['cash.view']['critical'] ?? null);
        $this->assertSame('standard', $permissions['cash.view']['risk_level'] ?? null);
        $this->assertNull($permissions['cash.view']['risk_label'] ?? null);
        $this->assertArrayNotHasKey('users.assign_admin_role', $permissions->all());
    }

    public function test_admin_can_create_custom_role_and_assign_it_to_user(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $admin = $this->userWithRole('admin');

        $this->actingAs($admin)
            ->postJson('/api/admin/roles', [
                'name' => 'catalog_manager',
                'permissions' => ['catalog.view', 'catalog.manage'],
            ])
            ->assertCreated()
            ->assertJsonPath('data.name', 'catalog_manager')
            ->assertJsonFragment(['name' => 'catalog.manage']);

        $this->actingAs($admin)
            ->postJson('/api/admin/users', [
                'name' => 'Gestora Catalogo',
                'email' => 'gestora.catalogo@hospital.local',
                'username' => 'gestora-catalogo',
                'password' => 'Temporary123!',
                'role' => 'catalog_manager',
                'active' => true,
            ])
            ->assertCreated()
            ->assertJsonPath('data.roles.0', 'catalog_manager');

        $created = User::query()->where('username', 'gestora-catalogo')->firstOrFail();
        $this->assertTrue($created->can('catalog.manage'));
        $this->assertFalse($created->can('invoices.create'));
    }

    public function test_user_manager_without_admin_assignment_permission_cannot_manage_roles(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $manager = User::factory()->create();
        $manager->givePermissionTo(['users.view', 'users.update']);

        $this->actingAs($manager)
            ->postJson('/api/admin/roles', [
                'name' => 'report_viewer',
                'permissions' => ['reports.view'],
            ])
            ->assertForbidden();
    }

    public function test_role_editor_rejects_internal_exact_permission_marker(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $admin = $this->userWithRole('admin');

        $this->actingAs($admin)
            ->postJson('/api/admin/roles', [
                'name' => 'invalid_internal_role',
                'permissions' => [User::EXACT_ACCESS_MARKER_PERMISSION],
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('permissions.0');
    }

    public function test_role_editor_rejects_inoperable_permissions_hidden_from_catalog(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $admin = $this->userWithRole('admin');

        $this->actingAs($admin)
            ->postJson('/api/admin/roles', [
                'name' => 'invalid_receipt_void_role',
                'permissions' => ['receipts.void'],
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('permissions.0');
    }

    public function test_role_editor_rejects_reserved_admin_assignment_permission_for_custom_roles(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $admin = $this->userWithRole('admin');

        $response = $this->actingAs($admin)
            ->getJson('/api/admin/roles')
            ->assertOk();

        $this->assertStringNotContainsString('users.assign_admin_role', $response->getContent());

        $this->actingAs($admin)
            ->postJson('/api/admin/roles', [
                'name' => 'admin_assignment_proxy',
                'permissions' => ['users.assign_admin_role'],
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('permissions.0');
    }

    public function test_built_in_admin_role_cannot_be_modified_through_role_editor(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $admin = $this->userWithRole('admin');
        $adminRole = Role::query()->where('name', 'admin')->firstOrFail();

        $this->actingAs($admin)
            ->patchJson("/api/admin/roles/{$adminRole->id}", [
                'name' => 'admin',
                'permissions' => ['users.view'],
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('role');
    }

    public function test_role_editor_rejects_roles_from_other_guards(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $admin = $this->userWithRole('admin');
        $apiRole = Role::query()->create([
            'name' => 'api_reporter',
            'guard_name' => 'api',
        ]);

        $this->actingAs($admin)
            ->patchJson("/api/admin/roles/{$apiRole->id}", [
                'name' => 'api_reporter_web',
                'permissions' => ['reports.view'],
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('role');

        $this->assertDatabaseHas('roles', [
            'id' => $apiRole->id,
            'name' => 'api_reporter',
            'guard_name' => 'api',
        ]);
    }

    public function test_role_editor_rejects_reserved_role_names(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $admin = $this->userWithRole('admin');

        $this->actingAs($admin)
            ->postJson('/api/admin/roles', [
                'name' => 'root',
                'permissions' => ['reports.view'],
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('name');

        $this->actingAs($admin)
            ->postJson('/api/admin/roles', [
                'name' => 'Admin',
                'permissions' => ['reports.view'],
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('name');

        $customRole = Role::query()->create([
            'name' => 'turno_noche',
            'guard_name' => 'web',
        ]);

        $this->actingAs($admin)
            ->patchJson("/api/admin/roles/{$customRole->id}", [
                'name' => 'admin',
                'permissions' => ['reports.view'],
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('name');

        $this->actingAs($admin)
            ->patchJson("/api/admin/roles/{$customRole->id}", [
                'name' => 'ROOT',
                'permissions' => ['reports.view'],
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('name');
    }

    private function userWithRole(string $role): User
    {
        $user = User::factory()->create();
        $user->assignRole($role);

        return $user;
    }
}
