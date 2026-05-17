<?php

namespace Tests\Feature;

use App\Models\CashMovement;
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

class CashPaymentsReceiptTest extends TestCase
{
    use RefreshDatabase;

    public function test_cashier_can_open_cash_session_and_cannot_open_two(): void
    {
        $this->seedBillingBase();
        $cashier = $this->cashier();

        $this->actingAs($cashier)
            ->postJson('/api/cash-sessions/open', [
                'opening_amount' => '500.00',
                'notes' => 'Inicio turno',
            ])
            ->assertCreated()
            ->assertJsonPath('data.status', CashRegisterSession::STATUS_OPEN)
            ->assertJsonPath('data.opening_amount', '500.00');

        $this->assertDatabaseHas('cash_movements', [
            'user_id' => $cashier->id,
            'type' => CashMovement::TYPE_OPENING,
            'amount' => '500.00',
        ]);
        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $cashier->id,
            'action' => 'cash_session.opened',
            'entity_type' => CashRegisterSession::class,
        ]);

        $this->actingAs($cashier)
            ->postJson('/api/cash-sessions/open', ['opening_amount' => '100.00'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('cash_session');
    }

    public function test_closing_cash_session_calculates_expected_and_difference(): void
    {
        $this->seedBillingBase();
        $cashier = $this->cashier();
        $sessionId = $this->openSession($cashier, '500.00');
        $invoiceId = $this->createInvoice($cashier, 'Glucosa');

        $this->actingAs($cashier)
            ->postJson("/api/invoices/{$invoiceId}/payments", [
                'cash_session_id' => $sessionId,
                'method' => Payment::METHOD_CASH,
                'amount' => '17.25',
            ])
            ->assertCreated();

        $this->actingAs($cashier)
            ->postJson("/api/cash-sessions/{$sessionId}/close", [
                'closing_amount' => '520.00',
                'notes' => 'Sobra contado',
            ])
            ->assertOk()
            ->assertJsonPath('data.status', CashRegisterSession::STATUS_CLOSED)
            ->assertJsonPath('data.expected_amount', '517.25')
            ->assertJsonPath('data.difference_amount', '2.75');

        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $cashier->id,
            'action' => 'cash_session.closed',
            'entity_type' => CashRegisterSession::class,
        ]);
    }

    public function test_payment_requires_an_open_own_cash_session(): void
    {
        $this->seedBillingBase();
        $cashier = $this->cashier();
        $otherCashier = $this->cashier();
        $invoiceId = $this->createInvoice($cashier, 'Glucosa');

        $this->actingAs($cashier)
            ->postJson("/api/invoices/{$invoiceId}/payments", [
                'cash_session_id' => 999,
                'method' => Payment::METHOD_CASH,
                'amount' => '1.00',
            ])
            ->assertUnprocessable();

        $otherSessionId = $this->openSession($otherCashier, '100.00');

        $this->actingAs($cashier)
            ->postJson("/api/invoices/{$invoiceId}/payments", [
                'cash_session_id' => $otherSessionId,
                'method' => Payment::METHOD_CASH,
                'amount' => '1.00',
            ])
            ->assertForbidden();

        $ownSessionId = $this->openSession($cashier, '100.00');
        $this->actingAs($cashier)
            ->postJson("/api/cash-sessions/{$ownSessionId}/close", ['closing_amount' => '100.00'])
            ->assertOk();

        $this->actingAs($cashier)
            ->postJson("/api/invoices/{$invoiceId}/payments", [
                'cash_session_id' => $ownSessionId,
                'method' => Payment::METHOD_CASH,
                'amount' => '1.00',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('cash_session_id');
    }

    public function test_register_payment_creates_cash_movement_and_updates_partial_then_paid_invoice(): void
    {
        $this->seedBillingBase();
        $cashier = $this->cashier();
        $sessionId = $this->openSession($cashier, '500.00');
        $invoiceId = $this->createInvoice($cashier, 'Glucosa');

        $this->actingAs($cashier)
            ->postJson("/api/invoices/{$invoiceId}/payments", [
                'cash_session_id' => $sessionId,
                'method' => Payment::METHOD_CASH,
                'amount' => '10.00',
            ])
            ->assertCreated()
            ->assertJsonPath('data.invoice.status', Invoice::STATUS_PARTIAL)
            ->assertJsonPath('data.invoice.paid_amount', '10.00')
            ->assertJsonPath('data.invoice.balance_due', '7.25');

        $this->assertDatabaseHas('payments', [
            'invoice_id' => $invoiceId,
            'cash_session_id' => $sessionId,
            'user_id' => $cashier->id,
            'method' => Payment::METHOD_CASH,
            'amount' => '10.00',
        ]);
        $this->assertDatabaseHas('cash_movements', [
            'cash_session_id' => $sessionId,
            'type' => CashMovement::TYPE_PAYMENT,
            'method' => Payment::METHOD_CASH,
            'amount' => '10.00',
        ]);

        $this->actingAs($cashier)
            ->postJson("/api/invoices/{$invoiceId}/payments", [
                'cash_session_id' => $sessionId,
                'method' => Payment::METHOD_TRANSFER,
                'amount' => '7.25',
                'reference' => 'TRX-1',
            ])
            ->assertCreated()
            ->assertJsonPath('data.invoice.status', Invoice::STATUS_PAID)
            ->assertJsonPath('data.invoice.paid_amount', '17.25')
            ->assertJsonPath('data.invoice.balance_due', '0.00');

        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $cashier->id,
            'action' => 'payment.registered',
            'entity_type' => Payment::class,
        ]);
    }

    public function test_payment_rejects_invalid_amounts_overpayment_void_and_paid_invoices(): void
    {
        $this->seedBillingBase();
        $cashier = $this->cashier();
        $sessionId = $this->openSession($cashier, '500.00');
        $invoiceId = $this->createInvoice($cashier, 'Glucosa');

        $this->actingAs($cashier)
            ->postJson("/api/invoices/{$invoiceId}/payments", [
                'cash_session_id' => $sessionId,
                'method' => Payment::METHOD_CASH,
                'amount' => '0.00',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('amount');

        $this->actingAs($cashier)
            ->postJson("/api/invoices/{$invoiceId}/payments", [
                'cash_session_id' => $sessionId,
                'method' => Payment::METHOD_CASH,
                'amount' => '18.00',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('amount');

        Invoice::query()->whereKey($invoiceId)->update(['status' => Invoice::STATUS_VOID]);

        $this->actingAs($cashier)
            ->postJson("/api/invoices/{$invoiceId}/payments", [
                'cash_session_id' => $sessionId,
                'method' => Payment::METHOD_CASH,
                'amount' => '1.00',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('invoice');

        $paidInvoiceId = $this->createInvoice($cashier, 'Hemograma Completo');
        $this->actingAs($cashier)
            ->postJson("/api/invoices/{$paidInvoiceId}/payments", [
                'cash_session_id' => $sessionId,
                'method' => Payment::METHOD_CASH,
                'amount' => '11.50',
            ])
            ->assertCreated();

        $this->actingAs($cashier)
            ->postJson("/api/invoices/{$paidInvoiceId}/payments", [
                'cash_session_id' => $sessionId,
                'method' => Payment::METHOD_CASH,
                'amount' => '1.00',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('invoice');
    }

    public function test_permissions_are_required_for_cash_and_payments(): void
    {
        $this->seedBillingBase();
        $user = User::factory()->create();
        $cashier = $this->cashier();
        $sessionId = $this->openSession($cashier, '100.00');
        $invoiceId = $this->createInvoice($cashier, 'Glucosa');

        $this->actingAs($user)
            ->postJson('/api/cash-sessions/open', ['opening_amount' => '100.00'])
            ->assertForbidden();

        $this->actingAs($user)
            ->postJson("/api/cash-sessions/{$sessionId}/close", ['closing_amount' => '100.00'])
            ->assertForbidden();

        $this->actingAs($user)
            ->postJson("/api/invoices/{$invoiceId}/payments", [
                'cash_session_id' => $sessionId,
                'method' => Payment::METHOD_CASH,
                'amount' => '1.00',
            ])
            ->assertForbidden();
    }

    public function test_receipt_uses_invoice_item_snapshots_and_supports_80mm_and_58mm(): void
    {
        $this->seedBillingBase();
        $cashier = $this->cashier();
        $sessionId = $this->openSession($cashier, '500.00');
        $invoiceId = $this->createInvoice($cashier, 'Glucosa');
        Service::query()->where('name', 'Glucosa')->update(['name' => 'Glucosa Cambiada', 'price' => '99.00']);

        $this->actingAs($cashier)
            ->postJson("/api/invoices/{$invoiceId}/payments", [
                'cash_session_id' => $sessionId,
                'method' => Payment::METHOD_CASH,
                'amount' => '17.25',
            ])
            ->assertCreated();

        $this->actingAs($cashier)
            ->getJson("/api/invoices/{$invoiceId}/receipt?width=80mm")
            ->assertOk()
            ->assertJsonPath('data.width', '80mm')
            ->assertJsonPath('data.hospital.name', 'Hospital Demo')
            ->assertJsonPath('data.hospital.rtn', '08011999123456')
            ->assertJsonPath('data.fiscal.cai', 'TEST-CAI')
            ->assertJsonPath('data.fiscal.authorized_range', '000-001-01-00000001 a 000-001-01-99999999')
            ->assertJsonPath('data.items.0.service_name', 'Glucosa')
            ->assertJsonPath('data.items.0.unit_price', '15.00')
            ->assertJsonPath('data.invoice.balance_due', '0.00')
            ->assertJsonCount(1, 'data.payments');

        $this->actingAs($cashier)
            ->getJson("/api/invoices/{$invoiceId}/receipt?width=58mm")
            ->assertOk()
            ->assertJsonPath('data.width', '58mm');
    }

    private function seedBillingBase(): void
    {
        $this->seed([RolesAndPermissionsSeeder::class, ServiceCatalogSeeder::class]);
        FiscalSetting::query()->create([
            'hospital_name' => 'Hospital Demo',
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
            'cai' => 'TEST-CAI',
            'valid_until' => now()->addYear()->toDateString(),
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
