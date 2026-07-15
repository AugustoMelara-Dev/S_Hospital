<?php

namespace App\Actions\Receipts;

use App\Actions\InstitutionalReceipts\AmountToSpanishWords;
use App\Models\Invoice;
use App\Models\Payment;
use App\Support\HospitalName;
use App\Support\ReceiptPaperSize;

class GenerateReceiptDataAction
{
    public function __construct(private readonly AmountToSpanishWords $amountToSpanishWords) {}

    public function execute(Invoice $invoice, string $width, ?string $copyLabel = null): array
    {
        $paperSize = ReceiptPaperSize::normalize($width);

        $invoice->loadMissing([
            'items',
            'payments.user:id,name,username',
            'issuer:id,name,username',
        ]);
        $postedPayments = $invoice->payments
            ->filter(fn (Payment $payment): bool => $payment->status === Payment::STATUS_POSTED)
            ->values();
        $cashierName = $postedPayments
            ->sortByDesc(fn ($payment): int => $payment->paid_at->getTimestamp())
            ->first()?->user?->name ?? $invoice->issuer?->name;
        $fiscalCai = $this->fiscalValue($invoice->fiscal_cai);
        $hasFiscalAuthorization = $fiscalCai !== null
            && $invoice->fiscal_range_from
            && $invoice->fiscal_range_to
            && $invoice->fiscal_valid_until;

        return [
            'width' => $paperSize,
            'hospital' => [
                'name' => HospitalName::display($invoice->hospital_name),
                'rtn' => $invoice->hospital_rtn,
                'address' => $invoice->hospital_address,
                'phone' => $invoice->hospital_phone,
                'slogan' => $invoice->hospital_slogan,
            ],
            'institutional' => [
                'template_mode' => $invoice->receipt_template_mode ?? 'institutional',
                'paper_size' => ReceiptPaperSize::normalize($invoice->receipt_paper_size ?? $paperSize),
                'government_line' => $invoice->receipt_government_line ?? 'Gobierno de Honduras',
                'secretariat_line' => $invoice->receipt_secretariat_line ?? 'Secretaria de Salud Publica',
                'location' => $invoice->receipt_location,
                'footer_text' => $invoice->receipt_footer_text,
                'copy_label' => $copyLabel ?? 'Original',
                'signature_label' => 'Firma y sello del receptor de fondos',
            ],
            'fiscal' => [
                'cai' => $fiscalCai,
                'authorized_range' => $hasFiscalAuthorization
                    ? $invoice->fiscal_range_from.' a '.$invoice->fiscal_range_to
                    : null,
                'valid_until' => $hasFiscalAuthorization ? $invoice->fiscal_valid_until->toDateString() : null,
            ],
            'invoice' => [
                'invoice_number' => $invoice->invoice_number,
                'issued_at' => $invoice->issued_at?->toISOString(),
                'cashier' => $cashierName,
                'cash_register_label' => $invoice->cash_session_id ? 'Caja #'.$invoice->cash_session_id : null,
                'patient_name' => $invoice->patient_name,
                'subtotal' => $this->moneyFromCents($invoice->subtotal_cents, $invoice->subtotal),
                'tax_amount' => $this->moneyFromCents($invoice->tax_amount_cents, $invoice->tax_amount),
                'discount_amount' => $this->moneyFromCents($invoice->discount_amount_cents, $invoice->discount_amount),
                'total' => $this->moneyFromCents($invoice->total_cents, $invoice->total),
                'paid_amount' => $this->moneyFromCents($invoice->paid_amount_cents, $invoice->paid_amount),
                'balance_due' => $this->moneyFromCents($invoice->balance_due_cents, $invoice->balance_due),
                'status' => $invoice->status,
                'tax_label' => $invoice->tax_label ?? 'ISV',
                'tax_rate' => $invoice->tax_rate_snapshot,
            ],
            'amount_words' => $this->amountToSpanishWords->forCents((int) $invoice->total_cents),
            'exempt_amount' => $this->moneyFromCents(
                $invoice->items
                    ->filter(fn ($item): bool => (float) $item->tax_rate === 0.0)
                    ->sum(fn ($item): int => (int) $item->line_subtotal_cents),
                null,
            ),
            'items' => $invoice->items->map(fn ($item): array => [
                'service_name' => $item->service_name,
                'category_name' => $item->category_name,
                'quantity' => $item->quantity,
                'unit_price' => $this->moneyFromCents($item->unit_price_cents, $item->unit_price),
                'tax_amount' => $this->moneyFromCents($item->tax_amount_cents, $item->tax_amount),
                'line_total' => $this->moneyFromCents($item->line_total_cents, $item->line_total),
                'special_rule_code' => $item->special_rule_code,
                'special_rule_applied' => $item->special_rule_applied,
                'notes' => $item->notes,
            ])->values(),
            'payments' => $postedPayments->map(fn ($payment): array => [
                'method' => $payment->method,
                'amount' => $this->moneyFromCents($payment->amount_cents, $payment->amount),
                'reference' => $payment->reference,
                'paid_at' => $payment->paid_at?->toISOString(),
                'cashier' => $payment->user?->name,
            ])->values(),
        ];
    }

    private function fiscalValue(?string $value): ?string
    {
        $trimmed = trim((string) $value);

        if ($trimmed === '') {
            return null;
        }

        return in_array(strtolower($trimmed), [
            'demo-cai',
            'test-cai',
            'configuracion-pendiente',
            'configuración-pendiente',
        ], true) ? null : $trimmed;
    }

    private function moneyFromCents(?int $cents, string|int|float|null $fallback): string
    {
        if ($cents !== null) {
            return number_format($cents / 100, 2, '.', '');
        }

        return number_format((float) $fallback, 2, '.', '');
    }
}
