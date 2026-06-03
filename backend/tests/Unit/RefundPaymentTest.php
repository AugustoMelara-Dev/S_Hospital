<?php

namespace Tests\Unit;

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

/**
 * FASE F4: refund approximation via negative-amount payment.
 *
 * v1.0.0 does not ship a dedicated "refund" form. Instead, the
 * same RegisterPaymentAction that handles a +L. 5 payment also
 * handles a -L. 5 payment: the formula
 *
 *   paid_amount_cents += amount_cents
 *   balance_due_cents  = total_cents - paid_amount_cents
 *
 * produces a balanced refund and an audit-friendly trail.
 *
 * This test covers the end-to-end sequence: create an invoice,
 * pay half of it, then register a negative payment of the same
 * amount. The final state must show paid_amount_cents=0 and
 * balance_due_cents back to the original total.
 */
class RefundPaymentTest extends TestCase
{
    use RefreshDatabase;

    public function test_a_negative_payment_after_a_positive_payment_zeros_the_invoice(): void
    {
        $this->seedBillingBase();
        $cashier = $this->cashier();
        $this->openSession($cashier);
        $invoiceId = $this->createInvoice($cashier, 'Maria Lopez', 'Glucosa');

        // Pay the full amount first (17.25).
        $this->actingAs($cashier)
            ->postJson("/api/invoices/{$invoiceId}/payments", [
                'cash_session_id' => $this->currentSessionId($cashier),
                'method' => Payment::METHOD_CASH,
                'amount' => '17.25',
            ])
            ->assertCreated();

        // Then refund the full amount as a negative payment.
        $this->actingAs($cashier)
            ->postJson("/api/invoices/{$invoiceId}/payments", [
                'cash_session_id' => $this->currentSessionId($cashier),
                'method' => Payment::METHOD_CASH,
                'amount' => '-17.25',
                'reference' => 'Devolucion factura 000-001-01-00000001',
            ])
            ->assertCreated();

        $invoice = Invoice::query()->findOrFail($invoiceId);
        $this->assertSame(0, (int) $invoice->paid_amount_cents);
        $this->assertSame(1725, (int) $invoice->balance_due_cents);
        $this->assertSame(Invoice::STATUS_ISSUED, $invoice->status);

        $this->assertSame(2, Payment::query()
            ->where('invoice_id', $invoiceId)
            ->where('status', Payment::STATUS_POSTED)
            ->count());
    }

    public function test_a_standalone_negative_payment_is_rejected_without_prior_payment(): void
    {
        // A refund requires a prior payment. Attempting to register
        // a negative payment on a freshly issued invoice (paid=0)
        // is a cashier mistake (or a malicious attempt to put the
        // invoice into a negative paid balance) and must be
        // rejected with 422.
        $this->seedBillingBase();
        $cashier = $this->cashier();
        $this->openSession($cashier);
        $invoiceId = $this->createInvoice($cashier, 'Jose Perez', 'Hemograma Completo');

        $this->actingAs($cashier)
            ->postJson("/api/invoices/{$invoiceId}/payments", [
                'cash_session_id' => $this->currentSessionId($cashier),
                'method' => Payment::METHOD_CASH,
                'amount' => '-1.00',
                'reference' => 'Devolucion',
            ])
            ->assertUnprocessable();
    }

    public function test_a_negative_payment_cannot_exceed_the_paid_amount(): void
    {
        $this->seedBillingBase();
        $cashier = $this->cashier();
        $this->openSession($cashier);
        $invoiceId = $this->createInvoice($cashier, 'Maria Lopez', 'Glucosa');

        // Pay the full 17.25.
        $this->actingAs($cashier)
            ->postJson("/api/invoices/{$invoiceId}/payments", [
                'cash_session_id' => $this->currentSessionId($cashier),
                'method' => Payment::METHOD_CASH,
                'amount' => '17.25',
            ])
            ->assertCreated();

        // Trying to refund MORE than was paid (in absolute value)
        // must be rejected so the cashier cannot accidentally push
        // the invoice into a negative paid balance.
        $this->actingAs($cashier)
            ->postJson("/api/invoices/{$invoiceId}/payments", [
                'cash_session_id' => $this->currentSessionId($cashier),
                'method' => Payment::METHOD_CASH,
                'amount' => '-30.00',
            ])
            ->assertUnprocessable();
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

    private function cashier(): User
    {
        $cashier = User::factory()->create();
        $cashier->assignRole('cajero');

        return $cashier->refresh();
    }

    private function openSession(User $cashier): int
    {
        return app(OpenCashSessionAction::class)
            ->execute(['opening_amount' => '500.00'], $cashier)
            ->id;
    }

    private function currentSessionId(User $cashier): int
    {
        return CashRegisterSession::query()
            ->where('user_id', $cashier->id)
            ->where('status', CashRegisterSession::STATUS_OPEN)
            ->firstOrFail()
            ->id;
    }

    private function createInvoice(User $cashier, string $patientName, string $serviceName): int
    {
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
