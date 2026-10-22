<?php

namespace App\Actions\InstitutionalReceipts;

use App\Actions\Billing\PreservesIssuedTimestamps;
use App\Actions\Receipts\ReprintReason;
use App\Models\InstitutionalReceipt;
use App\Models\InstitutionalReceiptPrintEvent;
use App\Models\InstitutionalReceiptSeries;
use App\Models\Invoice;
use App\Models\ReceiptPrintProfile;
use App\Models\User;
use App\Support\InvoiceAccess;
use App\Support\PaperSize;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;

/**
 * Institutional receipt PDF delivery pipeline.
 *
 * HS-PRINT-DELIVERY vocabulary used by this service (durable records only):
 * - Emisión: IssueInstitutionalReceiptAction persists the receipt and snapshots the
 *   financial data, profile and copy_mode. No paper is involved yet.
 * - Solicitud/generación para impresión: the print-event route
 *   (POST /print-events) records `issued_print` on the first logical print and
 *   `reprint` afterwards. GET /pdf is a read-only stream and records nothing.
 * - Primera solicitud autorizada de impresión: the first recorded print event
 *   (issued_print). It carries no reason and does not increment reprint_count.
 * - Reimpresión: a print event recorded after the first one (reprint) or a
 *   POST /pdf after the first recorded print. Both require a human reason of
 *   5-500 characters and increment institutional_receipts.reprint_count under
 *   the receipt row lock, so every reprint route shares the same persistent
 *   number. The `issued_print` event does not renumber the first delivery.
 * - Vista previa: GET /pdf?preview=1 renders the same HTML source but records no
 *   print event and changes no counter.
 * - Descarga: GET /pdf streams the document without recording a print event; a
 *   downloaded file later printed outside the application is not observable here.
 *   `pdf_generated` exists in the event enum but is intentionally not written:
 *   generation is represented by the print request/event, never by the transport.
 *
 * A print event and a PDF request accredit a logical request/delivery inside the
 * system: they do not prove that paper physically left a printer, nor how many
 * times a downloaded file was later printed outside the application.
 */
class InstitutionalReceiptPdfService
{
    // M-W2-RCP-04: registrar un evento de impresion (reprint_count) no debe
    // dejar que MariaDB reescriba `institutional_receipts.issued_at`.
    use PreservesIssuedTimestamps;

    public function __construct(
        private readonly InstitutionalReceiptHtmlBuilder $htmlBuilder,
    ) {}

    public function htmlForReceipt(InstitutionalReceipt $receipt, bool $draft = false, ?string $reprintLabel = null): string
    {
        return $this->htmlBuilder->forReceipt($receipt, $draft, $reprintLabel);
    }

    /**
     * Canonical result of the generator for an issued receipt (C3-P2).
     *
     * It carries the HTML plus the MEASURED page count, the requested vs used
     * composition and the distribution of the copy set. Every surface that talks
     * about how many pages the document contains must read this instead of
     * deriving pages from the number of copies.
     */
    public function planForReceipt(InstitutionalReceipt $receipt, bool $draft = false, ?string $reprintLabel = null): InstitutionalReceiptDocumentPlan
    {
        return $this->htmlBuilder->planForReceipt($receipt, $draft, $reprintLabel);
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function planForDraft(array $data, ReceiptPrintProfile $profile, ?InstitutionalReceiptSeries $series = null): InstitutionalReceiptDocumentPlan
    {
        return $this->htmlBuilder->planForDraft($data, $profile, $series);
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function htmlForDraft(array $data, ReceiptPrintProfile $profile, ?InstitutionalReceiptSeries $series = null): string
    {
        return $this->htmlBuilder->forDraft($data, $profile, $series);
    }

    /**
     * @return list<string>
     */
    public function copyLabelsForProfile(ReceiptPrintProfile $profile): array
    {
        return $this->htmlBuilder->copyLabels($profile->copies_mode);
    }

    public function pdfForReceipt(InstitutionalReceipt $receipt, ?string $reprintLabel = null): string
    {
        return Pdf::loadHTML($this->htmlForReceipt($receipt, false, $reprintLabel))
            ->setPaper(PaperSize::fromProfileSnapshot($receipt->profile_snapshot))
            ->output();
    }

    /**
     * POST /institutional-receipts/{receipt}/pdf is the document request route.
     *
     * - Before the first recorded print it is a first-print generation: optional
     *   reason (validated if present), no print event, no counter movement.
     * - After a recorded print it is a reprint request: `receipts.reprint` is
     *   required (same authorization as the print-event route), the human reason
     *   is mandatory 5-500, and the reprint is recorded durably under the row
     *   lock (a `reprint` event plus `institutional_receipts.reprint_count`).
     *   The PDF is rendered with the exact consumed number (`REIMPRESIÓN #n`),
     *   so this route can never generate two reprints under the same number and
     *   never renumbers the first delivery.
     *
     * GET /pdf stays read-only: it streams the current document (with the
     * next-reprint mark derived from the counter) and records nothing.
     */
    public function pdfForAuthorizedReceipt(
        InstitutionalReceipt $receipt,
        User $user,
        InvoiceAccess $invoiceAccess,
        ?string $reason = null,
        bool $reprintRequest = false,
    ): string {
        if ($reprintRequest) {
            [$renderReceipt, $reprintLabel] = DB::transaction(function () use ($receipt, $user, $reason, $invoiceAccess): array {
                $lockedReceipt = $this->lockedReceipt($receipt);

                // Same authorization contract as the print-event route: the first
                // print only needs view/ownership; a reprint additionally requires
                // receipts.reprint and a human reason.
                $this->authorizeLockedReceiptPrint($lockedReceipt, $user, $reason, $invoiceAccess);
                $this->assertPdfRequestReason($reason);

                if (! $lockedReceipt->printEvents()->exists()) {
                    return [$lockedReceipt, null];
                }

                // Reserve the number before the write; recordLockedPrintEvent
                // increments reprint_count to this same value inside the lock.
                $reservedNumber = (int) $lockedReceipt->reprint_count + 1;
                $this->recordLockedPrintEvent($lockedReceipt, $user, $reason);

                return [$lockedReceipt, 'REIMPRESIÓN #'.$reservedNumber];
            });

            return $this->pdfForReceipt($renderReceipt, $reprintLabel);
        }

        $receipt = $this->receiptForPdf($receipt);

        $this->authorizeLockedReceiptPdfView($receipt, $user, $invoiceAccess);
        $this->assertPdfRequestReason($reason);

        return $this->pdfForReceipt($receipt);
    }

    public function htmlForAuthorizedReceipt(
        InstitutionalReceipt $receipt,
        User $user,
        InvoiceAccess $invoiceAccess,
    ): string {
        $receipt = $this->receiptForPdf($receipt);

        $this->authorizeLockedReceiptPdfView($receipt, $user, $invoiceAccess);

        return $this->htmlForReceipt($receipt);
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function pdfForDraft(array $data, ReceiptPrintProfile $profile, ?InstitutionalReceiptSeries $series = null): string
    {
        return Pdf::loadHTML($this->htmlForDraft($data, $profile, $series))
            ->setPaper(PaperSize::fromProfile($profile))
            ->output();
    }

    public function recordReceiptPrintEvent(InstitutionalReceipt $receipt, User $user, ?string $reason = null): InstitutionalReceiptPrintEvent
    {
        return DB::transaction(function () use ($receipt, $user, $reason): InstitutionalReceiptPrintEvent {
            return $this->recordLockedPrintEvent($this->lockedReceipt($receipt), $user, $reason);
        });
    }

    public function recordAuthorizedReceiptPrintEvent(
        InstitutionalReceipt $receipt,
        User $user,
        ?string $reason,
        InvoiceAccess $invoiceAccess,
    ): InstitutionalReceiptPrintEvent {
        return DB::transaction(function () use ($receipt, $user, $reason, $invoiceAccess): InstitutionalReceiptPrintEvent {
            $lockedReceipt = $this->lockedReceipt($receipt);

            $this->authorizeLockedReceiptPrint($lockedReceipt, $user, $reason, $invoiceAccess);

            return $this->recordLockedPrintEvent($lockedReceipt, $user, $reason);
        });
    }

    public function recordTestPrintEvent(ReceiptPrintProfile $profile, User $user): InstitutionalReceiptPrintEvent
    {
        return InstitutionalReceiptPrintEvent::query()->create([
            'institutional_receipt_id' => null,
            'event_type' => InstitutionalReceiptPrintEvent::TYPE_TEST_PRINT,
            'copy_label' => implode('/', $this->htmlBuilder->copyLabels($profile->copies_mode)),
            'profile_snapshot' => [
                'code' => $profile->code,
                'name' => $profile->name,
                'paper_kind' => $profile->paper_kind,
                'width_mm' => (string) $profile->width_mm,
                'height_mm' => (string) $profile->height_mm,
                'copies_mode' => $profile->copies_mode,
            ],
            'reason' => 'PRUEBA - SIN VALIDEZ',
            'user_id' => $user->id,
            'created_at' => now(),
        ]);
    }

    private function receiptForPdf(InstitutionalReceipt $receipt): InstitutionalReceipt
    {
        return InstitutionalReceipt::query()
            ->with('invoice')
            ->whereKey($receipt->id)
            ->firstOrFail();
    }

    private function lockedReceipt(InstitutionalReceipt $receipt): InstitutionalReceipt
    {
        return InstitutionalReceipt::query()
            ->with('invoice')
            ->whereKey($receipt->id)
            ->lockForUpdate()
            ->firstOrFail();
    }

    private function authorizeLockedReceiptPdfView(
        InstitutionalReceipt $receipt,
        User $user,
        InvoiceAccess $invoiceAccess,
    ): void {
        abort_unless($user->can('receipts.view'), 403);

        if ($receipt->status !== InstitutionalReceipt::STATUS_ISSUED) {
            throw $this->validationException([
                'receipt' => 'Solo se puede generar PDF para recibos institucionales emitidos.',
            ]);
        }

        $this->authorizeReceiptView($user, $receipt, $invoiceAccess);
    }

    private function authorizeLockedReceiptPrint(
        InstitutionalReceipt $receipt,
        User $user,
        ?string $reason,
        InvoiceAccess $invoiceAccess,
    ): void {
        abort_unless($user->can('receipts.view'), 403);

        if ($receipt->status !== InstitutionalReceipt::STATUS_ISSUED) {
            throw $this->validationException([
                'receipt' => 'Solo se puede generar PDF para recibos institucionales emitidos.',
            ]);
        }

        $hasPreviousPrint = $receipt->printEvents()->exists();

        if (! $hasPreviousPrint) {
            $this->authorizeReceiptView($user, $receipt, $invoiceAccess);

            return;
        }

        abort_unless($user->can('receipts.reprint'), 403);

        if (! $user->can('receipts.reprint_any')) {
            $this->authorizeReceiptView($user, $receipt, $invoiceAccess);
        }

        $this->validateReprintReason($reason);
    }

    /**
     * Validates an explicitly provided document-request reason.
     *
     * A reprint request additionally requires a human reason 5-500 (enforced by
     * authorizeLockedReceiptPrint, shared with the print-event route); a
     * first-print request may omit it. A provided reason is always validated so
     * a canned/automatic string cannot pass through any route.
     */
    public function assertPdfRequestReason(?string $reason): void
    {
        $trimmed = trim((string) $reason);

        if ($trimmed !== '') {
            $this->validateReprintReason($trimmed);
        }
    }

    private function authorizeReceiptView(User $user, InstitutionalReceipt $receipt, InvoiceAccess $invoiceAccess): void
    {
        if ($user->can('receipts.reprint_any')) {
            return;
        }

        $invoice = $receipt->invoice;
        $timezone = $this->operationalTimezone();
        $isOwnCurrentDayReceipt = $receipt->issued_by === $user->id
            && $receipt->issued_at !== null
            && $receipt->issued_at->copy()->timezone($timezone)->isSameDay(now($timezone));

        if ($invoice instanceof Invoice) {
            abort_unless($invoiceAccess->canOperateInvoice($user, $invoice), 403);

            return;
        }

        abort_unless($isOwnCurrentDayReceipt, 403);
    }

    private function operationalTimezone(): string
    {
        $timezone = config('app.timezone', 'America/Tegucigalpa');

        return is_string($timezone) && $timezone !== ''
            ? $timezone
            : 'America/Tegucigalpa';
    }

    private function recordLockedPrintEvent(InstitutionalReceipt $lockedReceipt, User $user, ?string $reason): InstitutionalReceiptPrintEvent
    {
        $hasPreviousPrint = $lockedReceipt->printEvents()->exists();

        if ($hasPreviousPrint) {
            $this->validateReprintReason($reason);

            // M-W2-RCP-04: `issued_at` es el hecho historico de emision; una
            // reimpresion solo mueve el contador persistente.
            $issuedAt = $lockedReceipt->issued_at;

            $lockedReceipt->forceFill([
                'reprint_count' => $lockedReceipt->reprint_count + 1,
            ])->save();

            // El trait de hs-finance tambien expone restoreTimestamp; se reutiliza
            // para `institutional_receipts.issued_at` (campo que su trait no
            // cubria de forma dedicada).
            $this->restoreTimestamp('institutional_receipts', $lockedReceipt->getKey(), 'issued_at', $issuedAt);
        }

        return InstitutionalReceiptPrintEvent::query()->create([
            'institutional_receipt_id' => $lockedReceipt->id,
            'event_type' => $hasPreviousPrint
                ? InstitutionalReceiptPrintEvent::TYPE_REPRINT
                : InstitutionalReceiptPrintEvent::TYPE_ISSUED_PRINT,
            'copy_label' => implode('/', $this->htmlBuilder->copyLabels($lockedReceipt->copy_mode)),
            'profile_snapshot' => $lockedReceipt->profile_snapshot,
            'reason' => $hasPreviousPrint ? trim((string) $reason) : null,
            'user_id' => $user->id,
            'created_at' => now(),
        ]);
    }

    private function validateReprintReason(?string $reason): void
    {
        if (ReprintReason::isValid($reason)) {
            return;
        }

        throw $this->validationException([
            'reason' => 'El motivo de reimpresion es obligatorio y debe tener entre 5 y 500 caracteres.',
        ]);
    }

    /**
     * @param  array<string, string>  $messages
     */
    private function validationException(array $messages): ValidationException
    {
        return ReceiptPdfValidationException::withMessages($messages);
    }
}

final class ReceiptPdfValidationException extends ValidationException implements HttpExceptionInterface
{
    public function getStatusCode(): int
    {
        return $this->status;
    }

    /**
     * @return array<string, string>
     */
    public function getHeaders(): array
    {
        return [];
    }
}
