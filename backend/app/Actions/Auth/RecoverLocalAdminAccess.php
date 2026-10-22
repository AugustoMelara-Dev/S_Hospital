<?php

namespace App\Actions\Auth;

use App\Models\User;
use App\Support\AuditLogger;
use App\Support\RoleCatalog;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\ValidationException;

final class RecoverLocalAdminAccess
{
    /**
     * @param  array{sid: string, account: string}  $authorization
     *
     * @throws ValidationException
     */
    public function handle(string $identity, string $password, string $reason, array $authorization): User
    {
        $identity = trim($identity);
        $reason = trim($reason);

        validator(
            compact('identity', 'password', 'reason'),
            [
                'identity' => ['required', 'string', 'max:255'],
                'password' => ['required', 'string', 'max:255', Password::min(12)->mixedCase()->numbers()->symbols()],
                'reason' => ['required', 'string', 'min:5', 'max:500'],
            ],
            [
                'password.required' => 'Ingrese una contraseña temporal.',
                'password.min' => 'La contraseña temporal debe tener al menos 12 caracteres.',
                'password.max' => 'La contraseña temporal es demasiado larga.',
                'password.mixed' => 'La contraseña temporal debe incluir mayúscula y minúscula.',
                'password.numbers' => 'La contraseña temporal debe incluir un número.',
                'password.symbols' => 'La contraseña temporal debe incluir un símbolo.',
            ],
        )->validate();

        return DB::transaction(function () use ($identity, $password, $reason, $authorization): User {
            $user = User::query()
                ->where('active', true)
                ->where(function ($query) use ($identity): void {
                    $query->where('username', $identity)->orWhere('email', $identity);
                })
                ->whereHas(
                    'roles',
                    fn ($query) => $query->whereIn(
                        DB::raw('LOWER(name)'),
                        RoleCatalog::protectedRoleNames(),
                    ),
                )
                ->lockForUpdate()
                ->first();

            if (! $user instanceof User) {
                throw ValidationException::withMessages([
                    'identity' => ['No se encontró un administrador activo con ese usuario o correo.'],
                ]);
            }

            $oldValues = ['must_change_password' => $user->must_change_password];

            $user->forceFill([
                'password' => Hash::make($password),
                'must_change_password' => true,
                'remember_token' => Str::random(60),
            ])->save();

            $user->tokens()->delete();

            if (Schema::hasTable('sessions')) {
                DB::table('sessions')->where('user_id', $user->id)->delete();
            }

            if (Schema::hasTable('password_reset_tokens')) {
                DB::table('password_reset_tokens')->where('email', $user->email)->delete();
            }

            AuditLogger::log(
                action: 'user.password_recovered_locally',
                entity: $user,
                oldValues: $oldValues,
                newValues: [
                    'must_change_password' => true,
                    'sessions_revoked' => true,
                    'authorized_by' => 'windows_local_administrator',
                    'windows_sid' => $authorization['sid'],
                    'windows_account' => $authorization['account'],
                ],
                reason: $reason,
            );

            return $user->refresh();
        });
    }
}
