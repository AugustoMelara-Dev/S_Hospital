<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Hash;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

/** @phpstan-type ValidationUserResult array{status: string, username: string, active: bool, role?: string, permissions?: list<string>} */
class ManageFinalValidationUserCommand extends Command
{
    private const DEFAULT_PERMISSIONS = [
        'catalog.view',
        'invoices.view',
        'invoices.create',
        'cash.view',
        'cash.open',
        'cash.close',
        'payments.create',
        'payments.view',
        'receipts.view',
        'receipts.reprint',
        'audit.view',
        'reports.managerial.view',
        'reports.cash_session.view',
        'reports.export',
    ];

    protected $signature = 'hospital:validation-user
        {action : create or disable}
        {--username= : Temporary username, for example concurrency.final.validacion}
        {--password= : Temporary password for create outside production; prefer HOSPITAL_VALIDATION_USER_PASSWORD}
        {--role=cajero : Non-admin role to assign}
        {--permission=* : Override exact direct permissions; repeat for each permission}
        {--json : Emit machine-readable output}';

    protected $description = 'Create or disable a tightly-scoped temporary user for final LAN validation.';

    public function handle(): int
    {
        $action = strtolower(trim((string) $this->argument('action')));
        $username = strtolower(trim((string) $this->option('username')));

        if (! in_array($action, ['create', 'disable'], true)) {
            $this->error('Action must be create or disable.');

            return self::FAILURE;
        }

        if (! $this->passesSafetyGuards($username)) {
            return self::FAILURE;
        }

        return $action === 'create'
            ? $this->createUser($username)
            : $this->disableUser($username);
    }

    private function passesSafetyGuards(string $username): bool
    {
        if (getenv('HOSPITAL_ALLOW_FINAL_VALIDATION_USERS') !== '1') {
            $this->error('Refusing to manage validation users without HOSPITAL_ALLOW_FINAL_VALIDATION_USERS=1.');

            return false;
        }

        if (! preg_match('/^(smoke|concurrency|load)\.[a-z0-9_.-]+\.validacion$/', $username)) {
            $this->error('Validation username must match smoke|concurrency|load.*.validacion.');

            return false;
        }

        if (getenv('HOSPITAL_CONFIRM_VALIDATION_USER') !== $username) {
            $this->error("Set HOSPITAL_CONFIRM_VALIDATION_USER={$username} to confirm the exact temporary user.");

            return false;
        }

        return true;
    }

    private function createUser(string $username): int
    {
        $roleName = strtolower(trim((string) $this->option('role')));
        if (in_array($roleName, ['admin', 'root'], true)) {
            $this->error('Temporary validation users cannot receive admin/root roles.');

            return self::FAILURE;
        }

        $role = Role::query()
            ->where('name', $roleName)
            ->where('guard_name', 'web')
            ->first();

        if (! $role instanceof Role) {
            $this->error("Role [{$roleName}] does not exist. Complete normal installation seeders before validation.");

            return self::FAILURE;
        }

        $password = $this->validationPassword();
        if ($password === null) {
            return self::FAILURE;
        }

        if (! $this->isStrongPassword($password)) {
            $this->error('Password must be at least 12 characters with upper, lower, number, and symbol.');

            return self::FAILURE;
        }

        $permissions = $this->requestedPermissions();
        foreach ($permissions as $permission) {
            if (! Permission::query()->where('name', $permission)->where('guard_name', 'web')->exists()) {
                $this->error("Permission [{$permission}] does not exist. Complete normal installation seeders before validation.");

                return self::FAILURE;
            }
        }

        Permission::query()->firstOrCreate([
            'name' => User::EXACT_ACCESS_MARKER_PERMISSION,
            'guard_name' => 'web',
        ]);

        $user = User::query()->updateOrCreate(
            ['username' => $username],
            [
                'name' => $this->displayName($username),
                'email' => "{$username}@hospital-validation.local",
                'password' => Hash::make($password),
                'active' => true,
                'deactivated_at' => null,
                'must_change_password' => false,
            ],
        );

        $user->syncRoles([$roleName]);
        $user->syncPermissions(collect($permissions)
            ->push(User::EXACT_ACCESS_MARKER_PERMISSION)
            ->unique()
            ->sort()
            ->values()
            ->all());

        $this->writeResult([
            'status' => 'created',
            'username' => $user->username,
            'role' => $roleName,
            'permissions' => $permissions,
            'active' => true,
        ]);

        return self::SUCCESS;
    }

    private function disableUser(string $username): int
    {
        $user = User::query()->where('username', $username)->first();

        if (! $user instanceof User) {
            $this->writeResult([
                'status' => 'not_found',
                'username' => $username,
                'active' => false,
            ]);

            return self::SUCCESS;
        }

        $user->forceFill([
            'active' => false,
            'deactivated_at' => now(),
        ])->save();
        $user->tokens()->delete();

        $this->writeResult([
            'status' => 'disabled',
            'username' => $username,
            'active' => false,
        ]);

        return self::SUCCESS;
    }

    /**
     * @return list<string>
     */
    private function requestedPermissions(): array
    {
        $requested = collect($this->option('permission') ?: [])
            ->filter(fn (mixed $permission): bool => is_string($permission))
            ->map(fn (string $permission): string => trim($permission))
            ->filter()
            ->values();

        return array_values(($requested->isEmpty() ? collect(self::DEFAULT_PERMISSIONS) : $requested)
            ->unique()
            ->sort()
            ->all());
    }

    private function isStrongPassword(string $password): bool
    {
        return strlen($password) >= 12
            && preg_match('/[a-z]/', $password) === 1
            && preg_match('/[A-Z]/', $password) === 1
            && preg_match('/\d/', $password) === 1
            && preg_match('/[^A-Za-z0-9]/', $password) === 1;
    }

    private function validationPassword(): ?string
    {
        $envPassword = getenv('HOSPITAL_VALIDATION_USER_PASSWORD');
        if (is_string($envPassword) && $envPassword !== '') {
            return $envPassword;
        }

        $optionPassword = (string) $this->option('password');
        if ($optionPassword === '') {
            $this->error('Set HOSPITAL_VALIDATION_USER_PASSWORD for the temporary validation user password.');

            return null;
        }

        if ($this->laravel->environment('production')) {
            $this->error('In production, set HOSPITAL_VALIDATION_USER_PASSWORD instead of passing --password.');

            return null;
        }

        return $optionPassword;
    }

    private function displayName(string $username): string
    {
        return collect(explode('.', $username))
            ->reject(fn (string $part): bool => $part === 'validacion')
            ->map(fn (string $part): string => ucfirst($part))
            ->join(' ');
    }

    /**
     * @param  ValidationUserResult  $payload
     */
    private function writeResult(array $payload): void
    {
        if ($this->option('json')) {
            $this->line(json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR));

            return;
        }

        $this->info("Validation user {$payload['username']}: {$payload['status']}.");
    }
}
