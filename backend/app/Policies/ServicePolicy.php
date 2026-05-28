<?php

namespace App\Policies;

use App\Models\Service;
use App\Models\User;

class ServicePolicy
{
    public function viewAny(User $user): bool
    {
        return $user->can('catalog.view') || $user->hasRole(['admin', 'supervisor', 'cajero']);
    }

    public function create(User $user): bool
    {
        return $user->can('catalog.manage') || $user->hasRole(['admin', 'supervisor']);
    }

    public function update(User $user, Service $service): bool
    {
        return $user->can('catalog.manage') || $user->hasRole(['admin', 'supervisor']);
    }
}
