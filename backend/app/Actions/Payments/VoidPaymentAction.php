<?php

namespace App\Actions\Payments;

use App\Models\CashMovement;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\User;
use App\Support\AuditLogger;
use App\Support\Money;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class VoidPaymentAction
{
    public function __construct(
        private readonly AuditLogger $auditLogger,
    ) {}

    public function execute(Payment $payment, User $user, string $reason, ?Request $request = null): Payment
    {
        return DB::transaction(function () use ($payment, $user, $reason, $request): Payment {
            $lockedPayment = Payment::query()
                ->whereKey($payment->id)
                ->lockForUpdate()
                ->firstOrFail();

            if ($lockedPayment->status === Payment::STATUS_VOID) {
                throw ValidationException::withMessages([
                    'payment' => 'El pago ya esta anulado.',
                ]);
            }

            $lockedInvoice = Invoice::query()
                ->whereKey($lockedPayment->invoice_id)
                ->lockForUpdate()
                ->firstOrFail();

            $oldPaymentValues = [
                'status' => $lockedPayment->status,
                'voided_by' => $lockedPayment->voided_by,
                'voided_at' => $lockedPayment->voided_at,
                'void_reason' => $lockedPayment->void_reason,
            ];
            $oldInvoiceValues = [
                'status' => $lockedInvoice->status,
                'paid_amount' => $lockedInvoice->paid_amount,
                'balance_due' => $lockedInvoice->balance_due,
            ];

            $paymentCents = Money::parseCents((string) $lockedPayment->amount, 'amount');
            $paidCents = Money::parseCents((string) $lockedInvoice->paid_amount, 'paid_amount') - $paymentCents;
            $balanceCents = Money::parseCents((string) $lockedInvoice->balance_due, 'balance_due') + $paymentCents;

            if ($paidCents < 0) {
                throw ValidationException::withMessages([
                    'payment' => 'El pago no coincide con el saldo pagado de la factura.',
                ]);
            }

            $lockedPayment->forceFill([
                'status' => Payment::STATUS_VOID,
                'voided_by' => $user->id,
                'voided_at' => now(),
                'void_reason' => $reason,
            ])->save();

            $lockedInvoice->forceFill([
                'paid_amount' => Money::formatCents($paidCents),
                'balance_due' => Money::formatCents($balanceCents),
                'status' => $paidCents === 0 ? Invoice::STATUS_ISSUED : Invoice::STATUS_PARTIAL,
            ])->save();

            CashMovement::query()->create([
                'cash_session_id' => $lockedPayment->cash_session_id,
                'payment_id' => $lockedPayment->id,
                'user_id' => $user->id,
                'type' => CashMovement::TYPE_PAYMENT_VOID,
                'method' => $lockedPayment->method,
                'amount' => Money::formatCents(-$paymentCents),
                'notes' => $reason,
                'occurred_at' => now(),
            ]);

            $this->auditLogger->log(
                action: 'payment.voided',
                entity: $lockedPayment,
                user: $user,
                request: $request,
                oldValues: [
                    'payment' => $oldPaymentValues,
                    'invoice' => $oldInvoiceValues,
                ],
                newValues: [
                    'payment' => [
                        'status' => $lockedPayment->status,
                        'voided_by' => $lockedPayment->voided_by,
                        'voided_at' => $lockedPayment->voided_at,
                    ],
                    'invoice' => [
                        'status' => $lockedInvoice->status,
                        'paid_amount' => $lockedInvoice->paid_amount,
                        'balance_due' => $lockedInvoice->balance_due,
                    ],
                ],
                reason: $reason,
            );

            return $lockedPayment->load('user:id,name,username', 'cashSession:id,user_id,status,opened_at');
        });
    }
}
