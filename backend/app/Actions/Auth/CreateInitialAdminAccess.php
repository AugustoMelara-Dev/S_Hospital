<?php

namespace App\Actions\Auth;

use App\Models\User;
use App\Support\AuditLogger;
use App\Support\RoleCatalog;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\ValidationException;
use Spatie\Permission\Models\Role;

final class CreateInitialAdminAccess
{
    /**
     * @param  array{sid: string, account: string}  $authorization
     *
     * @throws ValidationException
     */
    public function handle(string $name, string $username, string $email, string $password, array $authorization): User
    {
        $input = validator(
            compact('name', 'username', 'email', 'password'),
            [
                'name' => ['required', 'string', 'max:120'],
                'username' => ['required', 'string', 'min:3', 'max:80', 'regex:/^[A-Za-z0-9._-]+$/', Rule::unique('users', 'username')],
                'email' => ['required', 'email', 'max:255', Rule::unique('users', 'email')],
                'password' => ['required', 'string', 'max:255', Password::min(12)->mixedCase()->numbers()->symbols()],
            ],
            [
                'username.regex' => 'El usuario solo puede incluir letras, números, punto, guion y guion bajo.',
                'password.min' => 'La contraseña temporal debe tener al menos 12 caracteres.',
                'password.mixed' => 'La contraseña temporal debe incluir mayúscula y minúscula.',
                'password.numbers' => 'La contraseña temporal debe incluir un número.',
                'password.symbols' => 'La contraseña temporal debe incluir un símbolo.',
            ],
        )->validate();

        return DB::transaction(function () use ($input, $authorization): User {
            // Todos los instaladores bloquean la misma fila de rol antes de
            // comprobar usuarios. Esto evita dos administradores iniciales si
            // dos procesos de instalación llegan al mismo tiempo.
            $adminRole = Role::query()
                ->where('guard_name', 'web')
                ->whereRaw('LOWER(name) = ?', ['admin'])
                ->lockForUpdate()
                ->first();

            if (! $adminRole instanceof Role) {
                throw ValidationException::withMessages([
                    'username' => ['La instalación todavía no preparó los permisos. Intente nuevamente.'],
                ]);
            }

            $adminExists = User::query()
                ->where('active', true)
                ->whereHas(
                    'roles',
                    fn ($query) => $query->whereIn(DB::raw('LOWER(name)'), RoleCatalog::protectedRoleNames()),
                )
                ->exists();

            if ($adminExists) {
                throw ValidationException::withMessages([
                    'username' => ['Ya existe un administrador activo. Use la recuperación de acceso si olvidó la contraseña.'],
                ]);
            }

            $user = User::query()->create([
                'name' => trim($input['name']),
                'username' => trim($input['username']),
                'email' => trim($input['email']),
                'password' => Hash::make($input['password']),
                'active' => true,
                'must_change_password' => true,
            ]);
            $user->assignRole($adminRole);

            AuditLogger::log(
                action: 'user.initial_admin_created_locally',
                entity: $user,
                newValues: [
                    'username' => $user->username,
                    'active' => true,
                    'must_change_password' => true,
                    'authorized_by' => 'windows_local_administrator',
                    'windows_sid' => $authorization['sid'],
                    'windows_account' => $authorization['account'],
                ],
                reason: 'Configuración inicial de la instalación local.',
            );

            $input['password'] = '';

            return $user->refresh();
        });
    }
}
