<?php

namespace Tests\Feature\Reports;

use App\Actions\Billing\CreateInvoiceAction;
use App\Actions\Cash\OpenCashSessionAction;
use App\Actions\Payments\RegisterPaymentAction;
use App\Actions\Reports\ExecutiveExcelExportService;
use App\Actions\Reports\ExecutivePdfExportService;
use App\Actions\Reports\ExecutiveReportService;
use App\Models\CashRegisterSession;
use App\Models\FiscalSequence;
use App\Models\FiscalSetting;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\Service;
use App\Models\User;
use App\Support\InvoiceAccess;
use App\Support\Money;
use Database\Seeders\RolesAndPermissionsSeeder;
use Database\Seeders\ServiceCatalogSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\PermissionRegistrar;
use Tests\TestCase;

/**
 * T-UI-04: UI (JSON), XLSX y PDF reconciliar sobre el MISMO reporte canonico
 * de ExecutiveReportService. Emision, cobro y saldo al corte son cohortes
 * distintas; el paciente viaja en Operaciones, Detalle y Cobros.
 */
class ExecutiveExportReconciliationTest extends TestCase
{
    use RefreshDatabase;

    public function test_ui_xlsx_and_pdf_reconcile_on_same_scope_with_partial_payments(): void
    {
        $this->seedBillingBase();
        $admin = $this->admin();
        $cashier = $this->cashier();
        $session = $this->openSession($cashier);

        $invoiceA = $this->createInvoice($cashier, 'Glucosa');
        $this->payInvoice($cashier, $invoiceA->id, $session->id, Payment::METHOD_CASH, $invoiceA->total);

        $invoiceB = $this->createInvoice($cashier, 'Glucosa');
        $this->payInvoice($cashier, $invoiceB->id, $session->id, Payment::METHOD_CASH, '5.00');
        $this->payInvoice($cashier, $invoiceB->id, $session->id, Payment::METHOD_CASH, '5.00');

        $today = Carbon::now('America/Tegucigalpa')->toDateString();
        $filters = ['date_from' => $today, 'date_to' => $today];

        $report = app(ExecutiveReportService::class)->report($filters, $admin);
        $summary = $report['summary'];

        // Distincion factura vs pago: 2 facturas, 3 pagos posteados.
        $this->assertSame(2, $summary['invoice_count']);
        $this->assertSame(3, $summary['receipt_count']);
        $this->assertSame(1, $summary['paid_count']);
        $this->assertSame(1, $summary['partial_count']);

        // Mismo payload/ambito que consume la UI.
        $json = $this->actingAs($admin)
            ->getJson('/api/reports/executive?date_from='.$today.'&date_to='.$today)
            ->assertOk()
            ->json('data');
        $this->assertSame($summary, $json['summary']);
        $this->assertSame($report['operations'], $json['operations']);
        $this->assertSame($report['collections'], $json['collections']);

        // El paciente viaja en Operaciones, Detalle y Cobros.
        $this->assertSame('Maria Lopez', $report['operations'][0]['patient']);
        $this->assertSame('Maria Lopez', $report['detail'][0]['patient']);
        $this->assertSame('Maria Lopez', $report['collections'][0]['patient']);
        $this->assertCount(2, $report['operations']);
        $this->assertCount(3, $report['collections']);

        // ---- XLSX: tipos y cifras contra el resultado canonico ----
        $fiscal = FiscalSetting::firstOrFail();
        $spreadsheet = app(ExecutiveExcelExportService::class)->generate(
            $report,
            $fiscal->toArray(),
            Carbon::createFromFormat('Y-m-d', $today),
            Carbon::createFromFormat('Y-m-d', $today),
            $admin->name,
        );

        $resumen = $spreadsheet->getSheetByName('Resumen');
        $this->assertSame((float) $summary['billed_total'], $resumen->getCell('B10')->getValue());
        $this->assertSame((float) $summary['collected_total'], $resumen->getCell('B11')->getValue());
        $this->assertSame(2, $resumen->getCell('B15')->getValue());
        $this->assertSame(3, $resumen->getCell('B16')->getValue());

        $operaciones = $spreadsheet->getSheetByName('Operaciones');
        $this->assertSame('Maria Lopez', $operaciones->getCell('C4')->getValue());
        $this->assertSame('Maria Lopez', $operaciones->getCell('C5')->getValue());

        $cobros = $spreadsheet->getSheetByName('Cobros');
        $totalCobrado = 0.0;
        for ($row = 4; $row <= 6; $row++) {
            $totalCobrado += (float) $cobros->getCell("H{$row}")->getValue();
        }
        $this->assertSame(Money::parseCents($summary['collected_total'], 'collected'), (int) round($totalCobrado * 100));
        $this->assertSame((float) $summary['collected_total'], (float) $cobros->getCell('H7')->getValue());

        // ---- PDF: mismas cifras canonicas e identidad de caja ----
        $html = app(ExecutivePdfExportService::class)->buildHtml($report, $fiscal->toArray(), $admin->name, Carbon::now('America/Tegucigalpa'));
        $this->assertStringContainsString(Money::formatLempiras(Money::parseCents($summary['billed_total'], 'billed')), $html);
        $this->assertStringContainsString(Money::formatLempiras(Money::parseCents($summary['collected_total'], 'collected')), $html);
        $this->assertStringContainsString('Maria Lopez', $html);
        $this->assertStringContainsString('Operaciones', $html);
        $this->assertStringContainsString('Cobros', $html);
    }

    public function test_empty_period_reconciles_across_ui_xlsx_and_pdf(): void
    {
        $this->seedBillingBase();
        $admin = $this->admin();
        $today = Carbon::now('America/Tegucigalpa')->toDateString();

        $report = app(ExecutiveReportService::class)->report(['date_from' => $today, 'date_to' => $today], $admin);
        $this->assertSame(0, $report['summary']['invoice_count']);
        $this->assertSame([], $report['operations']);
        $this->assertSame([], $report['collections']);

        $fiscal = FiscalSetting::firstOrFail();
        $spreadsheet = app(ExecutiveExcelExportService::class)->generate(
            $report,
            $fiscal->toArray(),
            Carbon::createFromFormat('Y-m-d', $today),
            Carbon::createFromFormat('Y-m-d', $today),
            $admin->name,
        );
        $this->assertSame(0.0, $spreadsheet->getSheetByName('Resumen')->getCell('B10')->getValue());

        $html = app(ExecutivePdfExportService::class)->buildHtml($report, $fiscal->toArray(), $admin->name, Carbon::now('America/Tegucigalpa'));
        $this->assertStringContainsString('L. 0.00', $html);
        $this->assertStringNotContainsString('Array', $html);
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
            'catalog.view', 'invoices.view', 'invoices.create', 'cash.view', 'cash.open', 'cash.close',
            'payments.create', 'payments.view', 'receipts.view', 'receipts.reprint',
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

    private function payInvoice(User $cashier, int $invoiceId, int $sessionId, string $method, string $amount): void
    {
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
