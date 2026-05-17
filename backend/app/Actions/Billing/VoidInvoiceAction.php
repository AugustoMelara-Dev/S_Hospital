<?php

namespace App\Actions\Billing;

use App\Models\AuditLog;
use App\Models\Invoice;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class VoidInvoiceAction
{
    public function execute(Invoice $invoice, User $user, string $reason): Invoice
    {
        if ($invoice->payments()->exists()) {
            AuditLog::query()->create([
                'user_id' => $user->id,
                'action' => 'invoice.void_blocked_paid',
                'entity_type' => Invoice::class,
                'entity_id' => $invoice->id,
                'old_values' => [
                    'status' => $invoice->status,
                    'paid_amount' => $invoice->paid_amount,
                    'balance_due' => $invoice->balance_due,
                ],
                'new_values' => [
                    'reason' => $reason,
                    'message' => 'No se puede anular una factura con pagos registrados sin flujo de reversión.',
                ],
                'created_at' => now(),
            ]);

            throw ValidationException::withMessages([
                'invoice' => 'No se puede anular una factura con pagos registrados sin flujo de reversión.',
            ]);
        }

        return DB::transaction(function () use ($invoice, $user, $reason): Invoice {
            $lockedInvoice = Invoice::query()
                ->withCount('payments')
                ->lockForUpdate()
                ->findOrFail($invoice->id);

            if ($lockedInvoice->status === Invoice::STATUS_VOID) {
                throw ValidationException::withMessages([
                    'invoice' => 'La factura ya esta anulada.',
                ]);
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

            return $lockedInvoice->load([
                'items',
                'payments',
                'cashSession.user:id,name,username',
                'issuer:id,name,username',
                'voidedBy:id,name,username',
                'fiscalSequence',
            ]);
        });
    }
}
