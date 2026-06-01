<?php

namespace App\Actions\Receipts;

use App\Models\Invoice;
use App\Models\Payment;
use App\Support\HospitalName;
use App\Support\ReceiptPaperSize;

class GenerateReceiptDataAction
{
    public function execute(Invoice $invoice, string $width): array
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
            ->sortByDesc(fn ($payment): int => $payment->paid_at?->getTimestamp() ?? 0)
            ->first()?->user?->name ?? $invoice->issuer?->name;

        return [
            'width' => $paperSize,
            'hospital' => [
                'name' => HospitalName::display($invoice->hospital_name),
                'rtn' => $invoice->hospital_rtn,
                'address' => $invoice->hospital_address,
                'slogan' => $invoice->hospital_slogan,
            ],
            'institutional' => [
                'template_mode' => $invoice->receipt_template_mode ?? 'institutional',
                'paper_size' => ReceiptPaperSize::normalize($invoice->receipt_paper_size ?? $paperSize),
                'government_line' => $invoice->receipt_government_line ?? 'Gobierno de Honduras',
                'secretariat_line' => $invoice->receipt_secretariat_line ?? 'Secretaria de Salud Publica',
                'location' => $invoice->receipt_location,
                'footer_text' => $invoice->receipt_footer_text,
                'copy_label' => 'Original',
                'signature_label' => 'Firma y sello del receptor de fondos',
            ],
            'fiscal' => [
                'cai' => $invoice->fiscal_cai,
                'authorized_range' => $invoice->fiscal_range_from && $invoice->fiscal_range_to
                    ? $invoice->fiscal_range_from.' a '.$invoice->fiscal_range_to
                    : null,
                'valid_until' => $invoice->fiscal_valid_until?->toDateString(),
            ],
            'invoice' => [
                'id' => $invoice->id,
                'invoice_number' => $invoice->invoice_number,
                'issued_at' => $invoice->issued_at?->toISOString(),
                'cashier' => $cashierName,
                'patient_name' => $invoice->patient_name,
                'subtotal' => $invoice->subtotal,
                'tax_amount' => $invoice->tax_amount,
                'discount_amount' => $invoice->discount_amount,
                'total' => $invoice->total,
                'paid_amount' => $invoice->paid_amount,
                'balance_due' => $invoice->balance_due,
                'status' => $invoice->status,
                'tax_label' => $invoice->tax_label ?? 'ISV',
                'tax_rate' => $invoice->tax_rate_snapshot,
            ],
            'items' => $invoice->items->map(fn ($item): array => [
                'service_name' => $item->service_name,
                'category_name' => $item->category_name,
                'quantity' => $item->quantity,
                'unit_price' => $item->unit_price,
                'tax_amount' => $item->tax_amount,
                'line_total' => $item->line_total,
                'special_rule_code' => $item->special_rule_code,
                'special_rule_applied' => $item->special_rule_applied,
                'notes' => $item->notes,
            ])->values(),
            'payments' => $postedPayments->map(fn ($payment): array => [
                'id' => $payment->id,
                'method' => $payment->method,
                'amount' => $payment->amount,
                'reference' => $payment->reference,
                'paid_at' => $payment->paid_at?->toISOString(),
                'cashier' => $payment->user?->name,
            ])->values(),
        ];
    }
}
