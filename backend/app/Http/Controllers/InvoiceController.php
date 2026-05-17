<?php

namespace App\Http\Controllers;

use App\Actions\Billing\CreateInvoiceAction;
use App\Http\Requests\Billing\IndexInvoiceRequest;
use App\Http\Requests\Billing\StoreInvoiceRequest;
use App\Models\Invoice;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class InvoiceController extends Controller
{
    public function index(IndexInvoiceRequest $request): JsonResponse
    {
        $invoices = Invoice::query()
            ->with('issuer:id,name,username')
            ->orderByDesc('issued_at')
            ->paginate($request->perPage());

        return response()->json([
            'data' => $invoices->items(),
            'meta' => [
                'current_page' => $invoices->currentPage(),
                'per_page' => $invoices->perPage(),
                'total' => $invoices->total(),
            ],
        ]);
    }

    public function store(StoreInvoiceRequest $request, CreateInvoiceAction $createInvoice): JsonResponse
    {
        $invoice = $createInvoice->execute($request->validated(), $request->user());

        return response()->json([
            'data' => $invoice,
        ], 201);
    }

    public function show(Request $request, Invoice $invoice): JsonResponse
    {
        $request->user()->can('invoices.view') || abort(403);

        return response()->json([
            'data' => $invoice->load('items', 'issuer:id,name,username'),
        ]);
    }
}
