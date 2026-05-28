<?php

namespace App\Policies;

use App\Models\User;

class UserPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->can('users.view') || $user->hasRole(['admin', 'supervisor']);
    }

    public function create(User $user): bool
    {
        return $user->can('users.create') || $user->hasRole('admin');
    }

    public function update(User $user, User $model): bool
    {
        return $user->can('users.update') || $user->hasRole('admin');
    }

    public function disable(User $user, User $model): bool
    {
        return $user->can('users.disable') || $user->hasRole('admin');
    }

    public function resetPassword(User $user, User $model): bool
    {
        return $user->can('users.update') || $user->hasRole('admin');
    }
}
