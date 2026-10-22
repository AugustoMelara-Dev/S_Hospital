<?php

namespace Tests\Unit\Reports;

use App\Actions\Reports\LineRuleProvenance;
use App\Models\Service;
use Tests\TestCase;

/**
 * C2-B8: politica de compatibilidad historica del ajuste por regla.
 *
 * El backfill de la migracion 2026_09_18_000002 dejo `rule_adjustment_cents = 0`
 * en los historicos. Ese 0 no es un ajuste medido: es un dato desconocido. La
 * procedencia se deriva de la evidencia inmutable de la propia linea, nunca del
 * catalogo vigente.
 */
class LineRuleProvenanceTest extends TestCase
{
    public function test_line_without_rule_records_an_exact_zero_adjustment(): void
    {
        // Sin regla el ajuste es 0 por definicion: si es confiable.
        $this->assertTrue(LineRuleProvenance::adjustmentRecorded(false, 10000, 10000));
        $this->assertTrue(LineRuleProvenance::adjustmentRecorded(false, null, null));
        $this->assertNull(LineRuleProvenance::cause(false));
    }

    public function test_rule_line_with_surviving_catalog_price_is_recorded(): void
    {
        // Precio registrado 25.00 > efectivo 0.00: el ajuste si se persistio.
        $this->assertTrue(LineRuleProvenance::adjustmentRecorded(true, 2500, 0));
        $this->assertSame(
            'Medicamento elegible sin cobro por receta/dialisis autorizada ('.Service::ERYTHROPOIETIN_RULE.').',
            LineRuleProvenance::cause(true),
        );
    }

    public function test_backfilled_historical_rule_line_is_unknown_not_zero(): void
    {
        // El backfill hizo registrado = efectivo = 0. El 0 almacenado NO es un
        // ajuste medido: se declara desconocido.
        $this->assertFalse(LineRuleProvenance::adjustmentRecorded(true, 0, 0));
        $this->assertFalse(LineRuleProvenance::adjustmentRecorded(true, null, 0));
        $this->assertFalse(LineRuleProvenance::adjustmentRecorded(true, 2500, 2500));
    }
}
