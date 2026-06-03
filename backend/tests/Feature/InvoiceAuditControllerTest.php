<?php

namespace Tests\Feature;

use App\Actions\Billing\CreateInvoiceAction;
use App\Actions\Cash\OpenCashSessionAction;
use App\Models\AuditLog;
use App\Models\CashRegisterSession;
use App\Models\FiscalSequence;
use App\Models\FiscalSetting;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\Service;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Database\Seeders\ServiceCatalogSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class InvoiceAuditControllerTest extends TestCase
{
    use RefreshDatabase;

    public function test_invoice_audit_endpoint_returns_chronological_entries_for_supervisor(): void
    {
        $this->seedBillingBase();
        $cashier = $this->cashier();
        $supervisor = $this->supervisor();
        $invoiceId = $this->createInvoice($cashier, 'Maria Lopez', 'Glucosa');

        // Force one invoice.reprinted and one invoice.voided entry by
        // exercising the same actions a cashier / supervisor would
        // through the public API.
        $this->actingAs($cashier)
            ->postJson("/api/invoices/{$invoiceId}/reprint", [
                'width' => 'half_letter',
                'reason' => 'Copia para paciente',
            ])
            ->assertOk();

        $this->actingAs($supervisor)
            ->postJson("/api/invoices/{$invoiceId}/void", [
                'reason' => 'Anulacion por error de captura',
            ])
            ->assertOk();

        $response = $this->actingAs($supervisor)
            ->getJson("/api/invoices/{$invoiceId}/audit")
            ->assertOk()
            ->assertJsonPath('data.invoice.id', $invoiceId)
            ->assertJsonPath('data.invoice.invoice_number', '000-001-01-00000001');

        $entries = $response->json('data.entries');
        $actions = collect($entries)->pluck('action')->all();
        $this->assertContains('invoice.issued', $actions, 'createInvoice should have logged the initial issue event');
        $this->assertContains('invoice.reprinted', $actions);
        $this->assertContains('invoice.voided', $actions);
        $this->assertSame($supervisor->id, $entries[0]['user']['id'] ?? null);
    }

    public function test_invoice_audit_endpoint_is_forbidden_without_audit_view(): void
    {
        $this->seedBillingBase();
        $cashier = $this->cashier();
        $invoiceId = $this->createInvoice($cashier, 'Maria Lopez', 'Glucosa');

        $this->actingAs($cashier)
            ->getJson("/api/invoices/{$invoiceId}/audit")
            ->assertForbidden();
    }

    public function test_invoice_audit_endpoint_returns_only_own_invoice_for_cashier_without_history_scope(): void
    {
        $this->seedBillingBase();
        $ownCashier = User::factory()->create();
        $ownCashier->givePermissionTo(['invoices.view', 'audit.view']);
        $otherCashier = $this->cashier();
        $admin = $this->admin();
        $ownId = $this->createInvoice($ownCashier, 'Maria Lopez', 'Glucosa');
        $otherId = $this->createInvoice($otherCashier, 'Jose Perez', 'Hemograma Completo');

        // Make the other invoice a historical one so the cashier
        // does not have access to it.
        Invoice::query()->whereKey($otherId)->update(['issued_at' => now()->subDay()]);
        AuditLog::query()->create([
            'user_id' => $admin->id,
            'action' => 'invoice.reprinted',
            'entity_type' => Invoice::class,
            'entity_id' => $otherId,
            'created_at' => now(),
        ]);

        // Own invoice: accessible.
        $this->actingAs($ownCashier)
            ->getJson("/api/invoices/{$ownId}/audit")
            ->assertOk()
            ->assertJsonPath('data.invoice.id', $ownId);

        // Other cashier's invoice from yesterday: forbidden.
        $this->actingAs($ownCashier)
            ->getJson("/api/invoices/{$otherId}/audit")
            ->assertForbidden();
    }

    public function test_invoice_audit_endpoint_requires_authentication(): void
    {
        $this->seedBillingBase();
        $cashier = $this->cashier();
        $invoiceId = $this->createInvoice($cashier, 'Maria Lopez', 'Glucosa');

        $this->getJson("/api/invoices/{$invoiceId}/audit")
            ->assertUnauthorized();
    }

    private function seedBillingBase(): void
    {
        $this->seed([RolesAndPermissionsSeeder::class, ServiceCatalogSeeder::class]);
        FiscalSetting::query()->create([
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

    private function createInvoice(User $cashier, string $patientName, string $serviceName): int
    {
        CashRegisterSession::query()->firstOrCreate(
            [
                'user_id' => $cashier->id,
                'status' => CashRegisterSession::STATUS_OPEN,
            ],
            [
                'open_user_id' => $cashier->id,
                'opening_amount' => '500.00',
                'opened_at' => now(),
            ],
        );

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

    private function admin(): User
    {
        $user = User::factory()->create();
        $user->assignRole('admin');

        return $user->refresh();
    }

    private function supervisor(): User
    {
        $user = User::factory()->create();
        $user->assignRole('supervisor');

        return $user->refresh();
    }

    private function cashier(): User
    {
        $user = User::factory()->create();
        $user->assignRole('cajero');

        return $user->refresh();
    }
}
