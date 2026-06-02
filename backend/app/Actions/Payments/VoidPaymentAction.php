<?php

namespace App\Actions\Payments;

use App\Models\AuditLog;
use App\Models\CashMovement;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\User;
use App\Support\InvoiceAccess;
use App\Support\Money;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class VoidPaymentAction
{
    /**
     * @param  array{reason: string}  $payload
     *
     * @throws AuthorizationException
     */
    public function execute(Invoice $invoice, Payment $payment, array $payload, User $user, InvoiceAccess $invoiceAccess): Payment
    {
        $reason = trim($payload['reason'] ?? '');
        if (empty($reason)) {
            throw ValidationException::withMessages([
                'reason' => 'El motivo de reversión es requerido.',
            ]);
        }

        return DB::transaction(function () use ($invoice, $payment, $user, $invoiceAccess, $reason): Payment {
            $lockedInvoice = Invoice::query()
                ->whereKey($invoice->id)
                ->lockForUpdate()
                ->firstOrFail();

            $invoiceAccess->authorizeOperationalAccess($user, $lockedInvoice);

            $lockedPayment = Payment::query()
                ->whereKey($payment->id)
                ->where('invoice_id', $lockedInvoice->id)
                ->lockForUpdate()
                ->firstOrFail();

            if ($lockedInvoice->status === Invoice::STATUS_VOID) {
                throw ValidationException::withMessages([
                    'invoice' => 'No se puede reversar un pago de una factura anulada.',
                ]);
            }

            if ($lockedPayment->status !== Payment::STATUS_POSTED) {
                throw ValidationException::withMessages([
                    'payment' => 'El pago ya fue reversado.',
                ]);
            }

            $previousInvoiceValues = [
                'status' => $lockedInvoice->status,
                'paid_amount' => (string) $lockedInvoice->paid_amount,
                'balance_due' => (string) $lockedInvoice->balance_due,
            ];

            $lockedPayment->forceFill([
                'status' => Payment::STATUS_VOID,
                'voided_by' => $user->id,
                'voided_at' => now(),
                'void_reason' => $reason,
            ])->save();

            CashMovement::query()->create([
                'cash_session_id' => $lockedPayment->cash_session_id,
                'payment_id' => $lockedPayment->id,
                'user_id' => $user->id,
                'type' => CashMovement::TYPE_PAYMENT_VOID,
                'method' => $lockedPayment->method,
                'amount' => Money::formatCents(-((int) $lockedPayment->amount_cents)),
                'notes' => substr($lockedInvoice->invoice_number.' - '.$lockedPayment->void_reason, 0, 255),
                'occurred_at' => now(),
            ]);

            $postedPaidCents = (int) Payment::query()
                ->where('invoice_id', $lockedInvoice->id)
                ->where('status', Payment::STATUS_POSTED)
                ->whereNotNull('amount_cents')
                ->sum('amount_cents');
            $invoiceTotalCents = Money::parseCents((string) $lockedInvoice->total, 'total');
            $balanceCents = max(0, $invoiceTotalCents - $postedPaidCents);

            $lockedInvoice->forceFill([
                'paid_amount' => Money::formatCents($postedPaidCents),
                'balance_due' => Money::formatCents($balanceCents),
                'status' => $postedPaidCents === 0
                    ? Invoice::STATUS_ISSUED
                    : ($balanceCents === 0 ? Invoice::STATUS_PAID : Invoice::STATUS_PARTIAL),
            ])->save();

            AuditLog::query()->create([
                'user_id' => $user->id,
                'action' => 'payment.voided',
                'entity_type' => Payment::class,
                'entity_id' => $lockedPayment->id,
                'old_values' => [
                    'payment_status' => Payment::STATUS_POSTED,
                    'invoice' => $previousInvoiceValues,
                ],
                'new_values' => [
                    'payment_status' => $lockedPayment->status,
                    'void_reason' => $lockedPayment->void_reason,
                    'invoice_id' => $lockedInvoice->id,
                    'invoice_number' => $lockedInvoice->invoice_number,
                    'invoice_status' => $lockedInvoice->status,
                    'paid_amount' => $lockedInvoice->paid_amount,
                    'balance_due' => $lockedInvoice->balance_due,
                ],
            ]);

            return $lockedPayment->load(
                'user:id,name,username',
                'voidedBy:id,name,username',
                'cashSession:id,user_id,status,opened_at,closed_at',
            );
        });
    }
}
