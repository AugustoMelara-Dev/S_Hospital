<?php

namespace App\Policies;

use App\Models\Invoice;
use App\Models\User;
use Illuminate\Auth\Access\HandlesAuthorization;

class InvoicePolicy
{
    use HandlesAuthorization;

    public function viewAny(User $user): bool
    {
        return $user->can('invoices.view');
    }

    public function view(User $user, Invoice $invoice): bool
    {
        if ($user->can('invoices.view')) {
            return true;
        }

        return $invoice->issued_by === $user->id && $invoice->issued_at?->isToday() === true;
    }

    public function create(User $user): bool
    {
        return $user->can('invoices.create');
    }

    public function update(User $user, Invoice $invoice): bool
    {
        if ($user->can('invoices.operate_any')) {
            return true;
        }

        return $invoice->issued_by === $user->id
            && $invoice->issued_at?->isToday() === true
            && $invoice->status === 'issued';
    }

    public function void(User $user, Invoice $invoice): bool
    {
        return $user->can('invoices.void');
    }
}
