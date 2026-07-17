<?php

namespace App\Http\Controllers;

use App\Actions\Receipts\GenerateReceiptDataAction;
use App\Actions\Receipts\ReprintReceiptAction;
use App\Http\Requests\Receipts\ReprintReceiptRequest;
use App\Http\Requests\Receipts\ShowReceiptRequest;
use App\Models\Invoice;
use App\Support\AuditLogger;
use Illuminate\Http\JsonResponse;

class ReceiptController extends Controller
{
    public function show(
        ShowReceiptRequest $request,
        Invoice $invoice,
        GenerateReceiptDataAction $generateReceiptData,
        AuditLogger $auditLogger,
    ): JsonResponse {
        $user = $this->authenticatedUser($request);
        $receipt = $generateReceiptData->execute($invoice, $request->width());

        $auditLogger->log(
            action: 'receipt.viewed',
            entity: $invoice,
            user: $user,
            request: $request,
            newValues: [
                'invoice_number' => $invoice->invoice_number,
                'invoice_status' => $invoice->status,
                'width' => $receipt['width'] ?? $request->width(),
            ],
        );

        return response()->json([
            'data' => $receipt,
        ]);
    }

    public function reprint(
        ReprintReceiptRequest $request,
        Invoice $invoice,
        ReprintReceiptAction $reprintReceipt,
    ): JsonResponse {
        $user = $this->authenticatedUser($request);

        return response()->json([
            'data' => $reprintReceipt->execute(
                $invoice,
                $user,
                $request->width(),
                $request->reason(),
                $request,
            ),
        ]);
    }
}
