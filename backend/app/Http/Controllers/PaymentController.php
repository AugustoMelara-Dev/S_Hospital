<?php

namespace App\Http\Controllers;

use App\Actions\Payments\RegisterPaymentAction;
use App\Actions\Payments\VoidPaymentAction;
use App\Http\Requests\Payments\StorePaymentRequest;
use App\Http\Requests\Payments\VoidPaymentRequest;
use App\Models\Invoice;
use App\Models\Payment;
use App\Support\InvoiceAccess;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PaymentController extends Controller
{
    public function index(Request $request, Invoice $invoice, InvoiceAccess $invoiceAccess): JsonResponse
    {
        $request->user()->can('payments.view') || abort(403);
        $invoiceAccess->authorizeOperationalAccess($request->user(), $invoice);

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
        InvoiceAccess $invoiceAccess,
    ): JsonResponse {
        $payment = $registerPayment->execute($invoice, $request->validated(), $request->user(), $invoiceAccess, $request);

        return response()->json([
            'data' => [
                'payment' => $payment,
                'invoice' => $invoice->fresh()->load('items', 'payments', 'issuer:id,name,username'),
            ],
        ], 201);
    }

    public function void(
        VoidPaymentRequest $request,
        Payment $payment,
        VoidPaymentAction $voidPayment,
    ): JsonResponse {
        $voidedPayment = $voidPayment->execute($payment, $request->user(), $request->reason(), $request);

        return response()->json([
            'data' => [
                'payment' => $voidedPayment,
                'invoice' => $payment->invoice()->firstOrFail()->fresh()->load('items', 'payments', 'issuer:id,name,username'),
            ],
        ]);
    }
}
