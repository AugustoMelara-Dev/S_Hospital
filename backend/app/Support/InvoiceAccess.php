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
            && $this->wasIssuedDuringCurrentOperationalDay($invoice);
    }

    public function canOperateAnyInvoice(User $user): bool
    {
        return $user->can('invoices.operate_any');
    }

    public function canAccessAnyInvoice(User $user): bool
    {
        return $user->hasRole(['admin', 'supervisor'])
            || $user->can('invoices.operate_any')
            || $user->can('receipts.reprint_any')
            || $user->can('reports.managerial.view');
    }

    public function wasIssuedDuringCurrentOperationalDay(Invoice $invoice): bool
    {
        if ($invoice->issued_at === null) {
            return false;
        }

        $configuredTimezone = config('app.timezone', 'America/Tegucigalpa');
        $timezone = is_string($configuredTimezone) && $configuredTimezone !== ''
            ? $configuredTimezone
            : 'America/Tegucigalpa';

        return $invoice->issued_at
            ->copy()
            ->timezone($timezone)
            ->isSameDay(now($timezone));
    }
}
