<?php

namespace Tests\Feature;

use App\Actions\Billing\CreateInvoiceAction;
use App\Actions\Cash\OpenCashSessionAction;
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

class InvoiceHistoryReprintVoidTest extends TestCase
{
    use RefreshDatabase;

    public function test_invoice_history_is_paginated_filtered_and_recent_first(): void
    {
        $this->seedBillingBase();
        $admin = $this->admin();
        $cashier = $this->cashier();
        $firstId = $this->createInvoice($cashier, 'Maria Lopez', 'Glucosa');
        $secondId = $this->createInvoice($cashier, 'Jose Perez', 'Hemograma Completo');

        Invoice::query()->whereKey($firstId)->update([
            'issued_at' => now()->subDay(),
            'status' => Invoice::STATUS_VOID,
            'void_reason' => 'Error de captura',
            'voided_by' => $admin->id,
            'voided_at' => now()->subDay(),
        ]);
        Invoice::query()->whereKey($secondId)->update(['issued_at' => now()]);

        $this->actingAs($admin)
            ->getJson('/api/invoices?date_from='.now()->subDays(2)->toDateString().'&patient=Maria&status=void')
            ->assertOk()
            ->assertJsonPath('meta.current_page', 1)
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('data.0.patient_name', 'Maria Lopez')
            ->assertJsonPath('data.0.status', Invoice::STATUS_VOID);

        $this->actingAs($admin)
            ->getJson('/api/invoices?date_from='.now()->subDays(2)->toDateString().'&invoice_number=00000002')
            ->assertOk()
            ->assertJsonPath('data.0.id', $secondId);
    }

    public function test_cashier_sees_only_own_invoices_from_current_day_by_default(): void
    {
        $this->seedBillingBase();
        $cashier = $this->cashier();
        $otherCashier = $this->cashier();
        $ownTodayId = $this->createInvoice($cashier, 'Maria Lopez', 'Glucosa');
        $ownOldId = $this->createInvoice($cashier, 'Old Patient', 'Hemograma Completo');
        $otherTodayId = $this->createInvoice($otherCashier, 'Other Patient', 'Eritropoyetina');

        Invoice::query()->whereKey($ownOldId)->update(['issued_at' => now()->subDay()]);

        $response = $this->actingAs($cashier)
            ->getJson('/api/invoices?date_from='.now()->subDays(5)->toDateString().'&user_id='.$otherCashier->id)
            ->assertOk()
            ->assertJsonPath('meta.total', 1);

        $ids = collect($response->json('data'))->pluck('id');
        $this->assertTrue($ids->contains($ownTodayId));
        $this->assertFalse($ids->contains($ownOldId));
        $this->assertFalse($ids->contains($otherTodayId));
    }

    public function test_reports_view_does_not_grant_historical_invoice_access(): void
    {
        $this->seedBillingBase();
        $user = User::factory()->create();
        $user->givePermissionTo('invoices.view', 'invoices.create', 'reports.view');
        $otherCashier = $this->cashier();
        $oldId = $this->createInvoice($user, 'Own Old Patient', 'Glucosa');
        $otherTodayId = $this->createInvoice($otherCashier, 'Other Today', 'Hemograma Completo');

        Invoice::query()->whereKey($oldId)->update(['issued_at' => now()->subDay()]);

        $response = $this->actingAs($user)
            ->getJson('/api/invoices?date_from='.now()->subDays(5)->toDateString().'&user_id='.$otherCashier->id)
            ->assertOk()
            ->assertJsonPath('meta.total', 0);

        $ids = collect($response->json('data'))->pluck('id');
        $this->assertFalse($ids->contains($oldId));
        $this->assertFalse($ids->contains($otherTodayId));

        $this->actingAs($user)
            ->getJson("/api/invoices/{$otherTodayId}")
            ->assertForbidden();
    }

    public function test_supervisor_and_admin_can_view_historical_invoices(): void
    {
        $this->seedBillingBase();
        $cashier = $this->cashier();
        $oldId = $this->createInvoice($cashier, 'Maria Lopez', 'Glucosa');
        Invoice::query()->whereKey($oldId)->update(['issued_at' => now()->subDays(3)]);

        $this->actingAs($this->supervisor())
            ->getJson('/api/invoices?date_from='.now()->subDays(5)->toDateString().'&date_to='.now()->toDateString())
            ->assertOk()
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('data.0.id', $oldId);

        $this->actingAs($this->admin())
            ->getJson('/api/invoices?date_from='.now()->subDays(5)->toDateString().'&user_id='.$cashier->id)
            ->assertOk()
            ->assertJsonPath('meta.total', 1);
    }

    public function test_invoice_detail_includes_snapshots_payments_cash_session_status_and_fiscal_data(): void
    {
        $this->seedBillingBase();
        $cashier = $this->cashier();
        $sessionId = $this->openSession($cashier);
        $invoiceId = $this->createInvoice($cashier, 'Maria Lopez', 'Glucosa');

        $this->actingAs($cashier)
            ->postJson("/api/invoices/{$invoiceId}/payments", [
                'cash_session_id' => $sessionId,
                'method' => Payment::METHOD_CASH,
                'amount' => '17.25',
            ])
            ->assertCreated();

        $this->actingAs($cashier)
            ->getJson("/api/invoices/{$invoiceId}")
            ->assertOk()
            ->assertJsonPath('data.items.0.service_name', 'Glucosa')
            ->assertJsonPath('data.payments.0.amount', '17.25')
            ->assertJsonPath('data.cash_session.id', $sessionId)
            ->assertJsonPath('data.status', Invoice::STATUS_PAID)
            ->assertJsonPath('data.fiscal_sequence.cai', 'TEST-CAI');
    }

    public function test_reprint_uses_snapshots_and_writes_audit_log(): void
    {
        $this->seedBillingBase();
        $cashier = $this->cashier();
        $invoiceId = $this->createInvoice($cashier, 'Maria Lopez', 'Glucosa');
        Service::query()->where('name', 'Glucosa')->update(['name' => 'Glucosa Cambiada', 'price' => '99.00']);

        $this->actingAs($cashier)
            ->postJson("/api/invoices/{$invoiceId}/reprint", [
                'width' => 'half_letter',
                'reason' => 'Copia para paciente',
            ])
            ->assertOk()
            ->assertJsonPath('data.receipt.width', 'half_letter')
            ->assertJsonPath('data.receipt.items.0.service_name', 'Glucosa')
            ->assertJsonPath('data.receipt.items.0.unit_price', '15.00')
            ->assertJsonPath('data.audit.action', 'invoice.reprinted');

        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $cashier->id,
            'action' => 'invoice.reprinted',
            'entity_type' => Invoice::class,
            'entity_id' => $invoiceId,
        ]);
    }

    public function test_reprint_uses_invoice_fiscal_snapshot_after_settings_change(): void
    {
        $this->seedBillingBase();
        $cashier = $this->cashier();
        $invoiceId = $this->createInvoice($cashier, 'Maria Lopez', 'Glucosa');

        FiscalSetting::query()->firstOrFail()->update([
            'hospital_name' => 'Hospital Cambiado',
            'rtn' => '99999999999999',
        ]);
        FiscalSequence::query()->where('document_type', 'invoice')->update([
            'prefix' => '999-999-99',
            'min_number' => 50,
            'max_number' => 60,
            'cai' => 'CAI-CAMBIADO',
            'valid_until' => now()->addYears(2)->toDateString(),
        ]);

        $this->actingAs($cashier)
            ->postJson("/api/invoices/{$invoiceId}/reprint", ['width' => 'letter'])
            ->assertOk()
            ->assertJsonPath('data.receipt.hospital.name', 'Hospital San Isidro')
            ->assertJsonPath('data.receipt.hospital.rtn', '08011999123456')
            ->assertJsonPath('data.receipt.fiscal.cai', 'TEST-CAI')
            ->assertJsonPath('data.receipt.fiscal.authorized_range', '000-001-01-00000001 a 000-001-01-99999999')
            ->assertJsonPath('data.receipt.fiscal.valid_until', now()->addYear()->toDateString());
    }

    public function test_reprint_excludes_voided_payments_after_reversal(): void
    {
        $this->seedBillingBase();
        FiscalSetting::query()->update(['partial_payments_enabled' => true]);
        $cashier = $this->cashier();
        $supervisor = $this->supervisor();
        $sessionId = $this->openSession($cashier);
        $invoiceId = $this->createInvoice($cashier, 'Maria Lopez', 'Glucosa');

        $cashPaymentId = $this->actingAs($cashier)
            ->postJson("/api/invoices/{$invoiceId}/payments", [
                'cash_session_id' => $sessionId,
                'method' => Payment::METHOD_CASH,
                'amount' => '10.00',
            ])
            ->assertCreated()
            ->json('data.payment.id');

        $this->actingAs($cashier)
            ->postJson("/api/invoices/{$invoiceId}/payments", [
                'cash_session_id' => $sessionId,
                'method' => Payment::METHOD_TRANSFER,
                'amount' => '7.25',
                'reference' => 'TRX-REPRINT-1',
            ])
            ->assertCreated()
            ->assertJsonPath('data.invoice.status', Invoice::STATUS_PAID);

        $this->actingAs($supervisor)
            ->postJson("/api/invoices/{$invoiceId}/payments/{$cashPaymentId}/void", [
                'reason' => 'Correccion antes de reimpresion',
            ])
            ->assertOk()
            ->assertJsonPath('data.invoice.status', Invoice::STATUS_PARTIAL);

        $this->actingAs($cashier)
            ->postJson("/api/invoices/{$invoiceId}/reprint", [
                'width' => 'half_letter',
                'reason' => 'Copia con pago corregido',
            ])
            ->assertOk()
            ->assertJsonPath('data.audit.action', 'invoice.reprinted')
            ->assertJsonPath('data.receipt.invoice.status', Invoice::STATUS_PARTIAL)
            ->assertJsonPath('data.receipt.invoice.paid_amount', '7.25')
            ->assertJsonPath('data.receipt.invoice.balance_due', '10.00')
            ->assertJsonCount(1, 'data.receipt.payments')
            ->assertJsonPath('data.receipt.payments.0.method', Payment::METHOD_TRANSFER)
            ->assertJsonPath('data.receipt.payments.0.amount', '7.25')
            ->assertJsonPath('data.receipt.payments.0.reference', 'TRX-REPRINT-1');
    }

    public function test_cashier_cannot_reprint_other_or_old_invoice_without_reprint_any(): void
    {
        $this->seedBillingBase();
        $cashier = $this->cashier();
        $otherCashier = $this->cashier();
        $ownOldId = $this->createInvoice($cashier, 'Old Patient', 'Glucosa');
        $otherId = $this->createInvoice($otherCashier, 'Other Patient', 'Hemograma Completo');
        Invoice::query()->whereKey($ownOldId)->update(['issued_at' => now()->subDay()]);

        $this->actingAs($cashier)
            ->postJson("/api/invoices/{$otherId}/reprint", ['width' => 'letter'])
            ->assertForbidden();

        $this->actingAs($cashier)
            ->postJson("/api/invoices/{$ownOldId}/reprint", ['width' => 'letter'])
            ->assertForbidden();
    }

    public function test_supervisor_and_admin_can_reprint_with_permission(): void
    {
        $this->seedBillingBase();
        $cashier = $this->cashier();
        $oldId = $this->createInvoice($cashier, 'Maria Lopez', 'Glucosa');
        Invoice::query()->whereKey($oldId)->update(['issued_at' => now()->subDays(2)]);

        $this->actingAs($this->supervisor())
            ->postJson("/api/invoices/{$oldId}/reprint", ['width' => 'letter'])
            ->assertOk();

        $this->actingAs($this->admin())
            ->postJson("/api/invoices/{$oldId}/reprint", ['width' => 'a5'])
            ->assertOk();

        $this->actingAs($this->admin())
            ->postJson("/api/invoices/{$oldId}/reprint", ['width' => '80mm'])
            ->assertOk()
            ->assertJsonPath('data.receipt.width', '80mm');

        $this->actingAs($this->admin())
            ->postJson("/api/invoices/{$oldId}/reprint", ['width' => '58mm'])
            ->assertOk()
            ->assertJsonPath('data.receipt.width', '58mm');
    }

    public function test_void_requires_permission_and_reason(): void
    {
        $this->seedBillingBase();
        $cashier = $this->cashier();
        $invoiceId = $this->createInvoice($cashier, 'Maria Lopez', 'Glucosa');

        $this->actingAs($cashier)
            ->postJson("/api/invoices/{$invoiceId}/void", ['reason' => 'Error de captura'])
            ->assertForbidden();

        $this->actingAs($this->supervisor())
            ->postJson("/api/invoices/{$invoiceId}/void", ['reason' => ''])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('reason');
    }

    public function test_void_marks_invoice_and_does_not_delete_items(): void
    {
        $this->seedBillingBase();
        $cashier = $this->cashier();
        $supervisor = $this->supervisor();
        $invoiceId = $this->createInvoice($cashier, 'Maria Lopez', 'Glucosa');
        $itemCount = Invoice::query()->findOrFail($invoiceId)->items()->count();

        $this->actingAs($supervisor)
            ->postJson("/api/invoices/{$invoiceId}/void", ['reason' => 'Paciente solicito correccion'])
            ->assertOk()
            ->assertJsonPath('data.status', Invoice::STATUS_VOID)
            ->assertJsonPath('data.void_reason', 'Paciente solicito correccion')
            ->assertJsonPath('data.voided_by.id', $supervisor->id);

        $this->assertDatabaseHas('invoices', [
            'id' => $invoiceId,
            'status' => Invoice::STATUS_VOID,
            'void_reason' => 'Paciente solicito correccion',
            'voided_by' => $supervisor->id,
        ]);
        $this->assertSame($itemCount, Invoice::query()->findOrFail($invoiceId)->items()->count());
        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $supervisor->id,
            'action' => 'invoice.voided',
            'entity_type' => Invoice::class,
            'entity_id' => $invoiceId,
        ]);
    }

    public function test_void_paid_invoice_is_blocked_and_does_not_delete_payments_or_items(): void
    {
        $this->seedBillingBase();
        $cashier = $this->cashier();
        $sessionId = $this->openSession($cashier);
        $invoiceId = $this->createInvoice($cashier, 'Maria Lopez', 'Glucosa');
        $itemCount = Invoice::query()->findOrFail($invoiceId)->items()->count();

        $this->actingAs($cashier)
            ->postJson("/api/invoices/{$invoiceId}/payments", [
                'cash_session_id' => $sessionId,
                'method' => Payment::METHOD_CASH,
                'amount' => '17.25',
            ])
            ->assertCreated();

        $this->actingAs($this->supervisor())
            ->postJson("/api/invoices/{$invoiceId}/void", ['reason' => 'Intento con pago'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('invoice')
            ->assertJsonPath(
                'errors.invoice.0',
                'No se puede anular una factura con pagos registrados sin flujo de reversión.',
            );

        $this->assertDatabaseHas('invoices', [
            'id' => $invoiceId,
            'status' => Invoice::STATUS_PAID,
        ]);
        $this->assertSame(1, Payment::query()->where('invoice_id', $invoiceId)->count());
        $this->assertSame($itemCount, Invoice::query()->findOrFail($invoiceId)->items()->count());
        $this->assertDatabaseHas('audit_logs', [
            'action' => 'invoice.void_blocked_paid',
            'entity_type' => Invoice::class,
            'entity_id' => $invoiceId,
        ]);
    }

    public function test_void_invoice_is_allowed_after_all_payments_are_reversed(): void
    {
        $this->seedBillingBase();
        $cashier = $this->cashier();
        $supervisor = $this->supervisor();
        $sessionId = $this->openSession($cashier);
        $invoiceId = $this->createInvoice($cashier, 'Maria Lopez', 'Glucosa');

        $paymentId = $this->actingAs($cashier)
            ->postJson("/api/invoices/{$invoiceId}/payments", [
                'cash_session_id' => $sessionId,
                'method' => Payment::METHOD_CASH,
                'amount' => '17.25',
            ])
            ->assertCreated()
            ->json('data.payment.id');

        $this->actingAs($supervisor)
            ->postJson("/api/invoices/{$invoiceId}/payments/{$paymentId}/void", [
                'reason' => 'Pago reversado antes de anular factura',
            ])
            ->assertOk()
            ->assertJsonPath('data.invoice.status', Invoice::STATUS_ISSUED)
            ->assertJsonPath('data.invoice.paid_amount', '0.00')
            ->assertJsonPath('data.invoice.balance_due', '17.25');

        $this->actingAs($supervisor)
            ->postJson("/api/invoices/{$invoiceId}/void", [
                'reason' => 'Factura emitida por error y sin cobros vigentes',
            ])
            ->assertOk()
            ->assertJsonPath('data.status', Invoice::STATUS_VOID)
            ->assertJsonPath('data.void_reason', 'Factura emitida por error y sin cobros vigentes')
            ->assertJsonPath('data.payments.0.status', Payment::STATUS_VOID);

        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $supervisor->id,
            'action' => 'invoice.voided',
            'entity_type' => Invoice::class,
            'entity_id' => $invoiceId,
        ]);
    }

    public function test_void_revalidates_payment_state_inside_transaction_before_marking_void(): void
    {
        $this->seedBillingBase();
        $cashier = $this->cashier();
        $sessionId = $this->openSession($cashier);
        $invoiceId = $this->createInvoice($cashier, 'Maria Lopez', 'Glucosa');

        Payment::query()->create([
            'invoice_id' => $invoiceId,
            'cash_session_id' => $sessionId,
            'user_id' => $cashier->id,
            'method' => Payment::METHOD_CASH,
            'amount' => '17.25',
            'status' => Payment::STATUS_POSTED,
            'paid_at' => now(),
        ]);

        $this->actingAs($this->supervisor())
            ->postJson("/api/invoices/{$invoiceId}/void", ['reason' => 'Intento concurrente'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('invoice')
            ->assertJsonPath(
                'errors.invoice.0',
                'No se puede anular una factura con pagos registrados sin flujo de reversión.',
            );

        $this->assertDatabaseHas('invoices', [
            'id' => $invoiceId,
            'status' => Invoice::STATUS_ISSUED,
            'voided_by' => null,
            'voided_at' => null,
        ]);
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

    private function openSession(User $cashier): int
    {
        return app(OpenCashSessionAction::class)
            ->execute(['opening_amount' => '500.00'], $cashier->fresh())
            ->id;
    }

    private function admin(): User
    {
        $admin = User::factory()->create();
        $admin->assignRole('admin');

        return $admin->refresh()->load('roles.permissions');
    }

    private function supervisor(): User
    {
        $supervisor = User::factory()->create();
        $supervisor->assignRole('supervisor');

        return $supervisor->refresh()->load('roles.permissions');
    }

    private function cashier(): User
    {
        $cashier = User::factory()->create();
        $cashier->assignRole('cajero');

        return $cashier->refresh()->load('roles.permissions');
    }
}
