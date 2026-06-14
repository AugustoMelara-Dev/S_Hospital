<?php

namespace App\Policies;

use App\Models\Area;
use App\Models\User;

/**
 * Authorization for areas (departments). Areas are used in the
 * catalog and in reports; the controller is protected by
 * `catalog.view` / `catalog.manage`. The policy centralises
 * the check.
 */
class AreaPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->can('catalog.view') || $user->can('reports.view');
    }

    public function view(User $user, Area $area): bool
    {
        return $this->viewAny($user);
    }

    public function create(User $user): bool
    {
        return $user->can('catalog.manage');
    }

    public function update(User $user, Area $area): bool
    {
        return $user->can('catalog.manage');
    }
}
