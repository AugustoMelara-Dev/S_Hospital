<?php

namespace App\Support;

use App\Models\User;
use Illuminate\Support\Collection;

class VisiblePermissions
{
    private const HIDDEN_PERMISSION_NAMES = [
        User::EXACT_ACCESS_MARKER_PERMISSION,
        'backups.restore',
        'receipts.void',
        'users.assign_admin_role',
    ];

    /**
     * @return list<string>
     */
    public static function hiddenPermissionNames(): array
    {
        return self::HIDDEN_PERMISSION_NAMES;
    }

    /**
     * @param  Collection<int, string>  $permissions
     * @return Collection<int, string>
     */
    public static function rejectHidden(Collection $permissions): Collection
    {
        return $permissions->reject(fn (string $permission): bool => in_array($permission, self::HIDDEN_PERMISSION_NAMES, true));
    }
}
