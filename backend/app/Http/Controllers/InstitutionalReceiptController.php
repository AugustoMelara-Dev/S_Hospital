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
        $receipt = $issueReceipt->execute($request->validated(), $request->user(), $invoiceAccess);

        return response()->json([
            'data' => $receipt,
        ], 201);
    }

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

        $pdf = $pdfService->pdfForAuthorizedReceipt(
            $receipt,
            $user,
            $invoiceAccess,
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
        if ($request->isMethod('GET')) {
            return null;
        }

        $reason = trim((string) $request->input('reason'));

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
