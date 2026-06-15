<?php

namespace App\Actions\InstitutionalReceipts;

use App\Models\InstitutionalReceipt;
use App\Models\InstitutionalReceiptPrintEvent;
use App\Models\InstitutionalReceiptSeries;
use App\Models\ReceiptPrintProfile;
use App\Models\User;
use App\Support\PaperSize;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Support\Facades\DB;

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

    /**
     * @param  array<string, mixed>  $data
     */
    public function pdfForDraft(array $data, ReceiptPrintProfile $profile, ?InstitutionalReceiptSeries $series = null): string
    {
        return Pdf::loadHTML($this->htmlForDraft($data, $profile, $series))
            ->setPaper(PaperSize::fromProfile($profile))
            ->output();
    }

    public function recordReceiptPdfEvent(InstitutionalReceipt $receipt, User $user, ?string $reason = null): InstitutionalReceiptPrintEvent
    {
        return DB::transaction(function () use ($receipt, $user, $reason): InstitutionalReceiptPrintEvent {
            $lockedReceipt = InstitutionalReceipt::query()
                ->whereKey($receipt->id)
                ->lockForUpdate()
                ->firstOrFail();
            $hasPreviousPrint = $lockedReceipt->printEvents()->exists();

            if ($hasPreviousPrint) {
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
                'reason' => $hasPreviousPrint ? $reason : null,
                'user_id' => $user->id,
                'created_at' => now(),
            ]);
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
}
