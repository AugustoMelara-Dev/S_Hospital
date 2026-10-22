<?php

namespace App\Actions\Billing;

use App\Models\Service;
use App\Models\User;

/**
 * Server-side financial prevalidation/preview.
 *
 * Reuses the SAME domain pieces the emission path uses
 * (PrepareInvoiceItemsAction, ResolveInvoiceDialysisPrescriptionAction,
 * ResolveInvoiceTaxRateAction and CalculateInvoiceTotalsAction) so the POS
 * never has to recompute fiscal math in the browser.
 *
 * It performs NO writes: no invoice, no fiscal number, no counter increment,
 * no payment, no receipt. The response exposes integer cents per concept plus
 * the applied rate and its origin.
 *
 * Response states (see hospital-ai/evidencia/R2-MONEY-BE/CONTRATO_PREVALIDACION.md):
 *  - ok               : totals computed, at least one cent of tax.
 *  - zero_tax         : totals computed, subtotal > 0 but tax is legitimately 0
 *                       (all lines exempt or a configured 0% rate).
 *  - zero_total       : totals computed and total is legitimately 0
 *                       (all lines free by the authorized dialysis rule, or a
 *                       configured zero price).
 *  - tax_unavailable  : the configured tax rate cannot be parsed, so tax/total
 *                       are returned as null (never as a fake 0).
 */
class PreviewInvoiceTotalsAction
{
    public const STATUS_OK = 'ok';

    public const STATUS_ZERO_TAX = 'zero_tax';

    public const STATUS_ZERO_TOTAL = 'zero_total';

    public const STATUS_TAX_UNAVAILABLE = 'tax_unavailable';

    public const ZERO_REASON_ALL_LINES_FREE_BY_RULE = 'all_lines_free_by_rule';

    public const ZERO_REASON_CONFIGURED_ZERO_PRICE = 'configured_zero_price';

    public function __construct(
        private readonly PrepareInvoiceItemsAction $prepareItems,
        private readonly ResolveInvoiceDialysisPrescriptionAction $resolveDialysisPrescription,
        private readonly ResolveInvoiceTaxRateAction $resolveTaxRate,
        private readonly CalculateInvoiceTotalsAction $calculateTotals,
    ) {}

    /**
     * @param  array{items: list<array{service_id: int, quantity: string, notes?: ?string}>, dialysis_prescription?: bool}  $payload
     * @return array<string, mixed>
     */
    public function execute(array $payload, User $issuer): array
    {
        $dialysisPrescription = $this->resolveDialysisPrescription->execute(
            (bool) ($payload['dialysis_prescription'] ?? false),
            $issuer,
        );

        $preparedItems = $this->prepareItems->execute($payload['items']);
        $tax = $this->resolveTaxRate->execute();
        $taxAvailable = $tax['available'] === true;

        // When the rate is unavailable we still compute the pre-tax base with a
        // 0.00 rate. The tax and total fields are then nulled out below so the
        // caller can never mistake an unknown tax for a legitimate zero.
        $totals = $this->calculateTotals->execute(
            $preparedItems,
            $taxAvailable ? (string) $tax['rate'] : '0.00',
            $dialysisPrescription,
        );

        $taxCents = $taxAvailable ? $totals['tax_amount_cents'] : null;
        $totalCents = $taxAvailable ? $totals['total_cents'] : null;
        $status = $this->resolveStatus(
            $totals['subtotal_cents'],
            $taxCents,
            $totalCents,
            $taxAvailable,
        );

        $items = [];
        foreach ($totals['items'] as $index => $item) {
            $items[] = $this->presentItem(
                $item,
                $preparedItems[$index]['service'],
                $taxAvailable,
            );
        }

        return [
            'status' => $status,
            'currency' => 'HNL',
            'message' => $status === self::STATUS_TAX_UNAVAILABLE
                ? 'No se pudo calcular el importe final: la tasa de impuesto configurada no es valida.'
                : null,
            'tax' => [
                'label' => 'ISV',
                'available' => $taxAvailable,
                'rate' => $tax['rate'],
                'rate_basis_points' => $tax['rate_basis_points'],
                'origin' => $tax['origin'],
            ],
            'totals' => [
                'subtotal_cents' => $totals['subtotal_cents'],
                'taxable_base_cents' => $totals['taxable_base_cents'],
                'exempt_cents' => $totals['exempt_cents'],
                'tax_cents' => $taxCents,
                'discount_cents' => $totals['discount_amount_cents'],
                'total_cents' => $totalCents,
            ],
            // H-15: same per-rate breakdown the emission path calculates. The
            // receipt renders this exact shape from the historical snapshot.
            'tax_breakdown' => $taxAvailable ? $totals['tax_breakdown'] : [],
            'zero_reason' => $this->resolveZeroReason($status, $totals['items']),
            'items' => $items,
            // Contract guarantee, also asserted by InvoicePreviewContractTest.
            'emission' => [
                'persisted' => false,
                'invoice_created' => false,
                'fiscal_number_consumed' => false,
                'payment_created' => false,
                'institutional_receipt_created' => false,
            ],
        ];
    }

    private function resolveStatus(int $subtotalCents, ?int $taxCents, ?int $totalCents, bool $taxAvailable): string
    {
        if (! $taxAvailable || $taxCents === null || $totalCents === null) {
            return self::STATUS_TAX_UNAVAILABLE;
        }

        if ($totalCents === 0) {
            return self::STATUS_ZERO_TOTAL;
        }

        if ($taxCents === 0 && $subtotalCents > 0) {
            return self::STATUS_ZERO_TAX;
        }

        return self::STATUS_OK;
    }

    /**
     * @param  list<array<string, mixed>>  $items
     */
    private function resolveZeroReason(string $status, array $items): ?string
    {
        if ($status !== self::STATUS_ZERO_TOTAL || $items === []) {
            return null;
        }

        foreach ($items as $item) {
            if (($item['special_rule_applied'] ?? false) !== true) {
                return self::ZERO_REASON_CONFIGURED_ZERO_PRICE;
            }
        }

        return self::ZERO_REASON_ALL_LINES_FREE_BY_RULE;
    }

    /**
     * @param  array<string, mixed>  $item
     * @return array<string, mixed>
     */
    private function presentItem(array $item, Service $service, bool $taxAvailable): array
    {
        return [
            'service_id' => $item['service_id'],
            'service_name' => $item['service_name'],
            'category_name' => $item['category_name'] ?? null,
            'area_name' => $item['area_name'] ?? null,
            'quantity' => $item['quantity'],
            'quantity_cents' => $item['quantity_cents'],
            // Precio registrado en catalogo, separado del importe final.
            'unit_price_registered' => $item['unit_price_registered'] ?? null,
            'unit_price_registered_cents' => $item['unit_price_registered_cents'] ?? null,
            // Precio efectivo aplicado (0 si la regla dejo la linea sin cobro).
            'unit_price_cents' => $item['unit_price_cents'],
            // Ajuste por regla: importe registrado menos importe aplicado.
            'rule_adjustment' => $item['rule_adjustment'] ?? '0.00',
            'rule_adjustment_cents' => $item['rule_adjustment_cents'] ?? 0,
            'taxable' => $service->taxable,
            'tax_rate_id' => $service->tax_rate_id,
            'tax_rate' => $item['tax_rate'],
            'line_subtotal_cents' => $item['line_subtotal_cents'],
            'tax_cents' => $taxAvailable ? $item['tax_amount_cents'] : null,
            'line_total_cents' => $taxAvailable ? $item['line_total_cents'] : null,
            'special_rule_code' => $item['special_rule_code'],
            'special_rule_applied' => (bool) $item['special_rule_applied'],
            // Causa textual por linea: por que se ajusto (o null si no aplico).
            'rule_cause' => $item['rule_cause'] ?? null,
            'notes' => $item['notes'] ?? null,
        ];
    }
}
