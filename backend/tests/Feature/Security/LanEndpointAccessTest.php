<?php

declare(strict_types=1);

namespace Tests\Feature\Security;

use App\Actions\Billing\CreateInvoiceAction;
use App\Models\CashRegisterSession;
use App\Models\FiscalSequence;
use App\Models\FiscalSetting;
use App\Models\Service;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Database\Seeders\ServiceCatalogSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * M-W1-SEC-01 acceptance: LAN endpoint exposure and role scoping.
 *
 * This suite is the executable form of the "endpoint x rol x esperado x
 * observado" table in hospital-ai/evidencia/M-W1-SEC-01/INFORME.md. It uses
 * the real seeded roles (admin/supervisor/auditor/soporte_tecnico/cajero) and
 * synthetic users/fixtures only; it never touches production data.
 *
 * Coverage:
 *  - public liveness payload minimality (no operational detail leaks);
 *  - public branding/logo payload minimality;
 *  - operational endpoints require authentication and the right permission;
 *  - vertical escalation (cajero/soporte_tecnico -> admin/operational surfaces);
 *  - horizontal access (cashier A over cashier B invoice/receipt/payment/cash).
 */
class LanEndpointAccessTest extends TestCase
{
    use RefreshDatabase;

    // ---------------------------------------------------------------------
    // Public payload minimality
    // ---------------------------------------------------------------------

    public function test_public_health_payload_is_liveness_only(): void
    {
        $health = $this->getJson('/api/health')->assertOk();
        $healthKeys = array_keys($health->json());
        sort($healthKeys);
        $this->assertSame(['service', 'status'], $healthKeys);
        $this->assertSame('ok', $health->json('status'));

        $systemHealth = $this->getJson('/api/system/health')->assertOk();
        $keys = array_keys($systemHealth->json('data'));
        sort($keys);
        $this->assertSame(['service', 'status', 'version'], $keys);

        $encoded = json_encode($systemHealth->json(), JSON_THROW_ON_ERROR);
        foreach ([
            'queue',
            'backups',
            'storage',
            'checksum',
            'audit',
            'failed_jobs',
            'pending_migration',
            'php_version',
            'app_url',
            'app_debug',
            'worker_command',
            'scheduler_command',
            'APP_KEY',
            'DB_PASSWORD',
        ] as $forbidden) {
            $this->assertStringNotContainsString($forbidden, $encoded);
        }
    }

    public function test_public_branding_payload_is_minimal_and_has_no_sensitive_fields(): void
    {
        FiscalSetting::query()->create([
            'hospital_name' => 'Hospital General San Isidro',
            'rtn' => '08011999123456',
            'default_tax_rate' => '15.00',
            'primary_color' => '#0f4c5c',
            'address' => 'Barrio El Centro, siga 3',
            'phone' => '2222-3333',
            'slogan' => 'Servicio con vocacion',
            'government_line' => 'Secretaria de Salud',
            'secretariat_line' => 'Hospital General San Isidro',
            'receipt_location' => 'Tegucigalpa',
            'receipt_footer_text' => 'Gracias por su preferencia',
        ]);

        $response = $this->getJson('/api/settings/branding')->assertOk();

        $keys = array_keys((array) $response->json('data'));
        sort($keys);
        $this->assertSame([
            'government_line',
            'hospital_name',
            'primary_color',
            'receipt_location',
            'secretariat_line',
            'slogan',
        ], $keys);

        $response
            ->assertJsonMissingPath('data.rtn')
            ->assertJsonMissingPath('data.address')
            ->assertJsonMissingPath('data.phone')
            ->assertJsonMissingPath('data.receipt_footer_text')
            ->assertJsonMissingPath('data.default_tax_rate');

        $encoded = json_encode($response->json(), JSON_THROW_ON_ERROR);
        foreach (['08011999123456', '2222-3333', 'Barrio El Centro', 'Gracias por su preferencia'] as $forbidden) {
            $this->assertStringNotContainsString($forbidden, $encoded);
        }
    }

    public function test_public_logo_endpoint_exposes_only_the_url(): void
    {
        $response = $this->getJson('/api/settings/logo')->assertOk();

        $this->assertSame(['logo_url'], array_keys($response->json()));
    }

    // ---------------------------------------------------------------------
    // Authentication gate on operational surfaces
    // ---------------------------------------------------------------------

    public function test_operational_and_admin_endpoints_reject_anonymous_access(): void
    {
        $endpoints = [
            '/api/system/health/detail',
            '/api/system/echo-config',
            '/api/system/setup-status',
            '/api/system/status-summary',
            '/api/system/status',
            '/api/system/audit-logs',
            '/api/system/openapi',
            '/api/admin/users',
            '/api/admin/roles',
            '/api/backups',
            '/api/invoices',
            '/api/reports/executive',
        ];

        foreach ($endpoints as $endpoint) {
            $this->getJson($endpoint)->assertUnauthorized();
        }
    }

    // ---------------------------------------------------------------------
    // Vertical scoping with real roles
    // ---------------------------------------------------------------------

    public function test_cajero_cannot_reach_operational_admin_report_or_export_surfaces(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $cajero = $this->userWithRole('cajero');

        $this->actingAs($cajero)->getJson('/api/system/status')->assertForbidden();
        $this->actingAs($cajero)->getJson('/api/system/health/detail')->assertForbidden();
        $this->actingAs($cajero)->getJson('/api/system/audit-logs')->assertForbidden();
        $this->actingAs($cajero)->getJson('/api/admin/users')->assertForbidden();
        $this->actingAs($cajero)->getJson('/api/admin/roles')->assertForbidden();
        $this->actingAs($cajero)->getJson('/api/backups')->assertForbidden();
        $this->actingAs($cajero)->getJson('/api/settings/fiscal')->assertForbidden();
        $this->actingAs($cajero)->getJson('/api/reports/executive')->assertForbidden();
        $this->actingAs($cajero)
            ->getJson('/api/reports/export?date_from=2026-09-01&date_to=2026-09-07')
            ->assertForbidden();
    }

    public function test_soporte_tecnico_can_read_status_detail_but_not_invoices_or_admin(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $soporte = $this->userWithRole('soporte_tecnico');

        $this->actingAs($soporte)->getJson('/api/system/status-summary')->assertOk();
        $this->actingAs($soporte)->getJson('/api/invoices')->assertForbidden();
        $this->actingAs($soporte)->getJson('/api/admin/users')->assertForbidden();
        $this->actingAs($soporte)->getJson('/api/backups')->assertForbidden();
    }

    public function test_operational_settings_read_is_authenticated_only_and_write_is_permission_gated(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        FiscalSetting::query()->create([
            'hospital_name' => 'Hospital General San Isidro',
            'rtn' => '08011999123456',
            'default_tax_rate' => '15.00',
            'primary_color' => '#0f4c5c',
            'scanner_enabled' => false,
            'partial_payments_enabled' => false,
        ]);
        $cajero = $this->userWithRole('cajero');

        // Read is intentionally available to any authenticated session so the
        // POS can render behavior; the payload is limited to non-secret flags.
        $response = $this->actingAs($cajero)->getJson('/api/settings/operational')->assertOk();
        $keys = array_keys((array) $response->json('data'));
        sort($keys);
        $this->assertSame(['default_tax_rate', 'partial_payments_enabled', 'scanner_enabled'], $keys);

        // Write still requires settings.operational.update.
        $this->actingAs($cajero)
            ->putJson('/api/settings/operational', [
                'scanner_enabled' => true,
                'partial_payments_enabled' => true,
            ])
            ->assertForbidden();
    }

    public function test_auditor_reads_are_scoped_and_writes_are_denied(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $auditor = $this->userWithRole('auditor');

        $this->actingAs($auditor)->getJson('/api/invoices')->assertOk();
        $this->actingAs($auditor)->getJson('/api/backups')->assertOk();
        $this->actingAs($auditor)->getJson('/api/system/audit-logs')->assertOk();
        // Read-only role: no catalog management, no user management.
        $this->actingAs($auditor)
            ->postJson('/api/categories', ['name' => 'Categoria sintetica auditor'])
            ->assertForbidden();
        $this->actingAs($auditor)->getJson('/api/admin/users')->assertForbidden();
    }

    // ---------------------------------------------------------------------
    // Horizontal access between cashiers
    // ---------------------------------------------------------------------

    public function test_cajero_cannot_read_or_operate_another_cashiers_invoice(): void
    {
        $this->seedBillingBase();
        $cashierA = $this->userWithRole('cajero');
        $cashierB = $this->userWithRole('cajero');
        $invoiceB = $this->createInvoice($cashierB, 'Paciente Sintetico B', 'Glucosa');
        $sessionA = $this->openSession($cashierA, '100.00');

        // Read: invoice, receipt and its payment list.
        $this->actingAs($cashierA)->getJson("/api/invoices/{$invoiceB}")->assertForbidden();
        $this->actingAs($cashierA)->getJson("/api/invoices/{$invoiceB}/receipt")->assertForbidden();
        $this->actingAs($cashierA)->getJson("/api/invoices/{$invoiceB}/payments")->assertForbidden();

        // Write: void, reverse, reprint, payment.
        $this->actingAs($cashierA)
            ->postJson("/api/invoices/{$invoiceB}/void", ['reason' => 'Intento indebido sintetico'])
            ->assertForbidden();
        $this->actingAs($cashierA)
            ->postJson("/api/invoices/{$invoiceB}/reverse", ['reason' => 'Intento indebido sintetico'])
            ->assertForbidden();
        $this->actingAs($cashierA)
            ->postJson("/api/invoices/{$invoiceB}/reprint", [
                'width' => 'half_letter',
                'reason' => 'Intento indebido sintetico',
            ])
            ->assertForbidden();
        $this->actingAs($cashierA)
            ->postJson("/api/invoices/{$invoiceB}/payments", [
                'cash_session_id' => $sessionA,
                'method' => 'cash',
                'amount' => '10.00',
            ])
            ->assertForbidden();

        // Own invoice on the current operational day stays reachable.
        $invoiceA = $this->createInvoice($cashierA, 'Paciente Sintetico A', 'Hemograma Completo');
        $this->actingAs($cashierA)->getJson("/api/invoices/{$invoiceA}")->assertOk();
        $this->actingAs($cashierA)->getJson("/api/invoices/{$invoiceA}/receipt")->assertOk();
    }

    public function test_cajero_cannot_spend_another_cashiers_cash_session(): void
    {
        $this->seedBillingBase();
        $cashierA = $this->userWithRole('cajero');
        $cashierB = $this->userWithRole('cajero');
        $invoiceA = $this->createInvoice($cashierA, 'Paciente Sintetico A', 'Glucosa');
        $sessionB = $this->openSession($cashierB, '100.00');

        // Client-supplied cash_session_id must not be trusted across users.
        $this->actingAs($cashierA)
            ->postJson("/api/invoices/{$invoiceA}/payments", [
                'cash_session_id' => $sessionB,
                'method' => 'cash',
                'amount' => '10.00',
            ])
            ->assertForbidden();
    }

    public function test_supervisor_can_read_and_operate_any_cashiers_invoice(): void
    {
        $this->seedBillingBase();
        $cashier = $this->userWithRole('cajero');
        $supervisor = $this->userWithRole('supervisor');
        $invoice = $this->createInvoice($cashier, 'Paciente Sintetico C', 'Glucosa');

        $this->actingAs($supervisor)->getJson("/api/invoices/{$invoice}")->assertOk();
        $this->actingAs($supervisor)->getJson("/api/invoices/{$invoice}/receipt")->assertOk();
    }

    // ---------------------------------------------------------------------
    // Helpers (synthetic fixtures)
    // ---------------------------------------------------------------------

    private function seedBillingBase(): void
    {
        $this->seed([RolesAndPermissionsSeeder::class, ServiceCatalogSeeder::class]);
        FiscalSetting::query()->create([
            'receipt_template_mode' => 'thermal',
            'hospital_name' => 'Hospital General San Isidro',
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
            'cai' => 'SYNTHETIC-CAI-M-W1-SEC-01',
            'valid_until' => now()->addYear()->toDateString(),
            'active' => true,
        ]);
    }

    private function userWithRole(string $role): User
    {
        $user = User::factory()->create();
        $user->assignRole($role);

        return $user->refresh()->load('roles.permissions');
    }

    private function openSession(User $cashier, string $openingAmount): int
    {
        $session = CashRegisterSession::query()->firstOrCreate(
            [
                'user_id' => $cashier->id,
                'status' => CashRegisterSession::STATUS_OPEN,
            ],
            [
                'open_user_id' => $cashier->id,
                'opening_amount' => $openingAmount,
                'opened_at' => now(),
            ],
        );

        return $session->id;
    }

    private function createInvoice(User $cashier, string $patientName, string $serviceName): int
    {
        $this->openSession($cashier, '500.00');

        return app(CreateInvoiceAction::class)
            ->execute([
                'patient_name' => $patientName,
                'items' => [[
                    'service_id' => Service::query()->where('name', $serviceName)->firstOrFail()->id,
                    'quantity' => '1.00',
                ]],
            ], $cashier->fresh())
            ->id;
    }
}
