<?php

namespace App\Actions\Payments;

use App\Events\InvoiceChanged;
use App\Events\PaymentChanged;
use App\Models\AuditLog;
use App\Models\CashMovement;
use App\Models\CashRegisterSession;
use App\Models\FiscalSetting;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\User;
use App\Support\InvoiceAccess;
use App\Support\Money;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\ValidationException;

class RegisterPaymentAction
{
    /**
     * @param  array{cash_session_id: int, method: string, amount: string, reference?: ?string}  $payload
     *
     * @throws AuthorizationException
     */
    public function execute(Invoice $invoice, array $payload, User $user, InvoiceAccess $invoiceAccess): Payment
    {
        return DB::transaction(function () use ($invoice, $payload, $user, $invoiceAccess): Payment {
            $lockedInvoice = Invoice::query()
                ->whereKey($invoice->id)
                ->lockForUpdate()
                ->firstOrFail();

            $invoiceAccess->authorizeOperationalAccess($user, $lockedInvoice);

            $cashSession = CashRegisterSession::query()
                ->whereKey($payload['cash_session_id'])
                ->lockForUpdate()
                ->firstOrFail();

            if ($cashSession->user_id !== $user->id) {
                throw new AuthorizationException('No puede operar la caja de otro usuario.');
            }

            if ($cashSession->status !== CashRegisterSession::STATUS_OPEN) {
                throw ValidationException::withMessages([
                    'cash_session_id' => 'La caja seleccionada esta cerrada.',
                ]);
            }

            if ($lockedInvoice->status === Invoice::STATUS_VOID) {
                throw ValidationException::withMessages([
                    'invoice' => 'No se puede pagar una factura anulada.',
                ]);
            }

            if ($lockedInvoice->status === Invoice::STATUS_PAID) {
                throw ValidationException::withMessages([
                    'invoice' => 'La factura ya esta pagada.',
                ]);
            }

            $amountCents = Money::parsePositiveCents($payload['amount'], 'amount');
            $balanceCents = $this->resolveBalanceCents($lockedInvoice);

            if ($amountCents > $balanceCents) {
                throw ValidationException::withMessages([
                    'amount' => 'El pago no puede exceder el saldo pendiente.',
                ]);
            }

            $partialPaymentsEnabled = Schema::hasColumn('fiscal_settings', 'partial_payments_enabled')
                ? (bool) (FiscalSetting::query()->value('partial_payments_enabled') ?? false)
                : false;

            if ($amountCents < $balanceCents && ! $partialPaymentsEnabled) {
                throw ValidationException::withMessages([
                    'amount' => 'El monto recibido es menor al total.',
                ]);
            }

            $payment = Payment::query()->create([
                'invoice_id' => $lockedInvoice->id,
                'cash_session_id' => $cashSession->id,
                'user_id' => $user->id,
                'method' => $payload['method'],
                'amount' => Money::formatCents($amountCents),
                'amount_cents' => $amountCents,
                'reference' => $payload['reference'] ?? null,
                'status' => Payment::STATUS_POSTED,
                'paid_at' => now(),
            ]);

            CashMovement::query()->create([
                'cash_session_id' => $cashSession->id,
                'payment_id' => $payment->id,
                'user_id' => $user->id,
                'type' => CashMovement::TYPE_PAYMENT,
                'method' => $payload['method'],
                'amount' => Money::formatCents($amountCents),
                'notes' => $lockedInvoice->invoice_number,
                'occurred_at' => now(),
            ]);

            $paidCents = $this->resolvePaidCents($lockedInvoice) + $amountCents;
            $nextBalanceCents = $balanceCents - $amountCents;

            $lockedInvoice->forceFill([
                'paid_amount' => Money::formatCents($paidCents),
                'paid_amount_cents' => $paidCents,
                'balance_due' => Money::formatCents($nextBalanceCents),
                'balance_due_cents' => $nextBalanceCents,
                'status' => $nextBalanceCents === 0 ? Invoice::STATUS_PAID : Invoice::STATUS_PARTIAL,
                'cash_session_id' => $lockedInvoice->cash_session_id ?? $cashSession->id,
            ])->save();

            AuditLog::query()->create([
                'user_id' => $user->id,
                'action' => 'payment.registered',
                'entity_type' => Payment::class,
                'entity_id' => $payment->id,
                'new_values' => [
                    'invoice_id' => $lockedInvoice->id,
                    'invoice_number' => $lockedInvoice->invoice_number,
                    'cash_session_id' => $cashSession->id,
                    'method' => $payment->method,
                    'amount' => $payment->amount,
                    'invoice_status' => $lockedInvoice->status,
                    'balance_due' => $lockedInvoice->balance_due,
                ],
            ]);

            DB::afterCommit(function () use ($payment, $lockedInvoice) {
                PaymentChanged::dispatch($payment->fresh(), 'registered');
                InvoiceChanged::dispatch($lockedInvoice->fresh(), 'updated');
            });

            return $payment->load('user:id,name,username', 'cashSession:id,user_id,status,opened_at');
        });
    }

    private function resolveBalanceCents(Invoice $invoice): int
    {
        if ($invoice->balance_due_cents !== null) {
            return (int) $invoice->balance_due_cents;
        }

        return Money::parseCents((string) $invoice->balance_due, 'balance_due');
    }

    private function resolvePaidCents(Invoice $invoice): int
    {
        if ($invoice->paid_amount_cents !== null) {
            return (int) $invoice->paid_amount_cents;
        }

        return Money::parseCents((string) $invoice->paid_amount, 'paid_amount');
    }
}
