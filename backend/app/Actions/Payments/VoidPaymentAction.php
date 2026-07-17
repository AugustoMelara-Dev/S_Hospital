<?php

namespace App\Actions\Payments;

use App\Actions\InstitutionalReceipts\VoidInstitutionalReceiptAction;
use App\Events\InvoiceChanged;
use App\Events\PaymentChanged;
use App\Models\AuditLog;
use App\Models\CashMovement;
use App\Models\CashRegisterSession;
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
    public function __construct(private readonly VoidInstitutionalReceiptAction $voidInstitutionalReceipt) {}

    /**
     * @param  array{reason: string}  $payload
     *
     * @throws AuthorizationException
     */
    public function execute(
        Invoice $invoice,
        Payment $payment,
        array $payload,
        User $user,
        InvoiceAccess $invoiceAccess,
        bool $allowClosedCashSession = false,
    ): Payment {
        $reason = trim($payload['reason']);
        if (empty($reason)) {
            throw ValidationException::withMessages([
                'reason' => 'El motivo de reversión es requerido.',
            ]);
        }

        return DB::transaction(function () use ($invoice, $payment, $user, $invoiceAccess, $reason, $allowClosedCashSession): Payment {
            $paymentSnapshot = Payment::query()
                ->select(['id', 'invoice_id', 'cash_session_id'])
                ->whereKey($payment->id)
                ->firstOrFail();

            if ((int) $paymentSnapshot->invoice_id !== (int) $invoice->id) {
                throw ValidationException::withMessages([
                    'payment' => 'El pago no pertenece a esta factura.',
                ]);
            }

            $cashSession = CashRegisterSession::query()
                ->whereKey($paymentSnapshot->cash_session_id)
                ->lockForUpdate()
                ->firstOrFail();

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

            if ((int) $lockedPayment->cash_session_id !== (int) $cashSession->id) {
                throw ValidationException::withMessages([
                    'cash_session' => 'La caja del pago cambio durante la operacion. Intente nuevamente.',
                ]);
            }

            if ($cashSession->status === CashRegisterSession::STATUS_CLOSED && ! $allowClosedCashSession) {
                throw ValidationException::withMessages([
                    'cash_session' => 'No se puede anular un pago de una caja cerrada. Use ajuste posterior autorizado.',
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

            if ($cashSession->status !== CashRegisterSession::STATUS_CLOSED) {
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
            }

            $postedPaidCents = (int) Payment::query()
                ->where('invoice_id', $lockedInvoice->id)
                ->where('status', Payment::STATUS_POSTED)
                ->sum('amount_cents');
            $invoiceTotalCents = (int) $lockedInvoice->total_cents;
            $balanceCents = max(0, $invoiceTotalCents - $postedPaidCents);

            $lockedInvoice->forceFill([
                'paid_amount' => Money::formatCents($postedPaidCents),
                'paid_amount_cents' => $postedPaidCents,
                'balance_due' => Money::formatCents($balanceCents),
                'balance_due_cents' => $balanceCents,
                'status' => $postedPaidCents === 0
                    ? Invoice::STATUS_ISSUED
                    : ($balanceCents === 0 ? Invoice::STATUS_PAID : Invoice::STATUS_PARTIAL),
            ])->save();

            $voidedReceipts = $this->voidInstitutionalReceipt->forInvoice($lockedInvoice, $user, $reason);

            AuditLog::query()->create([
                'user_id' => $user->id,
                'action' => 'payment.voided',
                'result' => 'success',
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
                    'cash_session_status' => $cashSession->status,
                    'cash_movement_created' => $cashSession->status !== CashRegisterSession::STATUS_CLOSED,
                    'voided_institutional_receipt_ids' => $voidedReceipts->pluck('id')->all(),
                ],
                'reason' => $reason,
            ]);

            DB::afterCommit(function () use ($lockedPayment, $lockedInvoice) {
                PaymentChanged::dispatch($lockedPayment->refresh(), 'voided');
                InvoiceChanged::dispatch($lockedInvoice->refresh(), 'updated');
            });

            return $lockedPayment->load(
                'user:id,name,username',
                'voidedBy:id,name,username',
                'cashSession:id,user_id,status,opened_at,closed_at',
            );
        });
    }
}
