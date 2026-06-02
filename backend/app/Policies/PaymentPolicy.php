<?php

namespace App\Policies;

use App\Models\Payment;
use App\Models\User;
use Illuminate\Auth\Access\HandlesAuthorization;

class PaymentPolicy
{
    use HandlesAuthorization;

    public function create(User $user): bool
    {
        return $user->can('payments.create');
    }

    public function void(User $user, Payment $payment): bool
    {
        return $user->can('payments.void');
    }
}