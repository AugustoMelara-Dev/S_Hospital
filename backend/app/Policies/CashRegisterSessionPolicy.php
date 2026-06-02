<?php

namespace App\Policies;

use App\Models\CashRegisterSession;
use App\Models\User;
use Illuminate\Auth\Access\HandlesAuthorization;

class CashRegisterSessionPolicy
{
    use HandlesAuthorization;

    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, CashRegisterSession $session): bool
    {
        if ($user->can('cash.view_any')) {
            return true;
        }

        return $session->user_id === $user->id;
    }

    public function create(User $user): bool
    {
        return true;
    }

    public function update(User $user, CashRegisterSession $session): bool
    {
        if ($session->status === CashRegisterSession::STATUS_CLOSED) {
            return false;
        }

        return $session->user_id === $user->id;
    }

    public function close(User $user, CashRegisterSession $session): bool
    {
        if ($session->status === CashRegisterSession::STATUS_CLOSED) {
            return false;
        }

        return $session->user_id === $user->id && $user->can('cash.close');
    }
}
