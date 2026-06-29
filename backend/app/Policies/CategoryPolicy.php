<?php

namespace App\Policies;

use App\Models\Category;
use App\Models\User;

/**
 * Authorization for catalog categories. The controller is already
 * protected by `catalog.view` / `catalog.manage`; the policy
 * centralises the check.
 */
class CategoryPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->can('catalog.view');
    }

    public function view(User $user, Category $category): bool
    {
        return $this->viewAny($user);
    }

    public function create(User $user): bool
    {
        return $user->can('catalog.manage');
    }

    public function update(User $user, Category $category): bool
    {
        return $user->can('catalog.manage');
    }

    public function delete(User $user, Category $category): bool
    {
        return $user->can('catalog.manage');
    }
}
