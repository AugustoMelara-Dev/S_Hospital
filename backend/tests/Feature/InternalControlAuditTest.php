<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\CashRegisterSession;
use App\Models\FiscalSequence;
use App\Models\FiscalSetting;
use App\Models\InstitutionalReceiptSeries;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\Service;
use App\Models\User;
use Database\Seeders\ReceiptPrintProfileSeeder;
use Database\Seeders\RolesAndPermissionsSeeder;
use Database\Seeders\ServiceCatalogSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class InternalControlAuditTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->withoutMiddleware(ThrottleRequests::class);
    }

    public function test_roles_include_auditor_and_technical_support_with_read_only_scopes(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);

        $auditor = Role::findByName('auditor', 'web');
        $support = Role::findByName('soporte_tecnico', 'web');

        $this->assertTrue($auditor->hasPermissionTo('audit.view'));
        $this->assertTrue($auditor->hasPermissionTo('reports.managerial.view'));
        $this->assertTrue($auditor->hasPermissionTo('backups.view'));
        $this->assertFalse($auditor->hasPermissionTo('invoices.create'));
        $this->assertFalse($auditor->hasPermissionTo('settings.fiscal.update'));

        $this->assertTrue($support->hasPermissionTo('system.status.view'));
        $this->assertFalse($support->hasPermissionTo('cash.open'));
        $this->assertFalse($support->hasPermissionTo('invoices.create'));
        $this->assertFalse($support->hasPermissionTo('backups.create'));
    }

    public function test_successful_and_failed_login_attempts_are_audited_with_result_and_device_context(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $user = User::factory()->create([
            'username' => 'cajero1',
            'password' => bcrypt('Password123!'),
        ]);
        $user->assignRole('cajero');

        $this->withHeader('User-Agent', 'Caja-LAN/1.0')
            ->postJson('/api/auth/login', [
                'login' => 'cajero1',
                'password' => 'wrong-password',
            ])
            ->assertUnprocessable();

        $this->withHeader('User-Agent', 'Caja-LAN/1.0')
            ->postJson('/api/auth/login', [
                'login' => 'cajero1',
                'password' => 'Password123!',
            ])
            ->assertOk();

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'auth.login_failed',
            'result' => 'failed',
            'ip_address' => '127.0.0.1',
            'user_agent' => 'Caja-LAN/1.0',
        ]);

        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $user->id,
            'action' => 'auth.login_success',
            'result' => 'success',
            'ip_address' => '127.0.0.1',
            'user_agent' => 'Caja-LAN/1.0',
        ]);
    }

    public function test_admin_user_lifecycle_changes_are_audited_with_before_and_after_values(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $admin = User::factory()->create();
        $admin->assignRole('admin');

        $response = $this->actingAs($admin)
            ->withHeader('User-Agent', 'Admin-LAN/2.0')
            ->postJson('/api/admin/users', [
                'name' => 'Auditor Interno',
                'email' => 'auditor@example.test',
                'username' => 'auditor',
                'password' => 'Password123!',
                'password_confirmation' => 'Password123!',
                'role' => 'auditor',
                'active' => true,
            ])
            ->assertCreated();

        $createdUserId = $response->json('data.id');

        $this->actingAs($admin)
            ->withHeader('User-Agent', 'Admin-LAN/2.0')
            ->patchJson("/api/admin/users/{$createdUserId}", [
                'name' => 'Auditor Consulta',
                'email' => 'auditor@example.test',
                'username' => 'auditor',
                'role' => 'auditor',
            ])
            ->assertOk();

        $this->actingAs($admin)
            ->withHeader('User-Agent', 'Admin-LAN/2.0')
            ->postJson("/api/admin/users/{$createdUserId}/toggle-active", [
                'reason' => 'Cambio temporal de funciones',
            ])
            ->assertOk()
            ->assertJsonPath('data.active', false);

        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $admin->id,
            'action' => 'user.created',
            'entity_type' => User::class,
            'entity_id' => $createdUserId,
            'result' => 'success',
            'ip_address' => '127.0.0.1',
        ]);
        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $admin->id,
            'action' => 'user.updated',
            'entity_type' => User::class,
            'entity_id' => $createdUserId,
            'result' => 'success',
        ]);
        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $admin->id,
            'action' => 'user.deactivated',
            'entity_type' => User::class,
            'entity_id' => $createdUserId,
            'result' => 'success',
            'reason' => 'Cambio temporal de funciones',
        ]);

        $updatedAudit = AuditLog::query()
            ->where('action', 'user.updated')
            ->where('entity_id', $createdUserId)
            ->firstOrFail();

        $this->assertSame('Auditor Interno', $updatedAudit->old_values['name']);
        $this->assertSame('Auditor Consulta', $updatedAudit->new_values['name']);
        $this->assertArrayNotHasKey('password', $updatedAudit->new_values);
    }

    public function test_cash_difference_creates_dedicated_audit_event_with_required_reason(): void
    {
        $this->seedBillingBase();
        $this->enableInstitutionalReceiptIssuing();
        $cashier = $this->cashier();
        $sessionId = $this->openSession($cashier, '500.00');
        $invoiceId = $this->createInvoice($cashier, 'Glucosa');

        $this->actingAs($cashier)
            ->postJson("/api/invoices/{$invoiceId}/payments", [
                'cash_session_id' => $sessionId,
                'method' => Payment::METHOD_CASH,
                'amount' => '17.25',
            ])
            ->assertCreated()
            ->assertJsonPath('data.institutional_receipt.receipt_number_full', 'REC-A-00000001');

        $this->actingAs($cashier)
            ->withHeader('User-Agent', 'Caja-Cierre/1.0')
            ->postJson("/api/cash-sessions/{$sessionId}/close", [
                'closing_amount' => '520.00',
                'notes' => 'Sobrante contado por supervisor',
            ])
            ->assertOk();

        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $cashier->id,
            'action' => 'cash_session.difference',
            'entity_type' => CashRegisterSession::class,
            'entity_id' => $sessionId,
            'reason' => 'Sobrante contado por supervisor',
            'result' => 'success',
            'user_agent' => 'Caja-Cierre/1.0',
        ]);
    }

    public function test_critical_billing_receipt_and_fiscal_events_keep_device_context(): void
    {
        $this->seedBillingBase();
        $cashier = $this->cashier();
        $admin = User::factory()->create();
        $admin->assignRole('admin');

        $sessionId = $this->actingAs($cashier)
            ->withHeader('User-Agent', 'Caja-Flujo/3.0')
            ->postJson('/api/cash-sessions/open', ['opening_amount' => '500.00'])
            ->assertCreated()
            ->json('data.id');

        $service = Service::query()->where('name', 'Glucosa')->firstOrFail();
        $invoiceId = $this->actingAs($cashier)
            ->withHeader('User-Agent', 'Caja-Flujo/3.0')
            ->postJson('/api/invoices', [
                'patient_name' => 'Maria Lopez',
                'items' => [[
                    'service_id' => $service->id,
                    'quantity' => '1.00',
                ]],
            ])
            ->assertCreated()
            ->json('data.id');

        $this->actingAs($cashier)
            ->withHeader('User-Agent', 'Caja-Flujo/3.0')
            ->postJson("/api/invoices/{$invoiceId}/payments", [
                'cash_session_id' => $sessionId,
                'method' => Payment::METHOD_CASH,
                'amount' => '17.25',
            ])
            ->assertCreated();

        $this->actingAs($cashier)
            ->withHeader('User-Agent', 'Caja-Flujo/3.0')
            ->postJson("/api/invoices/{$invoiceId}/reprint", [
                'width' => 'half_letter',
                'reason' => 'Copia para paciente',
            ])
            ->assertOk();

        $this->actingAs($admin)
            ->withHeader('User-Agent', 'Admin-Fiscal/4.0')
            ->putJson('/api/settings/fiscal', [
                'hospital_name' => 'Hospital San Isidro Controlado',
                'rtn' => '08011999123456',
                'default_tax_rate' => '15.00',
                'primary_color' => 'teal',
                'address' => 'Barrio El Centro',
                'slogan' => 'Servicio institucional',
                'receipt_template_mode' => 'institutional',
                'government_line' => 'Gobierno de Honduras',
                'secretariat_line' => 'Secretaria de Salud',
                'receipt_location' => 'Tocoa, Colon',
                'receipt_footer_text' => 'Gracias por su pago',
            ])
            ->assertOk();

        foreach ([
            ['action' => 'cash_session.opened', 'entity_type' => CashRegisterSession::class, 'user_agent' => 'Caja-Flujo/3.0'],
            ['action' => 'invoice.issued', 'entity_type' => Invoice::class, 'user_agent' => 'Caja-Flujo/3.0'],
            ['action' => 'payment.registered', 'entity_type' => Payment::class, 'user_agent' => 'Caja-Flujo/3.0'],
            ['action' => 'invoice.reprinted', 'entity_type' => Invoice::class, 'user_agent' => 'Caja-Flujo/3.0', 'reason' => 'Copia para paciente'],
            ['action' => 'fiscal_settings.updated', 'entity_type' => FiscalSetting::class, 'user_agent' => 'Admin-Fiscal/4.0'],
        ] as $auditRow) {
            $this->assertDatabaseHas('audit_logs', [
                ...$auditRow,
                'result' => 'success',
                'ip_address' => '127.0.0.1',
            ]);
        }
    }

    public function test_auditor_can_view_audit_report_but_cannot_invoice_or_operate_cash(): void
    {
        $this->seedBillingBase();
        $auditor = User::factory()->create();
        $auditor->assignRole('auditor');

        $this->actingAs($auditor)
            ->getJson('/api/reports/operations?date_from='.now()->toDateString().'&date_to='.now()->toDateString())
            ->assertOk();

        $service = Service::query()->where('name', 'Glucosa')->firstOrFail();

        $this->actingAs($auditor)
            ->postJson('/api/invoices', [
                'patient_name' => 'Paciente Auditor',
                'items' => [[
                    'service_id' => $service->id,
                    'quantity' => '1.00',
                ]],
            ])
            ->assertForbidden();

        $this->actingAs($auditor)
            ->postJson('/api/cash-sessions/open', ['opening_amount' => '0.00'])
            ->assertForbidden();
    }

    public function test_payment_void_requires_permission_reason_and_reconciles_invoice_and_cash_audit(): void
    {
        $this->seedBillingBase();
        $cashier = $this->cashier();
        $supervisor = User::factory()->create();
        $supervisor->assignRole('supervisor');
        $sessionId = $this->openSession($cashier, '500.00');
        $invoiceId = $this->createInvoice($cashier, 'Glucosa');

        $paymentId = $this->actingAs($cashier)
            ->postJson("/api/invoices/{$invoiceId}/payments", [
                'cash_session_id' => $sessionId,
                'method' => Payment::METHOD_CASH,
                'amount' => '17.25',
            ])
            ->assertCreated()
            ->json('data.payment.id');

        $this->actingAs($cashier)
            ->postJson("/api/payments/{$paymentId}/void", ['reason' => 'Error de cobro'])
            ->assertForbidden();

        $this->actingAs($supervisor)
            ->postJson("/api/payments/{$paymentId}/void", ['reason' => 'Error de cobro'])
            ->assertOk()
            ->assertJsonPath('data.payment.status', Payment::STATUS_VOID)
            ->assertJsonPath('data.invoice.status', Invoice::STATUS_ISSUED)
            ->assertJsonPath('data.invoice.paid_amount', '0.00')
            ->assertJsonPath('data.invoice.balance_due', '17.25');

        $this->assertDatabaseHas('payments', [
            'id' => $paymentId,
            'status' => Payment::STATUS_VOID,
            'void_reason' => 'Error de cobro',
            'voided_by' => $supervisor->id,
        ]);
        $this->assertDatabaseHas('cash_movements', [
            'cash_session_id' => $sessionId,
            'payment_id' => $paymentId,
            'type' => 'payment_void',
            'amount' => '-17.25',
        ]);
        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $supervisor->id,
            'action' => 'payment.voided',
            'entity_type' => Payment::class,
            'entity_id' => $paymentId,
            'reason' => 'Error de cobro',
            'result' => 'success',
        ]);
    }

    private function seedBillingBase(): void
    {
        $this->seed([RolesAndPermissionsSeeder::class, ServiceCatalogSeeder::class]);
        FiscalSetting::query()->create([
            'hospital_name' => 'Hospital San Isidro',
            'rtn' => '08011999123456',
            'default_tax_rate' => '15.00',
            'receipt_width' => '80mm',
        ]);
        FiscalSequence::query()->create([
            'document_type' => 'invoice',
            'prefix' => '000-001-01',
            'min_number' => 1,
            'max_number' => 99999999,
            'current_number' => 0,
            'cai' => 'REAL-CAI-2026',
            'valid_until' => now()->addYear()->toDateString(),
            'active' => true,
        ]);
    }

    private function enableInstitutionalReceiptIssuing(): void
    {
        $this->seed(ReceiptPrintProfileSeeder::class);
        FiscalSetting::query()->update([
            'receipt_template_mode' => 'institutional',
            'receipt_paper_size' => 'half_letter',
            'government_line' => 'Gobierno de Honduras',
            'secretariat_line' => 'Secretaria de Salud',
            'receipt_location' => 'Tocoa, Colon',
            'receipt_footer_text' => 'Original: Oficina Recaudadora',
        ]);
        InstitutionalReceiptSeries::query()->create([
            'document_type' => InstitutionalReceiptSeries::DOCUMENT_TYPE,
            'series' => 'REC-A',
            'prefix' => 'RA',
            'number_format' => '{series}-{number:08}',
            'min_number' => 1,
            'max_number' => 100,
            'current_number' => 0,
            'range_authorization' => 'AUT-REC',
            'legal_text' => 'CERTIFICA haber enterado en esta oficina la suma de',
            'receipt_number_color' => '#b91c1c',
            'active' => true,
        ]);
    }

    private function cashier(): User
    {
        $cashier = User::factory()->create();
        $cashier->assignRole('cajero');

        return $cashier;
    }

    private function openSession(User $cashier, string $openingAmount): int
    {
        return $this->actingAs($cashier)
            ->postJson('/api/cash-sessions/open', ['opening_amount' => $openingAmount])
            ->assertCreated()
            ->json('data.id');
    }

    private function createInvoice(User $cashier, string $serviceName): int
    {
        return $this->actingAs($cashier)
            ->postJson('/api/invoices', [
                'patient_name' => 'Maria Lopez',
                'items' => [[
                    'service_id' => Service::query()->where('name', $serviceName)->firstOrFail()->id,
                    'quantity' => '1.00',
                ]],
            ])
            ->assertCreated()
            ->json('data.id');
    }
}
