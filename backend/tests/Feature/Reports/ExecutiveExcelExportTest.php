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
use PhpOffice\PhpSpreadsheet\IOFactory;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\PermissionRegistrar;
use Tests\TestCase;

class ExecutiveExcelExportTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }

    public function test_executive_excel_endpoint_returns_xlsx_with_expected_sheets(): void
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
        $this->assertStringContainsString('no-store', (string) $response->headers->get('Cache-Control'));
        $this->assertSame('no-cache', $response->headers->get('Pragma'));
        $this->assertSame('0', $response->headers->get('Expires'));

        // Generate the same workbook directly to verify sheet content. The
        // streamed download response cannot be captured by the test
        // binary but the service is the source of truth.
        $report = app(ExecutiveReportService::class)
            ->report(['date_from' => $today, 'date_to' => $today], $admin);
        $fiscal = FiscalSetting::first();

        $spreadsheet = app(ExecutiveExcelExportService::class)->generate(
            $report,
            $fiscal->toArray(),
            Carbon::createFromFormat('Y-m-d', $today),
            Carbon::createFromFormat('Y-m-d', $today),
            $admin->name,
        );

        $tempFile = tempnam(sys_get_temp_dir(), 'exec_xlsx_').'.xlsx';
        $writer = IOFactory::createWriter($spreadsheet, 'Xlsx');
        $writer->save($tempFile);

        $loaded = IOFactory::createReaderForFile($tempFile)->load($tempFile);
        $sheetTitles = $loaded->getSheetNames();

        $this->assertContains('Resumen', $sheetTitles);
        $this->assertContains('Cobros por metodo', $sheetTitles);
        $this->assertContains('Facturado diario', $sheetTitles);
        $this->assertContains('Servicios', $sheetTitles);
        $this->assertContains('Cajeros', $sheetTitles);
        $this->assertContains('Caja', $sheetTitles);
        $this->assertContains('Pendientes', $sheetTitles);
        $this->assertContains('Anulaciones y reversas', $sheetTitles);
        $this->assertContains('Auditoria', $sheetTitles);
        $this->assertContains('Glosario', $sheetTitles);

        @unlink($tempFile);
    }

    public function test_executive_excel_summary_sheet_contains_kpis_and_comparison(): void
    {
        $this->seedBillingBase();
        $admin = $this->admin();
        $cashier = $this->cashier();
        $session = $this->openSession($cashier);

        $invoice = $this->createInvoice($cashier, 'Glucosa');
        $this->payInvoice($cashier, $invoice->id, $session->id, Payment::METHOD_CASH, $invoice->total);

        $today = Carbon::now('America/Tegucigalpa')->toDateString();

        $service = app(ExecutiveExcelExportService::class);
        $report = app(ExecutiveReportService::class)
            ->report(['date_from' => $today, 'date_to' => $today], $admin);
        $fiscal = FiscalSetting::first();

        $spreadsheet = $service->generate(
            $report,
            $fiscal->toArray(),
            Carbon::createFromFormat('Y-m-d', $today),
            Carbon::createFromFormat('Y-m-d', $today),
            'Admin',
        );

        $sheet = $spreadsheet->getSheetByName('Resumen');
        $this->assertNotNull($sheet);

        $contents = $sheet->toArray(null, true, true, true);
        $flat = array_map(static fn ($row) => implode(' | ', array_map(static fn ($v) => (string) $v, $row)), $contents);

        $this->assertTrue((bool) array_filter($flat, fn ($line) => str_contains($line, 'Total Facturado')));
        $this->assertTrue((bool) array_filter($flat, fn ($line) => str_contains($line, 'Total Cobrado')));
        $this->assertTrue((bool) array_filter($flat, fn ($line) => str_contains($line, 'Anulado')));
        $this->assertTrue((bool) array_filter($flat, fn ($line) => str_contains($line, 'Ticket Promedio')));
    }

    public function test_executive_excel_escapes_formula_like_text_from_report_payload(): void
    {
        $dangerousFormula = '=HYPERLINK("http://example.invalid")';
        $dangerousPlus = '+SUM(1,1)';
        $dangerousAt = '@SUM(1,1)';

        $report = [
            'summary' => [],
            'comparison' => [],
            'payment_methods' => [[
                'label' => $dangerousFormula,
                'amount' => '10.00',
                'count' => 1,
                'percentage' => '100',
            ]],
            'daily_trend' => [[
                'date' => $dangerousPlus,
                'billed' => '10.00',
                'collected' => '10.00',
                'pending' => '0.00',
                'voided_count' => 0,
                'invoice_count' => 1,
            ]],
            'services' => [
                'top_by_amount' => [[
                    'service' => $dangerousFormula,
                    'category' => $dangerousPlus,
                    'quantity' => '1.00',
                    'total' => '10.00',
                    'collected' => '10.00',
                ]],
                'top_by_quantity' => [],
                'by_category' => [[
                    'category' => $dangerousAt,
                    'quantity' => '1.00',
                    'total' => '10.00',
                    'collected' => '10.00',
                    'item_count' => 1,
                ]],
                'by_area' => [[
                    'area' => $dangerousFormula,
                    'quantity' => '1.00',
                    'total' => '10.00',
                    'item_count' => 1,
                ]],
            ],
            'cashiers' => [[
                'name' => $dangerousFormula,
                'collected' => '10.00',
                'cash' => '10.00',
                'transfer' => '0.00',
                'card' => '0.00',
                'other' => '0.00',
                'payment_count' => 1,
                'voided_count' => 0,
                'difference_total' => '0.00',
            ]],
            'cash_sessions' => [[
                'cashier' => $dangerousFormula,
                'opened_at' => $dangerousPlus,
                'closed_at' => $dangerousAt,
                'opening_amount' => '10.00',
                'expected_cash' => '10.00',
                'counted_cash' => '10.00',
                'difference' => '0.00',
                'status' => $dangerousFormula,
                'closure_note' => $dangerousPlus,
            ]],
            'pending_aging' => [
                '0_7_days' => ['count' => 1, 'amount' => '10.00'],
                '8_30_days' => ['count' => 0, 'amount' => '0.00'],
                '31_plus_days' => ['count' => 0, 'amount' => '0.00'],
                'items' => [[
                    'invoice_number' => $dangerousFormula,
                    'patient' => $dangerousPlus,
                    'issued_at' => $dangerousAt,
                    'age_days' => 1,
                    'total' => '10.00',
                    'balance_due' => '10.00',
                ]],
            ],
            'voids_and_reversals' => [[
                'kind' => 'void',
                'invoice_number' => $dangerousFormula,
                'patient' => $dangerousPlus,
                'amount' => '10.00',
                'user' => $dangerousAt,
                'authorized_by' => $dangerousFormula,
                'reason' => $dangerousPlus,
                'created_at' => $dangerousAt,
            ]],
            'audit_summary' => [],
        ];

        $spreadsheet = app(ExecutiveExcelExportService::class)->generate(
            $report,
            ['hospital_name' => $dangerousFormula, 'rtn' => $dangerousPlus],
            Carbon::create(2026, 6, 1, 0, 0, 0, 'America/Tegucigalpa'),
            Carbon::create(2026, 6, 1, 0, 0, 0, 'America/Tegucigalpa'),
            $dangerousAt,
        );

        $this->assertSame("'{$dangerousFormula}", $spreadsheet->getSheetByName('Resumen')->getCell('A2')->getValue());
        $this->assertSame("'{$dangerousFormula}", $spreadsheet->getSheetByName('Cobros por metodo')->getCell('A4')->getValue());
        $this->assertSame("'{$dangerousPlus}", $spreadsheet->getSheetByName('Facturado diario')->getCell('A4')->getValue());
        $this->assertSame("'{$dangerousFormula}", $spreadsheet->getSheetByName('Servicios')->getCell('A6')->getValue());
        $this->assertSame("'{$dangerousPlus}", $spreadsheet->getSheetByName('Servicios')->getCell('B6')->getValue());
        $this->assertSame("'{$dangerousAt}", $spreadsheet->getSheetByName('Servicios')->getCell('A13')->getValue());
        $this->assertSame("'{$dangerousFormula}", $spreadsheet->getSheetByName('Servicios')->getCell('A17')->getValue());
        $this->assertSame("'{$dangerousFormula}", $spreadsheet->getSheetByName('Cajeros')->getCell('A4')->getValue());
        $this->assertSame("'{$dangerousFormula}", $spreadsheet->getSheetByName('Caja')->getCell('A4')->getValue());
        $this->assertSame("'{$dangerousPlus}", $spreadsheet->getSheetByName('Caja')->getCell('B4')->getValue());
        $this->assertSame("'{$dangerousAt}", $spreadsheet->getSheetByName('Caja')->getCell('C4')->getValue());
        $this->assertSame("'{$dangerousFormula}", $spreadsheet->getSheetByName('Caja')->getCell('H4')->getValue());
        $this->assertSame("'{$dangerousPlus}", $spreadsheet->getSheetByName('Caja')->getCell('I4')->getValue());
        $this->assertSame("'{$dangerousFormula}", $spreadsheet->getSheetByName('Pendientes')->getCell('A10')->getValue());
        $this->assertSame("'{$dangerousPlus}", $spreadsheet->getSheetByName('Pendientes')->getCell('B10')->getValue());
        $this->assertSame("'{$dangerousAt}", $spreadsheet->getSheetByName('Pendientes')->getCell('C10')->getValue());
        $this->assertSame("'{$dangerousFormula}", $spreadsheet->getSheetByName('Anulaciones y reversas')->getCell('B4')->getValue());
        $this->assertSame("'{$dangerousPlus}", $spreadsheet->getSheetByName('Anulaciones y reversas')->getCell('C4')->getValue());
        $this->assertSame("'{$dangerousAt}", $spreadsheet->getSheetByName('Anulaciones y reversas')->getCell('E4')->getValue());
        $this->assertSame("'{$dangerousFormula}", $spreadsheet->getSheetByName('Anulaciones y reversas')->getCell('F4')->getValue());
        $this->assertSame("'{$dangerousPlus}", $spreadsheet->getSheetByName('Anulaciones y reversas')->getCell('G4')->getValue());
        $this->assertSame("'{$dangerousAt}", $spreadsheet->getSheetByName('Anulaciones y reversas')->getCell('H4')->getValue());
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

    private function payInvoice(
        User $cashier,
        int $invoiceId,
        int $sessionId,
        string $method,
        string $amount,
    ): void {
        app(RegisterPaymentAction::class)
            ->execute(
                Invoice::query()->findOrFail($invoiceId),
                [
                    'cash_session_id' => $sessionId,
                    'method' => $method,
                    'amount' => $amount,
                ],
                $cashier->fresh(),
                app(InvoiceAccess::class),
            );
    }

    /**
     * @param  array<int, string>  $permissionNames
     */
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
