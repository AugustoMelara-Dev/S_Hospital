<?php

namespace App\Http\Controllers;

use App\Actions\InstitutionalReceipts\InstitutionalReceiptPdfService;
use App\Actions\InstitutionalReceipts\IssueInstitutionalReceiptAction;
use App\Http\Requests\InstitutionalReceipts\IssueInstitutionalReceiptRequest;
use App\Http\Requests\InstitutionalReceipts\RegisterReceiptPrintEventRequest;
use App\Models\InstitutionalReceipt;
use App\Models\User;
use App\Support\InvoiceAccess;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class InstitutionalReceiptController extends Controller
{
    public function store(
        IssueInstitutionalReceiptRequest $request,
        IssueInstitutionalReceiptAction $issueReceipt,
        InvoiceAccess $invoiceAccess,
    ): JsonResponse {
        $receipt = $issueReceipt->execute($request->payload(), $this->authenticatedUser($request), $invoiceAccess);

        return response()->json([
            'data' => $receipt,
        ], 201);
    }

    /**
     * GET  /institutional-receipts/{receipt}/pdf          : view/download (read-only).
     * GET  /institutional-receipts/{receipt}/pdf?preview=1: HTML preview (no print event).
     * POST /institutional-receipts/{receipt}/pdf          : document request. Before the
     *   first recorded print it is a first-print request (reason optional); after a
     *   recorded print it is a reprint request and requires `receipts.reprint` plus a
     *   human reason 5-500. A reprint recorded through this route durably increments
     *   institutional_receipts.reprint_count and stores a `reprint` event, exactly
     *   like POST /print-events, so there is a single persistent reprint number.
     *
     * None of these responses records a print event or proves physical paper output;
     * the print-event endpoint is the logical delivery record.
     */
    public function pdf(
        Request $request,
        InstitutionalReceipt $receipt,
        InstitutionalReceiptPdfService $pdfService,
        InvoiceAccess $invoiceAccess,
    ): Response {
        $user = $request->user();

        abort_unless($user instanceof User, 403);

        if ($request->boolean('preview')) {
            return response($pdfService->htmlForAuthorizedReceipt(
                $receipt,
                $user,
                $invoiceAccess,
            ), 200, [
                'Content-Type' => 'text/html; charset=UTF-8',
            ]);
        }

        $isReprintRequest = $request->isMethod('POST');

        $pdf = $pdfService->pdfForAuthorizedReceipt(
            $receipt,
            $user,
            $invoiceAccess,
            $isReprintRequest ? $this->reprintReason($request) : null,
            $isReprintRequest,
        );

        $filename = $this->safePdfFilename($receipt->receipt_number_full);

        return response($pdf, 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'inline; filename="'.$filename.'"',
        ]);
    }

    public function printEvent(
        RegisterReceiptPrintEventRequest $request,
        InstitutionalReceipt $receipt,
        InstitutionalReceiptPdfService $pdfService,
        InvoiceAccess $invoiceAccess,
    ): JsonResponse {
        $user = $request->user();

        abort_unless($user instanceof User, 403);

        $event = $pdfService->recordAuthorizedReceiptPrintEvent(
            $receipt,
            $user,
            $this->reprintReason($request),
            $invoiceAccess,
        );

        return response()->json([
            'data' => [
                'event' => $event,
                'receipt' => $receipt->fresh(),
            ],
        ], 201);
    }

    private function reprintReason(Request $request): ?string
    {
        $reason = trim($request->string('reason')->toString());

        return $reason === '' ? null : $reason;
    }

    private function safePdfFilename(string $receiptNumber): string
    {
        if (preg_match('/^[A-Za-z0-9_-]+$/', $receiptNumber) === 1) {
            return 'recibo-institucional-'.$receiptNumber.'.pdf';
        }

        return 'recibo-institucional.pdf';
    }
}
