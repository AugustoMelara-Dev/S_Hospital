<?php

namespace App\Policies;

use App\Models\User;
use App\Support\RoleCatalog;

/**
 * Authorization for the admin user-management endpoints. The
 * Form Requests are protected by the seeded user-management permissions;
 * this policy keeps those checks introspectable via Gates without relying
 * on legacy or unseeded permission names.
 */
class UserPolicy
{
    public function viewAny(User $actor): bool
    {
        return $actor->can('users.view');
    }

    public function view(User $actor, User $user): bool
    {
        return $this->viewAny($actor);
    }

    public function create(User $actor): bool
    {
        return $actor->can('users.create');
    }

    public function update(User $actor, User $user): bool
    {
        return $actor->can('users.update');
    }

    public function toggleActive(User $actor, User $user): bool
    {
        if (! $actor->can('users.disable')) {
            return false;
        }

        // No se puede desactivar a si mismo; el controller ya lo valida
        // pero la policy lo deja explicito.
        return $actor->id !== $user->id && $this->canManageProtectedTarget($actor, $user);
    }

    public function resetPassword(User $actor, User $user): bool
    {
        return $actor->can('users.update')
            && $actor->id !== $user->id
            && $this->canManageProtectedTarget($actor, $user);
    }

    private function canManageProtectedTarget(User $actor, User $user): bool
    {
        if (! $this->hasProtectedRole($user)) {
            return true;
        }

        return $actor->can('users.assign_admin_role');
    }

    private function hasProtectedRole(User $user): bool
    {
        return $user->getRoleNames()
            ->contains(fn (string $role): bool => RoleCatalog::isProtectedRoleName($role));
    }
}
