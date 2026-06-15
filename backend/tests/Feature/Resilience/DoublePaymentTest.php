<?php

declare(strict_types=1);

namespace Tests\Feature\Resilience;

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
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Resilience audit: a cashier (or the cashier's network) sends two
 * near-simultaneous payment requests for the same invoice. The
 * SELECT ... FOR UPDATE on the invoice must serialize them and the
 * second request must see a reduced balance and refuse the duplicate.
 */
class DoublePaymentTest extends TestCase
{
    use RefreshDatabase;

    public function test_two_payments_on_same_invoice_cannot_overpay_the_balance(): void
    {
        $this->seedBillingBase();
        $this->togglePartial(true);

        $cashier = $this->cashierWithOpenSession();
        $sessionId = $this->openSessionFor($cashier, '500.00');
        $glucose = Service::query()->where('name', 'Glucosa')->firstOrFail();

        $invoiceId = $this->actingAs($cashier)
            ->postJson('/api/invoices', [
                'patient_name' => 'Doble pago',
                'items' => [['service_id' => $glucose->id, 'quantity' => '1.00']],
            ])
            ->assertCreated()
            ->json('data.id');

        $invoice = Invoice::query()->findOrFail($invoiceId);
        $this->assertSame(1725, (int) $invoice->total_cents);

        $first = $this->actingAs($cashier)
            ->postJson("/api/invoices/{$invoiceId}/payments", [
                'cash_session_id' => $sessionId,
                'method' => Payment::METHOD_CASH,
                'amount' => '17.25',
            ]);
        $first->assertCreated();

        $second = $this->actingAs($cashier)
            ->postJson("/api/invoices/{$invoiceId}/payments", [
                'cash_session_id' => $sessionId,
                'method' => Payment::METHOD_CASH,
                'amount' => '17.25',
            ]);
        $second->assertStatus(422);
        $second->assertJsonPath('errors.invoice.0', 'La factura ya esta pagada.');

        $this->assertSame(1, Payment::query()->where('invoice_id', $invoiceId)->count());

        $invoice = Invoice::query()->findOrFail($invoiceId);
        $this->assertSame(0, (int) $invoice->balance_due_cents);
        $this->assertSame(1725, (int) $invoice->paid_amount_cents);
        $this->assertSame(Invoice::STATUS_PAID, $invoice->status);
    }

    public function test_paying_full_then_partial_after_void_is_blocked(): void
    {
        $this->seedBillingBase();
        $this->togglePartial(true);

        $cashier = $this->cashierWithVoidPermission();
        $sessionId = $this->openSessionFor($cashier, '500.00');
        $glucose = Service::query()->where('name', 'Glucosa')->firstOrFail();

        $invoiceId = $this->actingAs($cashier)
            ->postJson('/api/invoices', [
                'patient_name' => 'Secuencia pago + anulacion pago',
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
            ->json('data.payment');

        $this->actingAs($cashier)
            ->postJson("/api/invoices/{$invoiceId}/payments/{$payment['id']}/void", [
                'reason' => 'Devolucion al paciente',
            ])
            ->assertOk();

        $this->actingAs($cashier)
            ->postJson("/api/invoices/{$invoiceId}/payments", [
                'cash_session_id' => $sessionId,
                'method' => Payment::METHOD_CASH,
                'amount' => '17.25',
            ])
            ->assertCreated();

        $this->assertSame(2, Payment::query()->where('invoice_id', $invoiceId)->count());

        $this->actingAs($cashier)
            ->postJson("/api/invoices/{$invoiceId}/payments", [
                'cash_session_id' => $sessionId,
                'method' => Payment::METHOD_CASH,
                'amount' => '17.25',
            ])
            ->assertStatus(422);
    }

    public function test_payment_on_voided_invoice_is_refused(): void
    {
        $this->seedBillingBase();
        $this->togglePartial(true);

        $cashier = $this->cashierWithVoidPermission();
        $sessionId = $this->openSessionFor($cashier, '500.00');
        $glucose = Service::query()->where('name', 'Glucosa')->firstOrFail();

        $invoiceId = $this->actingAs($cashier)
            ->postJson('/api/invoices', [
                'patient_name' => 'No cobrar anulada',
                'items' => [['service_id' => $glucose->id, 'quantity' => '1.00']],
            ])
            ->assertCreated()
            ->json('data.id');

        $this->actingAs($cashier)
            ->postJson("/api/invoices/{$invoiceId}/void", [
                'reason' => 'Error de captura',
            ])
            ->assertOk();

        $this->actingAs($cashier)
            ->postJson("/api/invoices/{$invoiceId}/payments", [
                'cash_session_id' => $sessionId,
                'method' => Payment::METHOD_CASH,
                'amount' => '17.25',
            ])
            ->assertStatus(422);
    }

    public function test_double_close_on_same_session_is_rejected(): void
    {
        $this->seedBillingBase();

        $cashier = $this->cashierWithOpenSession();
        $sessionId = $this->openSessionFor($cashier, '500.00');
        $glucose = Service::query()->where('name', 'Glucosa')->firstOrFail();

        $invoiceId = $this->actingAs($cashier)
            ->postJson('/api/invoices', [
                'patient_name' => 'Cierre doble',
                'items' => [['service_id' => $glucose->id, 'quantity' => '1.00']],
            ])
            ->assertCreated()
            ->json('data.id');

        $this->actingAs($cashier)
            ->postJson("/api/invoices/{$invoiceId}/payments", [
                'cash_session_id' => $sessionId,
                'method' => Payment::METHOD_CASH,
                'amount' => '17.25',
            ])
            ->assertCreated();

        $this->actingAs($cashier)
            ->postJson("/api/cash-sessions/{$sessionId}/close", [
                'closing_amount' => '517.25',
            ])
            ->assertOk();

        $secondClose = $this->actingAs($cashier)
            ->postJson("/api/cash-sessions/{$sessionId}/close", [
                'closing_amount' => '517.25',
            ]);

        $this->assertContains($secondClose->status(), [403, 422]);

        if ($secondClose->status() === 422) {
            $secondClose->assertJsonPath('errors.cash_session.0', 'La caja ya esta cerrada.');
        }
    }

    public function test_payment_amount_above_balance_is_rejected_with_no_drift(): void
    {
        $this->seedBillingBase();
        $this->togglePartial(true);

        $cashier = $this->cashierWithOpenSession();
        $sessionId = $this->openSessionFor($cashier, '500.00');
        $glucose = Service::query()->where('name', 'Glucosa')->firstOrFail();

        $invoiceId = $this->actingAs($cashier)
            ->postJson('/api/invoices', [
                'patient_name' => 'Sobrepago',
                'items' => [['service_id' => $glucose->id, 'quantity' => '1.00']],
            ])
            ->assertCreated()
            ->json('data.id');

        $this->actingAs($cashier)
            ->postJson("/api/invoices/{$invoiceId}/payments", [
                'cash_session_id' => $sessionId,
                'method' => Payment::METHOD_CASH,
                'amount' => '99.99',
            ])
            ->assertStatus(422);

        $invoice = Invoice::query()->findOrFail($invoiceId);
        $this->assertSame(0, (int) $invoice->paid_amount_cents);
        $this->assertSame(1725, (int) $invoice->balance_due_cents);
        $this->assertSame(Invoice::STATUS_ISSUED, $invoice->status);
    }

    public function test_payment_audit_trail_records_each_successful_payment_once(): void
    {
        $this->seedBillingBase();
        $this->togglePartial(true);

        $cashier = $this->cashierWithOpenSession();
        $sessionId = $this->openSessionFor($cashier, '500.00');
        $glucose = Service::query()->where('name', 'Glucosa')->firstOrFail();

        $invoiceId = $this->actingAs($cashier)
            ->postJson('/api/invoices', [
                'patient_name' => 'Auditoria',
                'items' => [['service_id' => $glucose->id, 'quantity' => '1.00']],
            ])
            ->assertCreated()
            ->json('data.id');

        $this->actingAs($cashier)
            ->postJson("/api/invoices/{$invoiceId}/payments", [
                'cash_session_id' => $sessionId,
                'method' => Payment::METHOD_CASH,
                'amount' => '10.00',
            ])
            ->assertCreated();

        $this->actingAs($cashier)
            ->postJson("/api/invoices/{$invoiceId}/payments", [
                'cash_session_id' => $sessionId,
                'method' => Payment::METHOD_CASH,
                'amount' => '7.25',
            ])
            ->assertCreated();

        $paymentIds = Payment::query()->where('invoice_id', $invoiceId)->pluck('id');
        foreach ($paymentIds as $paymentId) {
            $this->assertSame(1, AuditLog::query()
                ->where('action', 'payment.registered')
                ->where('entity_id', $paymentId)
                ->count());
        }
    }

    public function test_concurrent_db_writes_to_invoice_total_dont_overshoot(): void
    {
        $this->seedBillingBase();
        $this->togglePartial(true);

        $cashier = $this->cashierWithOpenSession();
        $sessionId = $this->openSessionFor($cashier, '500.00');
        $glucose = Service::query()->where('name', 'Glucosa')->firstOrFail();

        $invoiceId = $this->actingAs($cashier)
            ->postJson('/api/invoices', [
                'patient_name' => 'Race',
                'items' => [['service_id' => $glucose->id, 'quantity' => '1.00']],
            ])
            ->assertCreated()
            ->json('data.id');

        $invoice = Invoice::query()->findOrFail($invoiceId);
        $balanceBefore = (int) $invoice->balance_due_cents;
        $paidBefore = (int) $invoice->paid_amount_cents;

        DB::transaction(function () use ($invoice, &$balanceBefore, &$paidBefore): void {
            $locked = Invoice::query()->lockForUpdate()->findOrFail($invoice->id);
            $newPaid = $paidBefore + 1000;
            $newBalance = $balanceBefore - 1000;

            $locked->forceFill([
                'paid_amount_cents' => $newPaid,
                'balance_due_cents' => $newBalance,
                'paid_amount' => number_format($newPaid / 100, 2, '.', ''),
                'balance_due' => number_format($newBalance / 100, 2, '.', ''),
                'status' => $newBalance === 0 ? Invoice::STATUS_PAID : Invoice::STATUS_PARTIAL,
            ])->save();

            $paidBefore = $newPaid;
            $balanceBefore = $newBalance;
        });

        $this->actingAs($cashier)
            ->postJson("/api/invoices/{$invoiceId}/payments", [
                'cash_session_id' => $sessionId,
                'method' => Payment::METHOD_CASH,
                'amount' => '7.25',
            ])
            ->assertCreated();

        $invoice = Invoice::query()->findOrFail($invoiceId);
        $this->assertLessThanOrEqual((int) $invoice->total_cents, (int) $invoice->paid_amount_cents);
        $this->assertSame((int) $invoice->total_cents, (int) $invoice->paid_amount_cents + (int) $invoice->balance_due_cents);
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

    private function togglePartial(bool $enabled): void
    {
        FiscalSetting::query()->update(['partial_payments_enabled' => $enabled]);
    }

    private function cashierWithOpenSession(string $suffix = ''): User
    {
        $cashier = User::factory()->create([
            'username' => 'caj'.$suffix.'-'.uniqid(),
        ]);
        $cashier->assignRole('cajero');

        return $cashier->refresh();
    }

    private function cashierWithOperateAny(string $suffix = ''): User
    {
        $cashier = $this->cashierWithOpenSession($suffix);
        $cashier->givePermissionTo('invoices.operate_any');

        return $cashier->refresh();
    }

    private function cashierWithVoidPermission(string $suffix = ''): User
    {
        $cashier = $this->cashierWithOperateAny($suffix);
        $cashier->givePermissionTo('invoices.void');
        $cashier->givePermissionTo('payments.void');

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
}
