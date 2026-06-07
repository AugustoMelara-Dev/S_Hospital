<?php

declare(strict_types=1);

namespace App\Actions\Payments;

use App\Actions\Reports\DashboardReportService;
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
                $amountCents = Money::parseSignedCents($payload['amount'], 'amount');
                // Allow a negative payment on a PAID invoice: this is the
                // refund approximation (FASE F4). The amount must be in
                // the range [0, paid_amount_cents] so the invoice never
                // goes negative on the paid side. Positive payments on
                // a PAID invoice are still rejected.
                if ($amountCents >= 0) {
                    throw ValidationException::withMessages([
                        'invoice' => 'La factura ya esta pagada.',
                    ]);
                }
            }

            $amountCents = Money::parseSignedCents($payload['amount'], 'amount');
            $balanceCents = $this->resolveBalanceCents($lockedInvoice);
            $paidCents = $this->resolvePaidCents($lockedInvoice);

            if ($amountCents === 0) {
                throw ValidationException::withMessages([
                    'amount' => 'El monto no puede ser cero.',
                ]);
            }

            if ($amountCents > 0 && $amountCents > $balanceCents) {
                throw ValidationException::withMessages([
                    'amount' => 'El monto no puede exceder el saldo pendiente.',
                ]);
            }

            // A negative payment cannot refund more than has been
            // paid so far. Without this guard a cashier could push
            // the invoice's paid_amount_cents into the negative.
            if ($amountCents < 0 && abs($amountCents) > $paidCents) {
                throw ValidationException::withMessages([
                    'amount' => 'La devolucion no puede exceder el monto pagado en valor absoluto.',
                ]);
            }

            $partialPaymentsEnabled = Schema::hasColumn('fiscal_settings', 'partial_payments_enabled')
                ? (bool) (FiscalSetting::query()->value('partial_payments_enabled') ?? false)
                : false;

            if ($amountCents > 0 && $amountCents < $balanceCents && ! $partialPaymentsEnabled) {
                throw ValidationException::withMessages([
                    'amount' => 'El monto recibido es menor al saldo pendiente. No se puede registrar como pagado; active pagos parciales solo si administracion lo autoriza.',
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

            $nextPaidCents = $paidCents + $amountCents;
            $nextBalanceCents = $balanceCents - $amountCents;

            $lockedInvoice->forceFill([
                'paid_amount' => Money::formatCents($nextPaidCents),
                'paid_amount_cents' => $nextPaidCents,
                'balance_due' => Money::formatCents($nextBalanceCents),
                'balance_due_cents' => $nextBalanceCents,
                'status' => $nextBalanceCents === 0 ? Invoice::STATUS_PAID : ($nextPaidCents <= 0 ? Invoice::STATUS_ISSUED : Invoice::STATUS_PARTIAL),
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

            DB::afterCommit(function () use ($payment, $lockedInvoice, $user) {
                PaymentChanged::dispatch($payment->fresh(), 'registered', $user->id);
                InvoiceChanged::dispatch($lockedInvoice->fresh(), 'updated', $user->id);
                DashboardReportService::forgetCache();
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
