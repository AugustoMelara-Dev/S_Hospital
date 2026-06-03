<?php

namespace App\Actions\Billing;

use App\Events\InvoiceChanged;
use App\Models\AuditLog;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\User;
use App\Support\InvoiceAccess;
use App\Support\Money;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class VoidInvoiceAction
{
    public function __construct(private readonly InvoiceAccess $invoiceAccess) {}

    public function execute(Invoice $invoice, User $user, string $reason): Invoice
    {
        $reason = trim($reason);
        if (empty($reason)) {
            throw ValidationException::withMessages([
                'reason' => 'El motivo de anulación es requerido.',
            ]);
        }

        $result = DB::transaction(function () use ($invoice, $user, $reason): ?Invoice {
            $lockedInvoice = Invoice::query()
                ->withCount([
                    'payments as posted_payments_count' => fn ($query) => $query
                        ->where('status', Payment::STATUS_POSTED),
                ])
                ->lockForUpdate()
                ->findOrFail($invoice->id);

            $this->invoiceAccess->authorizeOperationalAccess($user, $lockedInvoice);

            if ($lockedInvoice->status === Invoice::STATUS_VOID) {
                throw ValidationException::withMessages([
                    'invoice' => 'La factura ya esta anulada.',
                ]);
            }

            if ($this->hasPaymentState($lockedInvoice)) {
                AuditLog::query()->create([
                    'user_id' => $user->id,
                    'action' => 'invoice.void_blocked_paid',
                    'entity_type' => Invoice::class,
                    'entity_id' => $lockedInvoice->id,
                    'old_values' => [
                        'status' => $lockedInvoice->status,
                        'paid_amount' => $lockedInvoice->paid_amount,
                        'balance_due' => $lockedInvoice->balance_due,
                        'posted_payments_count' => $lockedInvoice->posted_payments_count,
                    ],
                    'new_values' => [
                        'reason' => $reason,
                        'message' => 'No se puede anular una factura con pagos registrados sin flujo de reversión.',
                    ],
                    'created_at' => now(),
                ]);

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

            AuditLog::query()->create([
                'user_id' => $user->id,
                'action' => 'invoice.voided',
                'entity_type' => Invoice::class,
                'entity_id' => $lockedInvoice->id,
                'old_values' => $oldValues,
                'new_values' => [
                    'status' => $lockedInvoice->status,
                    'void_reason' => $lockedInvoice->void_reason,
                    'voided_by' => $lockedInvoice->voided_by,
                    'voided_at' => $lockedInvoice->voided_at,
                ],
                'created_at' => now(),
            ]);

            DB::afterCommit(function () use ($lockedInvoice) {
                InvoiceChanged::dispatch($lockedInvoice->fresh(), 'voided');
            });

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

        return ((int) ($invoice->posted_payments_count ?? 0)) > 0
            || $paidCents > 0
            || in_array($invoice->status, [Invoice::STATUS_PARTIAL, Invoice::STATUS_PAID], true)
            || $balanceCents !== $totalCents;
    }
}
