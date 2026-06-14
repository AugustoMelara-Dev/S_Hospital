<?php

namespace App\Policies;

use App\Models\Service;
use App\Models\User;

/**
 * Authorization for the catalog (services). The FormRequests already
 * check `catalog.view`, `catalog.manage`, `catalog.activate`,
 * `catalog.price_update`. The policy exists so the Gate facade
 * resolves `Gate::authorize('update', $service)` from controllers and
 * tests, eliminating the risk of an action forgetting the check.
 */
class ServicePolicy
{
    public function viewAny(User $user): bool
    {
        return $user->can('catalog.view');
    }

    public function view(User $user, Service $service): bool
    {
        return $user->can('catalog.view');
    }

    public function create(User $user): bool
    {
        return $user->can('catalog.manage');
    }

    public function update(User $user, Service $service): bool
    {
        return $user->can('catalog.manage');
    }

    public function delete(User $user, Service $service): bool
    {
        return $user->can('catalog.manage');
    }
}
