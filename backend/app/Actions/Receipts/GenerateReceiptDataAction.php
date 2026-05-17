<?php

namespace App\Actions\Receipts;

use App\Models\FiscalSetting;
use App\Models\Invoice;

class GenerateReceiptDataAction
{
    public function execute(Invoice $invoice, string $width): array
    {
        $invoice->loadMissing([
            'items',
            'payments.user:id,name,username',
            'issuer:id,name,username',
            'fiscalSequence',
        ]);

        $settings = FiscalSetting::query()->first();
        $sequence = $invoice->fiscalSequence;

        return [
            'width' => $width,
            'hospital' => [
                'name' => $settings?->hospital_name ?? 'Hospital',
                'rtn' => $settings?->rtn,
            ],
            'fiscal' => [
                'cai' => $sequence?->cai,
                'authorized_range' => $sequence
                    ? $sequence->prefix.'-'.str_pad((string) $sequence->min_number, 8, '0', STR_PAD_LEFT)
                        .' a '.$sequence->prefix.'-'.str_pad((string) $sequence->max_number, 8, '0', STR_PAD_LEFT)
                    : null,
                'valid_until' => $sequence?->valid_until?->toDateString(),
            ],
            'invoice' => [
                'id' => $invoice->id,
                'invoice_number' => $invoice->invoice_number,
                'issued_at' => $invoice->issued_at?->toISOString(),
                'cashier' => $invoice->issuer?->name,
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
