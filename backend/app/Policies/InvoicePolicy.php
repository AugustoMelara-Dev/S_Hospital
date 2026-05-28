<?php

namespace App\Policies;

use App\Models\Invoice;
use App\Models\User;
use App\Support\InvoiceAccess;

class InvoicePolicy
{
    protected InvoiceAccess $invoiceAccess;

    public function __construct()
    {
        $this->invoiceAccess = new InvoiceAccess();
    }

    public function viewAny(User $user): bool
    {
        return $user->can('invoices.view') || $user->hasRole(['admin', 'supervisor']);
    }

    public function view(User $user, Invoice $invoice): bool
    {
        return $this->invoiceAccess->canOperateInvoice($user, $invoice);
    }

    public function create(User $user): bool
    {
        return $user->can('invoices.create');
    }

    public function void(User $user, Invoice $invoice): bool
    {
        return $user->can('invoices.void') && $this->invoiceAccess->canOperateInvoice($user, $invoice);
    }

    public function reprint(User $user, Invoice $invoice): bool
    {
        if ($user->can('receipts.reprint_any')) {
            return true;
        }

        // Cashier can only reprint their own invoice today
        return $invoice->issued_by === $user->id
            && $invoice->issued_at?->isToday() === true;
    }
}
