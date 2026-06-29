<?php

namespace App\Support;

class RoleCatalog
{
    private const PROTECTED_ROLES = ['admin', 'root'];

    private const RESERVED_ROLE_PERMISSIONS = [
        'users.assign_admin_role',
    ];

    public static function isProtectedRoleName(string $role): bool
    {
        return in_array(strtolower($role), self::PROTECTED_ROLES, true);
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
