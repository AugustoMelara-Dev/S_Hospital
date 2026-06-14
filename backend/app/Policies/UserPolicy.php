<?php

namespace App\Policies;

use App\Models\User;

/**
 * Authorization for the admin user-management endpoints. The
 * controller is currently protected by `users.view` / `users.manage`
 * in `UserController`; this policy makes those checks introspectable
 * via `Gate::authorize('update', $user)`.
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
        return $actor->can('users.manage');
    }

    public function update(User $actor, User $user): bool
    {
        return $actor->can('users.update') || $actor->can('users.manage');
    }

    public function toggleActive(User $actor, User $user): bool
    {
        if (! $actor->can('users.disable') && ! $actor->can('users.manage')) {
            return false;
        }

        // No se puede desactivar a si mismo; el controller ya lo valida
        // pero la policy lo deja explicito.
        return $actor->id !== $user->id;
    }

    public function resetPassword(User $actor, User $user): bool
    {
        return $actor->can('users.reset_password') || $actor->can('users.manage');
    }
}
