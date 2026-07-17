<?php

namespace App\Http\Controllers;

use App\Actions\InstitutionalReceipts\IssueInstitutionalReceiptAction;
use App\Actions\Payments\RegisterPaymentAction;
use App\Actions\Payments\VoidPaymentAction;
use App\Http\Requests\Payments\IndexPaymentRequest;
use App\Http\Requests\Payments\StorePaymentRequest;
use App\Http\Requests\Payments\VoidPaymentRequest;
use App\Models\InstitutionalReceipt;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\User;
use App\Support\InvoiceAccess;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class PaymentController extends Controller
{
    public function index(IndexPaymentRequest $request, Invoice $invoice, InvoiceAccess $invoiceAccess): JsonResponse
    {
        $invoiceAccess->authorizeOperationalAccess($this->authenticatedUser($request), $invoice);

        return response()->json([
            'data' => $invoice->payments()
                ->with('user:id,name,username', 'cashSession:id,user_id,status,opened_at')
                ->latest('paid_at')
                ->get(),
        ]);
    }

    public function store(
        StorePaymentRequest $request,
        Invoice $invoice,
        RegisterPaymentAction $registerPayment,
        IssueInstitutionalReceiptAction $issueReceipt,
        InvoiceAccess $invoiceAccess,
    ): JsonResponse {
        return DB::transaction(function () use ($request, $invoice, $registerPayment, $issueReceipt, $invoiceAccess) {
            $payment = $registerPayment->execute($invoice, $request->payload(), $this->authenticatedUser($request), $invoiceAccess, $request);
            $freshInvoice = $invoice->refresh()->load('items', 'payments', 'issuer:id,name,username');
            $receiptResult = $this->issueInstitutionalReceiptAfterPaidPayment(
                $request,
                $freshInvoice,
                $payment,
                $issueReceipt,
                $invoiceAccess,
            );

            return response()->json([
                'data' => [
                    'payment' => $payment,
                    'invoice' => $freshInvoice,
                    'institutional_receipt' => $receiptResult['receipt'],
                    'institutional_receipt_error' => $receiptResult['error'],
                    'receipt_outcome' => $receiptResult['outcome'],
                ],
            ], 201);
        });
    }

    public function void(
        VoidPaymentRequest $request,
        Invoice $invoice,
        Payment $payment,
        VoidPaymentAction $voidPayment,
        InvoiceAccess $invoiceAccess,
    ): JsonResponse {
        $voidedPayment = $voidPayment->execute($invoice, $payment, $request->payload(), $this->authenticatedUser($request), $invoiceAccess);

        return response()->json([
            'data' => [
                'payment' => $voidedPayment,
                'invoice' => $invoice->refresh()->load('items', 'payments', 'issuer:id,name,username'),
            ],
        ]);
    }

    public function voidByPayment(
        VoidPaymentRequest $request,
        Payment $payment,
        VoidPaymentAction $voidPayment,
        InvoiceAccess $invoiceAccess,
    ): JsonResponse {
        /** @var Invoice $invoice */
        $invoice = $payment->invoice()->firstOrFail();
        $voidedPayment = $voidPayment->execute($invoice, $payment, $request->payload(), $this->authenticatedUser($request), $invoiceAccess);

        return response()->json([
            'data' => [
                'payment' => $voidedPayment,
                'invoice' => $invoice->refresh()->load('items', 'payments', 'issuer:id,name,username'),
            ],
        ]);
    }

    /**
     * @return array{
     *     receipt: InstitutionalReceipt|null,
     *     error: string|null,
     *     outcome: 'issued'|'not_required'|'recovery_required'
     * }
     */
    private function issueInstitutionalReceiptAfterPaidPayment(
        StorePaymentRequest $request,
        Invoice $invoice,
        Payment $payment,
        IssueInstitutionalReceiptAction $issueReceipt,
        InvoiceAccess $invoiceAccess,
    ): array {
        $user = $request->user();

        if ($invoice->status !== Invoice::STATUS_PAID || $invoice->balance_due_cents !== 0) {
            return ['receipt' => null, 'error' => null, 'outcome' => 'not_required'];
        }

        if (! ($user instanceof User) || ! $user->can('receipts.view')) {
            return [
                'receipt' => null,
                'error' => 'Pago registrado. Un usuario autorizado debe emitir el recibo institucional desde Historial de facturas.',
                'outcome' => 'recovery_required',
            ];
        }

        try {
            $receipt = $issueReceipt->execute([
                'invoice_id' => $invoice->id,
                'payment_id' => $payment->id,
                'cash_session_id' => $payment->cash_session_id,
            ], $user, $invoiceAccess);

            return ['receipt' => $receipt, 'error' => null, 'outcome' => 'issued'];
        } catch (ValidationException $exception) {
            $firstError = collect($exception->errors())->flatten()->first();

            return [
                'receipt' => null,
                'error' => is_string($firstError) && $firstError !== ''
                    ? $firstError
                    : 'Pago registrado, pero no se pudo emitir el recibo institucional.',
                'outcome' => 'recovery_required',
            ];
        } catch (ModelNotFoundException) {
            return [
                'receipt' => null,
                'error' => 'Pago registrado, pero falta configurar una serie o perfil activo de recibos institucionales.',
                'outcome' => 'recovery_required',
            ];
        }
    }
}
