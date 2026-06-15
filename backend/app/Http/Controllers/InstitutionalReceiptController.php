<?php

namespace App\Http\Controllers;

use App\Actions\InstitutionalReceipts\IssueInstitutionalReceiptAction;
use App\Http\Requests\InstitutionalReceipts\IssueInstitutionalReceiptRequest;
use App\Support\InvoiceAccess;
use Illuminate\Http\JsonResponse;

class InstitutionalReceiptController extends Controller
{
    public function store(
        IssueInstitutionalReceiptRequest $request,
        IssueInstitutionalReceiptAction $issueReceipt,
        InvoiceAccess $invoiceAccess,
    ): JsonResponse {
        $receipt = $issueReceipt->execute($request->validated(), $request->user(), $invoiceAccess);

        return response()->json([
            'data' => $receipt,
        ], 201);
    }
}
