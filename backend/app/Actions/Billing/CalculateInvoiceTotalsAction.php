<?php

namespace App\Actions\Billing;

use App\Models\Service;
use App\Models\ServiceArea;
use App\Support\Money;
use Illuminate\Validation\ValidationException;
use LogicException;

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
     * H-15: the rate is resolved per line. A service with `tax_rate_id` uses
     * that rate; a line without a rate is exempt. For legacy rows that still
     * carry only `taxable`, the configured default rate is used, so existing
     * single-rate invoices keep the exact same totals.
     *
     * @param  list<array{service: Service, quantity: string, notes: ?string}>  $items
     * @return array{
     *     subtotal: string, subtotal_cents: int,
     *     taxable_base: string, taxable_base_cents: int,
     *     exempt: string, exempt_cents: int,
     *     tax_amount: string, tax_amount_cents: int,
     *     discount_amount: string, discount_amount_cents: int,
     *     total: string, total_cents: int,
     *     items: list<array<string, mixed>>,
     *     tax_breakdown: list<array{rate: string, base_cents: int, tax_cents: int, base_label: string, tax_label: string}>
     * }
     */
    public function execute(array $items, string $legacyDefaultTaxRate, bool $patientDialysisPrescription = false): array
    {
        // `$legacyDefaultTaxRate` is kept only for call-site compatibility. The
        // effective rate is resolved per line from `services.tax_rate_id` (A-03).
        $subtotal = Money::zero();
        $calculatedItems = [];

        foreach ($items as $item) {
            $service = $item['service'];
            $quantityUnits = $this->parseDecimalUnits($item['quantity'], 'items.quantity');
            $specialRuleApplied = $this->appliesErythropoietinRule($service, $patientDialysisPrescription);
            // La regla de gratuidad solo cambia el importe efectivo de la línea.
            // El tratamiento fiscal siempre proviene del catálogo autorizado.
            $lineBasisPoints = $this->lineRateBasisPoints($service);
            $lineTaxable = $lineBasisPoints > 0;
            $registeredUnitPriceCents = $this->parseMoneyCents((string) $service->price);
            $unitPriceCents = $specialRuleApplied ? 0 : $registeredUnitPriceCents;
            $lineSubtotalCents = intdiv(($unitPriceCents * $quantityUnits) + 50, 100);
            $registeredLineSubtotalCents = intdiv(($registeredUnitPriceCents * $quantityUnits) + 50, 100);
            $ruleAdjustmentCents = $registeredLineSubtotalCents - $lineSubtotalCents;

            $subtotal = $subtotal->plus(Money::fromCents($lineSubtotalCents));

            $category = $service->category;
            $categoryName = $category === null ? '' : $category->name;
            $area = $service->area;
            $areaName = $area === null ? $categoryName : $area->name;

            $calculatedItems[] = [
                '_taxable' => $lineTaxable,
                '_rate_bp' => $lineBasisPoints,
                '_tax_remainder' => ($lineSubtotalCents * $lineBasisPoints) % 10000,
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
                'unit_price_registered' => $this->formatMoney($registeredUnitPriceCents),
                'unit_price_registered_cents' => $registeredUnitPriceCents,
                'rule_adjustment' => $this->formatMoney($ruleAdjustmentCents),
                'rule_adjustment_cents' => $ruleAdjustmentCents,
                'rule_cause' => $this->ruleCause($specialRuleApplied),
                'tax_rate' => $this->formatRate($lineBasisPoints),
                'line_subtotal' => $this->formatMoney($lineSubtotalCents),
                'line_subtotal_cents' => $lineSubtotalCents,
                'special_rule_code' => $service->special_rule_code,
                'special_rule_applied' => $specialRuleApplied,
                'notes' => $item['notes'],
            ];
        }

        $distribution = $this->distributeInvoiceTaxByRate($calculatedItems);
        $calculatedItems = $distribution['items'];
        $subtotalCents = $subtotal->toCents();
        $taxableSubtotalCents = $distribution['taxable_base_cents'];
        $taxCents = $distribution['tax_amount_cents'];
        $discountCents = 0;
        $exemptCents = $subtotalCents - $taxableSubtotalCents;
        $totalCents = $subtotalCents + $taxCents - $discountCents;

        return [
            'subtotal' => $this->formatMoney($subtotalCents),
            'subtotal_cents' => $subtotalCents,
            'taxable_base' => $this->formatMoney($taxableSubtotalCents),
            'taxable_base_cents' => $taxableSubtotalCents,
            'exempt' => $this->formatMoney($exemptCents),
            'exempt_cents' => $exemptCents,
            'tax_amount' => $this->formatMoney($taxCents),
            'tax_amount_cents' => $taxCents,
            'discount_amount' => $this->formatMoney($discountCents),
            'discount_amount_cents' => $discountCents,
            'total' => $this->formatMoney($totalCents),
            'total_cents' => $totalCents,
            'items' => $calculatedItems,
            'tax_breakdown' => $distribution['tax_breakdown'],
        ];
    }

    /**
     * Distribuye el impuesto por grupo de tasa aplicando resto mayor dentro de
     * cada grupo. Con una sola tasa el resultado es idéntico al algoritmo
     * anterior (misma base, mismo redondeo, mismo reparto).
     *
     * @param  list<array<string, mixed>>  $items
     * @return array{
     *     items: list<array<string, mixed>>,
     *     taxable_base_cents: int,
     *     tax_amount_cents: int,
     *     tax_breakdown: list<array{rate: string, base_cents: int, tax_cents: int, base_label: string, tax_label: string}>
     * }
     */
    private function distributeInvoiceTaxByRate(array $items): array
    {
        $lineTaxCents = [];
        $groups = [];
        $taxableBaseCents = 0;

        foreach ($items as $index => $item) {
            $basisPoints = $this->intValue($item['_rate_bp'] ?? null);
            $baseCents = $this->intValue($item['line_subtotal_cents'] ?? null);

            if ($basisPoints <= 0 || ($item['_taxable'] ?? false) !== true) {
                $lineTaxCents[$index] = 0;

                continue;
            }

            $exactNumerator = $baseCents * $basisPoints;
            $lineTaxCents[$index] = intdiv($exactNumerator, 10000);
            $taxableBaseCents += $baseCents;

            if (! isset($groups[$basisPoints])) {
                $groups[$basisPoints] = ['base' => 0, 'base_tax' => 0, 'refs' => []];
            }

            $groups[$basisPoints]['base'] += $baseCents;
            $groups[$basisPoints]['base_tax'] += $lineTaxCents[$index];
            $groups[$basisPoints]['refs'][] = ['index' => $index, 'remainder' => $exactNumerator % 10000];
        }

        $breakdown = [];
        $taxAmountCents = 0;
        krsort($groups);

        foreach ($groups as $basisPoints => $group) {
            $groupTaxCents = intdiv(($group['base'] * $basisPoints) + 5000, 10000);
            $remainingCents = $groupTaxCents - $group['base_tax'];
            $refs = $group['refs'];

            usort($refs, fn (array $a, array $b): int => $b['remainder'] <=> $a['remainder']
                ?: $a['index'] <=> $b['index']);

            for ($i = 0; $i < $remainingCents && isset($refs[$i]); $i++) {
                $lineTaxCents[$refs[$i]['index']]++;
            }

            $taxAmountCents += $groupTaxCents;
            $compactRate = $this->formatCompactRate($basisPoints);
            $breakdown[] = [
                'rate' => $this->formatRate($basisPoints),
                'base_cents' => $group['base'],
                'tax_cents' => $groupTaxCents,
                'base_label' => 'Gravado '.$compactRate.' %',
                'tax_label' => 'ISV '.$compactRate.' %',
            ];
        }

        $exemptBaseCents = 0;

        foreach ($items as $index => $item) {
            $lineTax = $lineTaxCents[$index] ?? 0;
            $lineTotalCents = $this->intValue($item['line_subtotal_cents'] ?? null) + $lineTax;
            $items[$index]['tax_amount_cents'] = $lineTax;
            $items[$index]['tax_amount'] = $this->formatMoney($lineTax);
            $items[$index]['line_total'] = $this->formatMoney($lineTotalCents);
            $items[$index]['line_total_cents'] = $lineTotalCents;

            if ($this->intValue($item['_rate_bp'] ?? null) <= 0) {
                $exemptBaseCents += $this->intValue($item['line_subtotal_cents'] ?? null);
            }

            unset($items[$index]['_taxable'], $items[$index]['_rate_bp'], $items[$index]['_tax_remainder']);
        }

        if ($exemptBaseCents > 0) {
            $breakdown[] = [
                'rate' => '0.00',
                'base_cents' => $exemptBaseCents,
                'tax_cents' => 0,
                'base_label' => 'Exento',
                'tax_label' => 'Exento',
            ];
        }

        return [
            'items' => $items,
            'taxable_base_cents' => $taxableBaseCents,
            'tax_amount_cents' => $taxAmountCents,
            'tax_breakdown' => $breakdown,
        ];
    }

    /**
     * The single source of truth (A-03): a service is charged exactly according
     * to its `tax_rate_id`. `NULL` always means exempt; there is no implicit
     * fallback to a global default. Existing installations are backfilled on
     * upgrade, so the UI and the backend can never disagree.
     */
    private function lineRateBasisPoints(Service $service): int
    {
        if ($service->tax_rate_id === null) {
            return 0;
        }

        $service->loadMissing('taxRate');
        $percentage = $service->taxRate?->percentage;

        return $percentage === null ? 0 : $this->parseRateBasisPoints((string) $percentage);
    }

    private function appliesErythropoietinRule(Service $service, bool $patientDialysisPrescription): bool
    {
        return $patientDialysisPrescription
            && $this->hasErythropoietinRule($service);
    }

    private function ruleCause(bool $specialRuleApplied): ?string
    {
        if (! $specialRuleApplied) {
            return null;
        }

        return 'Medicamento elegible sin cobro por receta/dialisis autorizada ('.Service::ERYTHROPOIETIN_RULE.').';
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

        if ($serviceAreaId === null) {
            return null;
        }

        if (! is_int($serviceAreaId) && ! is_string($serviceAreaId)) {
            throw new LogicException('El area de servicio legada no tiene un identificador escalar valido.');
        }

        $normalizedId = filter_var($serviceAreaId, FILTER_VALIDATE_INT, [
            'options' => ['min_range' => 1],
        ]);

        if (! is_int($normalizedId)) {
            throw new LogicException('El area de servicio legada no tiene un identificador entero valido.');
        }

        return $normalizedId;
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

    private function formatCompactRate(int $basisPoints): string
    {
        return rtrim(rtrim($this->formatRate($basisPoints), '0'), '.');
    }

    private function intValue(mixed $value): int
    {
        if (is_int($value)) {
            return $value;
        }

        if (is_float($value)) {
            return (int) $value;
        }

        return is_string($value) && is_numeric($value) ? (int) $value : 0;
    }
}
