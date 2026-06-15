<?php

namespace App\Actions\InstitutionalReceipts;

use App\Models\AuditLog;
use App\Models\CashRegisterSession;
use App\Models\InstitutionalReceipt;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\ReceiptPrintProfile;
use App\Models\User;
use App\Support\InvoiceAccess;
use App\Support\Money;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class IssueInstitutionalReceiptAction
{
    public function __construct(
        private readonly ReserveInstitutionalReceiptNumberAction $reserveNumber,
        private readonly BuildInstitutionalReceiptSnapshotAction $buildSnapshot,
        private readonly ResolveReceiptPrintProfileAction $resolveProfile,
        private readonly AmountToSpanishWords $amountToSpanishWords,
    ) {}

    /**
     * @param  array{invoice_id: int, payment_id?: int|null, cash_session_id?: int|null, profile_id?: int|null, profile_code?: string|null}  $payload
     *
     * @throws AuthorizationException
     * @throws ModelNotFoundException
     * @throws ValidationException
     */
    public function execute(array $payload, User $user, InvoiceAccess $invoiceAccess): InstitutionalReceipt
    {
        return DB::transaction(function () use ($payload, $user, $invoiceAccess): InstitutionalReceipt {
            $invoice = Invoice::query()
                ->with('items', 'payments.user:id,name,username')
                ->whereKey($payload['invoice_id'])
                ->lockForUpdate()
                ->firstOrFail();

            $invoiceAccess->authorizeOperationalAccess($user, $invoice);
            $this->assertInvoiceCanBeIssued($invoice);

            if ($this->hasExistingIssuedReceipt($invoice)) {
                throw ValidationException::withMessages([
                    'invoice_id' => 'Esta factura ya tiene un recibo institucional emitido.',
                ]);
            }

            $selectedPayment = $this->selectedPayment($invoice, $payload);
            $cashSession = $this->cashSession($invoice, $selectedPayment, $payload);
            $this->assertCashSessionCanBeUsed($cashSession, $user);

            $profile = $this->resolveProfile($payload, $user, $cashSession);
            $reservation = $this->reserveNumber->execute();
            $amountCents = $this->invoiceTotalCents($invoice);
            $snapshot = $this->buildSnapshot->execute(
                $invoice,
                $reservation['series'],
                $profile,
                $user,
                $cashSession,
                $selectedPayment,
                $reservation['full']
            );

            $receipt = InstitutionalReceipt::query()->create([
                'invoice_id' => $invoice->id,
                'payment_id' => $selectedPayment?->id,
                'cash_session_id' => $cashSession->id,
                'series_id' => $reservation['series']->id,
                'receipt_number' => $reservation['number'],
                'receipt_number_full' => $reservation['full'],
                'status' => InstitutionalReceipt::STATUS_ISSUED,
                'amount' => Money::formatCents($amountCents),
                'amount_cents' => $amountCents,
                'issued_at' => now(),
                'issued_by' => $user->id,
                'payer_name' => $snapshot['payer_name'],
                'concept' => $snapshot['concept'],
                'amount_words' => $this->amountToSpanishWords->forCents($amountCents),
                'template_code' => $profile->template_code,
                'print_profile_code' => $profile->code,
                'copy_mode' => $profile->copies_mode,
                'institution_snapshot' => $snapshot['institution_snapshot'],
                'series_snapshot' => $snapshot['series_snapshot'],
                'profile_snapshot' => $snapshot['profile_snapshot'],
                'invoice_snapshot' => $snapshot['invoice_snapshot'],
                'payment_snapshot' => $snapshot['payment_snapshot'],
                'items_snapshot' => $snapshot['items_snapshot'],
            ]);

            AuditLog::query()->create([
                'user_id' => $user->id,
                'action' => 'institutional_receipt.issued',
                'entity_type' => InstitutionalReceipt::class,
                'entity_id' => $receipt->id,
                'new_values' => [
                    'invoice_number' => $invoice->invoice_number,
                    'receipt_number_full' => $receipt->receipt_number_full,
                    'amount' => $receipt->amount,
                    'cash_session_id' => $cashSession->id,
                    'payment_id' => $selectedPayment?->id,
                ],
            ]);

            return $receipt->refresh()->load('invoice', 'payment', 'cashSession', 'series', 'issuer:id,name,username');
        });
    }

    private function assertInvoiceCanBeIssued(Invoice $invoice): void
    {
        if ($invoice->status === Invoice::STATUS_VOID) {
            throw ValidationException::withMessages([
                'invoice_id' => 'No se puede emitir recibo para una factura anulada.',
            ]);
        }

        if ($invoice->status !== Invoice::STATUS_PAID || $this->invoiceBalanceCents($invoice) !== 0) {
            throw ValidationException::withMessages([
                'invoice_id' => 'Solo se puede emitir recibo institucional para facturas pagadas.',
            ]);
        }
    }

    private function hasExistingIssuedReceipt(Invoice $invoice): bool
    {
        return InstitutionalReceipt::query()
            ->where('invoice_id', $invoice->id)
            ->where('status', '!=', InstitutionalReceipt::STATUS_VOID)
            ->exists();
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    private function selectedPayment(Invoice $invoice, array $payload): ?Payment
    {
        if (empty($payload['payment_id'])) {
            return null;
        }

        $payment = Payment::query()
            ->whereKey($payload['payment_id'])
            ->lockForUpdate()
            ->firstOrFail();

        if ($payment->invoice_id !== $invoice->id) {
            throw ValidationException::withMessages([
                'payment_id' => 'El pago seleccionado no pertenece a esta factura.',
            ]);
        }

        if ($payment->status !== Payment::STATUS_POSTED) {
            throw ValidationException::withMessages([
                'payment_id' => 'El pago seleccionado no esta posteado.',
            ]);
        }

        return $payment;
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    private function cashSession(Invoice $invoice, ?Payment $selectedPayment, array $payload): CashRegisterSession
    {
        $requestedCashSessionId = $payload['cash_session_id'] ?? null;
        $cashSessionId = null;

        if ($selectedPayment instanceof Payment) {
            $cashSessionId = $selectedPayment->cash_session_id;
        }

        if (! $cashSessionId) {
            $latestPayment = $invoice->payments
                ->where('status', Payment::STATUS_POSTED)
                ->sortByDesc('paid_at')
                ->first();

            if ($latestPayment instanceof Payment) {
                $cashSessionId = $latestPayment->cash_session_id;
            }
        }

        if (! $cashSessionId) {
            $cashSessionId = $invoice->cash_session_id;
        }

        if ($requestedCashSessionId && $cashSessionId && (int) $requestedCashSessionId !== (int) $cashSessionId) {
            throw ValidationException::withMessages([
                'cash_session_id' => 'La caja seleccionada no coincide con la caja asociada al cobro de esta factura.',
            ]);
        }

        if ($requestedCashSessionId && ! $cashSessionId) {
            $cashSessionId = $requestedCashSessionId;
        }

        if (! $cashSessionId) {
            throw ValidationException::withMessages([
                'cash_session_id' => 'No se encontro una caja asociada a la factura pagada.',
            ]);
        }

        return CashRegisterSession::query()
            ->whereKey($cashSessionId)
            ->lockForUpdate()
            ->firstOrFail();
    }

    private function assertCashSessionCanBeUsed(CashRegisterSession $cashSession, User $user): void
    {
        if ($cashSession->user_id !== $user->id && ! $user->can('invoices.operate_any')) {
            throw new AuthorizationException('No puede emitir recibos desde la caja de otro usuario.');
        }

        if ($cashSession->status !== CashRegisterSession::STATUS_OPEN) {
            throw ValidationException::withMessages([
                'cash_session_id' => 'La caja seleccionada esta cerrada.',
            ]);
        }
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    private function resolveProfile(array $payload, User $user, CashRegisterSession $cashSession): ReceiptPrintProfile
    {
        if (! empty($payload['profile_id'])) {
            return ReceiptPrintProfile::query()
                ->where('active', true)
                ->findOrFail($payload['profile_id']);
        }

        if (! empty($payload['profile_code'])) {
            return ReceiptPrintProfile::query()
                ->where('active', true)
                ->where('code', $payload['profile_code'])
                ->firstOrFail();
        }

        return $this->resolveProfile->execute($user, $cashSession);
    }

    private function invoiceTotalCents(Invoice $invoice): int
    {
        return (int) $invoice->total_cents;
    }

    private function invoiceBalanceCents(Invoice $invoice): int
    {
        return (int) $invoice->balance_due_cents;
    }
}
