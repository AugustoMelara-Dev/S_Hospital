<?php

namespace App\Support;

class RoleCatalog
{
    private const PROTECTED_ROLES = ['admin', 'root'];

    private const ELEVATED_ROLES = ['supervisor', 'auditor'];

    private const RESERVED_ROLE_PERMISSIONS = [
        'users.assign_admin_role',
    ];

    private const ELEVATED_ROLE_PERMISSIONS = [
        'audit.view',
        'backups.download',
        'backups.restore',
        'cash.close_any',
        'invoices.operate_any',
        'invoices.reverse',
        'invoices.void',
        'payments.void',
        'receipt_settings.update',
        'receipts.reprint_any',
        'receipts.void',
        'reports.export',
        'reports.managerial.view',
        'settings.fiscal.update',
    ];

    public static function isProtectedRoleName(string $role): bool
    {
        return in_array(strtolower($role), self::PROTECTED_ROLES, true);
    }

    public static function isElevatedRoleName(string $role): bool
    {
        $normalized = strtolower($role);

        return self::isProtectedRoleName($role) || in_array($normalized, self::ELEVATED_ROLES, true);
    }

    /**
     * @param  iterable<string>  $permissions
     */
    public static function containsReservedPermissions(iterable $permissions): bool
    {
        foreach ($permissions as $permission) {
            if (in_array($permission, self::RESERVED_ROLE_PERMISSIONS, true)) {
                return true;
            }
        }

        return false;
    }

    /**
     * @param  iterable<string>  $permissions
     */
    public static function containsElevatedPermissions(iterable $permissions): bool
    {
        foreach ($permissions as $permission) {
            if (in_array($permission, self::ELEVATED_ROLE_PERMISSIONS, true)) {
                return true;
            }
        }

        return false;
    }

    /**
     * @return list<string>
     */
    public static function hiddenPermissionNames(): array
    {
        return array_values(array_unique([
            ...VisiblePermissions::hiddenPermissionNames(),
            ...self::RESERVED_ROLE_PERMISSIONS,
        ]));
    }

    public static function notProtectedRoleNameRule(): \Closure
    {
        return function (string $attribute, mixed $value, \Closure $fail): void {
            if (is_string($value) && self::isProtectedRoleName($value)) {
                $fail('El nombre del rol esta reservado.');
            }
        };
    }
}
