<?php

namespace App\Policies;

use App\Models\CashRegisterSession;
use App\Models\User;

class CashRegisterSessionPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->can('cash.view') || $user->hasRole(['admin', 'supervisor']);
    }

    public function view(User $user, CashRegisterSession $session): bool
    {
        if ($user->hasRole(['admin', 'supervisor']) || $user->can('cash.close_any')) {
            return true;
        }

        return $session->user_id === $user->id;
    }

    public function open(User $user): bool
    {
        return $user->can('cash.open');
    }

    public function close(User $user, CashRegisterSession $session): bool
    {
        if ($user->can('cash.close_any') || $user->hasRole(['admin', 'supervisor'])) {
            return true;
        }

        return $session->user_id === $user->id && $user->can('cash.close');
    }
}
