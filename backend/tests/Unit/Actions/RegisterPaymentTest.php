<?php

namespace Tests\Unit\Actions;

use App\Actions\Payments\RegisterPaymentAction;
use App\Models\CashRegisterSession;
use App\Models\FiscalSequence;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\User;
use App\Support\InvoiceAccess;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class RegisterPaymentTest extends TestCase
{
    use RefreshDatabase;

    private RegisterPaymentAction $action;
    private User $cashier;
    private CashRegisterSession $session;
    private Invoice $invoice;
    private InvoiceAccess $invoiceAccess;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);
        $this->action = new RegisterPaymentAction();
        $this->invoiceAccess = new InvoiceAccess();

        $this->cashier = User::factory()->create();
        $this->cashier->assignRole('cajero');

        $this->session = CashRegisterSession::query()->create([
            'user_id' => $this->cashier->id,
            'status' => CashRegisterSession::STATUS_OPEN,
            'opening_amount' => '100.00',
            'opened_at' => now(),
        ]);

        $sequence = FiscalSequence::query()->create([
            'document_type' => 'invoice',
            'prefix' => '001-001-01',
            'min_number' => 1,
            'max_number' => 1000,
            'current_number' => 1,
            'cai' => 'ABC-123',
            'valid_until' => now()->addYear(),
            'active' => true,
        ]);

        $this->invoice = Invoice::query()->create([
            'invoice_number' => '001-001-01-00000001',
            'fiscal_sequence_id' => $sequence->id,
            'fiscal_cai' => 'ABC-123',
            'fiscal_range_from' => '00000001',
            'fiscal_range_to' => '00001000',
            'fiscal_valid_until' => now()->addYear(),
            'fiscal_prefix' => '001-001-01',
            'hospital_name' => 'Hospital Local',
            'hospital_rtn' => '12345',
            'patient_name' => 'John Doe',
            'subtotal' => '100.00',
            'tax_amount' => '15.00',
            'discount_amount' => '0.00',
            'total' => '115.00',
            'paid_amount' => '0.00',
            'balance_due' => '115.00',
            'status' => Invoice::STATUS_ISSUED,
            'issued_by' => $this->cashier->id,
            'issued_at' => now(),
        ]);
    }

    public function test_it_registers_payment_successfully(): void
    {
        $payload = [
            'cash_session_id' => $this->session->id,
            'method' => Payment::METHOD_CASH,
            'amount' => '50.00',
            'reference' => null,
        ];

        $payment = $this->action->execute($this->invoice, $payload, $this->cashier, $this->invoiceAccess);

        $this->assertDatabaseHas('payments', [
            'id' => $payment->id,
            'invoice_id' => $this->invoice->id,
            'cash_session_id' => $this->session->id,
            'amount' => '50.00',
            'method' => Payment::METHOD_CASH,
        ]);

        $this->assertDatabaseHas('cash_movements', [
            'cash_session_id' => $this->session->id,
            'payment_id' => $payment->id,
            'amount' => '50.00',
        ]);

        $updatedInvoice = $this->invoice->fresh();
        $this->assertSame('50.00', $updatedInvoice->paid_amount);
        $this->assertSame('65.00', $updatedInvoice->balance_due);
        $this->assertSame(Invoice::STATUS_PARTIAL, $updatedInvoice->status);
    }

    public function test_it_blocks_payments_exceeding_pending_balance(): void
    {
        $payload = [
            'cash_session_id' => $this->session->id,
            'method' => Payment::METHOD_CASH,
            'amount' => '120.00',
            'reference' => null,
        ];

        $this->expectException(ValidationException::class);
        $this->action->execute($this->invoice, $payload, $this->cashier, $this->invoiceAccess);
    }

    public function test_it_blocks_payments_on_closed_cashbox(): void
    {
        $this->session->update(['status' => CashRegisterSession::STATUS_CLOSED]);

        $payload = [
            'cash_session_id' => $this->session->id,
            'method' => Payment::METHOD_CASH,
            'amount' => '50.00',
            'reference' => null,
        ];

        $this->expectException(ValidationException::class);
        $this->action->execute($this->invoice, $payload, $this->cashier, $this->invoiceAccess);
    }

    public function test_it_blocks_payments_on_other_users_cashbox(): void
    {
        $otherCashier = User::factory()->create();
        $otherCashier->assignRole('cajero');

        $payload = [
            'cash_session_id' => $this->session->id,
            'method' => Payment::METHOD_CASH,
            'amount' => '50.00',
            'reference' => null,
        ];

        $this->expectException(AuthorizationException::class);
        $this->action->execute($this->invoice, $payload, $otherCashier, $this->invoiceAccess);
    }
}
