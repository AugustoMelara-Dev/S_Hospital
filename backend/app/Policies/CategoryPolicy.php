<?php

namespace App\Policies;

use App\Models\Category;
use App\Models\User;

class CategoryPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->can('catalog.view') || $user->hasRole(['admin', 'supervisor', 'cajero']);
    }

    public function create(User $user): bool
    {
        return $user->can('catalog.manage') || $user->hasRole(['admin', 'supervisor']);
    }

    public function update(User $user, Category $category): bool
    {
        return $user->can('catalog.manage') || $user->hasRole(['admin', 'supervisor']);
    }
}
