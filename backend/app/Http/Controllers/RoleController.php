<?php

namespace App\Http\Controllers;

use App\Http\Requests\Admin\StoreRoleRequest;
use App\Http\Requests\Admin\UpdateRoleRequest;
use App\Support\AuditLogger;
use App\Support\RoleCatalog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

class RoleController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        abort_unless($request->user()?->can('users.view'), 403);

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

        $role = Role::query()->create([
            'name' => $validated['name'],
            'guard_name' => 'web',
        ]);
        $role->syncPermissions($validated['permissions']);

        app(PermissionRegistrar::class)->forgetCachedPermissions();

        $role->load('permissions');

        $auditLogger->log(
            action: 'role.created',
            entity: $role,
            user: $request->user(),
            request: $request,
            newValues: $this->auditPayload($role),
        );

        return response()->json([
            'data' => $this->transformRole($role),
        ], 201);
    }

    public function update(UpdateRoleRequest $request, Role $role, AuditLogger $auditLogger): JsonResponse
    {
        $validated = $request->validated();

        $oldValues = $this->auditPayload($role->load('permissions'));

        $role->forceFill([
            'name' => $validated['name'],
            'guard_name' => 'web',
        ])->save();
        $role->syncPermissions($validated['permissions']);

        app(PermissionRegistrar::class)->forgetCachedPermissions();

        $role->load('permissions');

        $auditLogger->log(
            action: 'role.updated',
            entity: $role,
            user: $request->user(),
            request: $request,
            oldValues: $oldValues,
            newValues: $this->auditPayload($role),
        );

        return response()->json([
            'data' => $this->transformRole($role),
        ]);
    }

    private function transformRole(Role $role): array
    {
        $permissions = [];

        foreach ($role->permissions->sortBy('name') as $permission) {
            if (! $permission instanceof Permission || in_array($permission->name, RoleCatalog::hiddenPermissionNames(), true)) {
                continue;
            }

            $permissions[] = [
                'name' => $permission->name,
                'module' => $this->moduleForPermission($permission->name),
                'label' => $this->labelForPermission($permission->name),
            ];
        }

        return [
            'id' => $role->id,
            'name' => $role->name,
            'protected' => RoleCatalog::isProtectedRoleName($role->name),
            'permissions' => $permissions,
        ];
    }

    /**
     * @return list<array{module: string, label: string, permissions: list<array{name: string, module: string, label: string}>}>
     */
    private function permissionCatalog(): array
    {
        return Permission::query()
            ->where('guard_name', 'web')
            ->whereNotIn('name', RoleCatalog::hiddenPermissionNames())
            ->orderBy('name')
            ->get()
            ->groupBy(fn (Permission $permission): string => $this->moduleForPermission($permission->name))
            ->map(fn ($permissions, string $module): array => [
                'module' => $module,
                'label' => $this->labelForModule($module),
                'permissions' => $permissions
                    ->map(fn (Permission $permission): array => [
                        'name' => $permission->name,
                        'module' => $module,
                        'label' => $this->labelForPermission($permission->name),
                    ])
                    ->values()
                    ->all(),
            ])
            ->values()
            ->all();
    }

    private function moduleForPermission(string $permission): string
    {
        return str_contains($permission, '.')
            ? explode('.', $permission, 2)[0]
            : 'system';
    }

    private function labelForModule(string $module): string
    {
        return ucfirst(str_replace('_', ' ', $module));
    }

    private function labelForPermission(string $permission): string
    {
        return ucfirst(str_replace(['.', '_'], [' - ', ' '], $permission));
    }

    /**
     * @return array{name: string, protected: bool, permissions: list<string>}
     */
    private function auditPayload(Role $role): array
    {
        return [
            'name' => $role->name,
            'protected' => RoleCatalog::isProtectedRoleName($role->name),
            'permissions' => $role->permissions->pluck('name')->sort()->values()->all(),
        ];
    }
}
