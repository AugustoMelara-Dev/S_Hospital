<?php

namespace App\Actions\Billing;

use App\Models\Service;
use Illuminate\Validation\ValidationException;

class CalculateInvoiceTotalsAction
{
    /**
     * @param  list<array{service: Service, quantity: string, dialysis_prescription: bool, notes: ?string}>  $items
     * @return array{
     *     subtotal: string, subtotal_cents: int,
     *     tax_amount: string, tax_amount_cents: int,
     *     discount_amount: string, discount_amount_cents: int,
     *     total: string, total_cents: int,
     *     items: list<array<string, mixed>>
     * }
     */
    public function execute(array $items, string $taxRate): array
    {
        $taxRateBasisPoints = $this->parseRateBasisPoints($taxRate);
        $subtotalCents = 0;
        $taxCents = 0;
        $calculatedItems = [];

        foreach ($items as $item) {
            $service = $item['service'];
            $quantityUnits = $this->parseDecimalUnits($item['quantity'], 'items.quantity');
            $specialRuleApplied = $this->appliesErythropoietinRule($service, $item['dialysis_prescription']);
            $unitPriceCents = $specialRuleApplied ? 0 : $this->parseMoneyCents((string) $service->price);
            $lineSubtotalCents = intdiv(($unitPriceCents * $quantityUnits) + 50, 100);
            $lineTaxCents = $service->taxable
                ? intdiv(($lineSubtotalCents * $taxRateBasisPoints) + 5000, 10000)
                : 0;
            $lineTotalCents = $lineSubtotalCents + $lineTaxCents;

            $subtotalCents += $lineSubtotalCents;
            $taxCents += $lineTaxCents;

            $calculatedItems[] = [
                'service_id' => $service->id,
                'service_name' => $service->name,
                'category_id' => $service->category_id,
                'category_name' => $service->category->name,
                'area_id' => $service->area_id,
                'area_name' => $service->area?->name ?: $service->category->name,
                'scan_code' => $service->scan_code,
                'barcode' => $service->barcode,
                'qr_code' => $service->qr_code,
                'quantity' => $this->formatDecimalUnits($quantityUnits),
                'quantity_cents' => $quantityUnits,
                'unit_price' => $this->formatMoney($unitPriceCents),
                'unit_price_cents' => $unitPriceCents,
                'tax_rate' => $service->taxable ? $this->formatRate($taxRateBasisPoints) : '0.00',
                'tax_amount' => $this->formatMoney($lineTaxCents),
                'tax_amount_cents' => $lineTaxCents,
                'line_subtotal' => $this->formatMoney($lineSubtotalCents),
                'line_subtotal_cents' => $lineSubtotalCents,
                'line_total' => $this->formatMoney($lineTotalCents),
                'line_total_cents' => $lineTotalCents,
                'special_rule_code' => $service->special_rule_code,
                'special_rule_applied' => $specialRuleApplied,
                'notes' => $item['notes'],
            ];
        }

        $discountCents = 0;
        $totalCents = $subtotalCents + $taxCents - $discountCents;

        return [
            'subtotal' => $this->formatMoney($subtotalCents),
            'subtotal_cents' => $subtotalCents,
            'tax_amount' => $this->formatMoney($taxCents),
            'tax_amount_cents' => $taxCents,
            'discount_amount' => $this->formatMoney($discountCents),
            'discount_amount_cents' => $discountCents,
            'total' => $this->formatMoney($totalCents),
            'total_cents' => $totalCents,
            'items' => $calculatedItems,
        ];
    }

    private function appliesErythropoietinRule(Service $service, bool $dialysisPrescription): bool
    {
        return $dialysisPrescription
            && $service->special_rule_code === Service::ERYTHROPOIETIN_RULE;
    }

    private function parseMoneyCents(string $value): int
    {
        if (! preg_match('/^\d+(\.\d{1,2})?$/', $value)) {
            throw ValidationException::withMessages([
                'items' => 'El precio del servicio no tiene un formato valido.',
            ]);
        }

        [$integer, $decimal] = array_pad(explode('.', $value, 2), 2, '00');

        return ((int) $integer * 100) + (int) str_pad(substr($decimal, 0, 2), 2, '0');
    }

    private function parseDecimalUnits(string $value, string $field): int
    {
        if (! preg_match('/^\d+(\.\d{1,2})?$/', $value)) {
            throw ValidationException::withMessages([
                $field => 'La cantidad debe tener maximo dos decimales.',
            ]);
        }

        [$integer, $decimal] = array_pad(explode('.', $value, 2), 2, '00');
        $units = ((int) $integer * 100) + (int) str_pad(substr($decimal, 0, 2), 2, '0');

        if ($units <= 0) {
            throw ValidationException::withMessages([
                $field => 'La cantidad debe ser mayor que cero.',
            ]);
        }

        return $units;
    }

    private function parseRateBasisPoints(string $value): int
    {
        if (! preg_match('/^\d+(\.\d{1,2})?$/', $value)) {
            throw ValidationException::withMessages([
                'tax_rate' => 'La tasa de impuesto no tiene un formato valido.',
            ]);
        }

        [$integer, $decimal] = array_pad(explode('.', $value, 2), 2, '00');

        return ((int) $integer * 100) + (int) str_pad(substr($decimal, 0, 2), 2, '0');
    }

    private function formatMoney(int $cents): string
    {
        return intdiv($cents, 100).'.'.str_pad((string) ($cents % 100), 2, '0', STR_PAD_LEFT);
    }

    private function formatDecimalUnits(int $units): string
    {
        return intdiv($units, 100).'.'.str_pad((string) ($units % 100), 2, '0', STR_PAD_LEFT);
    }

    private function formatRate(int $basisPoints): string
    {
        return intdiv($basisPoints, 100).'.'.str_pad((string) ($basisPoints % 100), 2, '0', STR_PAD_LEFT);
    }
}
