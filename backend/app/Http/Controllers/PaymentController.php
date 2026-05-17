<?php

namespace App\Http\Controllers;

use App\Actions\Payments\RegisterPaymentAction;
use App\Http\Requests\Payments\StorePaymentRequest;
use App\Models\Invoice;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PaymentController extends Controller
{
    public function index(Request $request, Invoice $invoice): JsonResponse
    {
        $request->user()->can('payments.view') || abort(403);

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
    ): JsonResponse {
        $payment = $registerPayment->execute($invoice, $request->validated(), $request->user());

        return response()->json([
            'data' => [
                'payment' => $payment,
                'invoice' => $invoice->fresh()->load('items', 'payments', 'issuer:id,name,username'),
            ],
        ], 201);
    }
}
