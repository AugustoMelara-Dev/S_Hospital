<?php

namespace App\Policies;

use App\Models\CashRegisterSession;
use App\Models\User;

/**
 * Authorization for the cash register. The Actions already gate
 * with `cash.open`, `cash.close`, `cash.close_any`. The policy
 * exists so the Laravel Gate facade can resolve
 * `Gate::authorize('close', $session)` from the controllers.
 */
class CashSessionPolicy
{
    public function open(User $user): bool
    {
        return $user->can('cash.open');
    }

    public function close(User $user, CashRegisterSession $session): bool
    {
        if (! $user->can('cash.close') && ! $user->can('cash.close_any')) {
            return false;
        }

        // Cajero can only close their own session; the Action validates state.
        if (! $user->can('cash.close_any') && $session->user_id !== $user->id) {
            return false;
        }

        return true;
    }

    public function view(User $user, CashRegisterSession $session): bool
    {
        return $user->can('cash.view')
            && ($user->can('cash.close_any') || $session->user_id === $user->id);
    }
}
