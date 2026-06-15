<?php

namespace App\Actions\InstitutionalReceipts;

use App\Models\FiscalSetting;
use App\Models\InstitutionalReceipt;
use App\Models\InstitutionalReceiptSeries;
use App\Models\ReceiptPrintProfile;
use App\Support\Money;
use Illuminate\Support\Facades\View;

class InstitutionalReceiptHtmlBuilder
{
    /**
     * @return array<int, string>
     */
    public function copyLabels(string $copyMode): array
    {
        return match ($copyMode) {
            'original_first' => ['ORIGINAL', 'PRIMERA COPIA'],
            'original_first_second' => ['ORIGINAL', 'PRIMERA COPIA', 'SEGUNDA COPIA'],
            default => ['ORIGINAL'],
        };
    }

    public function forReceipt(InstitutionalReceipt $receipt, bool $draft = false): string
    {
        return View::make('pdf.institutional-receipts.classic', [
            'pages' => $this->pagesForReceipt($receipt, $draft),
            'profile' => $this->normalizedProfile($receipt->profile_snapshot),
        ])->render();
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function forDraft(array $data, ReceiptPrintProfile $profile, ?InstitutionalReceiptSeries $series = null): string
    {
        $settings = FiscalSetting::query()->firstOrNew();
        $amount = Money::formatCents(Money::parseCents((string) ($data['amount'] ?? '0.00'), 'amount'));

        return View::make('pdf.institutional-receipts.classic', [
            'pages' => collect($this->copyLabels($profile->copies_mode))
                ->map(fn (string $copyLabel): array => [
                    'copy_label' => $copyLabel,
                    'draft' => true,
                    'watermark' => 'PRUEBA - SIN VALIDEZ',
                    'institution' => [
                        'government_line' => $settings->government_line ?: '',
                        'secretariat_line' => $settings->secretariat_line ?: '',
                        'hospital_name' => $settings->hospital_name ?: 'SIN CONFIGURAR',
                        'address' => $settings->address ?: '',
                        'receipt_location' => $settings->receipt_location ?: '',
                        'receipt_footer_text' => $settings->receipt_footer_text ?: '',
                    ],
                    'series' => [
                        'series' => $series?->series ?: 'PRUEBA',
                        'receipt_number_full' => $series ? $this->formatDraftNumber($series) : 'PRUEBA-SIN-NUMERO',
                        'receipt_number_color' => $this->safeHexColor($series?->receipt_number_color),
                        'legal_text' => $series?->legal_text ?: '',
                    ],
                    'amount' => $amount,
                    'issued_at' => now(),
                    'payer_name' => (string) ($data['payer_name'] ?? 'Paciente de prueba'),
                    'amount_words' => 'PRUEBA - SIN VALIDEZ',
                    'amount_statement' => $this->amountStatement($series?->legal_text, 'PRUEBA - SIN VALIDEZ'),
                    'concept' => (string) ($data['concept'] ?? 'Servicios hospitalarios de prueba'),
                ])
                ->all(),
            'profile' => $this->profileFromModel($profile),
        ])->render();
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function pagesForReceipt(InstitutionalReceipt $receipt, bool $draft): array
    {
        return collect($this->copyLabels($receipt->copy_mode))
            ->map(fn (string $copyLabel): array => [
                'copy_label' => $copyLabel,
                'draft' => $draft,
                'watermark' => $draft ? 'PRUEBA - SIN VALIDEZ' : null,
                'institution' => $this->normalizedInstitution($receipt->institution_snapshot),
                'series' => $this->normalizedSeries($receipt->series_snapshot, $receipt->receipt_number_full),
                'amount' => Money::formatCents((int) $receipt->amount_cents),
                'issued_at' => $receipt->issued_at,
                'payer_name' => $receipt->payer_name,
                'amount_words' => $receipt->amount_words,
                'amount_statement' => $this->amountStatement($receipt->series_snapshot['legal_text'] ?? null, $receipt->amount_words),
                'concept' => $receipt->concept,
            ])
            ->all();
    }

    /**
     * @param  array<string, mixed>  $snapshot
     * @return array<string, mixed>
     */
    private function normalizedInstitution(array $snapshot): array
    {
        return [
            'government_line' => $snapshot['government_line'] ?? '',
            'secretariat_line' => $snapshot['secretariat_line'] ?? '',
            'hospital_name' => $snapshot['hospital_name'] ?? 'SIN CONFIGURAR',
            'address' => $snapshot['address'] ?? '',
            'receipt_location' => $snapshot['receipt_location'] ?? '',
            'receipt_footer_text' => $snapshot['receipt_footer_text'] ?? '',
        ];
    }

    /**
     * @param  array<string, mixed>  $snapshot
     * @return array<string, mixed>
     */
    private function normalizedSeries(array $snapshot, string $receiptNumberFull): array
    {
        return [
            'series' => $snapshot['series'] ?? '',
            'receipt_number_full' => $snapshot['receipt_number_full'] ?? $receiptNumberFull,
            'receipt_number_color' => $this->safeHexColor($snapshot['receipt_number_color'] ?? null),
            'legal_text' => $snapshot['legal_text'] ?? '',
        ];
    }

    /**
     * @param  array<string, mixed>  $snapshot
     * @return array<string, mixed>
     */
    private function normalizedProfile(array $snapshot): array
    {
        return [
            'font_family' => $this->safeFontFamily($snapshot['font_family'] ?? null),
            'font_scale' => (float) ($snapshot['font_scale'] ?? 1),
            'margin_top_mm' => (float) ($snapshot['margin_top_mm'] ?? 6),
            'margin_right_mm' => (float) ($snapshot['margin_right_mm'] ?? 6),
            'margin_bottom_mm' => (float) ($snapshot['margin_bottom_mm'] ?? 6),
            'margin_left_mm' => (float) ($snapshot['margin_left_mm'] ?? 6),
            'show_copy_legend' => (bool) ($snapshot['show_copy_legend'] ?? true),
            'show_physical_seal_space' => (bool) ($snapshot['show_physical_seal_space'] ?? true),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function profileFromModel(ReceiptPrintProfile $profile): array
    {
        return $this->normalizedProfile([
            'font_family' => $profile->font_family,
            'font_scale' => $profile->font_scale,
            'margin_top_mm' => $profile->margin_top_mm,
            'margin_right_mm' => $profile->margin_right_mm,
            'margin_bottom_mm' => $profile->margin_bottom_mm,
            'margin_left_mm' => $profile->margin_left_mm,
            'show_copy_legend' => $profile->show_copy_legend,
            'show_physical_seal_space' => $profile->show_physical_seal_space,
        ]);
    }

    private function formatDraftNumber(InstitutionalReceiptSeries $series): string
    {
        return $series->series.'-'.str_pad((string) ($series->current_number + 1), 8, '0', STR_PAD_LEFT);
    }

    private function safeHexColor(mixed $color): string
    {
        $value = is_string($color) ? $color : '';

        return preg_match('/^#[0-9A-Fa-f]{6}$/', $value) === 1 ? $value : '#b91c1c';
    }

    private function safeFontFamily(mixed $fontFamily): string
    {
        $value = is_string($fontFamily) && $fontFamily !== '' ? $fontFamily : 'Arial, sans-serif';

        return preg_match('/^[A-Za-z0-9 ,"\'-]+$/', $value) === 1 ? $value : 'Arial, sans-serif';
    }

    private function amountStatement(mixed $legalText, string $amountWords): string
    {
        $legal = trim(is_string($legalText) ? $legalText : '');

        return trim($legal.' '.$amountWords);
    }
}
