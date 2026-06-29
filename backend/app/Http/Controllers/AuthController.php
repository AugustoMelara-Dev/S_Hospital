<?php

namespace App\Http\Controllers;

use App\Http\Requests\Auth\ChangePasswordRequest;
use App\Http\Requests\Auth\LoginRequest;
use App\Models\AuditLog;
use App\Models\LoginAttempt;
use App\Models\User;
use App\Support\AuditLogger;
use App\Support\VisiblePermissions;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function login(LoginRequest $request, AuditLogger $auditLogger): JsonResponse
    {
        $credentials = $request->validated();
        $loginField = filter_var($credentials['login'], FILTER_VALIDATE_EMAIL) ? 'email' : 'username';
        $attemptedUser = User::query()->where($loginField, $credentials['login'])->first();

        $attempt = LoginAttempt::query()->create([
            'login' => $credentials['login'],
            'ip' => $request->ip(),
            'user_agent' => substr((string) $request->userAgent(), 0, 191),
            'success' => false,
            'attempted_at' => now(),
        ]);

        if (
            $attemptedUser instanceof User
            && ! $attemptedUser->active
            && Hash::check($credentials['password'], $attemptedUser->password)
        ) {
            $auditLogger->log(
                action: 'auth.login_failed',
                entity: $attemptedUser,
                user: $attemptedUser,
                request: $request,
                newValues: [
                    'login' => $credentials['login'],
                    'login_field' => $loginField,
                    'active' => false,
                ],
                reason: 'Usuario inactivo.',
                result: 'failed',
            );

            $this->auditAuth($request, 'auth.login_blocked', $attemptedUser, [
                'reason' => 'inactive_user',
            ]);

            throw ValidationException::withMessages([
                'login' => ['El usuario esta inactivo.'],
            ]);
        }

        if (! Auth::attempt([$loginField => $credentials['login'], 'password' => $credentials['password']])) {
            $this->auditAuth($request, 'auth.login_failed', null, [
                'login' => $credentials['login'],
            ]);

            throw ValidationException::withMessages([
                'login' => ['Las credenciales no son validas.'],
            ]);
        }

        $request->session()->regenerate();

        Auth::logoutOtherDevices($credentials['password']);

        $user = $request->user();

        // Clear idempotency keys to prevent cross-session replays
        DB::table('idempotency_keys')
            ->where('user_id', $user->id)
            ->delete();

        $attempt->forceFill(['success' => true])->save();

        if (! $user->active) {
            $auditLogger->log(
                action: 'auth.login_failed',
                entity: $user,
                user: $user,
                request: $request,
                newValues: [
                    'login' => $credentials['login'],
                    'login_field' => $loginField,
                    'active' => false,
                ],
                reason: 'Usuario inactivo.',
                result: 'failed',
            );

            Auth::guard('web')->logout();
            $request->session()->invalidate();
            $request->session()->regenerateToken();
            $this->auditAuth($request, 'auth.login_blocked', $user, [
                'reason' => 'inactive_user',
            ]);

            throw ValidationException::withMessages([
                'login' => ['El usuario esta inactivo.'],
            ]);
        }

        $this->auditAuth($request, 'auth.login', $user);

        return response()->json([
            'data' => $this->userPayload($user),
        ]);
    }

    public function me(Request $request): JsonResponse
    {
        return response()->json([
            'data' => $this->userPayload($request->user()),
        ]);
    }

    public function session(Request $request): JsonResponse
    {
        $user = Auth::guard('web')->user();

        if ($user && ! $user->active) {
            Auth::guard('web')->logout();
            $request->session()->invalidate();
            $request->session()->regenerateToken();
            $this->auditAuth($request, 'auth.session_revoked', $user, [
                'reason' => 'inactive_user',
            ]);

            return response()->json([
                'data' => null,
            ]);
        }

        return response()->json([
            'data' => $user ? $this->userPayload($user) : null,
        ]);
    }

    public function changePassword(ChangePasswordRequest $request, AuditLogger $auditLogger): JsonResponse
    {
        $user = $request->user();
        $validated = $request->validated();

        if (! Hash::check($validated['current_password'], $user->password)) {
            $auditLogger->log(
                action: 'user.password_change_failed',
                entity: $user,
                user: $user,
                request: $request,
                reason: 'Contrasena actual invalida.',
                result: 'failed',
            );

            throw ValidationException::withMessages([
                'current_password' => ['La contrasena actual no es valida.'],
            ]);
        }

        $user->forceFill([
            'password' => Hash::make($validated['password']),
            'must_change_password' => false,
        ])->save();

        $this->auditAuth($request, 'auth.password_changed', $user);

        return response()->json([
            'data' => $this->userPayload($user->refresh()),
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $user = $request->user();

        Auth::guard('web')->logout();

        $request->session()->invalidate();
        $request->session()->regenerateToken();

        $this->auditAuth($request, 'auth.logout', $user);

        return response()->json([
            'ok' => true,
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function userPayload($user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'username' => $user->username,
            'active' => $user->active,
            'roles' => $user->getRoleNames()->values(),
            'permissions' => $this->visiblePermissionNames($user),
            'uses_exact_permission_map' => $user->usesExactDirectPermissionMap(),
            'must_change_password' => $user->must_change_password,
        ];
    }

    private function visiblePermissionNames(User $user): Collection
    {
        $permissions = $user->usesExactDirectPermissionMap()
            ? $user->getDirectPermissions()
            : $user->getAllPermissions();

        return $permissions
            ->pluck('name')
            ->pipe(fn (Collection $permissions): Collection => VisiblePermissions::rejectHidden($permissions))
            ->sort()
            ->values();
    }

    /**
     * @param  array<string, mixed>  $newValues
     */
    private function auditAuth(Request $request, string $action, ?User $user, array $newValues = []): void
    {
        $result = str_contains($action, 'failed') || str_contains($action, 'blocked') ? 'failed' : 'success';
        $payload = [
            'user_id' => $user?->id,
            'action' => $action,
            'result' => $result,
            'entity_type' => User::class,
            'entity_id' => $user?->id,
            'old_values' => null,
            'new_values' => $newValues,
            'ip_address' => $request->ip(),
            'ip' => $request->ip(),
            'user_agent' => substr((string) $request->userAgent(), 0, 191),
            'url' => $request->fullUrl(),
            'http_method' => $request->method(),
        ];

        AuditLog::query()->create($payload);

        if ($action === 'auth.login') {
            AuditLog::query()->create([
                ...$payload,
                'action' => 'auth.login_success',
            ]);
        }
    }
}
