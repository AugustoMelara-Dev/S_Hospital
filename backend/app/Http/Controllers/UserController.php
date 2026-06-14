<?php

namespace App\Http\Controllers;

use App\Http\Requests\Admin\IndexUserRequest;
use App\Http\Requests\Admin\ResetUserPasswordRequest;
use App\Http\Requests\Admin\StoreUserRequest;
use App\Http\Requests\Admin\ToggleUserActiveRequest;
use App\Http\Requests\Admin\UpdateUserRequest;
use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Hash;

class UserController extends Controller
{
    public function index(IndexUserRequest $request): JsonResponse
    {
        $users = User::query()
            ->with('roles')
            ->orderBy('name')
            ->get()
            ->map(fn (User $user) => $this->transformUser($user));

        return response()->json([
            'data' => $users,
        ]);
    }

    public function store(StoreUserRequest $request): JsonResponse
    {
        $validated = $request->validated();

        $user = User::create([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'username' => $validated['username'],
            'password' => Hash::make($validated['password']),
            'active' => $validated['active'] ?? true,
            'must_change_password' => true,
        ]);

        $user->assignRole($validated['role']);

        $this->auditUserChange($request, $user, 'user.created', null, [
            'name' => $user->name,
            'email' => $user->email,
            'username' => $user->username,
            'active' => $user->active,
            'role' => $validated['role'],
            'must_change_password' => $user->must_change_password,
        ]);

        return response()->json([
            'data' => $this->transformUser($user->load('roles')),
        ], 201);
    }

    public function update(UpdateUserRequest $request, User $user): JsonResponse
    {
        $validated = $request->validated();
        $oldValues = [
            'name' => $user->name,
            'email' => $user->email,
            'username' => $user->username,
            'roles' => $user->getRoleNames()->values()->all(),
        ];

        $user->update([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'username' => $validated['username'],
        ]);

        if (! $user->hasRole($validated['role'])) {
            $user->syncRoles([$validated['role']]);
        }

        $this->auditUserChange($request, $user->refresh(), 'user.updated', $oldValues, [
            'name' => $user->name,
            'email' => $user->email,
            'username' => $user->username,
            'roles' => $user->getRoleNames()->values()->all(),
        ]);

        return response()->json([
            'data' => $this->transformUser($user->load('roles')),
        ]);
    }

    public function toggleActive(ToggleUserActiveRequest $request, User $user): JsonResponse
    {
        $oldActive = (bool) $user->active;

        $user->update([
            'active' => ! $user->active,
        ]);

        $this->auditUserChange(
            $request,
            $user->refresh(),
            $user->active ? 'user.enabled' : 'user.disabled',
            ['active' => $oldActive],
            [
                'username' => $user->username,
                'active' => (bool) $user->active,
            ],
        );

        return response()->json([
            'data' => $this->transformUser($user->load('roles')),
        ]);
    }

    public function resetPassword(ResetUserPasswordRequest $request, User $user): JsonResponse
    {
        $validated = $request->validated();

        $user->forceFill([
            'password' => Hash::make($validated['password']),
            'must_change_password' => true,
        ])->save();

        $this->auditUserChange($request, $user->refresh(), 'user.password_reset', null, [
            'username' => $user->username,
            'must_change_password' => true,
        ]);

        return response()->json([
            'data' => $this->transformUser($user->load('roles')),
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
            'must_change_password' => $user->must_change_password,
        ];
    }

    /**
     * @param  array<string, mixed>|null  $oldValues
     * @param  array<string, mixed>|null  $newValues
     */
    private function auditUserChange(
        \Illuminate\Http\Request $request,
        User $target,
        string $action,
        ?array $oldValues,
        ?array $newValues,
    ): void {
        AuditLog::query()->create([
            'user_id' => $request->user()?->id,
            'action' => $action,
            'entity_type' => User::class,
            'entity_id' => $target->id,
            'old_values' => $oldValues,
            'new_values' => $newValues,
            'ip' => $request->ip(),
            'user_agent' => (string) $request->userAgent(),
        ]);
    }
}
