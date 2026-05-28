<?php

namespace App\Http\Controllers;

use App\Http\Requests\Admin\StoreUserRequest;
use App\Http\Requests\Admin\UpdateUserRequest;
use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class UserController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', User::class);

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

        $user = DB::transaction(function () use ($validated, $request): User {
            $user = User::create([
                'name' => $validated['name'],
                'email' => $validated['email'],
                'username' => $validated['username'],
                'password' => Hash::make($validated['password']),
                'active' => $validated['active'] ?? true,
                'must_change_password' => true,
            ]);

            $user->assignRole($validated['role']);
            $this->audit($request, 'user.created', $user->refresh(), null);

            return $user;
        });

        return response()->json([
            'data' => $this->transformUser($user->load('roles')),
        ], 201);
    }

    public function update(UpdateUserRequest $request, User $user): JsonResponse
    {
        $validated = $request->validated();

        $user = DB::transaction(function () use ($validated, $request, $user): User {
            $oldValues = $this->auditPayload($user);

            $user->update([
                'name' => $validated['name'],
                'email' => $validated['email'],
                'username' => $validated['username'],
            ]);

            $user->syncRoles([$validated['role']]);
            $this->audit($request, 'user.updated', $user->refresh(), $oldValues);

            return $user;
        });

        return response()->json([
            'data' => $this->transformUser($user->load('roles')),
        ]);
    }

    public function toggleActive(Request $request, User $user): JsonResponse
    {
        $this->authorize('disable', $user);

        // Prevent disabling yourself
        if ($user->id === $request->user()->id) {
            throw ValidationException::withMessages([
                'active' => ['No puedes desactivar tu propio usuario.'],
            ]);
        }

        $user = DB::transaction(function () use ($request, $user): User {
            $oldValues = $this->auditPayload($user);

            $user->update([
                'active' => ! $user->active,
            ]);

            $this->audit($request, 'user.status_updated', $user->refresh(), $oldValues);

            return $user;
        });

        return response()->json([
            'data' => $this->transformUser($user->load('roles')),
        ]);
    }

    public function resetPassword(Request $request, User $user): JsonResponse
    {
        $this->authorize('resetPassword', $user);

        $validated = $request->validate([
            'password' => ['required', 'string', \Illuminate\Validation\Rules\Password::min(10)->letters()->numbers()],
        ]);

        $user = DB::transaction(function () use ($validated, $request, $user): User {
            $oldValues = $this->auditPayload($user);

            $user->forceFill([
                'password' => Hash::make($validated['password']),
                'must_change_password' => true,
            ])->save();

            $this->audit($request, 'user.password_reset', $user->refresh(), $oldValues);

            return $user;
        });

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
     * Helper to write security AuditLogs
     *
     * @param  array<string, mixed>|null  $oldValues
     */
    private function audit(Request $request, string $action, User $user, ?array $oldValues): void
    {
        AuditLog::query()->create([
            'user_id' => $request->user()->id,
            'action' => $action,
            'entity_type' => User::class,
            'entity_id' => $user->id,
            'old_values' => $oldValues,
            'new_values' => $this->auditPayload($user),
        ]);
    }

    /**
     * Helper payload for user AuditLogs
     *
     * @return array<string, mixed>
     */
    private function auditPayload(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'username' => $user->username,
            'active' => (bool) $user->active,
            'roles' => $user->getRoleNames()->values()->toArray(),
        ];
    }
}
