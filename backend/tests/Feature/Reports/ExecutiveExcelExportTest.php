<?php

namespace Tests\Feature\Reports;

use App\Actions\Billing\CreateInvoiceAction;
use App\Actions\Cash\OpenCashSessionAction;
use App\Actions\Payments\RegisterPaymentAction;
use App\Actions\Reports\ExecutiveExcelExportService;
use App\Actions\Reports\ExecutiveReportService;
use App\Models\CashRegisterSession;
use App\Models\FiscalSequence;
use App\Models\FiscalSetting;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\Service;
use App\Models\User;
use App\Support\InvoiceAccess;
use Database\Seeders\RolesAndPermissionsSeeder;
use Database\Seeders\ServiceCatalogSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\PermissionRegistrar;
use Tests\TestCase;

/**
 * T-UI-04: el XLSX ejecutivo debe entregar exactamente las hojas Resumen,
 * Operaciones, Detalle, Cobros y Caja, con tipos numericos reales, numeros de
 * factura como texto, gratuidad identificada y sin formulas vivas.
 */
class ExecutiveExcelExportTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }

    public function test_executive_excel_endpoint_returns_xlsx_with_the_five_mandated_sheets(): void
    {
        $this->seedBillingBase();
        $admin = $this->admin();
        $cashier = $this->cashier();
        $session = $this->openSession($cashier);

        $invoice = $this->createInvoice($cashier, 'Glucosa');
        $this->payInvoice($cashier, $invoice->id, $session->id, Payment::METHOD_CASH, $invoice->total);

        $today = Carbon::now('America/Tegucigalpa')->toDateString();

        $response = $this->actingAs($admin)
            ->get('/api/reports/executive/excel?date_from='.$today.'&date_to='.$today);

        $response->assertOk();
        $this->assertStringContainsString(
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            (string) $response->headers->get('content-type')
        );

        $spreadsheet = $this->generateReportWorkbook($admin, $today);
        $this->assertSame(
            ['Resumen', 'Operaciones', 'Detalle', 'Cobros', 'Caja'],
            $spreadsheet->getSheetNames(),
        );
    }

    public function test_operations_and_collections_sheets_carry_patient_box_and_types(): void
    {
        $this->seedBillingBase();
        $admin = $this->admin();
        $cashier = $this->cashier();
        $session = $this->openSession($cashier);

        $invoice = $this->createInvoice($cashier, 'Glucosa');
        $this->payInvoice($cashier, $invoice->id, $session->id, Payment::METHOD_TRANSFER, $invoice->total);

        $today = Carbon::now('America/Tegucigalpa')->toDateString();
        $spreadsheet = $this->generateReportWorkbook($admin, $today);

        $operations = $spreadsheet->getSheetByName('Operaciones');
        $this->assertNotNull($operations);
        $this->assertSame('Paciente', $operations->getCell('C3')->getValue());
        $this->assertSame('Maria Lopez', $operations->getCell('C4')->getValue());
        $this->assertSame('Pagada', $operations->getCell('I4')->getValue());
        $this->assertSame('Cobrada', $operations->getCell('J4')->getValue());
        $this->assertTrue(is_numeric($operations->getCell('A4')->getValue()), 'La fecha debe ser serial Excel.');
        $this->assertSame('dd/mm/yyyy', $operations->getStyle('A4')->getNumberFormat()->getFormatCode());
        $this->assertSame('#,##0.00', $operations->getStyle('F4')->getNumberFormat()->getFormatCode());
        // Numero de factura como texto explicito (conserve ceros iniciales).
        $this->assertNotSame('f', $operations->getCell('B4')->getDataType());
        $this->assertStringStartsWith('000-001-01-', (string) $operations->getCell('B4')->getValue());

        $collections = $spreadsheet->getSheetByName('Cobros');
        $this->assertNotNull($collections);
        $this->assertSame('Maria Lopez', $collections->getCell('C4')->getValue());
        $this->assertSame('Transferencia', $collections->getCell('F4')->getValue());
        $this->assertSame('Cobrado', $collections->getCell('I4')->getValue());
        $this->assertSame('dd/mm/yyyy hh:mm', $collections->getStyle('A4')->getNumberFormat()->getFormatCode());
        $this->assertSame('#,##0.00', $collections->getStyle('H4')->getNumberFormat()->getFormatCode());
    }

    public function test_detail_sheet_identifies_gratuity_by_line_and_keeps_registered_price_column(): void
    {
        $this->seedBillingBase();
        $admin = $this->admin();
        $cashier = $this->cashier();

        $invoice = $this->createFreeInvoice($cashier, 'Eritropoyetina');

        $today = Carbon::now('America/Tegucigalpa')->toDateString();
        $spreadsheet = $this->generateReportWorkbook($admin, $today);
        $detail = $spreadsheet->getSheetByName('Detalle');

        $this->assertNotNull($detail);
        $this->assertSame('Maria Lopez', $detail->getCell('C4')->getValue());
        $this->assertSame('Eritropoyetina', $detail->getCell('D4')->getValue());
        $this->assertStringContainsString('EPO', (string) $detail->getCell('L4')->getValue());
        $this->assertSame('#,##0.00', $detail->getStyle('H4')->getNumberFormat()->getFormatCode());
        $this->assertSame('#,##0.00', $detail->getStyle('I4')->getNumberFormat()->getFormatCode());

        // Gratuidad identificada tambien en el Resumen.
        $summary = $spreadsheet->getSheetByName('Resumen');
        $flat = array_map(
            static fn (array $row): string => implode(' | ', array_map('strval', $row)),
            $summary->toArray(),
        );
        $this->assertTrue((bool) array_filter($flat, fn (string $line): bool => str_contains($line, 'Lineas gratuitas')));
        $this->assertSame(1, $summary->getCell('B26')->getValue());
        $this->assertSame('#,##0', $summary->getStyle('B26')->getNumberFormat()->getFormatCode());

        // La operacion gratuita no crea un pago ficticio.
        $this->assertSame(0, Payment::query()->where('invoice_id', $invoice->id)->count());
        $this->assertSame(1, $invoice->refresh()->settlement === Invoice::SETTLEMENT_FREE_BY_RULE ? 1 : 0);
    }

    public function test_summary_counts_money_and_percentages_have_distinct_types(): void
    {
        $this->seedBillingBase();
        $admin = $this->admin();
        $cashier = $this->cashier();
        $session = $this->openSession($cashier);

        $invoice = $this->createInvoice($cashier, 'Glucosa');
        $this->payInvoice($cashier, $invoice->id, $session->id, Payment::METHOD_CASH, $invoice->total);

        $today = Carbon::now('America/Tegucigalpa')->toDateString();
        $spreadsheet = $this->generateReportWorkbook($admin, $today);
        $summary = $spreadsheet->getSheetByName('Resumen');

        $this->assertSame('"L." #,##0.00', $summary->getStyle('B10')->getNumberFormat()->getFormatCode());
        $this->assertSame('#,##0', $summary->getStyle('B15')->getNumberFormat()->getFormatCode());
        $this->assertIsInt($summary->getCell('B15')->getValue());
        // La fila de encabezado usa el azul institucional y la primera fila de
        // datos no hereda ese relleno.
        $this->assertSame('2563EB', $summary->getStyle('A9')->getFill()->getStartColor()->getRGB());
        $this->assertNotSame('2563EB', $summary->getStyle('A10')->getFill()->getStartColor()->getRGB());
    }

    public function test_long_text_wraps_with_readable_rows_without_changing_money_alignment(): void
    {
        $patient = 'Paciente con nombre suficientemente largo para ocupar dos lineas completas';
        $note = 'Cierre conciliado con una observacion extensa que debe permanecer visible en una sola fila completa.';
        $report = [
            'summary' => ['billed_total' => '1029.25', 'invoice_count' => 1],
            'operations' => [[
                'date' => '2026-09-28', 'invoice_number' => '000-001-01-00000001', 'patient' => $patient,
                'cash_session_label' => 'Caja principal / Sesion 1', 'cashier' => 'Caja Hospitalaria',
                'total' => '1029.25', 'paid' => '1029.25', 'balance' => '0.00', 'status_label' => 'Pagada',
                'settlement_label' => 'Cobrada', 'receipt_document' => 'REC-A-00000001',
            ]],
            'detail' => [[
                'date' => '2026-09-28', 'invoice_number' => '000-001-01-00000001', 'patient' => $patient,
                'service' => 'Servicio hospitalario con descripcion completa', 'category' => 'Laboratorio', 'area' => 'Laboratorio',
                'quantity' => '1', 'unit_price' => '1029.25', 'rule_adjustment' => '0.00',
                'tax' => '0.00', 'line_total' => '1029.25', 'is_free' => false,
            ], [
                'date' => '2026-09-28', 'invoice_number' => '000-001-01-00000002', 'patient' => $patient,
                'service' => 'Servicio historico', 'category' => 'Laboratorio', 'area' => 'Laboratorio',
                'quantity' => '1', 'unit_price' => '0.00', 'rule_adjustment' => '0.00',
                'rule_adjustment_persisted' => false, 'tax' => '0.00', 'line_total' => '0.00', 'is_free' => true,
            ]],
            'collections' => [[
                'paid_at' => '2026-09-28T10:00:00-06:00', 'invoice_number' => '000-001-01-00000001',
                'patient' => $patient, 'cash_session_label' => 'Caja principal / Sesion 1', 'cashier' => 'Caja Hospitalaria',
                'method_label' => 'Transferencia', 'reference' => 'REFERENCIA-EXTENSA-00000001',
                'amount' => '1029.25', 'status_label' => 'Cobrado',
            ]],
            'cash_sessions' => [[
                'id' => 1, 'cash_register_name' => 'Caja principal', 'cash_register_code' => 'CAJA-01',
                'cashier' => 'Caja Hospitalaria', 'opened_at' => '2026-09-28T08:00:00-06:00',
                'closed_at' => '2026-09-28T10:00:00-06:00', 'opening_amount' => '100.00',
                'expected_cash' => '1129.25', 'counted_cash' => '1129.25', 'difference' => '0.00',
                'status_label' => 'Cerrada', 'closure_note' => $note,
            ]],
        ];

        $spreadsheet = app(ExecutiveExcelExportService::class)->generate(
            $report,
            ['hospital_name' => 'Hospital San Isidro', 'rtn' => '08011999123456'],
            Carbon::create(2026, 9, 28, 0, 0, 0, 'America/Tegucigalpa'),
            Carbon::create(2026, 9, 28, 0, 0, 0, 'America/Tegucigalpa'),
            'Administrador',
        );

        foreach ([['Operaciones', 'C4'], ['Detalle', 'C4'], ['Cobros', 'C4'], ['Caja', 'L4']] as [$sheetName, $cell]) {
            $sheet = $spreadsheet->getSheetByName($sheetName);
            $this->assertTrue($sheet->getStyle($cell)->getAlignment()->getWrapText(), "{$sheetName}!{$cell} debe envolver texto.");
            $this->assertGreaterThanOrEqual(30, $sheet->getRowDimension(4)->getRowHeight(), "{$sheetName}!4 debe mostrar al menos dos lineas.");
        }

        $this->assertSame($patient, $spreadsheet->getSheetByName('Operaciones')->getCell('C4')->getValue());
        $this->assertSame($note, $spreadsheet->getSheetByName('Caja')->getCell('L4')->getValue());
        $this->assertFalse($spreadsheet->getSheetByName('Operaciones')->getStyle('F4')->getAlignment()->getWrapText());
        $this->assertSame('#,##0.00', $spreadsheet->getSheetByName('Operaciones')->getStyle('F4')->getNumberFormat()->getFormatCode());
        $this->assertFalse($spreadsheet->getSheetByName('Detalle')->getStyle('I4')->getAlignment()->getWrapText());
        $this->assertNotSame(Alignment::HORIZONTAL_LEFT, $spreadsheet->getSheetByName('Detalle')->getStyle('I4')->getAlignment()->getHorizontal());
        $this->assertSame('#,##0.00', $spreadsheet->getSheetByName('Detalle')->getStyle('I4')->getNumberFormat()->getFormatCode());
        $this->assertSame('No registrado', $spreadsheet->getSheetByName('Detalle')->getCell('I5')->getValue());
        $this->assertTrue($spreadsheet->getSheetByName('Detalle')->getStyle('I5')->getAlignment()->getWrapText());
        $this->assertSame(Alignment::HORIZONTAL_LEFT, $spreadsheet->getSheetByName('Detalle')->getStyle('I5')->getAlignment()->getHorizontal());
        $this->assertSame('"L." #,##0.00', $spreadsheet->getSheetByName('Resumen')->getStyle('B10')->getNumberFormat()->getFormatCode());
        $this->assertSame('#,##0', $spreadsheet->getSheetByName('Resumen')->getStyle('B15')->getNumberFormat()->getFormatCode());
    }

    public function test_empty_period_still_builds_the_five_sheets(): void
    {
        $this->seedBillingBase();
        $admin = $this->admin();
        $today = Carbon::now('America/Tegucigalpa')->toDateString();

        $spreadsheet = $this->generateReportWorkbook($admin, $today);
        $this->assertSame(['Resumen', 'Operaciones', 'Detalle', 'Cobros', 'Caja'], $spreadsheet->getSheetNames());
        $this->assertNull($spreadsheet->getSheetByName('Operaciones')->getCell('A4')->getValue());
        $this->assertSame(0, $spreadsheet->getSheetByName('Resumen')->getCell('B15')->getValue());
    }

    public function test_formula_like_text_is_never_a_live_formula(): void
    {
        $dangerous = '=HYPERLINK("http://example.invalid")';
        $plus = '+SUM(1,1)';

        $report = [
            'summary' => ['invoice_count' => 1],
            'operations' => [[
                'date' => '2026-06-01', 'invoice_number' => $dangerous, 'patient' => $plus,
                'cash_session_label' => $dangerous, 'cashier' => $plus, 'total' => '10.00',
                'paid' => '10.00', 'balance' => '0.00', 'status_label' => $dangerous,
                'settlement_label' => $plus, 'receipt_document' => $dangerous,
            ]],
            'detail' => [[
                'date' => '2026-06-01', 'invoice_number' => $dangerous, 'patient' => $plus,
                'service' => $dangerous, 'category' => $plus, 'area' => $dangerous,
                'quantity' => '1.00', 'unit_price' => '10.00', 'rule_adjustment' => '0.00',
                'tax' => '0.00', 'line_total' => '10.00', 'is_free' => false,
            ]],
            'collections' => [[
                'paid_at' => '2026-06-01T10:00:00-06:00', 'invoice_number' => $dangerous,
                'patient' => $plus, 'cash_session_label' => $dangerous, 'cashier' => $plus,
                'method_label' => $dangerous, 'reference' => $plus, 'amount' => '10.00',
                'status_label' => $dangerous,
            ]],
            'cash_sessions' => [],
            'gratuities' => [],
        ];

        $spreadsheet = app(ExecutiveExcelExportService::class)->generate(
            $report,
            ['hospital_name' => $dangerous, 'rtn' => $plus],
            Carbon::create(2026, 6, 1, 0, 0, 0, 'America/Tegucigalpa'),
            Carbon::create(2026, 6, 1, 0, 0, 0, 'America/Tegucigalpa'),
            $plus,
        );

        foreach ($spreadsheet->getAllSheets() as $sheet) {
            foreach ($sheet->getRowIterator() as $row) {
                foreach ($row->getCellIterator() as $cell) {
                    $value = $cell->getValue();
                    if (is_string($value) && $value !== '' && preg_match('/^[=+@]/', $value) === 1) {
                        $this->fail("Formula sin neutralizar en {$sheet->getTitle()}!{$cell->getCoordinate()}");
                    }
                }
            }
        }

        $summary = $spreadsheet->getSheetByName('Resumen');
        $this->assertStringStartsWith("'", (string) $summary->getCell('A2')->getValue());
        $operations = $spreadsheet->getSheetByName('Operaciones');
        $this->assertSame("'".$dangerous, $operations->getCell('B4')->getValue());
        $this->assertSame("'".$plus, $operations->getCell('C4')->getValue());
    }

    public function test_executive_excel_requires_reports_export_permission(): void
    {
        $this->seedBillingBase();
        $cashier = $this->cashier();
        $today = Carbon::now('America/Tegucigalpa')->toDateString();

        $this->actingAs($cashier)
            ->getJson('/api/reports/executive/excel?date_from='.$today.'&date_to='.$today)
            ->assertForbidden();
    }

    /** @param array<string, mixed> $overrides */
    private function generateReportWorkbook(User $admin, string $today): Spreadsheet
    {
        $report = app(ExecutiveReportService::class)
            ->report(['date_from' => $today, 'date_to' => $today], $admin);
        $fiscal = FiscalSetting::firstOrFail();

        return app(ExecutiveExcelExportService::class)->generate(
            $report,
            $fiscal->toArray(),
            Carbon::createFromFormat('Y-m-d', $today),
            Carbon::createFromFormat('Y-m-d', $today),
            $admin->name,
        );
    }

    private function seedBillingBase(): void
    {
        app(PermissionRegistrar::class)->forgetCachedPermissions();
        $this->seed([RolesAndPermissionsSeeder::class, ServiceCatalogSeeder::class]);
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        FiscalSetting::query()->create([
            'receipt_template_mode' => 'thermal',
            'hospital_name' => 'Hospital San Isidro',
            'rtn' => '08011999123456',
            'default_tax_rate' => '15.00',
            'receipt_paper_size' => 'half_letter',
            'partial_payments_enabled' => true,
        ]);

        FiscalSequence::query()->create([
            'document_type' => 'invoice',
            'prefix' => '000-001-01',
            'min_number' => 1,
            'max_number' => 99999999,
            'current_number' => 0,
            'cai' => 'TEST-CAI',
            'valid_until' => now()->addYear()->toDateString(),
            'active' => true,
        ]);
    }

    private function cashier(): User
    {
        $cashier = User::factory()->create();
        $cashier->assignRole('cajero');
        $this->grantDirectPermissions($cashier, [
            'catalog.view',
            'invoices.view',
            'invoices.create',
            'cash.view',
            'cash.open',
            'cash.close',
            'payments.create',
            'payments.view',
            'receipts.view',
            'receipts.reprint',
            'patients.mark_dialysis_prescription',
        ]);

        return $cashier->refresh();
    }

    private function admin(): User
    {
        $admin = User::factory()->create();
        $admin->assignRole('admin');
        $this->grantDirectPermissions($admin, RolesAndPermissionsSeeder::PERMISSIONS);

        return $admin->refresh();
    }

    private function openSession(User $cashier): CashRegisterSession
    {
        return app(OpenCashSessionAction::class)
            ->execute(['opening_amount' => '500.00'], $cashier->fresh());
    }

    private function createInvoice(User $cashier, string $serviceName): Invoice
    {
        if (! CashRegisterSession::query()
            ->where('user_id', $cashier->id)
            ->where('status', CashRegisterSession::STATUS_OPEN)
            ->exists()) {
            $this->openSession($cashier);
        }

        return app(CreateInvoiceAction::class)
            ->execute([
                'patient_name' => 'Maria Lopez',
                'items' => [[
                    'service_id' => Service::query()->where('name', $serviceName)->firstOrFail()->id,
                    'quantity' => '1.00',
                ]],
            ], $cashier->fresh());
    }

    private function createFreeInvoice(User $cashier, string $serviceName): Invoice
    {
        $this->openSession($cashier);

        return app(CreateInvoiceAction::class)
            ->execute([
                'patient_name' => 'Maria Lopez',
                'items' => [[
                    'service_id' => Service::query()->where('name', $serviceName)->firstOrFail()->id,
                    'quantity' => '1.00',
                ]],
                'dialysis_prescription' => true,
            ], $cashier->fresh());
    }

    private function payInvoice(User $cashier, int $invoiceId, int $sessionId, string $method, string $amount): void
    {
        app(RegisterPaymentAction::class)
            ->execute(
                Invoice::query()->findOrFail($invoiceId),
                [
                    'cash_session_id' => $sessionId,
                    'method' => $method,
                    'amount' => $amount,
                    'reference' => in_array($method, [Payment::METHOD_CARD, Payment::METHOD_TRANSFER], true)
                        ? 'REF-'.$method.'-'.$invoiceId
                        : null,
                ],
                $cashier->fresh(),
                app(InvoiceAccess::class),
            );
    }

    /** @param array<int, string> $permissionNames */
    private function grantDirectPermissions(User $user, array $permissionNames): void
    {
        $permissions = Permission::query()
            ->whereIn('name', array_values(array_unique($permissionNames)))
            ->get();

        app(PermissionRegistrar::class)->forgetCachedPermissions();
        $user->givePermissionTo($permissions);
        $user->refresh();
        $user->load('permissions', 'roles.permissions');
    }
}
