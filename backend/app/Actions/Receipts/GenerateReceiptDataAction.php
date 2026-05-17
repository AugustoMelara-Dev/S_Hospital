<?php

namespace App\Actions\Receipts;

use App\Models\Invoice;

class GenerateReceiptDataAction
{
    public function execute(Invoice $invoice, string $width): array
    {
        $invoice->loadMissing([
            'items',
            'payments.user:id,name,username',
            'issuer:id,name,username',
        ]);
        $cashierName = $invoice->payments
            ->sortByDesc(fn ($payment): int => $payment->paid_at?->getTimestamp() ?? 0)
            ->first()?->user?->name ?? $invoice->issuer?->name;

        return [
            'width' => $width,
            'hospital' => [
                'name' => $invoice->hospital_name ?? 'Hospital',
                'rtn' => $invoice->hospital_rtn,
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
            'payments' => $invoice->payments->map(fn ($payment): array => [
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
