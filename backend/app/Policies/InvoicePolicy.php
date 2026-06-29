<?php

namespace App\Policies;

use App\Models\Invoice;
use App\Models\User;
use App\Support\InvoiceAccess;
use Illuminate\Auth\Access\HandlesAuthorization;

/**
 * Authorization for the Invoice aggregate.
 *
 * This is the policy AGENTS.md explicitly requires: "Policies/Gates
 * para permisos". Prior to v1.0.0 the same checks lived inside
 * `FormRequest::authorize()` and runtime guards in the Actions
 * (e.g. `VoidInvoiceAction::execute()` calling
 * `InvoiceAccess::authorizeOperationalAccess()`). Centralizing
 * here makes the permission map introspectable from `php artisan
 * Gate::getPolicyFor(...) and testable in isolation.
 *
 * For now the policy delegates to `InvoiceAccess`, which is the
 * canonical per-invoice scope check. Future v1.1 work can fold
 * the remaining dedicated permission gates into named policy
 * methods as the endpoints are moved to Gate-based authorization.
 */
class InvoicePolicy
{
    use HandlesAuthorization;

    public function __construct(private readonly InvoiceAccess $invoiceAccess) {}

    /**
     * List invoices. The controller still narrows cashier scope to
     * own invoices from the current hospital day.
     */
    public function viewAny(User $user): bool
    {
        return $user->can('invoices.view');
    }

    public function view(User $user, Invoice $invoice): bool
    {
        return $user->can('invoices.view');
    }

    public function create(User $user): bool
    {
        return $user->can('invoices.create');
    }

    /**
     * Operate on a specific invoice (void, reverse, register a
     * payment, reprint). The same rule the Actions used directly.
     */
    public function operate(User $user, Invoice $invoice): bool
    {
        return $this->invoiceAccess->canOperateInvoice($user, $invoice);
    }

    /**
     * An issued (unpaid) invoice can be voided by a cajero with
     * `invoices.void` (or any admin/supervisor). Reverse of a paid
     * invoice requires `invoices.reverse`.
     */
    public function void(User $user, Invoice $invoice): bool
    {
        if (! $user->can('invoices.void')) {
            return false;
        }

        if ($invoice->status === Invoice::STATUS_VOID) {
            return false;
        }

        // Operational scope (own session today, or all with
        // operate_any).
        return $this->operate($user, $invoice);
    }

    public function reverse(User $user, Invoice $invoice): bool
    {
        return $user->can('invoices.reverse') && $this->operate($user, $invoice);
    }
}
