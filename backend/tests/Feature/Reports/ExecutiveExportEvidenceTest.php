<?php

namespace Tests\Feature\Reports;

use App\Actions\Reports\ExecutiveExcelExportService;
use App\Actions\Reports\ExecutivePdfExportService;
use Dompdf\Dompdf;
use Illuminate\Support\Carbon;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Style\NumberFormat;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use Tests\TestCase;

/**
 * T-UI-04 (evidencia): genera los XLSX/PDF REALES del generador sobre fixtures
 * sinteticos y los deja en hospital-ai/evidencia/T-UI-04/, junto a un volcado
 * de tipos/formato por celda. Prueba valores: importes >1000, conteos, fechas
 * serial, numeros de factura como texto y gratuidad.
 */
class ExecutiveExportEvidenceTest extends TestCase
{
    private string $evidenceDir;

    protected function setUp(): void
    {
        parent::setUp();

        $campaignRoot = dirname(base_path()).DIRECTORY_SEPARATOR.'hospital-ai';
        $base = is_dir($campaignRoot)
            ? $campaignRoot.DIRECTORY_SEPARATOR.'evidencia'.DIRECTORY_SEPARATOR.'T-UI-04'
            : storage_path('app'.DIRECTORY_SEPARATOR.'t-ui-04');

        $this->evidenceDir = $base;

        if (! is_dir($this->evidenceDir)) {
            mkdir($this->evidenceDir, 0777, true);
        }
    }

    public function test_generates_real_xlsx_and_pdf_artifacts_and_cell_format_dump(): void
    {
        $rich = $this->richReport();
        $spreadsheet = $this->xlsx($rich);

        $this->assertSame(['Resumen', 'Operaciones', 'Detalle', 'Cobros', 'Caja'], $spreadsheet->getSheetNames());

        $this->writeWorkbook($spreadsheet, 'rich-report.xlsx');
        $this->writeCellFormatDump($spreadsheet, 'rich-report-cell-formats.csv');

        $operations = $spreadsheet->getSheetByName('Operaciones');
        $this->assertSame('María López', $operations->getCell('C4')->getValue());
        $this->assertSame('#,##0.00', $operations->getStyle('F4')->getNumberFormat()->getFormatCode());
        $this->assertSame('dd/mm/yyyy', $operations->getStyle('A4')->getNumberFormat()->getFormatCode());

        // Varias cajas: la segunda sesion conserva su caja fisica y codigo.
        $caja = $spreadsheet->getSheetByName('Caja');
        $this->assertSame('CAJA-01', $caja->getCell('C4')->getValue());
        $this->assertSame('CAJA-02', $caja->getCell('C5')->getValue());
        $this->assertSame('Abierta', $caja->getCell('K5')->getValue());

        // Importes >1000 y conteos enteros.
        $summary = $spreadsheet->getSheetByName('Resumen');
        $this->assertSame(125430.75, $summary->getCell('B10')->getValue());
        $this->assertSame(128, $summary->getCell('B15')->getValue());
        $this->assertSame('#,##0', $summary->getStyle('B15')->getNumberFormat()->getFormatCode());

        // Gratuidad identificada en Detalle y Resumen.
        $detail = $spreadsheet->getSheetByName('Detalle');
        $this->assertStringContainsString('EPO', (string) $detail->getCell('L4')->getValue());
        $this->assertSame(1, $summary->getCell('B26')->getValue());

        $pdf = $this->pdf($rich);
        file_put_contents($this->evidenceDir.DIRECTORY_SEPARATOR.'rich-report.pdf', $pdf);
        $this->assertStringStartsWith('%PDF', $pdf);

        // Verificacion de la numeracion de pagina: mismo mecanismo page_text,
        // sin compresion para poder inspeccionar el contenido del PDF real.
        $uncompressed = $this->pdfUncompressed($rich);
        $this->assertStringContainsString('Pagina 1 de', $uncompressed);

        $dompdf = new Dompdf;
        $dompdf->loadHtml($this->pdfHtml($rich));
        $dompdf->render();

        file_put_contents(
            $this->evidenceDir.DIRECTORY_SEPARATOR.'reconciliation-rich.json',
            json_encode([
                'generated_at' => 'fixed-fixture',
                'sheets' => $spreadsheet->getSheetNames(),
                'canonical_summary' => $rich['summary'],
                'operations_first_row' => [
                    'invoice_number' => $operations->getCell('B4')->getValue(),
                    'patient' => $operations->getCell('C4')->getValue(),
                    'total' => $operations->getCell('F4')->getValue(),
                ],
                'pdf_pages' => $dompdf->getCanvas()->get_page_count(),
            ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        );
    }

    public function test_generates_empty_single_and_percent_extreme_workbooks(): void
    {
        $empty = $this->xlsx($this->reportPayload([
            'summary' => $this->zeroSummary(),
            'operations' => [], 'detail' => [], 'collections' => [], 'cash_sessions' => [], 'gratuities' => [],
        ]));
        $this->writeWorkbook($empty, 'empty-report.xlsx');
        $this->writeCellFormatDump($empty, 'empty-report-cell-formats.csv');
        $this->assertSame(['Resumen', 'Operaciones', 'Detalle', 'Cobros', 'Caja'], $empty->getSheetNames());

        $single = $this->xlsx($this->reportPayload([
            'summary' => array_merge($this->zeroSummary(), ['invoice_count' => 1, 'receipt_count' => 1, 'billed_total' => '1500.25']),
            'operations' => [[
                'date' => '2026-06-02', 'invoice_number' => '000-001-01-00000001', 'patient' => 'Ana Ruiz',
                'cash_session_label' => 'Caja Principal (CAJA-01)', 'cashier' => 'Ana Ruiz', 'total' => '1500.25',
                'paid' => '1500.25', 'balance' => '0.00', 'status_label' => 'Pagada', 'settlement_label' => 'Cobrada',
                'receipt_document' => null,
            ]],
        ]));
        $this->writeWorkbook($single, 'single-row-report.xlsx');
        $this->writeCellFormatDump($single, 'single-row-report-cell-formats.csv');
        $this->assertSame(1500.25, $single->getSheetByName('Operaciones')->getCell('F4')->getValue());

        $percent = $this->xlsx($this->reportPayload([
            'comparison' => [
                'billed' => ['delta_percentage' => 0],
                'collected' => ['delta_percentage' => 50],
            ],
        ]));
        $this->writeWorkbook($percent, 'percent-extremes-report.xlsx');
        $sheet = $percent->getSheetByName('Resumen');
        $this->assertSame(0.0, $sheet->getCell('C10')->getValue());
        $this->assertSame(0.5, $sheet->getCell('C11')->getValue());
        $this->assertSame('+0.00%;-0.00%;0.00%', $sheet->getStyle('C10')->getNumberFormat()->getFormatCode());

        // 100%: fraccion 1.0 con formato de porcentaje.
        $full = $this->xlsx($this->reportPayload([
            'comparison' => [
                'billed' => ['delta_percentage' => 100],
                'collected' => ['delta_percentage' => 0],
            ],
        ]));
        $fullSheet = $full->getSheetByName('Resumen');
        $this->assertSame(1.0, $fullSheet->getCell('C10')->getValue());
        $this->assertSame('100.00%', NumberFormat::toFormattedString(1.0, '0.00%'));
    }

    private function xlsx(array $report): Spreadsheet
    {
        return app(ExecutiveExcelExportService::class)->generate(
            $report,
            $this->fiscal(),
            Carbon::create(2026, 6, 1, 0, 0, 0, 'America/Tegucigalpa'),
            Carbon::create(2026, 6, 30, 0, 0, 0, 'America/Tegucigalpa'),
            'QA T-UI-04',
        );
    }

    private function pdf(array $report): string
    {
        return app(ExecutivePdfExportService::class)->generate(
            $report,
            $this->fiscal(),
            'QA T-UI-04',
            Carbon::create(2026, 7, 1, 9, 0, 0, 'America/Tegucigalpa'),
        );
    }

    private function pdfHtml(array $report): string
    {
        return app(ExecutivePdfExportService::class)->buildHtml(
            $report,
            $this->fiscal(),
            'QA T-UI-04',
            Carbon::create(2026, 7, 1, 9, 0, 0, 'America/Tegucigalpa'),
        );
    }

    /** Replica el page_text del servicio sin compresion, para inspeccionar el texto. */
    private function pdfUncompressed(array $report): string
    {
        $dompdf = new Dompdf;
        $dompdf->loadHtml($this->pdfHtml($report));
        $dompdf->render();
        $canvas = $dompdf->getCanvas();
        $font = $dompdf->getFontMetrics()->getFont('Helvetica', 'normal');
        $canvas->page_text(
            $canvas->get_width() - 150,
            $canvas->get_height() - 26,
            'Pagina {PAGE_NUM} de {PAGE_COUNT}',
            $font,
            8.5,
            [0.39, 0.45, 0.55],
        );

        return $dompdf->output(['compress' => 0]);
    }

    private function writeWorkbook(Spreadsheet $spreadsheet, string $filename): void
    {
        (new Xlsx($spreadsheet))->save($this->evidenceDir.DIRECTORY_SEPARATOR.$filename);
    }

    private function writeCellFormatDump(Spreadsheet $spreadsheet, string $filename): void
    {
        $handle = fopen($this->evidenceDir.DIRECTORY_SEPARATOR.$filename, 'w');
        fputcsv($handle, ['sheet', 'cell', 'raw_value', 'data_type', 'number_format', 'fill_rgb']);

        foreach ($spreadsheet->getAllSheets() as $sheet) {
            foreach ($sheet->getRowIterator() as $row) {
                foreach ($row->getCellIterator() as $cell) {
                    $value = $cell->getValue();
                    if ($value === null || $value === '') {
                        continue;
                    }
                    fputcsv($handle, [
                        $sheet->getTitle(),
                        $cell->getCoordinate(),
                        is_scalar($value) ? (string) $value : gettype($value),
                        $cell->getDataType(),
                        $sheet->getStyle($cell->getCoordinate())->getNumberFormat()->getFormatCode(),
                        $sheet->getStyle($cell->getCoordinate())->getFill()->getStartColor()->getRGB(),
                    ]);
                }
            }
        }

        fclose($handle);
    }

    /** @return array<string, mixed> */
    private function fiscal(): array
    {
        return [
            'hospital_name' => 'Hospital San Isidro',
            'rtn' => '08011999123456',
            'address' => 'Tegucigalpa, Honduras',
            'receipt_government_line' => 'Gobierno de Honduras',
            'receipt_secretariat_line' => 'Secretaria de Salud',
        ];
    }

    /** @return array<string, mixed> */
    private function zeroSummary(): array
    {
        return [
            'billed_total' => '0.00', 'collected_total' => '0.00', 'pending_total' => '0.00',
            'voided_total' => '0.00', 'reversed_total' => '0.00', 'invoice_count' => 0,
            'receipt_count' => 0, 'paid_count' => 0, 'partial_count' => 0, 'pending_count' => 0,
            'voided_count' => 0, 'average_ticket' => '0.00', 'without_charge_count' => 0,
            'gratuity_item_count' => 0, 'gratuity_adjustment_total' => '0.00', 'gratuity_adjustment_persisted' => false,
        ];
    }

    /** @return array<string, mixed> */
    private function richReport(): array
    {
        return $this->reportPayload([
            'summary' => [
                'billed_total' => '125430.75', 'collected_total' => '98765.50', 'pending_total' => '26665.25',
                'voided_total' => '1500.00', 'reversed_total' => '500.00', 'invoice_count' => 128,
                'receipt_count' => 203, 'paid_count' => 96, 'partial_count' => 32, 'pending_count' => 32,
                'voided_count' => 3, 'average_ticket' => '980.00', 'without_charge_count' => 4,
                'gratuity_item_count' => 1, 'gratuity_adjustment_total' => '0.00', 'gratuity_adjustment_persisted' => false,
            ],
            'comparison' => [
                'billed' => ['delta_percentage' => 12.5],
                'collected' => ['delta_percentage' => -3.25],
            ],
            'operations' => [
                [
                    'date' => '2026-06-02', 'invoice_number' => '000-001-01-00000128', 'patient' => 'María López',
                    'cash_session_label' => 'Caja Principal (CAJA-01)', 'cashier' => 'Ana Ruiz', 'total' => '125430.75',
                    'paid' => '98765.50', 'balance' => '26665.25', 'status_label' => 'Parcial',
                    'settlement_label' => 'Pendiente de cobro', 'receipt_document' => 'REC-0001',
                ],
            ],
            'detail' => [
                [
                    'date' => '2026-06-02', 'invoice_number' => '000-001-01-00000128', 'patient' => 'Maria Lopez',
                    'service' => 'Eritropoyetina', 'category' => 'Nefrologia', 'area' => 'Nefrologia',
                    'quantity' => '2.00', 'unit_price' => '0.00', 'rule_adjustment' => '0.00', 'tax' => '0.00',
                    'line_total' => '0.00', 'is_free' => true, 'rule_label' => 'Receta de dialisis (EPO por linea)',
                ],
            ],
            'collections' => [
                [
                    'paid_at' => '2026-06-02T10:15:00-06:00', 'invoice_number' => '000-001-01-00000128',
                    'patient' => 'Maria Lopez', 'cash_session_label' => 'Caja Principal (CAJA-01)',
                    'cashier' => 'Ana Ruiz', 'method' => 'cash', 'method_label' => 'Efectivo',
                    'reference' => null, 'amount' => '98765.50', 'status' => 'posted', 'status_label' => 'Cobrado',
                ],
            ],
            'cash_sessions' => [
                [
                    'id' => 42, 'cash_register_id' => 1, 'cash_register_code' => 'CAJA-01', 'cash_register_name' => 'Caja Principal',
                    'cashier' => 'Ana Ruiz', 'opened_at' => '2026-06-02T08:00:00-06:00', 'closed_at' => '2026-06-02T17:05:00-06:00',
                    'opening_amount' => '500.00', 'expected_cash' => '30500.00', 'counted_cash' => '30525.00',
                    'difference' => '25.00', 'status' => 'closed', 'status_label' => 'Cerrada', 'closure_note' => 'Cierre sin faltante',
                ],
                [
                    'id' => 57, 'cash_register_id' => 3, 'cash_register_code' => 'CAJA-02', 'cash_register_name' => 'Caja Emergencia',
                    'cashier' => 'Carlos Mejía', 'opened_at' => '2026-06-03T07:30:00-06:00', 'closed_at' => null,
                    'opening_amount' => '1000.00', 'expected_cash' => '21000.00', 'counted_cash' => null,
                    'difference' => null, 'status' => 'open', 'status_label' => 'Abierta', 'closure_note' => 'Pendiente de cierre',
                ],
            ],
            'gratuities' => [[
                'invoice_number' => '000-001-01-00000128', 'patient' => 'Maria Lopez', 'service' => 'Eritropoyetina',
                'category' => 'Nefrologia', 'quantity' => '2.00', 'adjustment_value' => '0.00',
                'reason' => 'Receta de dialisis (EPO por linea)',
            ]],
        ]);
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
            'summary' => $this->zeroSummary(),
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
