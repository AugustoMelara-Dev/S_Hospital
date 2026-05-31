<?php

namespace App\Actions\Billing;

use App\Models\Invoice;
use App\Models\User;
use App\Support\AuditLogger;
use App\Support\Money;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class VoidInvoiceAction
{
    public function __construct(
        private readonly AuditLogger $auditLogger,
    ) {}

    public function execute(Invoice $invoice, User $user, string $reason, ?Request $request = null): Invoice
    {
        $result = DB::transaction(function () use ($invoice, $user, $reason, $request): ?Invoice {
            $lockedInvoice = Invoice::query()
                ->withCount('payments')
                ->lockForUpdate()
                ->findOrFail($invoice->id);

            if ($lockedInvoice->status === Invoice::STATUS_VOID) {
                throw ValidationException::withMessages([
                    'invoice' => 'La factura ya esta anulada.',
                ]);
            }

            if ($this->hasPaymentState($lockedInvoice)) {
                $this->auditLogger->log(
                    action: 'invoice.void_blocked_paid',
                    entity: $lockedInvoice,
                    user: $user,
                    request: $request,
                    oldValues: [
                        'status' => $lockedInvoice->status,
                        'paid_amount' => $lockedInvoice->paid_amount,
                        'balance_due' => $lockedInvoice->balance_due,
                        'payments_count' => $lockedInvoice->payments_count,
                    ],
                    newValues: [
                        'message' => 'No se puede anular una factura con pagos registrados sin flujo de reversión.',
                    ],
                    reason: $reason,
                    result: 'failed',
                );

                return null;
            }

            $oldValues = [
                'status' => $lockedInvoice->status,
                'void_reason' => $lockedInvoice->void_reason,
                'voided_by' => $lockedInvoice->voided_by,
                'voided_at' => $lockedInvoice->voided_at,
            ];

            $lockedInvoice->forceFill([
                'status' => Invoice::STATUS_VOID,
                'void_reason' => $reason,
                'voided_by' => $user->id,
                'voided_at' => now(),
            ])->save();

            $this->auditLogger->log(
                action: 'invoice.voided',
                entity: $lockedInvoice,
                user: $user,
                request: $request,
                oldValues: $oldValues,
                newValues: [
                    'status' => $lockedInvoice->status,
                    'void_reason' => $lockedInvoice->void_reason,
                    'voided_by' => $lockedInvoice->voided_by,
                    'voided_at' => $lockedInvoice->voided_at,
                ],
                reason: $reason,
            );

            return $lockedInvoice->load([
                'items',
                'payments',
                'cashSession.user:id,name,username',
                'issuer:id,name,username',
                'voidedBy:id,name,username',
                'fiscalSequence',
            ]);
        });

        if (! $result instanceof Invoice) {
            throw ValidationException::withMessages([
                'invoice' => 'No se puede anular una factura con pagos registrados sin flujo de reversión.',
            ]);
        }

        return $result;
    }

    private function hasPaymentState(Invoice $invoice): bool
    {
        $paidCents = Money::parseCents((string) $invoice->paid_amount, 'paid_amount');
        $balanceCents = Money::parseCents((string) $invoice->balance_due, 'balance_due');
        $totalCents = Money::parseCents((string) $invoice->total, 'total');

        return $invoice->payments_count > 0
            || $paidCents > 0
            || in_array($invoice->status, [Invoice::STATUS_PARTIAL, Invoice::STATUS_PAID], true)
            || $balanceCents !== $totalCents;
    }
}
