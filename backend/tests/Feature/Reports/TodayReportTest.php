<?php

namespace Tests\Feature\Reports;

use App\Actions\Billing\CreateInvoiceAction;
use App\Actions\Cash\OpenCashSessionAction;
use App\Actions\Payments\RegisterPaymentAction;
use App\Models\BackupLog;
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

class TodayReportTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }

    public function test_today_endpoint_requires_authentication(): void
    {
        $this->getJson('/api/reports/today')->assertUnauthorized();
    }

    public function test_cajero_can_access_today_report_with_minimal_view(): void
    {
        $this->seedBillingBase();

        $cashier = $this->cashier();

        $this->actingAs($cashier)
            ->getJson('/api/reports/today')
            ->assertOk()
            ->assertJsonStructure([
                'data' => [
                    'date',
                    'timezone',
                    'server_time',
                    'cash_session_open',
                    'issued_count',
                    'collected_count',
                    'billed',
                    'collected',
                    'pending',
                    'voided_count',
                    'voided_amount',
                    'reversal_count',
                    'pending_invoice_count',
                    'pending_invoice_amount',
                    'payments_by_method' => [
                        'cash',
                        'transfer',
                        'card',
                        'other',
                    ],
                    'payments_count_by_method' => [
                        'cash',
                        'transfer',
                        'card',
                        'other',
                    ],
                    'backup_pending',
                ],
            ])
            ->assertJsonPath('data.timezone', 'America/Tegucigalpa')
            ->assertJsonPath('data.cash_session_open', false)
            ->assertJsonPath('data.issued_count', 0)
            ->assertJsonPath('data.collected_count', 0)
            ->assertJsonPath('data.billed', '0.00')
            ->assertJsonPath('data.collected', '0.00');
    }

    public function test_today_report_reflects_invoices_payments_and_cash_session(): void
    {
        $this->seedBillingBase();
        $cashier = $this->cashier();
        $session = $this->openSession($cashier);

        $invoice = $this->createInvoice($cashier, 'Glucosa');
        $this->payInvoice($cashier, $invoice->id, $session->id, Payment::METHOD_CASH, '17.25');

        $this->actingAs($cashier)
            ->getJson('/api/reports/today')
            ->assertOk()
            ->assertJsonPath('data.cash_session_open', true)
            ->assertJsonPath('data.cash_session_id', $session->id)
            ->assertJsonPath('data.issued_count', 1)
            ->assertJsonPath('data.collected_count', 1)
            ->assertJsonPath('data.billed', '17.25')
            ->assertJsonPath('data.collected', '17.25')
            ->assertJsonPath('data.payments_by_method.cash', '17.25')
            ->assertJsonPath('data.payments_count_by_method.cash', 1);
    }

    public function test_cashier_today_report_is_scoped_to_own_activity(): void
    {
        $this->seedBillingBase();
        $cashierA = $this->cashier();
        $cashierB = $this->cashier();
        $sessionA = $this->openSession($cashierA);
        $sessionB = $this->openSession($cashierB);

        $invoiceA = $this->createInvoice($cashierA, 'Glucosa');
        $invoiceB = $this->createInvoice($cashierB, 'Glucosa');
        $this->payInvoice($cashierA, $invoiceA->id, $sessionA->id, Payment::METHOD_CASH, '17.25');
        $this->payInvoice($cashierB, $invoiceB->id, $sessionB->id, Payment::METHOD_CARD, '17.25');

        $this->actingAs($cashierA)
            ->getJson('/api/reports/today')
            ->assertOk()
            ->assertJsonPath('data.cash_session_id', $sessionA->id)
            ->assertJsonPath('data.issued_count', 1)
            ->assertJsonPath('data.collected_count', 1)
            ->assertJsonPath('data.billed', '17.25')
            ->assertJsonPath('data.collected', '17.25')
            ->assertJsonPath('data.payments_by_method.cash', '17.25')
            ->assertJsonPath('data.payments_by_method.card', '0.00')
            ->assertJsonPath('data.payments_count_by_method.cash', 1)
            ->assertJsonPath('data.payments_count_by_method.card', 0);

        $this->actingAs($this->admin())
            ->getJson('/api/reports/today')
            ->assertOk()
            ->assertJsonPath('data.issued_count', 2)
            ->assertJsonPath('data.collected_count', 2)
            ->assertJsonPath('data.billed', '34.50')
            ->assertJsonPath('data.collected', '34.50')
            ->assertJsonPath('data.payments_by_method.cash', '17.25')
            ->assertJsonPath('data.payments_by_method.card', '17.25');
    }

    public function test_today_report_excludes_voided_invoices_from_billed(): void
    {
        $this->seedBillingBase();
        $cashier = $this->cashier();
        $session = $this->openSession($cashier);

        $good = $this->createInvoice($cashier, 'Glucosa');
        $voided = $this->createInvoice($cashier, 'Eritropoyetina');

        $this->payInvoice($cashier, $good->id, $session->id, Payment::METHOD_CASH, $good->total);
        $this->payInvoice($cashier, $voided->id, $session->id, Payment::METHOD_CARD, $voided->total);

        Invoice::query()->whereKey($voided->id)->update([
            'status' => Invoice::STATUS_VOID,
            'voided_by' => $this->supervisor()->id,
            'voided_at' => now(),
            'void_reason' => 'Prueba de anulación',
        ]);

        $this->actingAs($this->admin())
            ->getJson('/api/reports/today')
            ->assertOk()
            ->assertJsonPath('data.issued_count', 2)
            ->assertJsonPath('data.billed', $good->total)
            ->assertJsonPath('data.collected', $good->total)
            ->assertJsonPath('data.voided_count', 1)
            ->assertJsonPath('data.voided_amount', $voided->total);
    }

    public function test_today_report_counts_invoices_voided_today_even_when_issued_earlier(): void
    {
        $this->seedBillingBase();
        $cashier = $this->cashier();
        $voided = $this->createInvoice($cashier, 'Glucosa');

        $voided->update([
            'issued_at' => Carbon::now('America/Tegucigalpa')->subDay(),
            'status' => Invoice::STATUS_VOID,
            'voided_by' => $this->supervisor()->id,
            'voided_at' => Carbon::now('America/Tegucigalpa'),
            'void_reason' => 'Correccion administrativa del dia',
        ]);

        $this->actingAs($this->admin())
            ->getJson('/api/reports/today')
            ->assertOk()
            ->assertJsonPath('data.issued_count', 0)
            ->assertJsonPath('data.billed', '0.00')
            ->assertJsonPath('data.voided_count', 1)
            ->assertJsonPath('data.voided_amount', $voided->total);
    }

    public function test_today_report_reports_backup_pending(): void
    {
        $this->seedBillingBase();
        $admin = $this->admin();

        BackupLog::create([
            'filename' => 'pending.sql',
            'disk' => 'local',
            'path' => 'backups/pending.sql',
            'status' => BackupLog::STATUS_PENDING,
            'type' => BackupLog::TYPE_MANUAL,
            'created_by' => $admin->id,
            'created_at' => now()->subHours(3),
            'updated_at' => now()->subHours(3),
        ]);

        $this->actingAs($admin)
            ->getJson('/api/reports/today')
            ->assertOk()
            ->assertJsonPath('data.backup_pending', true);
    }

    public function test_today_report_uses_hospital_timezone_window(): void
    {
        $this->seedBillingBase();
        $cashier = $this->cashier();
        $session = $this->openSession($cashier);

        $invoice = $this->createInvoice($cashier, 'Glucosa');
        $invoice->update([
            'issued_at' => Carbon::now('America/Tegucigalpa')->subDays(2),
        ]);

        $this->actingAs($cashier)
            ->getJson('/api/reports/today')
            ->assertOk()
            ->assertJsonPath('data.issued_count', 0)
            ->assertJsonPath('data.billed', '0.00');

        $invoice->update([
            'issued_at' => Carbon::now('America/Tegucigalpa')->startOfDay()->addHours(8),
        ]);

        $this->actingAs($cashier)
            ->getJson('/api/reports/today')
            ->assertOk()
            ->assertJsonPath('data.issued_count', 1)
            ->assertJsonPath('data.billed', '17.25');
    }

    public function test_today_report_user_without_relevant_permission_is_forbidden(): void
    {
        $this->seedBillingBase();
        $user = User::factory()->create();
        $user->givePermissionTo(Permission::findByName('catalog.view', 'web'));

        $this->actingAs($user)
            ->getJson('/api/reports/today')
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
            'reports.view',
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
