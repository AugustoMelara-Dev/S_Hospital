<?php

namespace Tests\Feature\Reports;

use App\Actions\Billing\CreateInvoiceAction;
use App\Actions\Cash\OpenCashSessionAction;
use App\Actions\Payments\RegisterPaymentAction;
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
use Database\Seeders\RolesAndPermissionsSeeder;
use Database\Seeders\ServiceCatalogSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\PermissionRegistrar;
use Tests\TestCase;

class ExecutivePdfExportTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }

    public function test_executive_pdf_returns_pdf_with_institutional_header(): void
    {
        $this->seedBillingBase();
        $admin = $this->admin();
        $cashier = $this->cashier();
        $session = $this->openSession($cashier);

        $invoice = $this->createInvoice($cashier, 'Glucosa');
        $this->payInvoice($cashier, $invoice->id, $session->id, Payment::METHOD_CASH, $invoice->total);

        $today = Carbon::now('America/Tegucigalpa')->toDateString();

        $response = $this->actingAs($admin)
            ->get('/api/reports/executive/pdf?date_from='.$today.'&date_to='.$today);

        $response->assertOk();
        $this->assertSame('application/pdf', $response->headers->get('content-type'));
        $this->assertStringStartsWith('%PDF', $response->getContent());
    }

    public function test_executive_pdf_builder_contains_key_sections(): void
    {
        $this->seedBillingBase();
        $admin = $this->admin();
        $cashier = $this->cashier();
        $session = $this->openSession($cashier);

        $invoice = $this->createInvoice($cashier, 'Glucosa');
        $this->payInvoice($cashier, $invoice->id, $session->id, Payment::METHOD_CASH, $invoice->total);

        $today = Carbon::now('America/Tegucigalpa')->toDateString();

        $fiscal = FiscalSetting::first();
        $this->assertNotNull($fiscal);

        $service = app(ExecutivePdfExportService::class);

        $report = app(ExecutiveReportService::class)
            ->report([
                'date_from' => $today,
                'date_to' => $today,
            ], $admin);

        $html = $service->buildHtml($report, $fiscal->toArray(), 'Admin Test', Carbon::now('America/Tegucigalpa'));

        $this->assertStringContainsString('Gobierno de Honduras', $html);
        $this->assertStringContainsString('Hospital General San Isidro', $html);
        $this->assertStringContainsString('Resumen Ejecutivo', $html);
        $this->assertStringContainsString('Lectura Financiera', $html);
        $this->assertStringContainsString('Recaudacion por Metodo', $html);
        $this->assertStringContainsString('Tendencia Diaria', $html);
        $this->assertStringContainsString('Conceptos asociados a pagos', $html);
        $this->assertStringContainsString('Cantidad cobrable', $html);
        $this->assertStringContainsString('Cobrado en periodo', $html);
        $this->assertStringContainsString('Cajeros', $html);
        $this->assertStringContainsString('Sesiones de Caja', $html);
        $this->assertStringContainsString('Pendientes y Antiguedad', $html);
        $this->assertStringContainsString('Anulaciones y Reversas', $html);
        $this->assertStringContainsString('Resumen de Auditoria', $html);
        $this->assertStringContainsString('Documento generado por S_Hospital', $html);
        $this->assertStringContainsString('Los montos anulados y reversados ya estan excluidos de los totales activos', $html);
        $this->assertStringNotContainsString('facturado menos anulado y reversado', $html);

        $this->assertStringContainsString('L. ', $html);
        $this->assertStringContainsString('data-report-style="minimal-monochrome"', $html);
        $this->assertStringNotContainsString('#0d9488', $html);
        $this->assertStringNotContainsString('background: #0f172a', $html);
    }

    public function test_executive_pdf_without_audit_view_omits_audit_sections(): void
    {
        $this->seedBillingBase();
        $viewer = User::factory()->create();
        $this->grantDirectPermissions($viewer, [
            'reports.view',
            'reports.managerial.view',
            'reports.export',
        ]);
        $admin = $this->admin();
        $cashier = $this->cashier();
        $voided = $this->createInvoice($cashier, 'Glucosa');

        $voided->update([
            'status' => Invoice::STATUS_VOID,
            'voided_by' => $admin->id,
            'voided_at' => Carbon::now('America/Tegucigalpa'),
            'void_reason' => 'Motivo ejecutivo reservado',
        ]);

        $today = Carbon::now('America/Tegucigalpa')->toDateString();
        $fiscal = FiscalSetting::first();
        $this->assertNotNull($fiscal);

        $report = app(ExecutiveReportService::class)
            ->report(['date_from' => $today, 'date_to' => $today], $viewer);

        $html = app(ExecutivePdfExportService::class)
            ->buildHtml($report, $fiscal->toArray(), 'Viewer Test', Carbon::now('America/Tegucigalpa'));

        $this->assertStringContainsString('Resumen Ejecutivo', $html);
        $this->assertStringNotContainsString('Anulaciones y Reversas', $html);
        $this->assertStringNotContainsString('Resumen de Auditoria', $html);
        $this->assertStringNotContainsString('Motivo ejecutivo reservado', $html);
    }

    public function test_executive_pdf_builder_uses_safe_defaults_for_structured_payload_values(): void
    {
        $html = app(ExecutivePdfExportService::class)->buildHtml([
            'period' => ['from' => ['invalid'], 'to' => ['invalid']],
            'summary' => ['billed_total' => ['invalid'], 'invoice_count' => ['invalid']],
            'comparison' => ['billed' => ['delta_percentage' => ['invalid']]],
            'payment_methods' => [['label' => ['invalid'], 'amount' => ['invalid']]],
            'daily_trend' => [['date' => ['invalid'], 'billed' => ['invalid']]],
            'services' => ['top_by_amount' => [['service' => ['invalid']]]],
            'cashiers' => [['name' => ['invalid']]],
            'cash_sessions' => [['cashier' => ['invalid'], 'counted_cash' => ['invalid']]],
            'pending_aging' => ['items' => [['invoice_number' => ['invalid']]]],
            'voids_and_reversals' => [['invoice_number' => ['invalid'], 'amount' => ['invalid']]],
            'audit_summary' => ['critical_events' => ['invalid']],
            'accounting_policy' => ['billed_definition' => ['invalid']],
            'can_view_audit' => true,
        ], [
            'hospital_name' => ['invalid'],
            'rtn' => ['invalid'],
            'address' => ['invalid'],
        ]);

        $this->assertStringContainsString('Reporte Ejecutivo', $html);
        $this->assertStringContainsString('L. 0.00', $html);
        $this->assertStringNotContainsString('Array', $html);
    }

    public function test_executive_pdf_keeps_formatted_currency_together_in_wide_tables(): void
    {
        $html = app(ExecutivePdfExportService::class)->buildHtml([
            'period' => ['from' => '2026-09-01', 'to' => '2026-09-30'],
            'summary' => [
                'billed_total' => '17267.25',
                'collected_total' => '17267.25',
                'pending_total' => '0.00',
                'voided_total' => '0.00',
                'average_ticket' => '17267.25',
            ],
            'operations' => [[
                'date' => '2026-09-28',
                'invoice_number' => '000-001-01-00000018',
                'patient' => 'Paciente de prueba',
                'cash_session_label' => 'Caja principal',
                'cashier' => 'Cajero de prueba',
                'total' => '17267.25',
                'paid' => '17267.25',
                'balance' => '0.00',
                'status_label' => 'Pagada',
                'receipt_document' => 'REC-A-00000018',
            ]],
            'cashiers' => [[
                'name' => 'Cajero de prueba',
                'collected' => '34551.75',
                'cash' => '34551.75',
                'transfer' => '0.00',
                'card' => '0.00',
                'other' => '0.00',
                'payment_count' => 2,
                'voided_count' => 0,
                'difference_total' => '-34551.75',
            ]],
        ], [], 'QA', Carbon::create(2026, 9, 28, 10, 0, 0, 'America/Tegucigalpa'));

        $this->assertStringContainsString('L. 17,267.25', $html);
        $this->assertStringContainsString('L. 34,551.75', $html);
        $this->assertStringContainsString('- L. 34,551.75', $html);
        $this->assertStringNotContainsString('L. 17267.25', $html);
        $this->assertStringContainsString('class="report-table report-table-wide"', $html);
        $this->assertMatchesRegularExpression(
            '/<td class="money-cell"[^>]*>L\. 17,267\.25<\/td>/',
            $html,
        );
        $this->assertStringContainsString('.report-table .money-cell { font-variant-numeric: tabular-nums; white-space: nowrap; }', $html);
    }

    public function test_gratuities_start_with_a_data_row_and_repeat_the_header_in_continuations(): void
    {
        $gratuities = [];
        for ($index = 1; $index <= 9; $index++) {
            $gratuities[] = [
                'invoice_number' => 'REC-'.str_pad((string) $index, 3, '0', STR_PAD_LEFT),
                'patient' => 'Paciente '.$index,
                'service' => 'Eritropoyetina',
                'category' => 'Medicamentos',
                'quantity' => '1.00',
                'adjustment_value' => '25.00',
                'adjustment_persisted' => true,
                'reason' => 'Receta de diálisis',
            ];
        }

        $html = app(ExecutivePdfExportService::class)->buildHtml([
            'period' => ['from' => '2026-09-01', 'to' => '2026-09-30'],
            'gratuities' => $gratuities,
        ], [], 'QA', Carbon::create(2026, 9, 28, 10, 0, 0, 'America/Tegucigalpa'));

        $gratuitiesHtml = strstr($html, '<h2 class="section-title">Gratuidades</h2>');
        $this->assertIsString($gratuitiesHtml);
        $this->assertStringStartsWith(
            '<h2 class="section-title">Gratuidades</h2>',
            $gratuitiesHtml,
        );
        $this->assertSame(2, substr_count($gratuitiesHtml, '<th style="text-align:left;">N Factura</th>'));
        $this->assertSame(1, substr_count($gratuitiesHtml, 'REC-001'));
        $this->assertSame(1, substr_count($gratuitiesHtml, 'REC-009'));
        $this->assertMatchesRegularExpression(
            '/<div class="keep-together"><div class="section-heading"><h2 class="section-title">Gratuidades<\/h2>.*?<tbody>.*?REC-001/s',
            $html,
        );
    }

    public function test_executive_pdf_generic_reports_view_without_concrete_permission_is_forbidden(): void
    {
        $this->seedBillingBase();
        $viewer = User::factory()->create();
        $this->grantDirectPermissions($viewer, ['reports.view', 'reports.export']);

        $today = Carbon::now('America/Tegucigalpa')->toDateString();

        $this->actingAs($viewer)
            ->getJson('/api/reports/executive/pdf?date_from='.$today.'&date_to='.$today)
            ->assertForbidden();
    }

    public function test_executive_pdf_requires_managerial_permission(): void
    {
        $this->seedBillingBase();
        $cashier = $this->cashier();

        $today = Carbon::now('America/Tegucigalpa')->toDateString();

        $this->actingAs($cashier)
            ->getJson('/api/reports/executive/pdf?date_from='.$today.'&date_to='.$today)
            ->assertForbidden();
    }

    public function test_executive_pdf_requires_reports_export_permission(): void
    {
        $this->seedBillingBase();
        $viewer = $this->reportsViewer();

        $today = Carbon::now('America/Tegucigalpa')->toDateString();

        $this->actingAs($viewer)
            ->getJson('/api/reports/executive/pdf?date_from='.$today.'&date_to='.$today)
            ->assertForbidden();
    }

    public function test_executive_pdf_rejects_far_future_date_to_when_date_from_is_malformed(): void
    {
        $this->seedBillingBase();
        $admin = $this->admin();

        $this->actingAs($admin)
            ->getJson('/api/reports/executive/pdf?date_from=fecha-mala&date_to='.now()->addYear()->toDateString())
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['date_from', 'date_to']);
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

    private function reportsViewer(): User
    {
        $user = User::factory()->create();
        $this->grantDirectPermissions($user, [
            'reports.view',
            'reports.managerial.view',
        ]);

        return $user->refresh();
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
