<?php

namespace App\Http\Controllers;

use App\Http\Requests\Auth\ChangePasswordRequest;
use App\Http\Requests\Auth\LoginRequest;
use App\Models\User;
use App\Support\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function login(LoginRequest $request, AuditLogger $auditLogger): JsonResponse
    {
        $credentials = $request->validated();
        $loginField = filter_var($credentials['login'], FILTER_VALIDATE_EMAIL) ? 'email' : 'username';
        $attemptedUser = User::query()->where($loginField, $credentials['login'])->first();

        if (! Auth::attempt([$loginField => $credentials['login'], 'password' => $credentials['password']])) {
            $auditLogger->log(
                action: 'auth.login_failed',
                entity: User::class,
                entityId: $attemptedUser?->id,
                user: $attemptedUser,
                request: $request,
                newValues: [
                    'login' => $credentials['login'],
                    'login_field' => $loginField,
                ],
                reason: 'Credenciales no validas.',
                result: 'failed',
            );

            throw ValidationException::withMessages([
                'login' => ['Las credenciales no son validas.'],
            ]);
        }

        $request->session()->regenerate();

        $user = $request->user();

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

            throw ValidationException::withMessages([
                'login' => ['El usuario esta inactivo.'],
            ]);
        }

        $auditLogger->log(
            action: 'auth.login_success',
            entity: $user,
            user: $user,
            request: $request,
            newValues: [
                'login_field' => $loginField,
                'roles' => $user->getRoleNames()->values()->all(),
            ],
        );

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

        $auditLogger->log(
            action: 'user.password_changed',
            entity: $user,
            user: $user,
            request: $request,
            oldValues: ['must_change_password' => true],
            newValues: ['must_change_password' => false],
        );

        return response()->json([
            'data' => $this->userPayload($user->refresh()),
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        Auth::guard('web')->logout();

        $request->session()->invalidate();
        $request->session()->regenerateToken();

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
            'permissions' => $user->getAllPermissions()->pluck('name')->values(),
            'must_change_password' => $user->must_change_password,
        ];
    }
}
