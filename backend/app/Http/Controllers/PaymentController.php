<?php

namespace App\Http\Controllers;

use App\Actions\Payments\RegisterPaymentAction;
use App\Actions\Payments\VoidPaymentAction;
use App\Http\Requests\Payments\IndexPaymentRequest;
use App\Http\Requests\Payments\StorePaymentRequest;
use App\Http\Requests\Payments\VoidPaymentRequest;
use App\Models\Invoice;
use App\Models\Payment;
use App\Support\InvoiceAccess;
use Illuminate\Http\JsonResponse;

class PaymentController extends Controller
{
    public function index(IndexPaymentRequest $request, Invoice $invoice, InvoiceAccess $invoiceAccess): JsonResponse
    {
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
        $payment = $registerPayment->execute($invoice, $request->validated(), $request->user(), $invoiceAccess);

        return response()->json([
            'data' => [
                'payment' => $payment,
                'invoice' => $invoice->fresh()->load('items', 'payments', 'issuer:id,name,username'),
            ],
        ], 201);
    }

    public function void(
        VoidPaymentRequest $request,
        Invoice $invoice,
        Payment $payment,
        VoidPaymentAction $voidPayment,
        InvoiceAccess $invoiceAccess,
    ): JsonResponse {
        $voidedPayment = $voidPayment->execute($invoice, $payment, $request->validated(), $request->user(), $invoiceAccess);

        return response()->json([
            'data' => [
                'payment' => $voidedPayment,
                'invoice' => $invoice->fresh()->load('items', 'payments', 'issuer:id,name,username'),
            ],
        ]);
    }
}
