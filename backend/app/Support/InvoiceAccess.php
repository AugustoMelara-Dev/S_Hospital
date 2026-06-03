<?php

namespace App\Support;

use App\Models\Invoice;
use App\Models\User;
use Illuminate\Auth\Access\AuthorizationException;

class InvoiceAccess
{
    public function authorizeOperationalAccess(User $user, Invoice $invoice): void
    {
        if (! $this->canOperateInvoice($user, $invoice)) {
            throw new AuthorizationException('No puede operar esta factura.');
        }
    }

    public function canOperateInvoice(User $user, Invoice $invoice): bool
    {
        if ($this->canOperateAnyInvoice($user)) {
            return true;
        }

        return $invoice->issued_by === $user->id
            && $invoice->issued_at?->isToday() === true;
    }

    public function canOperateAnyInvoice(User $user): bool
    {
        return $user->can('invoices.operate_any');
    }

    public function canAccessAnyInvoice(User $user): bool
    {
        return $user->hasRole(['admin', 'supervisor'])
            || $user->can('receipts.reprint_any')
            || $user->can('reports.managerial.view')
            || $user->can('invoices.void');
    }
}
