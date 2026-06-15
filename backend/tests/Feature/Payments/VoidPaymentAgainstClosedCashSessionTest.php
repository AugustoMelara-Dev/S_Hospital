<?php

namespace Tests\Feature\Payments;

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

class VoidPaymentAgainstClosedCashSessionTest extends TestCase
{
    use RefreshDatabase;

    public function test_void_payment_fails_when_cash_session_is_closed(): void
    {
        $this->seedBillingBase();
        FiscalSetting::query()->update(['partial_payments_enabled' => true]);

        $cashier = $this->cashierUser();
        $session = $this->openSessionFor($cashier, '500.00');
        $paymentId = $this->issueInvoiceAndPayment($cashier, $session);

        CashRegisterSession::query()
            ->whereKey($session)
            ->update([
                'status' => CashRegisterSession::STATUS_CLOSED,
                'closed_at' => now(),
            ]);

        $response = $this->actingAs($cashier)
            ->postJson("/api/payments/{$paymentId}/void", [
                'reason' => 'Test',
            ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['cash_session']);

        $this->assertDatabaseHas('payments', [
            'id' => $paymentId,
            'status' => Payment::STATUS_ACTIVE,
        ]);
    }

    public function test_void_payment_succeeds_when_cash_session_is_still_open(): void
    {
        $this->seedBillingBase();
        FiscalSetting::query()->update(['partial_payments_enabled' => true]);

        $cashier = $this->cashierUser();
        $session = $this->openSessionFor($cashier, '500.00');
        $paymentId = $this->issueInvoiceAndPayment($cashier, $session);

        $this->actingAs($cashier)
            ->postJson("/api/payments/{$paymentId}/void", [
                'reason' => 'Anulacion de prueba',
            ])
            ->assertOk();

        $this->assertDatabaseHas('payments', [
            'id' => $paymentId,
            'status' => Payment::STATUS_VOID,
        ]);
    }

    private function seedBillingBase(): void
    {
        $this->seed([RolesAndPermissionsSeeder::class, ServiceCatalogSeeder::class]);
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

    private function cashierUser(): User
    {
        $cashier = User::factory()->create();
        $cashier->assignRole('cajero');

        return $cashier->refresh();
    }

    private function openSessionFor(User $cashier, string $openingAmount): int
    {
        $session = CashRegisterSession::query()->create([
            'user_id' => $cashier->id,
            'open_user_id' => $cashier->id,
            'opening_amount' => $openingAmount,
            'status' => CashRegisterSession::STATUS_OPEN,
            'opened_at' => now(),
        ]);

        return (int) $session->id;
    }

    private function issueInvoiceAndPayment(User $cashier, int $sessionId): int
    {
        $glucose = Service::query()->where('name', 'Glucosa')->firstOrFail();

        $invoiceId = $this->actingAs($cashier)
            ->postJson('/api/invoices', [
                'patient_name' => 'Maria Lopez',
                'items' => [['service_id' => $glucose->id, 'quantity' => '1.00']],
            ])
            ->assertCreated()
            ->json('data.id');

        $payment = $this->actingAs($cashier)
            ->postJson("/api/invoices/{$invoiceId}/payments", [
                'cash_session_id' => $sessionId,
                'method' => Payment::METHOD_CASH,
                'amount' => '17.25',
            ])
            ->assertCreated()
            ->json('data');

        return (int) $payment['id'];
    }
}
