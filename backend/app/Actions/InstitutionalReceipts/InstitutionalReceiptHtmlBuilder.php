<?php

namespace App\Actions\InstitutionalReceipts;

use App\Models\FiscalSetting;
use App\Models\InstitutionalReceipt;
use App\Models\InstitutionalReceiptSeries;
use App\Models\ReceiptPrintProfile;
use App\Support\HospitalName;
use App\Support\Money;
use Illuminate\Support\Facades\Storage;
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
        $amount = Money::formatCents(Money::parseCents($this->numericString($data['amount'] ?? null, '0.00'), 'amount'));
        $payerName = $this->stringValue($data['payer_name'] ?? null, 'Paciente de prueba');
        $concept = $this->stringValue($data['concept'] ?? null, 'Servicios hospitalarios de prueba');

        return View::make('pdf.institutional-receipts.classic', [
            'pages' => collect($this->copyLabels($profile->copies_mode))
                ->map(fn (string $copyLabel): array => [
                    'copy_label' => $copyLabel,
                    'draft' => true,
                    'watermark' => 'PRUEBA - SIN VALIDEZ',
                    'institution' => [
                        'government_line' => $settings->government_line ?: '',
                        'secretariat_line' => $settings->secretariat_line ?: '',
                        'hospital_name' => HospitalName::display($settings->hospital_name),
                        'rtn' => $settings->rtn ?: '',
                        'address' => $settings->address ?: '',
                        'phone' => $settings->phone ?: '',
                        'receipt_location' => $settings->receipt_location ?: '',
                        'receipt_footer_text' => $settings->receipt_footer_text ?: '',
                        'logo_data_uri' => $this->logoDataUriForProfile($profile),
                    ],
                    'series' => [
                        'series' => $series?->series ?: 'PRUEBA',
                        'receipt_number_full' => $series ? $this->formatDraftNumber($series) : 'PRUEBA-SIN-NUMERO',
                        'receipt_number_color' => $this->safeHexColor($series?->receipt_number_color),
                        'legal_text' => $series?->legal_text ?: '',
                    ],
                    'amount' => $amount,
                    'issued_at' => now(),
                    'payer_name' => $payerName,
                    'amount_words' => 'PRUEBA - SIN VALIDEZ',
                    'amount_statement' => $this->amountStatement($series?->legal_text, 'PRUEBA - SIN VALIDEZ'),
                    'concept' => $concept,
                    'status' => 'issued',
                    'invoice' => [
                        'invoice_number' => 'PRUEBA-SIN-FACTURA',
                        'fiscal_cai' => null,
                        'fiscal_range_from' => null,
                        'fiscal_range_to' => null,
                        'fiscal_valid_until' => null,
                        'patient_name' => $payerName,
                        'issued_at' => now()->toIso8601String(),
                        'tax_label' => 'ISV',
                        'tax_rate_snapshot' => null,
                        'subtotal' => $amount,
                        'exempt_amount' => $amount,
                        'tax_amount' => '0.00',
                        'discount_amount' => '0.00',
                        'total' => $amount,
                        'paid_amount' => $amount,
                        'balance_due' => '0.00',
                    ],
                    'payment' => [
                        'selected_payment' => null,
                        'posted_payments' => [],
                        'cash_context' => [
                            'cash_register_label' => null,
                            'cashier_name' => null,
                            'opened_at' => null,
                        ],
                        'issued_by' => [
                            'name' => null,
                        ],
                    ],
                    'items' => [[
                        'service_name' => $concept,
                        'category_name' => null,
                        'area_name' => null,
                        'quantity' => '1.00',
                        'unit_price' => $amount,
                        'tax_rate' => null,
                        'tax_amount' => '0.00',
                        'line_subtotal' => $amount,
                        'line_total' => $amount,
                        'notes' => null,
                    ]],
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
        return array_values(collect($this->copyLabels($receipt->copy_mode))
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
                'status' => $receipt->status,
                'invoice' => $this->normalizedInvoice($receipt->invoice_snapshot ?? []),
                'payment' => $this->normalizedPayment($receipt->payment_snapshot ?? []),
                'items' => $this->normalizedItems($receipt->items_snapshot ?? []),
            ])
            ->all());
    }

    /**
     * @param  array<string, mixed>  $snapshot
     * @return array<string, mixed>
     */
    private function normalizedInstitution(array $snapshot): array
    {
        return [
            'government_line' => $this->stringValue($snapshot['government_line'] ?? null),
            'secretariat_line' => $this->stringValue($snapshot['secretariat_line'] ?? null),
            'hospital_name' => $this->stringValue($snapshot['hospital_name'] ?? null, 'SIN CONFIGURAR'),
            'address' => $this->stringValue($snapshot['address'] ?? null),
            'rtn' => $this->stringValue($snapshot['rtn'] ?? null),
            'phone' => $this->stringValue($snapshot['phone'] ?? null),
            'receipt_location' => $this->stringValue($snapshot['receipt_location'] ?? null),
            'receipt_footer_text' => $this->stringValue($snapshot['receipt_footer_text'] ?? null),
            'logo_data_uri' => $this->safeImageDataUri($snapshot['logo_data_uri'] ?? null),
        ];
    }

    /**
     * @param  array<string, mixed>  $snapshot
     * @return array<string, mixed>
     */
    private function normalizedSeries(array $snapshot, string $receiptNumberFull): array
    {
        return [
            'series' => $this->stringValue($snapshot['series'] ?? null),
            'receipt_number_full' => $this->stringValue($snapshot['receipt_number_full'] ?? null, $receiptNumberFull),
            'receipt_number_color' => $this->safeHexColor($snapshot['receipt_number_color'] ?? null),
            'legal_text' => $this->stringValue($snapshot['legal_text'] ?? null),
            'range_authorization' => $this->stringValue($snapshot['range_authorization'] ?? null),
        ];
    }

    /**
     * @param  array<string, mixed>  $snapshot
     * @return array<string, mixed>
     */
    private function normalizedProfile(array $snapshot): array
    {
        return [
            'code' => $this->stringValue($snapshot['code'] ?? null),
            'font_family' => $this->safeFontFamily($snapshot['font_family'] ?? null),
            'font_scale' => $this->floatValue($snapshot['font_scale'] ?? null, 1.0),
            'margin_top_mm' => $this->floatValue($snapshot['margin_top_mm'] ?? null, 6.0),
            'margin_right_mm' => $this->floatValue($snapshot['margin_right_mm'] ?? null, 6.0),
            'margin_bottom_mm' => $this->floatValue($snapshot['margin_bottom_mm'] ?? null, 6.0),
            'margin_left_mm' => $this->floatValue($snapshot['margin_left_mm'] ?? null, 6.0),
            'show_copy_legend' => $this->boolValue($snapshot['show_copy_legend'] ?? null, true),
            'show_physical_seal_space' => $this->boolValue($snapshot['show_physical_seal_space'] ?? null, true),
            'paper_kind' => $this->stringValue($snapshot['paper_kind'] ?? null),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function profileFromModel(ReceiptPrintProfile $profile): array
    {
        return $this->normalizedProfile([
            'code' => $profile->code,
            'font_family' => $profile->font_family,
            'font_scale' => $profile->font_scale,
            'margin_top_mm' => $profile->margin_top_mm,
            'margin_right_mm' => $profile->margin_right_mm,
            'margin_bottom_mm' => $profile->margin_bottom_mm,
            'margin_left_mm' => $profile->margin_left_mm,
            'show_copy_legend' => $profile->show_copy_legend,
            'show_physical_seal_space' => $profile->show_physical_seal_space,
            'paper_kind' => $profile->paper_kind,
        ]);
    }

    /**
     * @param  array<string, mixed>  $snapshot
     * @return array<string, mixed>
     */
    private function normalizedInvoice(array $snapshot): array
    {
        return [
            'invoice_number' => $snapshot['invoice_number'] ?? '',
            'fiscal_cai' => $snapshot['fiscal_cai'] ?? null,
            'fiscal_range_from' => $snapshot['fiscal_range_from'] ?? null,
            'fiscal_range_to' => $snapshot['fiscal_range_to'] ?? null,
            'fiscal_valid_until' => $snapshot['fiscal_valid_until'] ?? null,
            'patient_name' => $snapshot['patient_name'] ?? '',
            'issued_at' => $snapshot['issued_at'] ?? null,
            'tax_label' => $snapshot['tax_label'] ?? 'ISV',
            'tax_rate_snapshot' => $snapshot['tax_rate_snapshot'] ?? null,
            'subtotal' => $this->moneyValue($snapshot['subtotal_cents'] ?? null, $snapshot['subtotal'] ?? '0.00'),
            'exempt_amount' => $this->moneyValue($snapshot['exempt_amount_cents'] ?? null, $snapshot['exempt_amount'] ?? '0.00'),
            'tax_amount' => $this->moneyValue($snapshot['tax_amount_cents'] ?? null, $snapshot['tax_amount'] ?? '0.00'),
            'discount_amount' => $this->moneyValue($snapshot['discount_amount_cents'] ?? null, $snapshot['discount_amount'] ?? '0.00'),
            'total' => $this->moneyValue($snapshot['total_cents'] ?? null, $snapshot['total'] ?? '0.00'),
            'paid_amount' => $this->moneyValue($snapshot['paid_amount_cents'] ?? null, $snapshot['paid_amount'] ?? '0.00'),
            'balance_due' => $this->moneyValue($snapshot['balance_due_cents'] ?? null, $snapshot['balance_due'] ?? '0.00'),
        ];
    }

    /**
     * @param  array<string, mixed>  $snapshot
     * @return array<string, mixed>
     */
    private function normalizedPayment(array $snapshot): array
    {
        $selectedPayment = is_array($snapshot['selected_payment'] ?? null) ? $snapshot['selected_payment'] : null;
        $postedPayments = collect(is_array($snapshot['posted_payments'] ?? null) ? $snapshot['posted_payments'] : [])
            ->filter(fn (mixed $payment): bool => is_array($payment))
            ->map(fn (array $payment): array => [
                'method' => $payment['method'] ?? '',
                'amount' => $this->moneyValue($payment['amount_cents'] ?? null, $payment['amount'] ?? '0.00'),
                'reference' => $payment['reference'] ?? null,
                'paid_at' => $payment['paid_at'] ?? null,
                'cashier_name' => $payment['cashier_name'] ?? null,
            ])
            ->values()
            ->all();

        return [
            'selected_payment' => $selectedPayment ? [
                'method' => $selectedPayment['method'] ?? '',
                'amount' => $this->moneyValue($selectedPayment['amount_cents'] ?? null, $selectedPayment['amount'] ?? '0.00'),
                'reference' => $selectedPayment['reference'] ?? null,
                'paid_at' => $selectedPayment['paid_at'] ?? null,
                'cashier_name' => $selectedPayment['cashier_name'] ?? null,
            ] : null,
            'posted_payments' => $postedPayments,
            'cash_context' => is_array($snapshot['cash_context'] ?? null) ? $snapshot['cash_context'] : [],
            'issued_by' => is_array($snapshot['issued_by'] ?? null) ? $snapshot['issued_by'] : [],
        ];
    }

    /**
     * @param  array<int, mixed>  $snapshot
     * @return list<array<string, mixed>>
     */
    private function normalizedItems(array $snapshot): array
    {
        return array_values(collect($snapshot)
            ->filter(fn (mixed $item): bool => is_array($item))
            ->map(fn (array $item): array => [
                'service_name' => $item['service_name'] ?? '',
                'category_name' => $item['category_name'] ?? null,
                'area_name' => $item['area_name'] ?? null,
                'quantity' => $item['quantity'] ?? '1.00',
                'unit_price' => $this->moneyValue($item['unit_price_cents'] ?? null, $item['unit_price'] ?? '0.00'),
                'tax_rate' => $item['tax_rate'] ?? null,
                'tax_amount' => $this->moneyValue($item['tax_amount_cents'] ?? null, $item['tax_amount'] ?? '0.00'),
                'line_subtotal' => $this->moneyValue($item['line_subtotal_cents'] ?? null, $item['line_subtotal'] ?? '0.00'),
                'line_total' => $this->moneyValue($item['line_total_cents'] ?? null, $item['line_total'] ?? '0.00'),
                'notes' => $item['notes'] ?? null,
            ])
            ->all());
    }

    private function moneyValue(mixed $cents, mixed $fallback): string
    {
        if (is_numeric($cents)) {
            return Money::formatCents((int) $cents);
        }

        return Money::formatCents(Money::parseCents($this->numericString($fallback, '0.00'), 'amount'));
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

    private function stringValue(mixed $value, string $default = ''): string
    {
        return is_string($value) ? $value : $default;
    }

    private function numericString(mixed $value, string $default): string
    {
        if (is_string($value) && is_numeric($value)) {
            return $value;
        }

        if (is_int($value) || (is_float($value) && is_finite($value))) {
            return (string) $value;
        }

        return $default;
    }

    private function floatValue(mixed $value, float $default): float
    {
        $numeric = $this->numericString($value, '');

        return $numeric === '' ? $default : (float) $numeric;
    }

    private function boolValue(mixed $value, bool $default): bool
    {
        return is_bool($value) ? $value : $default;
    }

    private function logoDataUriForProfile(ReceiptPrintProfile $profile): ?string
    {
        if (! $profile->use_logo || ! Storage::disk('public')->exists('branding/logo.png')) {
            return null;
        }

        $contents = Storage::disk('public')->get('branding/logo.png');

        if (! is_string($contents) || $contents === '') {
            return null;
        }

        $mime = Storage::disk('public')->mimeType('branding/logo.png') ?: 'image/png';

        if (! str_starts_with($mime, 'image/')) {
            $mime = 'image/png';
        }

        return $this->safeImageDataUri('data:'.$mime.';base64,'.base64_encode($contents));
    }

    private function safeImageDataUri(mixed $value): ?string
    {
        if (! is_string($value) || $value === '') {
            return null;
        }

        return preg_match('/^data:image\/(?:png|jpe?g);base64,[A-Za-z0-9+\/=]+$/', $value) === 1
            ? $value
            : null;
    }
}
