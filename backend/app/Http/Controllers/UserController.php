<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Http\Requests\Admin\IndexUserRequest;
use App\Http\Requests\Admin\ResetUserPasswordRequest;
use App\Http\Requests\Admin\StoreUserRequest;
use App\Http\Requests\Admin\ToggleUserActiveRequest;
use App\Http\Requests\Admin\UpdateUserRequest;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Hash;

class UserController extends Controller
{
    public function index(IndexUserRequest $request): JsonResponse
    {
        $users = User::query()
            ->with(['area:id,name,slug,active', 'roles'])
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
            'area_id' => $validated['area_id'] ?? null,
            'must_change_password' => true,
        ]);

        $user->assignRole($validated['role']);

        return response()->json([
            'data' => $this->transformUser($user->load(['area:id,name,slug,active', 'roles'])),
        ], 201);
    }

    public function update(UpdateUserRequest $request, User $user): JsonResponse
    {
        $validated = $request->validated();

        $user->update([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'username' => $validated['username'],
            'area_id' => $validated['area_id'] ?? null,
        ]);

        if (! $user->hasRole($validated['role'])) {
            $user->syncRoles([$validated['role']]);
        }

        return response()->json([
            'data' => $this->transformUser($user->load(['area:id,name,slug,active', 'roles'])),
        ]);
    }

    public function toggleActive(ToggleUserActiveRequest $request, User $user): JsonResponse
    {
        $user->update([
            'active' => ! $user->active,
        ]);

        return response()->json([
            'data' => $this->transformUser($user->load(['area:id,name,slug,active', 'roles'])),
        ]);
    }

    public function resetPassword(ResetUserPasswordRequest $request, User $user): JsonResponse
    {
        $validated = $request->validated();

        $user->forceFill([
            'password' => Hash::make($validated['password']),
            'must_change_password' => true,
        ])->save();

        return response()->json([
            'data' => $this->transformUser($user->load(['area:id,name,slug,active', 'roles'])),
        ]);
    }

    /**
     * Helper to transform user and its roles/permissions to simple payload
     *
     * @return array<string, mixed>
     */
    private function transformUser(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'username' => $user->username,
            'active' => $user->active,
            'area_id' => $user->area_id,
            'area' => $user->area ? [
                'id' => $user->area->id,
                'name' => $user->area->name,
                'slug' => $user->area->slug,
                'active' => $user->area->active,
            ] : null,
            'roles' => $user->getRoleNames()->values(),
            'must_change_password' => $user->must_change_password,
        ];
    }
}
