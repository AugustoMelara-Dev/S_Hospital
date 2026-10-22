<?php

declare(strict_types=1);

namespace Tests\Feature\Reports;

use App\Actions\Reports\ExecutiveExcelExportService;
use App\Actions\Reports\ExecutivePdfExportService;
use Dompdf\Dompdf;
use Illuminate\Support\Carbon;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use Tests\TestCase;

/**
 * C2-B8 (evidencia): genera los PDF/XLSX REALES del reporte de producto sobre
 * fixtures sinteticos y los deja en hospital-ai/evidencia/C2-B8/ con hash y
 * tamano.
 *
 * Cubre: conjunto completo y paginas posteriores (cabecera repetida), 0/1/muchas
 * filas, Unicode/apostrofos en el paciente, identificadores como texto, dinero
 * numerico, conteos enteros, fechas reconocibles, ajuste historico "No registrado"
 * y area de impresion / titulos repetidos. El XLSX se reabre desde disco.
 */
class ExecutiveExportEvidenceC2B8Test extends TestCase
{
    private string $evidenceDir;

    protected function setUp(): void
    {
        parent::setUp();

        $campaignRoot = dirname(base_path()).DIRECTORY_SEPARATOR.'hospital-ai';
        $this->evidenceDir = $campaignRoot.DIRECTORY_SEPARATOR.'evidencia'.DIRECTORY_SEPARATOR.'C2-B8';

        if (! is_dir($this->evidenceDir)) {
            mkdir($this->evidenceDir, 0777, true);
        }
    }

    public function test_generates_real_pdf_and_xlsx_with_print_setup_and_types(): void
    {
        $report = $this->reportPayload([
            'summary' => array_merge($this->summary(), [
                'billed_total' => '125430.75',
                'collected_total' => '98765.50',
                'invoice_count' => 25,
                'gratuity_item_count' => 1,
                'gratuity_adjustment_total' => '25.00',
                'gratuity_adjustment_persisted' => true,
            ]),
            'operations' => $this->operations(25),
            'detail' => $this->detail(25),
            'collections' => $this->collections(25),
        ]);

        // --- XLSX real -------------------------------------------------
        $spreadsheet = $this->xlsx($report);
        $this->assertSame(['Resumen', 'Operaciones', 'Detalle', 'Cobros', 'Caja'], $spreadsheet->getSheetNames());

        $operations = $spreadsheet->getSheetByName('Operaciones');
        $this->assertNotNull($operations);
        // Cabecera congelada debajo de la fila de encabezado (fila 3).
        $this->assertSame('A4', $operations->getFreezePane());
        // Cabecera repetida al imprimir: filas 1..3.
        $this->assertSame([1, 3], $operations->getPageSetup()->getRowsToRepeatAtTop());
        // Area de impresion acotada a los datos.
        $this->assertSame('A1:K29', (string) $operations->getPageSetup()->getPrintArea());
        $this->assertNotNull($operations->getAutoFilter());
        // Dinero numerico con formato y fecha como serial.
        $this->assertSame('#,##0.00', $operations->getStyle('F4')->getNumberFormat()->getFormatCode());
        $this->assertSame('dd/mm/yyyy', $operations->getStyle('A4')->getNumberFormat()->getFormatCode());
        $this->assertTrue(is_numeric($operations->getCell('A4')->getValue()));
        // Identificador como texto, con apostrofos y Unicode intactos.
        $this->assertStringStartsWith('000-001-01-', (string) $operations->getCell('B4')->getValue());
        $this->assertSame("O'Brien María José", $operations->getCell('C4')->getValue());

        $detail = $spreadsheet->getSheetByName('Detalle');
        $this->assertNotNull($detail);
        $this->assertSame('#,##0.00', $detail->getStyle('H4')->getNumberFormat()->getFormatCode());
        $this->assertSame('#,##0.00', $detail->getStyle('K4')->getNumberFormat()->getFormatCode());

        $summary = $spreadsheet->getSheetByName('Resumen');
        $this->assertSame(25, $summary->getCell('B15')->getValue());
        $this->assertSame('#,##0', $summary->getStyle('B15')->getNumberFormat()->getFormatCode());
        $this->assertSame('"L." #,##0.00', $summary->getStyle('B10')->getNumberFormat()->getFormatCode());

        $xlsxPath = $this->evidenceDir.DIRECTORY_SEPARATOR.'reporte-ejecutivo-c2b8.xlsx';
        (new Xlsx($spreadsheet))->save($xlsxPath);

        // Se reabre el archivo producido: no basta con que el servicio devuelva el objeto.
        $reopened = IOFactory::load($xlsxPath);
        $this->assertSame(['Resumen', 'Operaciones', 'Detalle', 'Cobros', 'Caja'], $reopened->getSheetNames());
        $this->assertSame([1, 3], $reopened->getSheetByName('Detalle')->getPageSetup()->getRowsToRepeatAtTop());

        // --- PDF real --------------------------------------------------
        $pdfService = app(ExecutivePdfExportService::class);
        $html = $pdfService->buildHtml($report, $this->fiscal(), 'QA C2-B8', Carbon::create(2026, 6, 4, 9, 0, 0, 'America/Tegucigalpa'));
        $this->assertStringContainsString('Resumen Ejecutivo', $html);
        $this->assertStringContainsString('No registrado', $html);

        $pdf = $pdfService->generate($report, $this->fiscal(), 'QA C2-B8', Carbon::create(2026, 6, 4, 9, 0, 0, 'America/Tegucigalpa'));
        $this->assertStringStartsWith('%PDF', $pdf);

        $pdfPath = $this->evidenceDir.DIRECTORY_SEPARATOR.'reporte-ejecutivo-c2b8.pdf';
        file_put_contents($pdfPath, $pdf);

        // Carta vertical (612 x 792 pt) y varias paginas con cabecera repetida.
        $dompdf = new Dompdf;
        $dompdf->loadHtml($html);
        $dompdf->render();
        $canvas = $dompdf->getCanvas();
        $this->assertEqualsWithDelta(612.0, (float) $canvas->get_width(), 1.0);
        $this->assertEqualsWithDelta(792.0, (float) $canvas->get_height(), 1.0);
        $this->assertGreaterThanOrEqual(2, $canvas->get_page_count(), '25 lineas de detalle deben paginar y repetir cabecera.');

        $this->writeManifest([
            'xlsx' => $xlsxPath,
            'pdf' => $pdfPath,
        ], [
            'xlsx_sheets' => $reopened->getSheetNames(),
            'pdf_pages' => $canvas->get_page_count(),
            'pdf_media' => ['width_pt' => (float) $canvas->get_width(), 'height_pt' => (float) $canvas->get_height()],
            'patient_unicode' => $operations->getCell('C4')->getValue(),
            'invoice_id_as_text' => (string) $operations->getCell('B4')->getValue(),
        ]);
    }

    public function test_empty_and_single_row_exports_are_still_openable(): void
    {
        $empty = $this->xlsx($this->reportPayload([
            'summary' => $this->summary(),
            'operations' => [], 'detail' => [], 'collections' => [], 'cash_sessions' => [], 'gratuities' => [],
        ]));
        $emptyPath = $this->evidenceDir.DIRECTORY_SEPARATOR.'reporte-vacio-c2b8.xlsx';
        (new Xlsx($empty))->save($emptyPath);
        $this->assertSame(['Resumen', 'Operaciones', 'Detalle', 'Cobros', 'Caja'], IOFactory::load($emptyPath)->getSheetNames());

        $single = $this->xlsx($this->reportPayload([
            'summary' => $this->summary(),
            'operations' => $this->operations(1),
            'detail' => $this->detail(1),
            'collections' => $this->collections(1),
        ]));
        $singlePath = $this->evidenceDir.DIRECTORY_SEPARATOR.'reporte-una-fila-c2b8.xlsx';
        (new Xlsx($single))->save($singlePath);
        $reopened = IOFactory::load($singlePath);
        $this->assertSame(1500.25, $reopened->getSheetByName('Cobros')->getCell('H4')->getValue());

        $this->writeManifest([
            'xlsx_empty' => $emptyPath,
            'xlsx_single' => $singlePath,
        ], [
            'empty_sheets' => IOFactory::load($emptyPath)->getSheetNames(),
            'single_amount' => $reopened->getSheetByName('Cobros')->getCell('H4')->getValue(),
        ]);
    }

    /** @param array<string, string> $artifacts */
    private function writeManifest(array $artifacts, array $extra): void
    {
        $entries = [];
        foreach ($artifacts as $key => $path) {
            $entries[$key] = [
                'path' => str_replace('\\', '/', $path),
                'bytes' => is_file($path) ? filesize($path) : null,
                'sha256' => is_file($path) ? hash_file('sha256', $path) : null,
            ];
        }

        $manifestPath = $this->evidenceDir.DIRECTORY_SEPARATOR.'manifest.json';
        $previous = is_file($manifestPath)
            ? json_decode((string) file_get_contents($manifestPath), true)
            : [];
        $previous = is_array($previous) ? $previous : [];
        $mergedArtifacts = array_merge($previous['artifacts'] ?? [], $entries);

        file_put_contents(
            $manifestPath,
            json_encode(array_merge($previous, ['artifacts' => $mergedArtifacts], $extra), JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        );
    }

    private function xlsx(array $report): Spreadsheet
    {
        return app(ExecutiveExcelExportService::class)->generate(
            $report,
            $this->fiscal(),
            Carbon::create(2026, 6, 1, 0, 0, 0, 'America/Tegucigalpa'),
            Carbon::create(2026, 6, 30, 0, 0, 0, 'America/Tegucigalpa'),
            'QA C2-B8',
        );
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function operations(int $count): array
    {
        $rows = [];
        for ($i = 1; $i <= $count; $i++) {
            $rows[] = [
                'date' => '2026-06-02',
                'invoice_number' => '000-001-01-'.str_pad((string) $i, 8, '0', STR_PAD_LEFT),
                'patient' => $i === 1 ? "O'Brien María José" : 'Paciente sintetico '.$i,
                'cash_session_label' => 'Caja Principal (CAJA-01)',
                'cashier' => 'Ana Ruiz',
                'total' => '1500.25',
                'paid' => '1500.25',
                'balance' => '0.00',
                'status_label' => 'Pagada',
                'settlement_label' => 'Cobrada',
                'receipt_document' => 'REC-'.str_pad((string) $i, 4, '0', STR_PAD_LEFT),
            ];
        }

        return $rows;
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function detail(int $count): array
    {
        $rows = [];
        for ($i = 1; $i <= $count; $i++) {
            $rows[] = [
                'date' => '2026-06-02',
                'invoice_number' => '000-001-01-'.str_pad((string) $i, 8, '0', STR_PAD_LEFT),
                'patient' => $i === 1 ? "O'Brien María José" : 'Paciente sintetico '.$i,
                'service' => 'Servicio sintetico '.$i,
                'category' => 'Laboratorio',
                'area' => 'Laboratorio',
                'quantity' => '2.00',
                'unit_price' => '10.00',
                'rule_adjustment' => '0.00',
                'tax' => '0.00',
                'line_total' => '20.00',
                'is_free' => false,
                'rule_label' => null,
                'rule_adjustment_persisted' => true,
            ];
        }

        // Primera linea: gratuidad historica backfilleada (desconocida).
        $rows[0] = array_merge($rows[0], [
            'service' => 'Eritropoyetina historica',
            'unit_price' => '0.00',
            'rule_adjustment' => '0.00',
            'is_free' => true,
            'rule_label' => 'Receta de dialisis (EPO por linea)',
            'rule_adjustment_persisted' => false,
        ]);

        return $rows;
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function collections(int $count): array
    {
        $rows = [];
        for ($i = 1; $i <= $count; $i++) {
            $rows[] = [
                'paid_at' => '2026-06-02T10:15:00-06:00',
                'invoice_number' => '000-001-01-'.str_pad((string) $i, 8, '0', STR_PAD_LEFT),
                'patient' => $i === 1 ? "O'Brien María José" : 'Paciente sintetico '.$i,
                'cash_session_label' => 'Caja Principal (CAJA-01)',
                'cashier' => 'Ana Ruiz',
                'method' => 'cash',
                'method_label' => 'Efectivo',
                'reference' => null,
                'amount' => '1500.25',
                'status' => 'posted',
                'status_label' => 'Cobrado',
            ];
        }

        return $rows;
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
    private function summary(): array
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
            'summary' => $this->summary(),
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
