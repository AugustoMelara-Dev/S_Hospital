<?php

namespace Tests\Feature\Reports;

use App\Actions\Billing\CreateInvoiceAction;
use App\Actions\Cash\OpenCashSessionAction;
use App\Actions\Payments\RegisterPaymentAction;
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

class ExecutiveReportTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }

    public function test_executive_endpoint_requires_authentication(): void
    {
        $this->getJson('/api/reports/executive?date_from=2026-06-01&date_to=2026-06-16')
            ->assertUnauthorized();
    }

    public function test_executive_endpoint_validates_date_range(): void
    {
        $this->seedBillingBase();
        $admin = $this->admin();

        $this->actingAs($admin)
            ->getJson('/api/reports/executive')
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['date_from', 'date_to']);

        $this->actingAs($admin)
            ->getJson('/api/reports/executive?date_from=2026-06-16&date_to=2026-06-01')
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['date_to']);

        $this->actingAs($admin)
            ->getJson('/api/reports/executive?date_from=2026-01-01&date_to=2026-12-31')
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['date_to']);

        $this->actingAs($admin)
            ->getJson('/api/reports/executive?date_from=fecha-mala&date_to='.now()->addYear()->toDateString())
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['date_from', 'date_to']);
    }

    public function test_executive_endpoint_returns_full_payload_shape(): void
    {
        $this->seedBillingBase();
        $admin = $this->admin();
        $cashier = $this->cashier();
        $session = $this->openSession($cashier);

        $service = Service::query()->where('active', true)->firstOrFail();
        $invoice = $this->createInvoice($cashier, 'Glucosa');
        $this->payInvoice($cashier, $invoice->id, $session->id, Payment::METHOD_CASH, $invoice->total);

        $today = Carbon::now('America/Tegucigalpa')->toDateString();

        $this->actingAs($admin)
            ->getJson('/api/reports/executive?date_from='.$today.'&date_to='.$today)
            ->assertOk()
            ->assertJsonStructure([
                'data' => [
                    'period' => [
                        'from',
                        'to',
                        'timezone',
                        'days',
                    ],
                    'filters',
                    'comparison' => [
                        'billed' => ['current', 'previous', 'delta_cents', 'delta_percentage'],
                        'collected' => ['current', 'previous', 'delta_cents', 'delta_percentage'],
                        'previous_period' => ['from', 'to'],
                    ],
                    'summary' => [
                        'billed_total',
                        'collected_total',
                        'collected_total_cents',
                        'pending_total',
                        'voided_total',
                        'reversed_total',
                        'invoice_count',
                        'receipt_count',
                        'paid_count',
                        'partial_count',
                        'pending_count',
                        'voided_count',
                        'average_ticket',
                    ],
                    'payment_methods' => [
                        '*' => ['method', 'label', 'amount', 'count', 'percentage'],
                    ],
                    'daily_trend' => [
                        '*' => ['date', 'billed', 'collected', 'pending', 'voided_count', 'invoice_count'],
                    ],
                    'services' => [
                        'top_by_amount',
                        'top_by_quantity',
                        'by_category',
                        'by_area',
                    ],
                    'cashiers' => [
                        '*' => [
                            'user_id',
                            'name',
                            'username',
                            'invoice_count',
                            'payment_count',
                            'collected',
                            'cash',
                            'transfer',
                            'card',
                            'other',
                            'voided_count',
                            'difference_total',
                        ],
                    ],
                    'cash_sessions' => [
                        '*' => [
                            'id',
                            'cashier',
                            'opened_at',
                            'closed_at',
                            'opening_amount',
                            'expected_cash',
                            'counted_cash',
                            'difference',
                            'status',
                            'closure_note',
                        ],
                    ],
                    'pending_aging' => [
                        '0_7_days',
                        '8_30_days',
                        '31_plus_days',
                        'items',
                    ],
                    'voids_and_reversals',
                    'audit_summary' => [
                        'critical_events',
                        'reprints',
                        'fiscal_changes',
                        'cash_differences',
                        'backup_events',
                    ],
                ],
            ]);
    }

    public function test_executive_summary_excludes_voided_invoices_from_billed(): void
    {
        $this->seedBillingBase();
        $admin = $this->admin();
        $cashier = $this->cashier();
        $session = $this->openSession($cashier);

        $good = $this->createInvoice($cashier, 'Glucosa');
        $this->payInvoice($cashier, $good->id, $session->id, Payment::METHOD_CASH, $good->total);

        $voided = $this->createInvoice($cashier, 'Hemograma Completo');
        $this->payInvoice($cashier, $voided->id, $session->id, Payment::METHOD_CARD, $voided->total);
        Invoice::query()->whereKey($voided->id)->update([
            'status' => Invoice::STATUS_VOID,
            'voided_by' => $this->supervisor()->id,
            'voided_at' => now(),
            'void_reason' => 'Prueba ejecutiva',
        ]);

        $today = Carbon::now('America/Tegucigalpa')->toDateString();

        $this->actingAs($admin)
            ->getJson('/api/reports/executive?date_from='.$today.'&date_to='.$today)
            ->assertOk()
            ->assertJsonPath('data.summary.invoice_count', 2)
            ->assertJsonPath('data.summary.paid_count', 1)
            ->assertJsonPath('data.summary.voided_count', 1)
            ->assertJsonPath('data.summary.billed_total', $good->total)
            ->assertJsonPath('data.summary.collected_total', $good->total)
            ->assertJsonPath('data.summary.voided_total', $voided->total)
            ->assertJsonPath('data.payment_methods.0.method', 'cash')
            ->assertJsonPath('data.payment_methods.0.amount', $good->total)
            ->assertJsonPath('data.payment_methods.0.count', 1);
    }

    public function test_executive_summary_counts_invoices_voided_in_range_even_when_issued_earlier(): void
    {
        $this->seedBillingBase();
        $admin = $this->admin();
        $cashier = $this->cashier();
        $voided = $this->createInvoice($cashier, 'Glucosa');

        $voided->update([
            'issued_at' => Carbon::now('America/Tegucigalpa')->subDay(),
            'status' => Invoice::STATUS_VOID,
            'voided_by' => $this->supervisor()->id,
            'voided_at' => Carbon::now('America/Tegucigalpa'),
            'void_reason' => 'Anulacion revisada en cierre diario',
        ]);

        $today = Carbon::now('America/Tegucigalpa')->toDateString();

        $this->actingAs($admin)
            ->getJson('/api/reports/executive?date_from='.$today.'&date_to='.$today)
            ->assertOk()
            ->assertJsonPath('data.summary.invoice_count', 0)
            ->assertJsonPath('data.summary.billed_total', '0.00')
            ->assertJsonPath('data.summary.voided_count', 1)
            ->assertJsonPath('data.summary.voided_total', $voided->total)
            ->assertJsonPath('data.daily_trend.0.invoice_count', 0)
            ->assertJsonPath('data.daily_trend.0.voided_count', 1)
            ->assertJsonPath('data.voids_and_reversals.0.kind', 'void')
            ->assertJsonPath('data.voids_and_reversals.0.invoice_number', $voided->invoice_number);
    }

    public function test_executive_payment_methods_separate_cash_from_others(): void
    {
        $this->seedBillingBase();
        $admin = $this->admin();
        $cashier = $this->cashier();
        $session = $this->openSession($cashier);

        $glucosa = $this->createInvoice($cashier, 'Glucosa');
        $hemo = $this->createInvoice($cashier, 'Hemograma Completo');
        $eritro = $this->createInvoice($cashier, 'Eritropoyetina');

        $this->payInvoice($cashier, $glucosa->id, $session->id, Payment::METHOD_CASH, $glucosa->total);
        $this->payInvoice($cashier, $hemo->id, $session->id, Payment::METHOD_TRANSFER, $hemo->total);
        $this->payInvoice($cashier, $eritro->id, $session->id, Payment::METHOD_CARD, $eritro->total);

        $today = Carbon::now('America/Tegucigalpa')->toDateString();

        $response = $this->actingAs($admin)
            ->getJson('/api/reports/executive?date_from='.$today.'&date_to='.$today)
            ->assertOk();

        $methods = collect($response->json('data.payment_methods'))->pluck('method')->all();
        $this->assertEqualsCanonicalizing(['cash', 'transfer', 'card', 'other'], $methods);

        $cashMethod = collect($response->json('data.payment_methods'))->firstWhere('method', 'cash');
        $this->assertEquals(1, $cashMethod['count']);
        $this->assertEquals($glucosa->total, $cashMethod['amount']);
    }

    public function test_executive_filters_panels_by_cash_session_and_method(): void
    {
        $this->seedBillingBase();
        $admin = $this->admin();
        $cashierA = $this->cashier();
        $cashierB = $this->cashier();
        $sessionA = $this->openSession($cashierA);
        $sessionB = $this->openSession($cashierB);

        $glucosa = $this->createInvoice($cashierA, 'Glucosa');
        $hemograma = $this->createInvoice($cashierB, 'Hemograma Completo');
        $this->payInvoice($cashierA, $glucosa->id, $sessionA->id, Payment::METHOD_CASH, $glucosa->total);
        $this->payInvoice($cashierB, $hemograma->id, $sessionB->id, Payment::METHOD_TRANSFER, $hemograma->total);

        $today = Carbon::now('America/Tegucigalpa')->toDateString();

        $response = $this->actingAs($admin)
            ->getJson('/api/reports/executive?date_from='.$today.'&date_to='.$today.'&cash_session_id='.$sessionA->id.'&method='.Payment::METHOD_CASH)
            ->assertOk();

        $this->assertSame($glucosa->total, $response->json('data.summary.collected_total'));
        $this->assertSame(1, $response->json('data.summary.invoice_count'));
        $this->assertSame(1, $response->json('data.payment_methods.0.count'));
        $this->assertSame('0.00', collect($response->json('data.payment_methods'))->firstWhere('method', Payment::METHOD_TRANSFER)['amount']);
        $this->assertSame(['Glucosa'], collect($response->json('data.services.top_by_amount'))->pluck('service')->all());
        $this->assertSame([$cashierA->id], collect($response->json('data.cashiers'))->pluck('user_id')->all());
        $this->assertSame([$sessionA->id], collect($response->json('data.cash_sessions'))->pluck('id')->all());
    }

    public function test_executive_includes_cash_sessions_with_differences(): void
    {
        $this->seedBillingBase();
        $admin = $this->admin();
        $cashier = $this->cashier();
        $session = $this->openSession($cashier);

        $session->update([
            'status' => CashRegisterSession::STATUS_CLOSED,
            'closed_at' => now(),
            'expected_amount' => '100.00',
            'closing_amount' => '95.00',
            'difference_amount' => '-5.00',
            'closing_notes' => 'Faltante de 5 lempiras',
        ]);

        $today = Carbon::now('America/Tegucigalpa')->toDateString();

        $this->actingAs($admin)
            ->getJson('/api/reports/executive?date_from='.$today.'&date_to='.$today)
            ->assertOk()
            ->assertJsonPath('data.cash_sessions.0.id', $session->id)
            ->assertJsonPath('data.cash_sessions.0.status', 'closed')
            ->assertJsonPath('data.cash_sessions.0.difference', '-5.00')
            ->assertJsonPath('data.cash_sessions.0.closure_note', 'Faltante de 5 lempiras');
    }

    public function test_executive_includes_audit_summary_counts(): void
    {
        $this->seedBillingBase();
        $admin = $this->admin();

        \DB::table('audit_logs')->insert([
            ['action' => 'invoice.reprinted', 'entity_type' => 'invoice', 'entity_id' => 1, 'user_id' => $admin->id, 'created_at' => now()],
            ['action' => 'invoice.voided', 'entity_type' => 'invoice', 'entity_id' => 2, 'user_id' => $admin->id, 'created_at' => now()],
            ['action' => 'backup.created', 'entity_type' => 'backup', 'entity_id' => 1, 'user_id' => $admin->id, 'created_at' => now()],
        ]);

        $today = Carbon::now('America/Tegucigalpa')->toDateString();

        $this->actingAs($admin)
            ->getJson('/api/reports/executive?date_from='.$today.'&date_to='.$today)
            ->assertOk()
            ->assertJsonPath('data.audit_summary.reprints', 1)
            ->assertJsonPath('data.audit_summary.critical_events', 1)
            ->assertJsonPath('data.audit_summary.backup_events', 1);
    }

    public function test_executive_without_audit_view_redacts_audit_details(): void
    {
        $this->seedBillingBase();
        $viewer = User::factory()->create();
        $this->grantDirectPermissions($viewer, [
            'reports.view',
            'reports.managerial.view',
        ]);
        $cashier = $this->cashier();
        $voided = $this->createInvoice($cashier, 'Glucosa');

        $voided->update([
            'status' => Invoice::STATUS_VOID,
            'voided_by' => $this->supervisor()->id,
            'voided_at' => Carbon::now('America/Tegucigalpa'),
            'void_reason' => 'Motivo ejecutivo reservado',
        ]);

        \DB::table('audit_logs')->insert([
            ['action' => 'invoice.voided', 'entity_type' => Invoice::class, 'entity_id' => $voided->id, 'user_id' => $viewer->id, 'created_at' => now()],
        ]);

        $today = Carbon::now('America/Tegucigalpa')->toDateString();

        $this->actingAs($viewer)
            ->getJson('/api/reports/executive?date_from='.$today.'&date_to='.$today)
            ->assertOk()
            ->assertJsonPath('data.can_view_audit', false)
            ->assertJsonCount(0, 'data.voids_and_reversals')
            ->assertJsonPath('data.audit_summary.critical_events', 0)
            ->assertJsonMissing(['reason' => 'Motivo ejecutivo reservado']);
    }

    public function test_executive_cajero_without_managerial_permission_is_forbidden(): void
    {
        $this->seedBillingBase();
        $cashier = $this->cashier();

        $today = Carbon::now('America/Tegucigalpa')->toDateString();

        $this->actingAs($cashier)
            ->getJson('/api/reports/executive?date_from='.$today.'&date_to='.$today)
            ->assertForbidden();
    }

    public function test_executive_supervisor_can_access(): void
    {
        $this->seedBillingBase();
        $supervisor = $this->supervisor();

        $today = Carbon::now('America/Tegucigalpa')->toDateString();

        $this->actingAs($supervisor)
            ->getJson('/api/reports/executive?date_from='.$today.'&date_to='.$today)
            ->assertOk();
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

    private function supervisor(): User
    {
        $supervisor = User::factory()->create();
        $supervisor->assignRole('supervisor');
        $this->grantDirectPermissions($supervisor, [
            'settings.fiscal.view',
            'catalog.view',
            'catalog.manage',
            'invoices.view',
            'invoices.create',
            'invoices.void',
            'cash.view',
            'cash.open',
            'cash.close',
            'cash.close_any',
            'payments.create',
            'payments.view',
            'payments.void',
            'receipts.view',
            'receipts.reprint',
            'receipts.reprint_any',
            'reports.view',
            'reports.managerial.view',
            'reports.cash_session.view',
            'reports.export',
            'audit.view',
        ]);

        return $supervisor->refresh();
    }

    private function openSession(User $cashier): CashRegisterSession
    {
        $existingSession = CashRegisterSession::query()
            ->where('user_id', $cashier->id)
            ->where('status', CashRegisterSession::STATUS_OPEN)
            ->first();

        if ($existingSession instanceof CashRegisterSession) {
            return $existingSession;
        }

        if (CashRegisterSession::query()->where('status', CashRegisterSession::STATUS_OPEN)->exists()) {
            return CashRegisterSession::query()->create([
                'user_id' => $cashier->id,
                'open_user_id' => $cashier->id,
                'opening_amount' => '500.00',
                'status' => CashRegisterSession::STATUS_OPEN,
                'opened_at' => now(),
            ]);
        }

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
