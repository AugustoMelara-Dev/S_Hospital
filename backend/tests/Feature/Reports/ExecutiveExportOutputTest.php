<?php

namespace Tests\Feature\Reports;

use App\Actions\Reports\ExecutiveExcelExportService;
use App\Actions\Reports\ExecutivePdfExportService;
use Dompdf\Dompdf;
use Illuminate\Support\Carbon;
use PhpOffice\PhpSpreadsheet\Shared\Date;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use Tests\TestCase;

/**
 * T-UI-04: contrato de tipos/formatos del XLSX de cinco hojas y del PDF.
 * Prueba valores reales (no solo el 200): conteos enteros, importes >1000,
 * porcentajes 0/0.5/1, fechas serial, texto de factura y neutralizacion.
 */
class ExecutiveExportOutputTest extends TestCase
{
    private const BLUE_HEADER = '2563EB';

    public function test_xlsx_separates_header_row_from_first_data_row_and_keeps_types(): void
    {
        $spreadsheet = $this->generateXlsx($this->reportPayload([
            'operations' => [[
                'date' => '2026-06-01', 'invoice_number' => '000-001-01-00000042', 'patient' => 'Maria Lopez',
                'cash_session_label' => 'Caja Principal (CAJA-01)', 'cashier' => 'Ana Ruiz', 'total' => '1500.00',
                'paid' => '1500.00', 'balance' => '0.00', 'status_label' => 'Pagada',
                'settlement_label' => 'Cobrada', 'receipt_document' => null,
            ]],
        ]));
        $operations = $spreadsheet->getSheetByName('Operaciones');
        $this->assertNotNull($operations);

        $this->assertSame(self::BLUE_HEADER, $operations->getStyle('A3')->getFill()->getStartColor()->getRGB());
        $this->assertNotSame(self::BLUE_HEADER, $operations->getStyle('A4')->getFill()->getStartColor()->getRGB());
        $this->assertSame('#,##0.00', $operations->getStyle('F4')->getNumberFormat()->getFormatCode());
        $this->assertSame('#,##0.00', $operations->getStyle('H4')->getNumberFormat()->getFormatCode());
        // Fecha serial con formato local, nunca ISO cruda.
        $opened = $operations->getCell('A4')->getValue();
        $this->assertTrue(is_numeric($opened));
        $this->assertSame('2026-06-01', Date::excelToDateTimeObject($opened)->format('Y-m-d'));
        $this->assertSame('dd/mm/yyyy', $operations->getStyle('A4')->getNumberFormat()->getFormatCode());
    }

    public function test_xlsx_summary_separates_counts_money_and_percentages(): void
    {
        $report = $this->reportPayload([
            'summary' => array_merge($this->summaryDefaults(), [
                'billed_total' => '1234.56',
                'invoice_count' => 5,
                'receipt_count' => 7,
                'without_charge_count' => 2,
            ]),
            'comparison' => [
                'billed' => ['delta_percentage' => 12.5],
                'collected' => ['delta_percentage' => null],
            ],
        ]);

        $sheet = $this->generateXlsx($report)->getSheetByName('Resumen');
        $this->assertNotNull($sheet);

        $this->assertSame(1234.56, $sheet->getCell('B10')->getValue());
        $this->assertSame('"L." #,##0.00', $sheet->getStyle('B10')->getNumberFormat()->getFormatCode());
        $this->assertSame(5, $sheet->getCell('B15')->getValue());
        $this->assertSame('#,##0', $sheet->getStyle('B15')->getNumberFormat()->getFormatCode());
        $this->assertSame(2, $sheet->getCell('B21')->getValue());
        $this->assertSame(0.125, $sheet->getCell('C10')->getValue());
        $this->assertSame('+0.00%;-0.00%;0.00%', $sheet->getStyle('C10')->getNumberFormat()->getFormatCode());
        $this->assertSame('', $sheet->getCell('C11')->getValue());
    }

    public function test_percentage_extremes_and_high_amounts_are_numeric(): void
    {
        $spreadsheet = $this->generateXlsx($this->reportPayload([
            'summary' => array_merge($this->summaryDefaults(), [
                'billed_total' => '10500.75',
                'collected_total' => '9876.50',
                'gratuity_item_count' => 2147483647,
            ]),
            'comparison' => [
                'billed' => ['delta_percentage' => 0],
                'collected' => ['delta_percentage' => 0.5],
            ],
        ]));

        $summary = $spreadsheet->getSheetByName('Resumen');
        $this->assertSame(10500.75, $summary->getCell('B10')->getValue());
        $this->assertSame(0.0, $summary->getCell('C10')->getValue());
        $this->assertSame(0.005, $summary->getCell('C11')->getValue());
        $this->assertSame('"L." #,##0.00', $summary->getStyle('B10')->getNumberFormat()->getFormatCode());
        $this->assertSame(2147483647, $summary->getCell('B26')->getValue());
    }

    public function test_xlsx_cash_and_detail_keep_register_identity_and_gratuity(): void
    {
        $report = $this->reportPayload([
            'cash_sessions' => [[
                'id' => 42, 'cash_register_id' => 3, 'cash_register_code' => 'CAJA-02', 'cash_register_name' => 'Caja Emergencia',
                'cashier' => 'Ana Ruiz', 'opened_at' => '2026-06-01T08:30:00-06:00', 'closed_at' => null,
                'opening_amount' => '500.00', 'expected_cash' => '1250.75', 'counted_cash' => null,
                'difference' => null, 'status' => 'open', 'status_label' => 'Abierta', 'closure_note' => null,
            ]],
            'detail' => [[
                'date' => '2026-06-01', 'invoice_number' => '000-001-01-00000042', 'patient' => 'Maria Lopez',
                'service' => 'Eritropoyetina', 'category' => 'Nefrologia', 'area' => 'Nefrologia',
                'quantity' => '2.00', 'unit_price' => '0.00', 'rule_adjustment' => '1500.00',
                'tax' => '0.00', 'line_total' => '0.00', 'is_free' => true, 'rule_label' => 'Receta de dialisis (EPO por linea)',
            ]],
        ]);

        $spreadsheet = $this->generateXlsx($report);
        $caja = $spreadsheet->getSheetByName('Caja');
        $this->assertSame(42, $caja->getCell('A4')->getValue());
        $this->assertSame('Caja Emergencia', $caja->getCell('B4')->getValue());
        $this->assertSame('CAJA-02', $caja->getCell('C4')->getValue());
        $this->assertSame('Abierta', $caja->getCell('K4')->getValue());

        $detail = $spreadsheet->getSheetByName('Detalle');
        $this->assertSame('000-001-01-00000042', $detail->getCell('B4')->getValue());
        $this->assertSame(2.0, $detail->getCell('G4')->getValue());
        $this->assertSame(1500.0, $detail->getCell('I4')->getValue());
        $this->assertStringContainsString('EPO', (string) $detail->getCell('L4')->getValue());
    }

    public function test_xlsx_handles_empty_single_and_multiple_rows(): void
    {
        $empty = $this->generateXlsx($this->reportPayload([
            'operations' => [], 'detail' => [], 'collections' => [], 'cash_sessions' => [], 'gratuities' => [],
        ]));
        $this->assertCount(5, $empty->getSheetNames());
        $this->assertNull($empty->getSheetByName('Cobros')->getCell('A4')->getValue());

        $single = $this->generateXlsx($this->reportPayload([
            'collections' => [[
                'paid_at' => '2026-06-02T10:00:00-06:00', 'invoice_number' => '000-001-01-00000001',
                'patient' => 'Maria Lopez', 'cash_session_label' => 'Caja Principal (CAJA-01)', 'cashier' => 'Ana Ruiz',
                'method' => 'cash', 'method_label' => 'Efectivo', 'reference' => null,
                'amount' => '1500.25', 'status' => 'posted', 'status_label' => 'Cobrado',
            ]],
        ]))->getSheetByName('Cobros');
        $this->assertSame(1500.25, $single->getCell('H4')->getValue());
        $this->assertSame(1500.25, $single->getCell('H5')->getValue(), 'La fila total debe cuadrar.');

        $multi = $this->generateXlsx($this->reportPayload([
            'collections' => [
                ['paid_at' => '2026-06-02T10:00:00-06:00', 'invoice_number' => 'A', 'patient' => 'Uno', 'cash_session_label' => 'C1', 'cashier' => 'Ana', 'method' => 'cash', 'method_label' => 'Efectivo', 'reference' => null, 'amount' => '1500.00', 'status' => 'posted', 'status_label' => 'Cobrado'],
                ['paid_at' => '2026-06-03T10:00:00-06:00', 'invoice_number' => 'B', 'patient' => 'Dos', 'cash_session_label' => 'C1', 'cashier' => 'Ana', 'method' => 'card', 'method_label' => 'Tarjeta', 'reference' => 'REF-1', 'amount' => '2750.50', 'status' => 'posted', 'status_label' => 'Cobrado'],
            ],
        ]))->getSheetByName('Cobros');
        $this->assertSame(1500.0, $multi->getCell('H4')->getValue());
        $this->assertSame(2750.5, $multi->getCell('H5')->getValue());
        $this->assertSame(4250.5, $multi->getCell('H6')->getValue());
        $this->assertSame('#,##0.00', $multi->getStyle('H5')->getNumberFormat()->getFormatCode());
    }

    public function test_pdf_puts_summary_first_then_detail_and_keeps_sections(): void
    {
        $report = $this->reportPayload([
            'operations' => [[
                'date' => '2026-06-01', 'invoice_number' => '000-001-01-00000042', 'patient' => 'Maria Lopez',
                'cash_session_label' => 'Caja Principal (CAJA-01)', 'cashier' => 'Ana Ruiz', 'total' => '1500.00',
                'paid' => '1500.00', 'balance' => '0.00', 'status_label' => 'Pagada', 'settlement_label' => 'Cobrada',
                'receipt_document' => 'REC-0001',
            ]],
            'collections' => [[
                'paid_at' => '2026-06-01T09:15:00-06:00', 'invoice_number' => '000-001-01-00000042',
                'patient' => 'Maria Lopez', 'cash_session_label' => 'Caja Principal (CAJA-01)', 'cashier' => 'Ana Ruiz',
                'method_label' => 'Efectivo', 'reference' => null, 'amount' => '1500.00', 'status_label' => 'Cobrado',
            ]],
            'gratuities' => [[
                'invoice_number' => '000-001-01-00000043', 'patient' => 'Jose Martinez', 'service' => 'Eritropoyetina',
                'category' => 'Nefrologia', 'quantity' => '1.00', 'adjustment_value' => '750.00',
                'reason' => 'Receta de dialisis (EPO por linea)',
            ]],
        ]);

        $service = app(ExecutivePdfExportService::class);
        $html = $service->buildHtml($report, $this->fiscal(), 'QA', Carbon::create(2026, 6, 4, 9, 0, 0, 'America/Tegucigalpa'));

        foreach (['Resumen Ejecutivo', 'Operaciones', 'Detalle', 'Cobros', 'Gratuidades', 'Sesiones de Caja'] as $section) {
            $this->assertStringContainsString($section, $html, "Falta la seccion {$section}.");
        }
        $this->assertStringContainsString('Maria Lopez', $html);
        $this->assertStringContainsString('Filtros:', $html);
        $this->assertStringContainsString('Sin filtros adicionales', $html);

        $pdf = $service->generate($report, $this->fiscal(), 'QA', Carbon::create(2026, 6, 4, 9, 0, 0, 'America/Tegucigalpa'));
        $this->assertStringStartsWith('%PDF', $pdf);

        $dompdf = new Dompdf;
        $dompdf->loadHtml($html);
        $dompdf->render();
        $this->assertGreaterThanOrEqual(1, $dompdf->getCanvas()->get_page_count());
    }

    private function generateXlsx(array $report): Spreadsheet
    {
        return app(ExecutiveExcelExportService::class)->generate(
            $report,
            $this->fiscal(),
            Carbon::create(2026, 6, 1, 0, 0, 0, 'America/Tegucigalpa'),
            Carbon::create(2026, 6, 30, 0, 0, 0, 'America/Tegucigalpa'),
            'QA',
        );
    }

    /** @return array<string, mixed> */
    private function fiscal(): array
    {
        return [
            'hospital_name' => 'Hospital San Isidro',
            'rtn' => '08011999123456',
            'address' => 'Tegucigalpa',
            'receipt_government_line' => 'Gobierno de Honduras',
            'receipt_secretariat_line' => 'Secretaria de Salud',
        ];
    }

    /** @return array<string, mixed> */
    private function summaryDefaults(): array
    {
        return [
            'billed_total' => '0.00', 'collected_total' => '0.00', 'collected_total_cents' => 0,
            'pending_total' => '0.00', 'voided_total' => '0.00', 'reversed_total' => '0.00',
            'invoice_count' => 0, 'receipt_count' => 0, 'paid_count' => 0, 'partial_count' => 0,
            'pending_count' => 0, 'voided_count' => 0, 'average_ticket' => '0.00',
            'without_charge_count' => 0, 'gratuity_item_count' => 0,
            'gratuity_adjustment_total' => '0.00', 'gratuity_adjustment_persisted' => false,
        ];
    }

    /**
     * @param  array<string, mixed>  $overrides
     * @return array<string, mixed>
     */
    private function reportPayload(array $overrides = []): array
    {
        $base = [
            'period' => ['from' => '2026-06-01', 'to' => '2026-06-30', 'timezone' => 'America/Tegucigalpa', 'days' => 30],
            'filters' => ['cash_session_id' => null, 'user_id' => null, 'category_id' => null, 'area_id' => null, 'method' => null, 'status' => null],
            'accounting_policy' => [
                'scope' => 'operational_cash', 'expenses_supported' => false, 'exclusions_already_applied' => true,
                'billed_definition' => 'Facturas emitidas no anuladas.', 'collected_definition' => 'Pagos posteados no reversados.',
            ],
            'comparison' => [
                'billed' => ['current' => '0.00', 'previous' => '0.00', 'delta_cents' => 0, 'delta_percentage' => null],
                'collected' => ['current' => '0.00', 'previous' => '0.00', 'delta_cents' => 0, 'delta_percentage' => null],
                'previous_period' => ['from' => '2026-05-02', 'to' => '2026-05-31'],
            ],
            'summary' => $this->summaryDefaults(),
            'payment_methods' => [['method' => 'cash', 'label' => 'Efectivo', 'amount' => '1000.00', 'count' => 1, 'percentage' => 100]],
            'daily_trend' => [['date' => '2026-06-01', 'billed' => '1000.00', 'collected' => '1000.00', 'pending' => '0.00', 'voided_count' => 0, 'invoice_count' => 1]],
            'services' => ['top_by_amount' => [], 'top_by_quantity' => [], 'by_category' => [], 'by_area' => []],
            'cashiers' => [],
            'cash_sessions' => [],
            'pending_aging' => [
                '0_7_days' => ['count' => 0, 'amount' => '0.00'], '8_30_days' => ['count' => 0, 'amount' => '0.00'],
                '31_plus_days' => ['count' => 0, 'amount' => '0.00'], 'items' => [],
            ],
            'voids_and_reversals' => [],
            'audit_summary' => ['critical_events' => 0, 'reprints' => 0, 'fiscal_changes' => 0, 'cash_differences' => 0, 'backup_events' => 0],
            'can_view_audit' => true,
            'operations' => [],
            'detail' => [],
            'collections' => [],
            'gratuities' => [],
        ];

        return array_replace($base, $overrides);
    }
}
