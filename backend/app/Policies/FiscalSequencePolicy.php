<?php

namespace App\Policies;

use App\Models\FiscalSequence;
use App\Models\User;

/**
 * Authorization for fiscal sequences. Mutations require
 * `settings.fiscal.update`; the view is open to any user with
 * `settings.fiscal.view` (used by the new-invoice UI to render
 * the active sequence).
 */
class FiscalSequencePolicy
{
    public function viewAny(User $user): bool
    {
        return $user->can('settings.fiscal.view');
    }

    public function view(User $user, FiscalSequence $sequence): bool
    {
        return $this->viewAny($user);
    }

    public function create(User $user): bool
    {
        return $user->can('settings.fiscal.update');
    }

    public function update(User $user, FiscalSequence $sequence): bool
    {
        return $user->can('settings.fiscal.update');
    }
}
