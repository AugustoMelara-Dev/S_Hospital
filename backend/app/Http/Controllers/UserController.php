<?php

namespace App\Http\Controllers;

use App\Http\Requests\Admin\IndexUserRequest;
use App\Http\Requests\Admin\ResetUserPasswordRequest;
use App\Http\Requests\Admin\StoreUserRequest;
use App\Http\Requests\Admin\ToggleUserActiveRequest;
use App\Http\Requests\Admin\UpdateUserRequest;
use App\Models\User;
use App\Support\AuditLogger;
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

    public function store(StoreUserRequest $request, AuditLogger $auditLogger): JsonResponse
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
        $user->load('roles');

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
        $oldValues = $this->auditPayload($user->load('roles'));

        $user->update([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'username' => $validated['username'],
        ]);

        if (! $user->hasRole($validated['role'])) {
            $user->syncRoles([$validated['role']]);
        }

        $user->load('roles');

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
        $oldValues = $this->auditPayload($user);
        $user->update([
            'active' => ! $user->active,
        ]);
        $user->load('roles');

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
        $user->load('roles');

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
            'must_change_password' => $user->must_change_password,
        ];
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
            'must_change_password' => $user->must_change_password,
        ];
    }
}
