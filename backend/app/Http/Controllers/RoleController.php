<?php

namespace App\Http\Controllers;

use App\Support\AuditLogger;
use App\Support\VisiblePermissions;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

class RoleController extends Controller
{
    private const PROTECTED_ROLES = ['admin', 'root'];

    private const RESERVED_ROLE_PERMISSIONS = [
        'users.assign_admin_role',
    ];

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

    public function store(Request $request, AuditLogger $auditLogger): JsonResponse
    {
        abort_unless($request->user()?->can('users.assign_admin_role'), 403);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:80', 'alpha_dash', $this->notProtectedRoleNameRule(), Rule::unique('roles', 'name')->where('guard_name', 'web')],
            'permissions' => ['required', 'array', 'min:1'],
            'permissions.*' => ['required', 'string', 'distinct', Rule::notIn(self::hiddenRolePermissionNames()), Rule::exists('permissions', 'name')->where('guard_name', 'web')],
        ]);

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

    public function update(Request $request, Role $role, AuditLogger $auditLogger): JsonResponse
    {
        abort_unless($request->user()?->can('users.assign_admin_role'), 403);

        if ($role->guard_name !== 'web') {
            throw ValidationException::withMessages([
                'role' => 'El rol no pertenece al guard operativo web.',
            ]);
        }

        if ($this->isProtectedRoleName($role->name)) {
            throw ValidationException::withMessages([
                'role' => 'El rol administrativo base no se puede modificar desde el editor de modulos.',
            ]);
        }

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:80', 'alpha_dash', $this->notProtectedRoleNameRule(), Rule::unique('roles', 'name')->where('guard_name', 'web')->ignore($role->id)],
            'permissions' => ['required', 'array', 'min:1'],
            'permissions.*' => ['required', 'string', 'distinct', Rule::notIn(self::hiddenRolePermissionNames()), Rule::exists('permissions', 'name')->where('guard_name', 'web')],
        ]);

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
            if (! $permission instanceof Permission || in_array($permission->name, self::hiddenRolePermissionNames(), true)) {
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
            'protected' => $this->isProtectedRoleName($role->name),
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
            ->whereNotIn('name', self::hiddenRolePermissionNames())
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

    private function isProtectedRoleName(string $role): bool
    {
        return in_array(strtolower($role), self::PROTECTED_ROLES, true);
    }

    private function notProtectedRoleNameRule(): \Closure
    {
        return function (string $attribute, mixed $value, \Closure $fail): void {
            if (is_string($value) && $this->isProtectedRoleName($value)) {
                $fail('El nombre del rol esta reservado.');
            }
        };
    }

    /**
     * @return list<string>
     */
    private static function hiddenRolePermissionNames(): array
    {
        return array_values(array_unique([
            ...VisiblePermissions::hiddenPermissionNames(),
            ...self::RESERVED_ROLE_PERMISSIONS,
        ]));
    }

    /**
     * @return array{name: string, protected: bool, permissions: list<string>}
     */
    private function auditPayload(Role $role): array
    {
        return [
            'name' => $role->name,
            'protected' => $this->isProtectedRoleName($role->name),
            'permissions' => $role->permissions->pluck('name')->sort()->values()->all(),
        ];
    }
}
