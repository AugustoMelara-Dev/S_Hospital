<?php

namespace App\Actions\InstitutionalReceipts;

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

class InstitutionalReceiptPdfService
{
    public function __construct(
        private readonly InstitutionalReceiptHtmlBuilder $htmlBuilder,
    ) {}

    public function htmlForReceipt(InstitutionalReceipt $receipt, bool $draft = false): string
    {
        return $this->htmlBuilder->forReceipt($receipt, $draft);
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function htmlForDraft(array $data, ReceiptPrintProfile $profile, ?InstitutionalReceiptSeries $series = null): string
    {
        return $this->htmlBuilder->forDraft($data, $profile, $series);
    }

    public function pdfForReceipt(InstitutionalReceipt $receipt): string
    {
        return Pdf::loadHTML($this->htmlForReceipt($receipt))
            ->setPaper(PaperSize::fromProfileSnapshot($receipt->profile_snapshot))
            ->output();
    }

    public function pdfForReceiptAndRecordPrintEvent(
        InstitutionalReceipt $receipt,
        User $user,
        ?string $reason,
        InvoiceAccess $invoiceAccess,
    ): string {
        return DB::transaction(function () use ($receipt, $user, $reason, $invoiceAccess): string {
            $lockedReceipt = $this->lockedReceipt($receipt);

            $this->authorizeLockedReceiptPrint($lockedReceipt, $user, $reason, $invoiceAccess);

            $pdf = $this->pdfForReceipt($lockedReceipt);
            $this->recordLockedPrintEvent($lockedReceipt, $user, $reason);

            return $pdf;
        });
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

    private function lockedReceipt(InstitutionalReceipt $receipt): InstitutionalReceipt
    {
        return InstitutionalReceipt::query()
            ->with('invoice')
            ->whereKey($receipt->id)
            ->lockForUpdate()
            ->firstOrFail();
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

    private function recordLockedPrintEvent(InstitutionalReceipt $lockedReceipt, User $user, ?string $reason): InstitutionalReceiptPrintEvent
    {
        $hasPreviousPrint = $lockedReceipt->printEvents()->exists();

        if ($hasPreviousPrint) {
            $this->validateReprintReason($reason);
            $lockedReceipt->forceFill([
                'reprint_count' => $lockedReceipt->reprint_count + 1,
            ])->save();
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
        $reason = trim((string) $reason);
        $length = mb_strlen($reason);

        if ($length < 5 || $length > 500) {
            throw $this->validationException([
                'reason' => 'El motivo de reimpresion es obligatorio y debe tener entre 5 y 500 caracteres.',
            ]);
        }
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
