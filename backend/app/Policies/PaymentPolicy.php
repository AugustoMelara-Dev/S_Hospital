<?php

namespace App\Policies;

use App\Models\Payment;
use App\Models\User;

/**
 * Authorization for payment rows. Voiding a posted payment requires
 * the `payments.void` permission and operational scope on the related
 * invoice (cajero today; admin or supervisor always).
 */
class PaymentPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->can('payments.view') || $user->can('payments.create');
    }

    public function view(User $user, Payment $payment): bool
    {
        return $this->viewAny($user);
    }

    public function create(User $user): bool
    {
        return $user->can('payments.create');
    }

    public function void(User $user, Payment $payment): bool
    {
        return $user->can('payments.void');
    }
}
