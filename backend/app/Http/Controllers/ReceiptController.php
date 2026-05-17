<?php

namespace App\Http\Controllers;

use App\Actions\Receipts\GenerateReceiptDataAction;
use App\Http\Requests\Receipts\ShowReceiptRequest;
use App\Models\Invoice;
use Illuminate\Http\JsonResponse;

class ReceiptController extends Controller
{
    public function show(
        ShowReceiptRequest $request,
        Invoice $invoice,
        GenerateReceiptDataAction $generateReceiptData,
    ): JsonResponse {
        return response()->json([
            'data' => $generateReceiptData->execute($invoice, $request->width()),
        ]);
    }
}
