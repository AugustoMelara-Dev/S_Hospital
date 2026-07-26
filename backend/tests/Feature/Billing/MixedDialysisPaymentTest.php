<?php

namespace Tests\Feature\Billing;

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

class MixedDialysisPaymentTest extends TestCase
{
    use RefreshDatabase;

    public function test_mixed_dialysis_invoice_collects_only_the_billable_balance(): void
    {
        $this->seedBillingBase();
        $cashier = $this->cashier();
        $session = CashRegisterSession::query()->where('user_id', $cashier->id)->firstOrFail();
        $product = Service::query()->where('name', 'Glucosa')->firstOrFail();
        $product->forceFill([
            'price' => '900.00',
            'taxable' => false,
            'special_rule_code' => null,
        ])->save();
        $erythropoietin = Service::query()->where('name', 'Eritropoyetina')->firstOrFail();

        $invoiceId = $this->actingAs($cashier)
            ->postJson('/api/invoices', [
                'patient_name' => 'Paciente con receta',
                'dialysis_prescription' => true,
                'items' => [
                    ['service_id' => $product->id, 'quantity' => '1.00'],
                    ['service_id' => $erythropoietin->id, 'quantity' => '1.00'],
                ],
            ])
            ->assertCreated()
            ->assertJsonPath('data.total', '900.00')
            ->assertJsonPath('data.balance_due', '900.00')
            ->assertJsonPath('data.status', Invoice::STATUS_ISSUED)
            ->json('data.id');

        $paymentId = $this->actingAs($cashier)
            ->postJson("/api/invoices/{$invoiceId}/payments", [
                'cash_session_id' => $session->id,
                'method' => Payment::METHOD_CASH,
                'amount' => '900.00',
            ])
            ->assertCreated()
            ->assertJsonPath('data.payment.amount', '900.00')
            ->assertJsonPath('data.invoice.paid_amount', '900.00')
            ->assertJsonPath('data.invoice.balance_due', '0.00')
            ->assertJsonPath('data.invoice.status', Invoice::STATUS_PAID)
            ->json('data.payment.id');

        $this->assertDatabaseHas('payments', [
            'id' => $paymentId,
            'invoice_id' => $invoiceId,
            'cash_session_id' => $session->id,
            'user_id' => $cashier->id,
            'method' => Payment::METHOD_CASH,
            'amount' => '900.00',
            'amount_cents' => 90000,
            'status' => Payment::STATUS_POSTED,
        ]);
        $this->assertDatabaseHas('cash_movements', [
            'cash_session_id' => $session->id,
            'payment_id' => $paymentId,
            'user_id' => $cashier->id,
            'type' => CashMovement::TYPE_PAYMENT,
            'method' => Payment::METHOD_CASH,
            'amount' => '900.00',
        ]);
        $this->assertDatabaseMissing('payments', [
            'invoice_id' => $invoiceId,
            'amount_cents' => 0,
            'reference' => 'Receta dialisis: factura sin cobro',
        ]);

        $invoice = Invoice::query()->findOrFail($invoiceId);
        $this->assertSame(90000, $invoice->paid_amount_cents);
        $this->assertSame(0, $invoice->balance_due_cents);
        $this->assertSame(1, $invoice->payments()->count());
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

    private function cashier(): User
    {
        $cashier = User::factory()->create();
        $cashier->assignRole('cajero');
        CashRegisterSession::query()->create([
            'user_id' => $cashier->id,
            'open_user_id' => $cashier->id,
            'opening_amount' => '500.00',
            'status' => CashRegisterSession::STATUS_OPEN,
            'opened_at' => now(),
        ]);

        return $cashier->refresh();
    }
}
