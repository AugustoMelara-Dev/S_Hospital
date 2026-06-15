<?php

namespace App\Http\Controllers;

use App\Actions\InstitutionalReceipts\InstitutionalReceiptPdfService;
use App\Actions\InstitutionalReceipts\IssueInstitutionalReceiptAction;
use App\Http\Requests\InstitutionalReceipts\IssueInstitutionalReceiptRequest;
use App\Http\Requests\InstitutionalReceipts\RegisterReceiptPrintEventRequest;
use App\Models\InstitutionalReceipt;
use App\Models\Invoice;
use App\Models\User;
use App\Support\InvoiceAccess;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
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

        abort_unless($user instanceof User && $user->can('receipts.view'), 403);
        $receipt->loadMissing('invoice');
        $this->authorizeReceiptView($user, $receipt, $invoiceAccess);

        if ($receipt->status !== InstitutionalReceipt::STATUS_ISSUED) {
            throw ValidationException::withMessages([
                'receipt' => 'Solo se puede generar PDF para recibos institucionales emitidos.',
            ]);
        }

        $pdf = $pdfService->pdfForReceipt($receipt);

        $filename = 'recibo-institucional-'.$receipt->receipt_number_full.'.pdf';

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
        $receipt->loadMissing('invoice');
        $hasPreviousPrint = $receipt->printEvents()->exists();

        if ($hasPreviousPrint) {
            $this->authorizeReprint($request, $receipt, $invoiceAccess);
        } else {
            $this->authorizeReceiptView($user, $receipt, $invoiceAccess);
        }

        if ($receipt->status !== InstitutionalReceipt::STATUS_ISSUED) {
            throw ValidationException::withMessages([
                'receipt' => 'Solo se puede registrar impresion de recibos institucionales emitidos.',
            ]);
        }

        $event = $pdfService->recordReceiptPrintEvent(
            $receipt,
            $user,
            $hasPreviousPrint ? $this->reprintReason($request) : null
        );

        return response()->json([
            'data' => [
                'event' => $event,
                'receipt' => $receipt->fresh(),
            ],
        ], 201);
    }

    private function authorizeReceiptView(User $user, InstitutionalReceipt $receipt, InvoiceAccess $invoiceAccess): void
    {
        if ($user->can('receipts.reprint_any') || $user->can('invoices.void')) {
            return;
        }

        $invoice = $receipt->invoice;
        $isOwnCurrentDayReceipt = $receipt->issued_by === $user->id
            && $receipt->issued_at !== null
            && $receipt->issued_at->copy()->timezone(config('app.timezone'))->isSameDay(now(config('app.timezone')));

        if ($invoice instanceof Invoice) {
            abort_unless($invoiceAccess->canOperateInvoice($user, $invoice), 403);

            return;
        }

        abort_unless($isOwnCurrentDayReceipt, 403);
    }

    private function authorizeReprint(Request $request, InstitutionalReceipt $receipt, InvoiceAccess $invoiceAccess): void
    {
        $user = $request->user();

        abort_unless($user instanceof User && $user->can('receipts.reprint'), 403);

        if (! $user->can('receipts.reprint_any')) {
            $this->authorizeReceiptView($user, $receipt, $invoiceAccess);
        }

        $request->validate([
            'reason' => ['required', 'string', 'min:5', 'max:500'],
        ]);
    }

    private function reprintReason(Request $request): string
    {
        return trim((string) $request->input('reason'));
    }
}
