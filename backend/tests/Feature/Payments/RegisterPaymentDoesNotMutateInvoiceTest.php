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

class RegisterPaymentDoesNotMutateInvoiceTest extends TestCase
{
    use RefreshDatabase;

    public function test_invoice_cash_session_id_is_not_overwritten_by_later_payment_in_other_session(): void
    {
        $this->seedBillingBase();
        FiscalSetting::query()->update(['partial_payments_enabled' => true]);

        $cashierA = $this->cashierUser();
        $sessionA = $this->openSessionFor($cashierA, '500.00');

        $glucose = Service::query()->where('name', 'Glucosa')->firstOrFail();
        $invoiceId = $this->actingAs($cashierA)
            ->postJson('/api/invoices', [
                'patient_name' => 'Maria Lopez',
                'items' => [['service_id' => $glucose->id, 'quantity' => '1.00']],
            ])
            ->assertCreated()
            ->json('data.id');

        $invoiceAfterCreate = Invoice::query()->findOrFail($invoiceId);
        $this->assertSame($sessionA, (int) $invoiceAfterCreate->cash_session_id);

        $this->actingAs($cashierA)
            ->postJson("/api/invoices/{$invoiceId}/payments", [
                'cash_session_id' => $sessionA,
                'method' => Payment::METHOD_CASH,
                'amount' => '10.00',
            ])
            ->assertCreated();

        $invoiceAfterFirstPayment = Invoice::query()->findOrFail($invoiceId);
        $this->assertSame($sessionA, (int) $invoiceAfterFirstPayment->cash_session_id, 'Invoice cash_session_id should be A after first payment.');

        $cashierB = $this->cashierWithOperateAny();
        $sessionB = $this->openSessionFor($cashierB, '600.00');

        $this->actingAs($cashierB)
            ->postJson("/api/invoices/{$invoiceId}/payments", [
                'cash_session_id' => $sessionB,
                'method' => Payment::METHOD_CASH,
                'amount' => '7.25',
            ])
            ->assertCreated();

        $invoiceAfterSecondPayment = Invoice::query()->findOrFail($invoiceId);
        $this->assertSame(
            $sessionA,
            (int) $invoiceAfterSecondPayment->cash_session_id,
            'BUG-BA-22: invoice cash_session_id must NOT be overwritten by a payment registered in a different cash session.'
        );

        $payments = Payment::query()->where('invoice_id', $invoiceId)->orderBy('id')->get();
        $this->assertCount(2, $payments);
        $this->assertSame($sessionA, (int) $payments[0]->cash_session_id);
        $this->assertSame($sessionB, (int) $payments[1]->cash_session_id, 'Second payment must keep its own session.');
    }

    public function test_invoice_cash_session_id_remains_unchanged_when_payment_session_differs_from_creation_session(): void
    {
        $this->seedBillingBase();

        $cashierA = $this->cashierUser();
        $sessionA = $this->openSessionFor($cashierA, '500.00');

        $glucose = Service::query()->where('name', 'Glucosa')->firstOrFail();
        $invoiceId = $this->actingAs($cashierA)
            ->postJson('/api/invoices', [
                'patient_name' => 'Maria Lopez',
                'items' => [['service_id' => $glucose->id, 'quantity' => '1.00']],
            ])
            ->assertCreated()
            ->json('data.id');

        $this->assertSame($sessionA, (int) Invoice::query()->findOrFail($invoiceId)->cash_session_id);

        $cashierB = $this->cashierWithOperateAny();
        $sessionB = $this->openSessionFor($cashierB, '600.00');

        $this->actingAs($cashierB)
            ->postJson("/api/invoices/{$invoiceId}/payments", [
                'cash_session_id' => $sessionB,
                'method' => Payment::METHOD_CASH,
                'amount' => '17.25',
            ])
            ->assertCreated();

        $invoice = Invoice::query()->findOrFail($invoiceId);
        $this->assertSame(
            $sessionA,
            (int) $invoice->cash_session_id,
            'Invoice cash_session_id should still be the session in which it was issued.'
        );

        $payment = Payment::query()->where('invoice_id', $invoiceId)->firstOrFail();
        $this->assertSame($sessionB, (int) $payment->cash_session_id);
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

    private function cashierWithOperateAny(): User
    {
        $cashier = $this->cashierUser();
        $cashier->givePermissionTo('invoices.operate_any');

        return $cashier->refresh();
    }

    private function openSessionFor(User $cashier, string $openingAmount): int
    {
        if (CashRegisterSession::query()->where('status', CashRegisterSession::STATUS_OPEN)->exists()) {
            return CashRegisterSession::query()->create([
                'user_id' => $cashier->id,
                'open_user_id' => $cashier->id,
                'opening_amount' => $openingAmount,
                'status' => CashRegisterSession::STATUS_OPEN,
                'opened_at' => now(),
            ])->id;
        }

        return $this->actingAs($cashier)
            ->postJson('/api/cash-sessions/open', ['opening_amount' => $openingAmount])
            ->assertCreated()
            ->json('data.id');
    }

    private function openSessionIdFor(User $cashier): int
    {
        $session = CashRegisterSession::query()
            ->where('user_id', $cashier->id)
            ->where('status', CashRegisterSession::STATUS_OPEN)
            ->firstOrFail();

        return (int) $session->id;
    }
}
