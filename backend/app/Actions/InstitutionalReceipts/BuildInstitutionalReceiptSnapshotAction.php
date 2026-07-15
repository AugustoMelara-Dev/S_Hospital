<?php

namespace App\Actions\InstitutionalReceipts;

use App\Models\CashRegisterSession;
use App\Models\FiscalSetting;
use App\Models\InstitutionalReceiptSeries;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\ReceiptPrintProfile;
use App\Models\User;
use App\Support\HospitalName;
use Illuminate\Support\Facades\Storage;

class BuildInstitutionalReceiptSnapshotAction
{
    /**
     * @return array{
     *     payer_name: string,
     *     concept: string,
     *     institution_snapshot: array<string, mixed>,
     *     series_snapshot: array<string, mixed>,
     *     profile_snapshot: array<string, mixed>,
     *     invoice_snapshot: array<string, mixed>,
     *     payment_snapshot: array<string, mixed>,
     *     items_snapshot: list<array<string, mixed>>
     * }
     */
    public function execute(
        Invoice $invoice,
        InstitutionalReceiptSeries $series,
        ReceiptPrintProfile $profile,
        User $issuer,
        CashRegisterSession $cashSession,
        ?Payment $selectedPayment,
        string $receiptNumberFull,
    ): array {
        $invoice->loadMissing('items', 'payments.user:id,name,username');
        $settings = FiscalSetting::query()->firstOrNew();
        $cashSession->loadMissing('user:id,name,username');
        $postedPayments = $invoice->payments
            ->where('status', Payment::STATUS_POSTED)
            ->values();

        $items = $invoice->items
            ->map(fn ($item): array => [
                'service_name' => $item->service_name,
                'category_name' => $item->category_name,
                'area_name' => $item->area_name,
                'quantity' => (string) $item->quantity,
                'unit_price' => $this->moneyFromCents($item->unit_price_cents, $item->unit_price),
                'unit_price_cents' => (int) $item->unit_price_cents,
                'tax_rate' => (string) $item->tax_rate,
                'tax_amount' => $this->moneyFromCents($item->tax_amount_cents, $item->tax_amount),
                'tax_amount_cents' => (int) $item->tax_amount_cents,
                'line_subtotal' => $this->moneyFromCents($item->line_subtotal_cents, $item->line_subtotal),
                'line_subtotal_cents' => (int) $item->line_subtotal_cents,
                'line_total' => $this->moneyFromCents($item->line_total_cents, $item->line_total),
                'line_total_cents' => (int) $item->line_total_cents,
                'notes' => $item->notes,
            ])
            ->values()
            ->all();

        return [
            'payer_name' => $invoice->patient_name,
            'concept' => $this->conceptFromItems($items),
            'institution_snapshot' => [
                'hospital_name' => HospitalName::display($settings->hospital_name ?: $invoice->hospital_name),
                'rtn' => $settings->rtn ?: $invoice->hospital_rtn,
                'address' => $settings->address ?: $invoice->hospital_address,
                'phone' => $settings->phone ?: $invoice->hospital_phone,
                'slogan' => $settings->slogan ?: $invoice->hospital_slogan,
                'government_line' => $settings->government_line ?: $invoice->receipt_government_line,
                'secretariat_line' => $settings->secretariat_line ?: $invoice->receipt_secretariat_line,
                'receipt_location' => $settings->receipt_location ?: $invoice->receipt_location,
                'receipt_footer_text' => $settings->receipt_footer_text ?: $invoice->receipt_footer_text,
                ...$this->logoSnapshot($profile),
            ],
            'series_snapshot' => [
                'document_type' => $series->document_type,
                'series' => $series->series,
                'prefix' => $series->prefix,
                'receipt_number_full' => $receiptNumberFull,
                'range_authorization' => $series->range_authorization,
                'legal_text' => $series->legal_text,
                'receipt_number_color' => $series->receipt_number_color,
            ],
            'profile_snapshot' => [
                'code' => $profile->code,
                'name' => $profile->name,
                'paper_kind' => $profile->paper_kind,
                'width_mm' => (string) $profile->width_mm,
                'height_mm' => (string) $profile->height_mm,
                'margin_top_mm' => (string) $profile->margin_top_mm,
                'margin_right_mm' => (string) $profile->margin_right_mm,
                'margin_bottom_mm' => (string) $profile->margin_bottom_mm,
                'margin_left_mm' => (string) $profile->margin_left_mm,
                'orientation' => $profile->orientation,
                'template_code' => $profile->template_code,
                'font_family' => $profile->font_family,
                'font_scale' => (string) $profile->font_scale,
                'copies_mode' => $profile->copies_mode,
                'show_copy_legend' => (bool) $profile->show_copy_legend,
                'show_physical_seal_space' => (bool) $profile->show_physical_seal_space,
                'use_logo' => (bool) $profile->use_logo,
            ],
            'invoice_snapshot' => [
                'invoice_number' => $invoice->invoice_number,
                'fiscal_cai' => $invoice->fiscal_cai,
                'fiscal_range_from' => $invoice->fiscal_range_from,
                'fiscal_range_to' => $invoice->fiscal_range_to,
                'patient_name' => $invoice->patient_name,
                'issued_at' => $invoice->issued_at?->toIso8601String(),
                'tax_label' => $invoice->tax_label,
                'tax_rate_snapshot' => (string) $invoice->tax_rate_snapshot,
                'subtotal' => $this->moneyFromCents($invoice->subtotal_cents, $invoice->subtotal),
                'subtotal_cents' => (int) $invoice->subtotal_cents,
                'exempt_amount' => $this->moneyFromCents($this->exemptAmountCents($items), null),
                'exempt_amount_cents' => $this->exemptAmountCents($items),
                'tax_amount' => $this->moneyFromCents($invoice->tax_amount_cents, $invoice->tax_amount),
                'tax_amount_cents' => (int) $invoice->tax_amount_cents,
                'discount_amount' => $this->moneyFromCents($invoice->discount_amount_cents, $invoice->discount_amount),
                'discount_amount_cents' => (int) $invoice->discount_amount_cents,
                'total' => $this->moneyFromCents($invoice->total_cents, $invoice->total),
                'total_cents' => (int) $invoice->total_cents,
                'paid_amount' => $this->moneyFromCents($invoice->paid_amount_cents, $invoice->paid_amount),
                'paid_amount_cents' => (int) $invoice->paid_amount_cents,
                'balance_due' => $this->moneyFromCents($invoice->balance_due_cents, $invoice->balance_due),
                'balance_due_cents' => (int) $invoice->balance_due_cents,
            ],
            'payment_snapshot' => [
                'selected_payment' => $selectedPayment ? $this->paymentSnapshot($selectedPayment) : null,
                'posted_payments' => $postedPayments
                    ->map(fn (Payment $payment): array => $this->paymentSnapshot($payment))
                    ->all(),
                'cash_context' => [
                    'cash_register_label' => 'Caja #'.$cashSession->id,
                    'cashier_name' => $cashSession->user->name,
                    'opened_at' => $cashSession->opened_at?->toIso8601String(),
                ],
                'issued_by' => [
                    'name' => $issuer->name,
                ],
            ],
            'items_snapshot' => $items,
        ];
    }

    /**
     * @param  list<array<string, mixed>>  $items
     */
    private function conceptFromItems(array $items): string
    {
        $names = collect($items)
            ->pluck('service_name')
            ->filter()
            ->unique()
            ->values();

        if ($names->isEmpty()) {
            return 'Servicios hospitalarios';
        }

        return $names->take(5)->implode(', ');
    }

    /**
     * @return array{logo_data_uri: string|null, logo_sha256: string|null}
     */
    private function logoSnapshot(ReceiptPrintProfile $profile): array
    {
        if (! $profile->use_logo || ! Storage::disk('public')->exists('branding/logo.png')) {
            return [
                'logo_data_uri' => null,
                'logo_sha256' => null,
            ];
        }

        $contents = Storage::disk('public')->get('branding/logo.png');
        $mime = Storage::disk('public')->mimeType('branding/logo.png') ?: 'image/png';

        if (! str_starts_with($mime, 'image/')) {
            $mime = 'image/png';
        }

        return [
            'logo_data_uri' => 'data:'.$mime.';base64,'.base64_encode($contents),
            'logo_sha256' => hash('sha256', $contents),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function paymentSnapshot(Payment $payment): array
    {
        return [
            'method' => $payment->method,
            'amount' => $this->moneyFromCents($payment->amount_cents, $payment->amount),
            'amount_cents' => (int) $payment->amount_cents,
            'reference' => $payment->reference,
            'paid_at' => $payment->paid_at?->toIso8601String(),
            'cashier_name' => $payment->user?->name,
        ];
    }

    private function moneyFromCents(?int $cents, string|int|float|null $fallback): string
    {
        if ($cents !== null) {
            return number_format($cents / 100, 2, '.', '');
        }

        return number_format((float) $fallback, 2, '.', '');
    }

    /**
     * @param  list<array<string, mixed>>  $items
     */
    private function exemptAmountCents(array $items): int
    {
        return collect($items)
            ->filter(fn (array $item): bool => (float) ($item['tax_rate'] ?? 0) === 0.0)
            ->sum(fn (array $item): int => (int) ($item['line_subtotal_cents'] ?? 0));
    }
}
