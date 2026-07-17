<?php

namespace App\Http\Controllers;

use App\Http\Requests\Admin\StoreRoleRequest;
use App\Http\Requests\Admin\UpdateRoleRequest;
use App\Support\AuditLogger;
use App\Support\RoleCatalog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

class RoleController extends Controller
{
    private const MODULE_LABELS = [
        'audit' => 'Auditoria',
        'backups' => 'Respaldos',
        'cash' => 'Caja',
        'catalog' => 'Catalogo',
        'fiscal' => 'Configuracion fiscal',
        'invoices' => 'Facturacion',
        'patients' => 'Pacientes',
        'payments' => 'Pagos',
        'receipt_settings' => 'Recibos',
        'receipts' => 'Recibos',
        'reports' => 'Reportes',
        'settings' => 'Configuracion',
        'system' => 'Sistema',
        'users' => 'Usuarios',
    ];

    private const PERMISSION_LABELS = [
        'audit.view' => 'Ver auditoria',
        'backups.create' => 'Crear respaldos',
        'backups.download' => 'Descargar respaldos',
        'backups.view' => 'Ver respaldos',
        'cash.close' => 'Cerrar caja propia',
        'cash.close_any' => 'Cerrar o revisar cajas de otros cajeros',
        'cash.open' => 'Abrir caja',
        'cash.view' => 'Ver caja',
        'catalog.manage' => 'Administrar servicios y precios',
        'catalog.view' => 'Ver catalogo',
        'fiscal.sequences.reset' => 'Ajustar correlativos fiscales',
        'invoices.create' => 'Crear facturas',
        'invoices.operate_any' => 'Operar facturas de otros usuarios',
        'invoices.reverse' => 'Reversar pagos y factura',
        'invoices.view' => 'Ver historial de facturas',
        'invoices.void' => 'Anular facturas',
        'patients.mark_dialysis_prescription' => 'Marcar receta de dialisis',
        'payments.create' => 'Cobrar facturas',
        'payments.view' => 'Ver pagos',
        'payments.void' => 'Reversar pagos',
        'receipt_settings.advanced' => 'Soporte tecnico de impresion',
        'receipt_settings.update' => 'Editar recibos y series',
        'receipt_settings.view' => 'Ver configuracion de recibos',
        'receipts.print_test' => 'Imprimir prueba de recibo',
        'receipts.reprint' => 'Reimprimir recibos',
        'receipts.reprint_any' => 'Reimprimir recibos de otros cajeros',
        'receipts.view' => 'Ver recibos',
        'reports.cash_session.view' => 'Ver reporte de caja',
        'reports.export' => 'Exportar reportes',
        'reports.managerial.view' => 'Ver reportes ejecutivos',
        'settings.fiscal.update' => 'Editar configuracion fiscal',
        'settings.fiscal.view' => 'Ver configuracion fiscal',
        'settings.operational.update' => 'Editar reglas operativas',
        'system.status.view' => 'Ver estado del sistema',
        'users.create' => 'Crear usuarios',
        'users.disable' => 'Desactivar usuarios',
        'users.update' => 'Editar usuarios y roles',
        'users.view' => 'Ver usuarios',
    ];

    public function index(Request $request): JsonResponse
    {
        abort_unless($this->authenticatedUser($request)->can('users.view'), 403);

        return response()->json([
            'data' => Role::query()
                ->with('permissions')
                ->where('guard_name', 'web')
                ->orderBy('name')
                ->get()
                ->map(fn (Role $role): array => $this->transformRole($role))
                ->values(),
            'permission_catalog' => $this->permissionCatalog(),
        ]);
    }

    public function store(StoreRoleRequest $request, AuditLogger $auditLogger): JsonResponse
    {
        $validated = $request->validated();

        $role = DB::transaction(function () use ($validated, $auditLogger, $request): Role {
            $role = Role::query()->create([
                'name' => $validated['name'],
                'guard_name' => 'web',
            ]);
            $role->syncPermissions($validated['permissions']);
            $role->load('permissions');

            $auditLogger->log(
                action: 'role.created',
                entity: $role,
                user: $request->user(),
                request: $request,
                newValues: $this->auditPayload($role),
            );

            return $role;
        });

        app(PermissionRegistrar::class)->forgetCachedPermissions();

        return response()->json([
            'data' => $this->transformRole($role),
        ], 201);
    }

    public function update(UpdateRoleRequest $request, Role $role, AuditLogger $auditLogger): JsonResponse
    {
        $validated = $request->validated();

        DB::transaction(function () use ($role, $validated, $auditLogger, $request): void {
            $oldValues = $this->auditPayload($role->load('permissions'));

            $role->forceFill([
                'name' => $validated['name'],
                'guard_name' => 'web',
            ])->save();
            $role->syncPermissions($validated['permissions']);
            $role->load('permissions');

            $auditLogger->log(
                action: 'role.updated',
                entity: $role,
                user: $request->user(),
                request: $request,
                oldValues: $oldValues,
                newValues: $this->auditPayload($role),
            );
        });

        app(PermissionRegistrar::class)->forgetCachedPermissions();

        return response()->json([
            'data' => $this->transformRole($role),
        ]);
    }

    /**
     * @return array{id: int, name: string, protected: bool, permissions: list<array{name: string, module: string, label: string, critical: bool, risk_level: 'critical'|'standard', risk_label: string|null}>}
     */
    private function transformRole(Role $role): array
    {
        $permissions = [];

        foreach ($role->permissions->sortBy('name') as $permission) {
            if (! $permission instanceof Permission || in_array($permission->name, RoleCatalog::hiddenPermissionNames(), true)) {
                continue;
            }

            $permissions[] = $this->transformPermission($permission);
        }

        return [
            'id' => (int) $role->getKey(),
            'name' => $role->name,
            'protected' => RoleCatalog::isProtectedRoleName($role->name),
            'permissions' => $permissions,
        ];
    }

    /**
     * @return list<array{module: string, label: string, permissions: list<array{name: string, module: string, label: string, critical: bool, risk_level: 'critical'|'standard', risk_label: string|null}>}>
     */
    private function permissionCatalog(): array
    {
        $groupedPermissions = Permission::query()
            ->where('guard_name', 'web')
            ->whereNotIn('name', RoleCatalog::hiddenPermissionNames())
            ->orderBy('name')
            ->get()
            ->groupBy(fn (Permission $permission): string => $this->moduleForPermission($permission->name));

        $catalog = [];
        foreach ($groupedPermissions as $module => $permissions) {
            if (! is_string($module)) {
                continue;
            }

            $items = [];
            foreach ($permissions as $permission) {
                $items[] = $this->transformPermission($permission, $module);
            }

            $catalog[] = [
                'module' => $module,
                'label' => $this->labelForModule($module),
                'permissions' => $items,
            ];
        }

        return $catalog;
    }

    /**
     * @return array{name: string, module: string, label: string, critical: bool, risk_level: 'critical'|'standard', risk_label: string|null}
     */
    private function transformPermission(Permission $permission, ?string $module = null): array
    {
        $risk = RoleCatalog::permissionRiskMetadata($permission->name);

        return [
            'name' => $permission->name,
            'module' => $module ?? $this->moduleForPermission($permission->name),
            'label' => $this->labelForPermission($permission->name),
            'critical' => $risk['critical'],
            'risk_level' => $risk['risk_level'],
            'risk_label' => $risk['risk_label'],
        ];
    }

    private function moduleForPermission(string $permission): string
    {
        return str_contains($permission, '.')
            ? explode('.', $permission, 2)[0]
            : 'system';
    }

    private function labelForModule(string $module): string
    {
        return self::MODULE_LABELS[$module] ?? ucfirst(str_replace('_', ' ', $module));
    }

    private function labelForPermission(string $permission): string
    {
        return self::PERMISSION_LABELS[$permission] ?? ucfirst(str_replace(['.', '_'], [' - ', ' '], $permission));
    }

    /**
     * @return array{name: string, protected: bool, permissions: list<string>}
     */
    private function auditPayload(Role $role): array
    {
        $permissions = [];
        foreach ($role->permissions as $permission) {
            if ($permission instanceof Permission) {
                $permissions[] = $permission->name;
            }
        }
        sort($permissions);

        return [
            'name' => $role->name,
            'protected' => RoleCatalog::isProtectedRoleName($role->name),
            'permissions' => $permissions,
        ];
    }
}
