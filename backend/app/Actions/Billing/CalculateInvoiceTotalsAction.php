<?php

namespace App\Actions\Billing;

use App\Models\Service;
use App\Models\ServiceArea;
use App\Support\Money;
use Illuminate\Validation\ValidationException;

class CalculateInvoiceTotalsAction
{
    /**
     * Rounding strategy for fractional cents in line subtotals:
     * half-up (half-away-from-zero) is the standard expected for hospital
     * billing in Honduras. We use `intdiv(($cents * $units) + 50, 100)` to
     * round 0.5 cent up. This is NOT banker's rounding; if a future
     * requirement demands half-to-even, the divisor is unchanged but the
     * additive offset must vary based on the parity of the quotient.
     *
     * @param  list<array{service: Service, quantity: string, notes: ?string}>  $items
     * @return array{
     *     subtotal: string, subtotal_cents: int,
     *     tax_amount: string, tax_amount_cents: int,
     *     discount_amount: string, discount_amount_cents: int,
     *     total: string, total_cents: int,
     *     items: list<array<string, mixed>>
     * }
     */
    public function execute(array $items, string $taxRate, bool $patientDialysisPrescription = false): array
    {
        $taxRateBasisPoints = $this->parseRateBasisPoints($taxRate);
        $subtotal = Money::zero();
        $calculatedItems = [];
        $taxableSubtotalCents = 0;

        foreach ($items as $item) {
            $service = $item['service'];
            $quantityUnits = $this->parseDecimalUnits($item['quantity'], 'items.quantity');
            $specialRuleApplied = $this->appliesErythropoietinRule($service, $patientDialysisPrescription);
            $lineTaxable = $service->taxable && ! $this->hasErythropoietinRule($service);
            $unitPriceCents = $specialRuleApplied ? 0 : $this->parseMoneyCents((string) $service->price);
            $lineSubtotalCents = intdiv(($unitPriceCents * $quantityUnits) + 50, 100);

            $subtotal = $subtotal->plus(Money::fromCents($lineSubtotalCents));
            if ($lineTaxable) {
                $taxableSubtotalCents += $lineSubtotalCents;
            }

            $category = $service->category;
            $categoryName = $category === null ? '' : $category->name;
            $area = $service->area;
            $areaName = $area === null ? $categoryName : $area->name;

            $calculatedItems[] = [
                '_taxable' => $lineTaxable,
                '_tax_remainder' => ($lineSubtotalCents * $taxRateBasisPoints) % 10000,
                'service_id' => $service->id,
                'service_name' => $service->name,
                'category_id' => $service->category_id,
                'category_name' => $categoryName,
                'area_id' => $service->area_id,
                'area_name' => $areaName,
                'service_area_id' => $this->legacyServiceAreaId($service),
                'service_area_name' => $areaName,
                'scan_code' => null,
                'barcode' => null,
                'qr_code' => null,
                'quantity' => $this->formatDecimalUnits($quantityUnits),
                'quantity_cents' => $quantityUnits,
                'unit_price' => $this->formatMoney($unitPriceCents),
                'unit_price_cents' => $unitPriceCents,
                'tax_rate' => $lineTaxable ? $this->formatRate($taxRateBasisPoints) : '0.00',
                'line_subtotal' => $this->formatMoney($lineSubtotalCents),
                'line_subtotal_cents' => $lineSubtotalCents,
                'special_rule_code' => $service->special_rule_code,
                'special_rule_applied' => $specialRuleApplied,
                'notes' => $item['notes'],
            ];
        }

        $taxCents = intdiv(($taxableSubtotalCents * $taxRateBasisPoints) + 5000, 10000);
        $calculatedItems = $this->distributeInvoiceTax($calculatedItems, $taxCents, $taxRateBasisPoints);
        $discountCents = 0;
        $totalCents = $subtotal->toCents() + $taxCents - $discountCents;

        return [
            'subtotal' => $this->formatMoney($subtotal->toCents()),
            'subtotal_cents' => $subtotal->toCents(),
            'tax_amount' => $this->formatMoney($taxCents),
            'tax_amount_cents' => $taxCents,
            'discount_amount' => $this->formatMoney($discountCents),
            'discount_amount_cents' => $discountCents,
            'total' => $this->formatMoney($totalCents),
            'total_cents' => $totalCents,
            'items' => $calculatedItems,
        ];
    }

    /**
     * @param  list<array<string, mixed>>  $items
     * @return list<array<string, mixed>>
     */
    private function distributeInvoiceTax(array $items, int $invoiceTaxCents, int $taxRateBasisPoints): array
    {
        $baseTaxTotal = 0;
        $remainders = [];

        foreach ($items as $index => $item) {
            if (($item['_taxable'] ?? false) !== true) {
                $items[$index]['tax_amount_cents'] = 0;

                continue;
            }

            $exactNumerator = ((int) $item['line_subtotal_cents']) * $taxRateBasisPoints;
            $baseTaxCents = intdiv($exactNumerator, 10000);
            $items[$index]['tax_amount_cents'] = $baseTaxCents;
            $baseTaxTotal += $baseTaxCents;
            $remainders[] = [
                'index' => $index,
                'remainder' => $exactNumerator % 10000,
            ];
        }

        usort($remainders, fn (array $a, array $b): int => $b['remainder'] <=> $a['remainder']
            ?: $a['index'] <=> $b['index']);

        $remainingCents = $invoiceTaxCents - $baseTaxTotal;
        for ($i = 0; $i < $remainingCents && isset($remainders[$i]); $i++) {
            $items[$remainders[$i]['index']]['tax_amount_cents']++;
        }

        foreach ($items as $index => $item) {
            $lineTaxCents = (int) $item['tax_amount_cents'];
            $lineTotalCents = (int) $item['line_subtotal_cents'] + $lineTaxCents;
            $items[$index]['tax_amount'] = $this->formatMoney($lineTaxCents);
            $items[$index]['line_total'] = $this->formatMoney($lineTotalCents);
            $items[$index]['line_total_cents'] = $lineTotalCents;
            unset($items[$index]['_taxable'], $items[$index]['_tax_remainder']);
        }

        return $items;
    }

    private function appliesErythropoietinRule(Service $service, bool $patientDialysisPrescription): bool
    {
        return $patientDialysisPrescription
            && $this->hasErythropoietinRule($service);
    }

    private function hasErythropoietinRule(Service $service): bool
    {
        return $service->special_rule_code === Service::ERYTHROPOIETIN_RULE;
    }

    private function legacyServiceAreaId(Service $service): ?int
    {
        if ($service->area_id === null || $service->area === null) {
            return null;
        }

        $serviceAreaId = ServiceArea::query()
            ->where('slug', $service->area->slug)
            ->value('id');

        return $serviceAreaId === null ? null : (int) $serviceAreaId;
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
