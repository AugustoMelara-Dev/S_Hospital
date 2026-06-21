<?php

namespace App\Actions\Billing;

use App\Actions\Payments\VoidPaymentAction;
use App\Events\InvoiceChanged;
use App\Models\AuditLog;
use App\Models\CashRegisterSession;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\User;
use App\Support\InvoiceAccess;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ReverseInvoiceAction
{
    public function __construct(
        private readonly InvoiceAccess $invoiceAccess,
        private readonly VoidPaymentAction $voidPayment,
    ) {}

    /**
     * Reverse a paid (or partially paid) invoice end-to-end:
     *  1. Lock the invoice row.
     *  2. Void every posted payment on the invoice (each void creates a
     *     negative cash_movement, recomputes paid_amount_cents, and
     *     re-derives the invoice status).
     *  3. Set the invoice to STATUS_VOID with the reason and voided_by
     *     and voided_at fields populated.
     *  4. Write a single audit log entry covering the whole flow.
     *
     * The whole thing runs in one DB::transaction with a row lock on the
     * invoice. If any payment void fails, the entire reverse is rolled
     * back, the invoice keeps its paid amount, and the cash movements
     * stay correct.
     *
     * @throws ValidationException
     */
    public function execute(Invoice $invoice, User $user, string $reason): Invoice
    {
        $reason = trim($reason);
        if (mb_strlen($reason) < 5) {
            throw ValidationException::withMessages([
                'reason' => 'El motivo de reverso debe tener al menos 5 caracteres.',
            ]);
        }

        /** @var Invoice $result */
        $result = DB::transaction(function () use ($invoice, $user, $reason): Invoice {
            $postedPaymentSnapshots = Payment::query()
                ->select(['id', 'cash_session_id'])
                ->where('invoice_id', $invoice->id)
                ->where('status', Payment::STATUS_POSTED)
                ->orderBy('cash_session_id')
                ->orderBy('id')
                ->get();

            if ($postedPaymentSnapshots->isNotEmpty()) {
                $cashSessions = CashRegisterSession::query()
                    ->whereIn('id', $postedPaymentSnapshots->pluck('cash_session_id')->unique()->values())
                    ->orderBy('id')
                    ->lockForUpdate()
                    ->get()
                    ->keyBy('id');

                foreach ($postedPaymentSnapshots as $paymentSnapshot) {
                    $cashSession = $cashSessions->get($paymentSnapshot->cash_session_id);
                    if ($cashSession?->status === CashRegisterSession::STATUS_CLOSED) {
                        throw ValidationException::withMessages([
                            'cash_session' => 'No se puede reversar una factura con pagos en caja cerrada. Registre un ajuste autorizado.',
                        ]);
                    }
                }
            }

            $lockedInvoice = Invoice::query()
                ->with(['payments' => fn ($query) => $query
                    ->where('status', Payment::STATUS_POSTED)
                    ->orderBy('id'),
                ])
                ->lockForUpdate()
                ->findOrFail($invoice->id);

            $this->invoiceAccess->authorizeOperationalAccess($user, $lockedInvoice);

            if ($lockedInvoice->status === Invoice::STATUS_VOID) {
                throw ValidationException::withMessages([
                    'invoice' => 'La factura ya esta anulada.',
                ]);
            }

            /** @var Collection<int, Payment> $postedPayments */
            $postedPayments = $lockedInvoice->payments;

            $oldValues = [
                'status' => $lockedInvoice->status,
                'paid_amount' => (string) $lockedInvoice->paid_amount,
                'balance_due' => (string) $lockedInvoice->balance_due,
                'posted_payments' => $postedPayments->map(fn (Payment $p) => [
                    'id' => $p->id,
                    'amount' => (string) $p->amount,
                    'method' => $p->method,
                ])->all(),
            ];

            $voidedPaymentIds = [];
            foreach ($postedPayments as $payment) {
                $voidedPayment = $this->voidPayment->execute(
                    $lockedInvoice,
                    $payment,
                    ['reason' => 'Reverso de factura: '.$reason],
                    $user,
                    $this->invoiceAccess,
                );
                $voidedPaymentIds[] = $voidedPayment->id;
            }

            $reloaded = Invoice::query()
                ->whereKey($lockedInvoice->id)
                ->lockForUpdate()
                ->firstOrFail();

            $reloaded->forceFill([
                'status' => Invoice::STATUS_VOID,
                'void_reason' => $reason,
                'voided_by' => $user->id,
                'voided_at' => now(),
            ])->save();

            AuditLog::query()->create([
                'user_id' => $user->id,
                'action' => 'invoice.reversed',
                'entity_type' => Invoice::class,
                'entity_id' => $reloaded->id,
                'old_values' => $oldValues,
                'new_values' => [
                    'status' => $reloaded->status,
                    'void_reason' => $reloaded->void_reason,
                    'voided_by' => $reloaded->voided_by,
                    'voided_at' => $reloaded->voided_at,
                    'voided_payment_ids' => $voidedPaymentIds,
                    'paid_amount_after' => (string) $reloaded->paid_amount,
                    'balance_due_after' => (string) $reloaded->balance_due,
                ],
                'created_at' => now(),
            ]);

            DB::afterCommit(function () use ($reloaded) {
                InvoiceChanged::dispatch($reloaded->fresh(), 'reversed');
            });

            return $reloaded->load([
                'items',
                'payments.voidedBy:id,name,username',
                'payments.user:id,name,username',
                'cashSession.user:id,name,username',
                'issuer:id,name,username',
                'voidedBy:id,name,username',
                'fiscalSequence',
            ]);
        });

        return $result;
    }
}
