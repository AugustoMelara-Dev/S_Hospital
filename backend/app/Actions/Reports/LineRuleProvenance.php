<?php

namespace App\Actions\Reports;

use App\Models\Service;

/**
 * Fuente unica de la procedencia (provenance) del ajuste por regla de una
 * linea de factura, usada por el detalle del API y por el reporte ejecutivo.
 *
 * CONTEXTO HISTORICO (T-BE-02, migracion 2026_09_18_000002):
 *  - El backfill dejo `invoice_items.unit_price_registered_cents = unit_price_cents`
 *    y `rule_adjustment_cents = 0` en las lineas emitidas antes de que existiera
 *    la persistencia por linea.
 *  - En una linea historica con regla EPO, `unit_price_cents` ya era 0 y el
 *    precio de catalogo nunca se guardo: por eso `unit_price_registered_cents`
 *    quedo 0 y `rule_adjustment_cents` quedo 0.
 *  - Ese 0 NO significa "el ajuste medido fue 0": significa "el ajuste es
 *    desconocido". Mostrarlo como 0 inventaria un dato que el hospital nunca
 *    registro (regla no negociable: historico sin ajuste != ajuste 0).
 *
 * MECANISMO DE DISTINCION (evidencia inmutable de la propia linea; NUNCA el
 * catalogo actual, que ya no refleja el precio de aquel dia):
 *  - Sin regla (`special_rule_applied = false`): el ajuste 0 es exacto; no habia
 *    nada que ajustar.
 *  - Con regla y `unit_price_registered_cents > unit_price_cents`: la linea
 *    conserva el precio de catalogo anterior al ajuste, luego
 *    `CalculateInvoiceTotalsAction` si escribio el ajuste al emitir. Es confiable.
 *  - Con regla y `unit_price_registered_cents <= unit_price_cents`: no hay
 *    evidencia de que el ajuste se haya persistido (caso backfilleado). Se
 *    reporta como NO confiable, aunque el entero almacenado siga siendo 0.
 *
 * Limitacion declarada: un servicio elegible con precio de catalogo 0 cae en el
 * tercer caso y se marca "no registrado". Es preferible la duda explicita a
 * inventar un 0.
 */
final class LineRuleProvenance
{
    public static function adjustmentRecorded(
        bool $specialRuleApplied,
        ?int $registeredUnitPriceCents,
        ?int $effectiveUnitPriceCents,
    ): bool {
        if (! $specialRuleApplied) {
            return true;
        }

        if ($registeredUnitPriceCents === null || $effectiveUnitPriceCents === null) {
            return false;
        }

        return $registeredUnitPriceCents > $effectiveUnitPriceCents;
    }

    /**
     * Causa textual por linea. Replica exactamente el texto que emite
     * `CalculateInvoiceTotalsAction::ruleCause()` para que el detalle persistido
     * y la valoracion (preview) compartan el mismo contrato.
     */
    public static function cause(bool $specialRuleApplied): ?string
    {
        if (! $specialRuleApplied) {
            return null;
        }

        return 'Medicamento elegible sin cobro por receta/dialisis autorizada ('.Service::ERYTHROPOIETIN_RULE.').';
    }
}
