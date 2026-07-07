<?php

namespace App\Policies;

use App\Models\Area;
use App\Models\User;

/**
 * Authorization for areas (departments). Areas are used in the
 * catalog and managerial reports. The policy centralises the
 * read/manage checks used by resource gates.
 */
class AreaPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->can('catalog.view') || $user->can('reports.managerial.view');
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
