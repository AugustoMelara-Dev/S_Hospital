<?php

namespace App\Http\Controllers;

use App\Http\Requests\Admin\IndexUserRequest;
use App\Http\Requests\Admin\ResetUserPasswordRequest;
use App\Http\Requests\Admin\StoreUserRequest;
use App\Http\Requests\Admin\ToggleUserActiveRequest;
use App\Http\Requests\Admin\UpdateUserRequest;
use App\Models\User;
use App\Support\AuditLogger;
use App\Support\VisiblePermissions;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

class UserController extends Controller
{
    private const PROTECTED_PERMISSIONS = [
        'users.assign_admin_role',
    ];

    public function index(IndexUserRequest $request): JsonResponse
    {
        $users = User::query()
            ->with(['roles', 'permissions'])
            ->orderBy('name')
            ->get()
            ->map(fn (User $user) => $this->transformUser($user));

        return response()->json([
            'data' => $users,
        ]);
    }

    public function store(StoreUserRequest $request, AuditLogger $auditLogger): JsonResponse
    {
        $validated = $request->validated();
        $this->assertCanAssignRole($request->user(), $validated['role']);
        $directPermissions = $this->directPermissionsFromRequest($request, $validated);
        $this->assertCanSyncDirectPermissions($request->user(), null, $directPermissions);
        $this->assertActiveExactPermissionMapHasAccess($directPermissions, $validated['active'] ?? true);

        $user = User::create([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'username' => $validated['username'],
            'password' => Hash::make($validated['password']),
            'active' => $validated['active'] ?? true,
            'must_change_password' => true,
        ]);

        $user->assignRole($validated['role']);
        if ($directPermissions !== null) {
            $user->syncPermissions($this->directPermissionsForExactAccess($directPermissions));
        }
        $user->load(['roles', 'permissions']);

        $auditLogger->log(
            action: 'user.created',
            entity: $user,
            user: $request->user(),
            request: $request,
            newValues: $this->auditPayload($user),
        );

        return response()->json([
            'data' => $this->transformUser($user),
        ], 201);
    }

    public function update(UpdateUserRequest $request, User $user, AuditLogger $auditLogger): JsonResponse
    {
        $validated = $request->validated();
        $oldValues = $this->auditPayload($user->load(['roles', 'permissions']));
        $this->assertCanAssignRole($request->user(), $validated['role'], $user);
        $directPermissions = $this->directPermissionsFromRequest($request, $validated);
        $this->assertCanSyncDirectPermissions($request->user(), $user, $directPermissions);
        $this->assertActiveExactPermissionMapHasAccess($directPermissions, $user->active);

        $user->update([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'username' => $validated['username'],
        ]);

        if (! $user->hasRole($validated['role'])) {
            $user->syncRoles([$validated['role']]);
        }

        if ($directPermissions !== null) {
            $user->syncPermissions($this->directPermissionsForExactAccess($directPermissions));
        }

        $user->load(['roles', 'permissions']);

        $auditLogger->log(
            action: 'user.updated',
            entity: $user,
            user: $request->user(),
            request: $request,
            oldValues: $oldValues,
            newValues: $this->auditPayload($user),
        );

        return response()->json([
            'data' => $this->transformUser($user),
        ]);
    }

    public function toggleActive(ToggleUserActiveRequest $request, User $user, AuditLogger $auditLogger): JsonResponse
    {
        $oldValues = $this->auditPayload($user->loadMissing(['roles', 'permissions']));
        $newActiveState = ! $user->active;
        if ($newActiveState) {
            $this->assertActiveExactPermissionMapHasAccess(
                $user->usesExactDirectPermissionMap()
                    ? $this->visibleDirectPermissionNames($user)->all()
                    : null,
                true,
            );
        }

        $user->update([
            'active' => $newActiveState,
            'deactivated_at' => $newActiveState ? null : now(),
        ]);
        $user->load(['roles', 'permissions']);

        $auditLogger->log(
            action: $user->active ? 'user.activated' : 'user.deactivated',
            entity: $user,
            user: $request->user(),
            request: $request,
            oldValues: $oldValues,
            newValues: $this->auditPayload($user),
            reason: $request->input('reason'),
        );

        return response()->json([
            'data' => $this->transformUser($user),
        ]);
    }

    public function resetPassword(ResetUserPasswordRequest $request, User $user, AuditLogger $auditLogger): JsonResponse
    {
        $validated = $request->validated();
        $oldValues = ['must_change_password' => $user->must_change_password];

        $user->forceFill([
            'password' => Hash::make($validated['password']),
            'must_change_password' => true,
        ])->save();
        $user->tokens()->delete();
        $user->load(['roles', 'permissions']);

        $auditLogger->log(
            action: 'user.password_reset',
            entity: $user,
            user: $request->user(),
            request: $request,
            oldValues: $oldValues,
            newValues: ['must_change_password' => true],
        );

        return response()->json([
            'data' => $this->transformUser($user),
        ]);
    }

    /**
     * Helper to transform user and its roles/permissions to simple payload
     */
    private function transformUser(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'username' => $user->username,
            'active' => $user->active,
            'roles' => $user->getRoleNames()->values(),
            'permissions' => $this->effectivePermissionNames($user),
            'direct_permissions' => $this->visibleDirectPermissionNames($user),
            'uses_exact_permission_map' => $user->usesExactDirectPermissionMap(),
            'must_change_password' => $user->must_change_password,
        ];
    }

    private function assertCanAssignRole(User $actor, string $role, ?User $target = null): void
    {
        $currentRole = $target?->getRoleNames()->first();

        if ($target instanceof User && $actor->id === $target->id && $currentRole !== $role) {
            throw ValidationException::withMessages([
                'role' => 'No puede cambiar su propio rol.',
            ]);
        }

        if ($this->isProtectedRoleName($role) && ! $actor->can('users.assign_admin_role')) {
            throw ValidationException::withMessages([
                'role' => 'No tiene permiso para asignar un rol administrativo.',
            ]);
        }

        if (! $this->isProtectedRoleName($role) && $this->roleContainsProtectedAdministrativePermissions($role)) {
            throw ValidationException::withMessages([
                'role' => 'El rol contiene permisos administrativos reservados y no se puede asignar como rol operativo.',
            ]);
        }
    }

    private function isProtectedRoleName(string $role): bool
    {
        return in_array(strtolower($role), ['admin', 'root'], true);
    }

    private function roleContainsProtectedAdministrativePermissions(string $role): bool
    {
        $roleModel = Role::query()
            ->where('name', $role)
            ->where('guard_name', 'web')
            ->with('permissions')
            ->first();

        if (! $roleModel instanceof Role) {
            return false;
        }

        return $roleModel->permissions->contains('name', 'users.assign_admin_role');
    }

    /**
     * @param  array<string, mixed>  $validated
     * @return list<string>|null
     */
    private function directPermissionsFromRequest(StoreUserRequest|UpdateUserRequest $request, array $validated): ?array
    {
        if (! $request->has('permissions')) {
            return null;
        }

        return collect($validated['permissions'] ?? [])
            ->map(fn (string $permission): string => $permission)
            ->pipe(fn (Collection $permissions): Collection => VisiblePermissions::rejectHidden($permissions))
            ->sort()
            ->values()
            ->all();
    }

    /**
     * @param  list<string>|null  $permissions
     */
    private function assertCanSyncDirectPermissions(User $actor, ?User $target, ?array $permissions): void
    {
        if ($permissions === null) {
            return;
        }

        if ($target instanceof User && $actor->id === $target->id) {
            throw ValidationException::withMessages([
                'permissions' => 'No puede cambiar sus propios permisos desde el editor de usuarios.',
            ]);
        }

        if (! $actor->can('users.assign_admin_role')) {
            throw ValidationException::withMessages([
                'permissions' => 'No tiene permiso para asignar permisos directos de modulos.',
            ]);
        }

        $protectedPermissions = array_values(array_intersect($permissions, self::PROTECTED_PERMISSIONS));

        if ($protectedPermissions !== []) {
            throw ValidationException::withMessages([
                'permissions' => 'No tiene permiso para asignar permisos administrativos.',
            ]);
        }
    }

    /**
     * @param  list<string>|null  $permissions
     */
    private function assertActiveExactPermissionMapHasAccess(?array $permissions, bool $active): void
    {
        if ($permissions === null || $permissions !== [] || ! $active) {
            return;
        }

        throw ValidationException::withMessages([
            'permissions' => 'Seleccione al menos un modulo para un usuario activo, o desactive el usuario antes de dejarlo sin acceso.',
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function auditPayload(User $user): array
    {
        return [
            'name' => $user->name,
            'email' => $user->email,
            'username' => $user->username,
            'active' => $user->active,
            'roles' => $user->getRoleNames()->values()->all(),
            'direct_permissions' => $this->visibleDirectPermissionNames($user)->all(),
            'effective_permissions' => $this->effectivePermissionNames($user)->all(),
            'must_change_password' => $user->must_change_password,
        ];
    }

    private function effectivePermissionNames(User $user): Collection
    {
        if ($user->usesExactDirectPermissionMap()) {
            return $this->visibleDirectPermissionNames($user);
        }

        return $user->getAllPermissions()
            ->pluck('name')
            ->pipe(fn (Collection $permissions): Collection => VisiblePermissions::rejectHidden($permissions))
            ->sort()
            ->values();
    }

    private function visibleDirectPermissionNames(User $user): Collection
    {
        return $user->getDirectPermissions()
            ->pluck('name')
            ->pipe(fn (Collection $permissions): Collection => VisiblePermissions::rejectHidden($permissions))
            ->sort()
            ->values();
    }

    /**
     * @param  list<string>  $permissions
     * @return list<string>
     */
    private function directPermissionsForExactAccess(array $permissions): array
    {
        Permission::query()->firstOrCreate([
            'name' => User::EXACT_ACCESS_MARKER_PERMISSION,
            'guard_name' => 'web',
        ]);

        return collect($permissions)
            ->push(User::EXACT_ACCESS_MARKER_PERMISSION)
            ->unique()
            ->sort()
            ->values()
            ->all();
    }
}
