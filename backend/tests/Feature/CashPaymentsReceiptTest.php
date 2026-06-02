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
use Illuminate\Database\QueryException;
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

    public function test_database_constraint_allows_only_one_open_cash_session_per_cashier(): void
    {
        $this->seedBillingBase();
        $cashier = $this->cashier();
        $this->openSession($cashier, '500.00');

        $this->expectException(QueryException::class);

        CashRegisterSession::query()->create([
            'user_id' => $cashier->id,
            'open_user_id' => $cashier->id,
            'opening_amount' => '100.00',
            'status' => CashRegisterSession::STATUS_OPEN,
            'opened_at' => now(),
        ]);
    }

    public function test_cashier_can_open_new_session_after_closing_previous_one(): void
    {
        $this->seedBillingBase();
        $cashier = $this->cashier();
        $sessionId = $this->openSession($cashier, '500.00');

        $this->actingAs($cashier)
            ->postJson("/api/cash-sessions/{$sessionId}/close", ['closing_amount' => '500.00'])
            ->assertOk()
            ->assertJsonPath('data.open_user_id', null);

        $this->actingAs($cashier)
            ->postJson('/api/cash-sessions/open', ['opening_amount' => '200.00'])
            ->assertCreated()
            ->assertJsonPath('data.open_user_id', $cashier->id);
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

    public function test_closing_cash_session_requires_note_when_difference_is_not_zero(): void
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
            ->postJson("/api/cash-sessions/{$sessionId}/close", ['closing_amount' => '520.00'])
            ->assertJsonValidationErrors('notes');

        $this->assertDatabaseHas('cash_register_sessions', [
            'id' => $sessionId,
            'status' => CashRegisterSession::STATUS_OPEN,
        ]);
    }

    public function test_transfer_card_and_other_payments_do_not_increase_expected_cash_amount(): void
    {
        $this->seedBillingBase();
        $cashier = $this->cashier();
        $sessionId = $this->openSession($cashier, '500.00');

        foreach ([
            ['service' => 'Glucosa', 'method' => Payment::METHOD_TRANSFER, 'amount' => '17.25'],
            ['service' => 'Hemograma Completo', 'method' => Payment::METHOD_CARD, 'amount' => '11.50'],
            ['service' => 'Eritropoyetina', 'method' => Payment::METHOD_OTHER, 'amount' => '28.75'],
        ] as $paymentCase) {
            $invoiceId = $this->createInvoice($cashier, $paymentCase['service']);

            $this->actingAs($cashier)
                ->postJson("/api/invoices/{$invoiceId}/payments", [
                    'cash_session_id' => $sessionId,
                    'method' => $paymentCase['method'],
                    'amount' => $paymentCase['amount'],
                ])
                ->assertCreated();
        }

        $this->actingAs($cashier)
            ->postJson("/api/cash-sessions/{$sessionId}/close", ['closing_amount' => '500.00'])
            ->assertOk()
            ->assertJsonPath('data.expected_amount', '500.00')
            ->assertJsonPath('data.difference_amount', '0.00');
    }

    public function test_current_cash_session_exposes_reconciliation_without_counting_pending_as_cash(): void
    {
        $this->seedBillingBase();
        FiscalSetting::query()->update(['partial_payments_enabled' => true]);
        $cashier = $this->cashier();
        $sessionId = $this->openSession($cashier, '500.00');
        $cashInvoice = $this->createInvoice($cashier, 'Glucosa');
        $transferInvoice = $this->createInvoice($cashier, 'Hemograma Completo');
        $partialInvoice = $this->createInvoice($cashier, 'Eritropoyetina');

        $this->actingAs($cashier)
            ->postJson("/api/invoices/{$cashInvoice}/payments", [
                'cash_session_id' => $sessionId,
                'method' => Payment::METHOD_CASH,
                'amount' => '17.25',
            ])
            ->assertCreated();

        $this->actingAs($cashier)
            ->postJson("/api/invoices/{$transferInvoice}/payments", [
                'cash_session_id' => $sessionId,
                'method' => Payment::METHOD_TRANSFER,
                'amount' => '11.50',
            ])
            ->assertCreated();

        $this->actingAs($cashier)
            ->postJson("/api/invoices/{$partialInvoice}/payments", [
                'cash_session_id' => $sessionId,
                'method' => Payment::METHOD_CARD,
                'amount' => '5.00',
            ])
            ->assertCreated();

        $this->actingAs($cashier)
            ->getJson('/api/cash-sessions/current')
            ->assertOk()
            ->assertJsonPath('data.payments_count', 3)
            ->assertJsonPath('data.payments_total', '33.75')
            ->assertJsonPath('data.payments_by_method.cash', '17.25')
            ->assertJsonPath('data.payments_by_method.transfer', '11.50')
            ->assertJsonPath('data.payments_by_method.card', '5.00')
            ->assertJsonPath('data.expected_cash_amount', '517.25')
            ->assertJsonPath('data.pending_invoice_count', 1)
            ->assertJsonPath('data.pending_amount', '23.75');

        $this->actingAs($cashier)
            ->postJson("/api/cash-sessions/{$sessionId}/close", ['closing_amount' => '517.25'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('cash_session');
    }

    public function test_payment_requires_an_open_own_cash_session(): void
    {
        $this->seedBillingBase();
        $cashier = $this->cashier();
        $otherCashier = $this->cashier();
        $closedOwnSessionId = $this->openSession($cashier, '100.00');
        $this->actingAs($cashier)
            ->postJson("/api/cash-sessions/{$closedOwnSessionId}/close", ['closing_amount' => '100.00'])
            ->assertOk();

        $invoiceSessionId = $this->openSession($cashier, '500.00');
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

        $this->actingAs($cashier)
            ->postJson("/api/invoices/{$invoiceId}/payments", [
                'cash_session_id' => $closedOwnSessionId,
                'method' => Payment::METHOD_CASH,
                'amount' => '1.00',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('cash_session_id');
    }

    public function test_cashier_cannot_list_or_pay_other_cashier_invoice_by_id(): void
    {
        $this->seedBillingBase();
        $cashier = $this->cashier();
        $otherCashier = $this->cashier();
        $sessionId = $this->openSession($cashier, '500.00');
        $this->openSession($otherCashier, '500.00');
        $otherInvoiceId = $this->createInvoice($otherCashier, 'Glucosa');

        $this->actingAs($cashier)
            ->getJson("/api/invoices/{$otherInvoiceId}/payments")
            ->assertForbidden();

        $this->actingAs($cashier)
            ->postJson("/api/invoices/{$otherInvoiceId}/payments", [
                'cash_session_id' => $sessionId,
                'method' => Payment::METHOD_CASH,
                'amount' => '17.25',
            ])
            ->assertForbidden();

        $this->assertDatabaseMissing('payments', [
            'invoice_id' => $otherInvoiceId,
            'cash_session_id' => $sessionId,
            'user_id' => $cashier->id,
        ]);
    }

    public function test_cashier_cannot_pay_own_old_invoice_without_elevated_invoice_access(): void
    {
        $this->seedBillingBase();
        $cashier = $this->cashier();
        $sessionId = $this->openSession($cashier, '500.00');
        $invoiceId = $this->createInvoice($cashier, 'Glucosa');

        Invoice::query()
            ->whereKey($invoiceId)
            ->update(['issued_at' => now()->subDay()]);

        $this->actingAs($cashier)
            ->postJson("/api/invoices/{$invoiceId}/payments", [
                'cash_session_id' => $sessionId,
                'method' => Payment::METHOD_CASH,
                'amount' => '17.25',
            ])
            ->assertForbidden();

        $this->assertDatabaseMissing('payments', [
            'invoice_id' => $invoiceId,
            'cash_session_id' => $sessionId,
            'user_id' => $cashier->id,
        ]);
    }

    public function test_report_permission_does_not_grant_invoice_payment_operation_scope(): void
    {
        $this->seedBillingBase();
        $cashier = $this->cashier();
        $reportingUser = User::factory()->create();
        $reportingUser->givePermissionTo(['payments.create', 'reports.managerial.view']);

        $sessionId = $this->openSession($cashier, '500.00');
        $invoiceId = $this->createInvoice($cashier, 'Glucosa');

        $this->actingAs($reportingUser)
            ->postJson("/api/invoices/{$invoiceId}/payments", [
                'cash_session_id' => $sessionId,
                'method' => Payment::METHOD_CASH,
                'amount' => '17.25',
            ])
            ->assertForbidden();

        $this->assertDatabaseMissing('payments', [
            'invoice_id' => $invoiceId,
            'user_id' => $reportingUser->id,
        ]);
    }

    public function test_reprint_any_permission_does_not_grant_invoice_payment_operation_scope(): void
    {
        $this->seedBillingBase();
        $cashier = $this->cashier();
        $reprintUser = User::factory()->create();
        $reprintUser->givePermissionTo(['payments.create', 'receipts.reprint_any']);

        $sessionId = $this->openSession($cashier, '500.00');
        $invoiceId = $this->createInvoice($cashier, 'Glucosa');

        $this->actingAs($reprintUser)
            ->postJson("/api/invoices/{$invoiceId}/payments", [
                'cash_session_id' => $sessionId,
                'method' => Payment::METHOD_CASH,
                'amount' => '17.25',
            ])
            ->assertForbidden();

        $this->assertDatabaseMissing('payments', [
            'invoice_id' => $invoiceId,
            'user_id' => $reprintUser->id,
        ]);
    }

    public function test_register_payment_creates_cash_movement_and_updates_partial_then_paid_invoice(): void
    {
        $this->seedBillingBase();
        FiscalSetting::query()->update(['partial_payments_enabled' => true]);
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

    public function test_voiding_payment_recalculates_invoice_and_excludes_payment_from_cash_and_reports(): void
    {
        $this->seedBillingBase();
        FiscalSetting::query()->update(['partial_payments_enabled' => true]);
        $cashier = $this->cashier();
        $supervisor = User::factory()->create();
        $supervisor->assignRole('supervisor');
        $sessionId = $this->openSession($cashier, '500.00');
        $invoiceId = $this->createInvoice($cashier, 'Glucosa');

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
                'reference' => 'TRX-VOID-1',
            ])
            ->assertCreated()
            ->assertJsonPath('data.invoice.status', Invoice::STATUS_PAID);

        $this->actingAs($cashier)
            ->postJson("/api/invoices/{$invoiceId}/payments/{$cashPaymentId}/void", [
                'reason' => 'Intento sin permiso',
            ])
            ->assertForbidden();

        $this->actingAs($supervisor)
            ->postJson("/api/invoices/{$invoiceId}/payments/{$cashPaymentId}/void", [
                'reason' => 'Pago registrado con metodo incorrecto',
            ])
            ->assertOk()
            ->assertJsonPath('data.payment.status', Payment::STATUS_VOID)
            ->assertJsonPath('data.payment.voided_by.id', $supervisor->id)
            ->assertJsonPath('data.payment.void_reason', 'Pago registrado con metodo incorrecto')
            ->assertJsonPath('data.invoice.status', Invoice::STATUS_PARTIAL)
            ->assertJsonPath('data.invoice.paid_amount', '7.25')
            ->assertJsonPath('data.invoice.balance_due', '10.00');

        $this->actingAs($supervisor)
            ->postJson("/api/invoices/{$invoiceId}/payments/{$cashPaymentId}/void", [
                'reason' => 'Segundo intento',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('payment');

        $this->actingAs($cashier)
            ->getJson('/api/cash-sessions/current')
            ->assertOk()
            ->assertJsonPath('data.payments_count', 1)
            ->assertJsonPath('data.payments_total', '7.25')
            ->assertJsonPath('data.payments_by_method.cash', '0.00')
            ->assertJsonPath('data.payments_by_method.transfer', '7.25')
            ->assertJsonPath('data.expected_cash_amount', '500.00')
            ->assertJsonPath('data.pending_invoice_count', 1)
            ->assertJsonPath('data.pending_amount', '10.00');

        $this->actingAs($supervisor)
            ->getJson('/api/reports/daily?date='.now()->toDateString())
            ->assertOk()
            ->assertJsonPath('data.total_collected', '7.25')
            ->assertJsonPath('data.payments_by_method.cash', '0.00')
            ->assertJsonPath('data.payments_by_method.transfer', '7.25');

        $this->actingAs($supervisor)
            ->getJson("/api/reports/cash-sessions/{$sessionId}")
            ->assertOk()
            ->assertJsonPath('data.total_cash', '0.00')
            ->assertJsonPath('data.total_transfer', '7.25')
            ->assertJsonPath('data.payments_count', 1)
            ->assertJsonCount(4, 'data.movements')
            ->assertJsonPath('data.movements.3.type', CashMovement::TYPE_PAYMENT_VOID)
            ->assertJsonPath('data.movements.3.amount', '-10.00');

        $this->assertDatabaseHas('payments', [
            'id' => $cashPaymentId,
            'status' => Payment::STATUS_VOID,
            'voided_by' => $supervisor->id,
            'void_reason' => 'Pago registrado con metodo incorrecto',
        ]);
        $this->assertDatabaseHas('cash_movements', [
            'cash_session_id' => $sessionId,
            'payment_id' => $cashPaymentId,
            'type' => CashMovement::TYPE_PAYMENT_VOID,
            'method' => Payment::METHOD_CASH,
            'amount' => '-10.00',
        ]);
        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $supervisor->id,
            'action' => 'payment.voided',
            'entity_type' => Payment::class,
            'entity_id' => $cashPaymentId,
        ]);
    }

    public function test_receipt_excludes_voided_payments_after_reversal(): void
    {
        $this->seedBillingBase();
        FiscalSetting::query()->update(['partial_payments_enabled' => true]);
        $cashier = $this->cashier();
        $supervisor = User::factory()->create(['name' => 'Supervisor Caja']);
        $supervisor->assignRole('supervisor');
        $sessionId = $this->openSession($cashier, '500.00');
        $invoiceId = $this->createInvoice($cashier, 'Glucosa');

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
                'reference' => 'TRX-REC-1',
            ])
            ->assertCreated()
            ->assertJsonPath('data.invoice.status', Invoice::STATUS_PAID);

        $this->actingAs($supervisor)
            ->postJson("/api/invoices/{$invoiceId}/payments/{$cashPaymentId}/void", [
                'reason' => 'Correccion de metodo antes de recibo',
            ])
            ->assertOk()
            ->assertJsonPath('data.invoice.status', Invoice::STATUS_PARTIAL)
            ->assertJsonPath('data.invoice.paid_amount', '7.25')
            ->assertJsonPath('data.invoice.balance_due', '10.00');

        $this->actingAs($cashier)
            ->getJson("/api/invoices/{$invoiceId}/receipt?width=half_letter")
            ->assertOk()
            ->assertJsonPath('data.invoice.status', Invoice::STATUS_PARTIAL)
            ->assertJsonPath('data.invoice.paid_amount', '7.25')
            ->assertJsonPath('data.invoice.balance_due', '10.00')
            ->assertJsonCount(1, 'data.payments')
            ->assertJsonPath('data.payments.0.method', Payment::METHOD_TRANSFER)
            ->assertJsonPath('data.payments.0.amount', '7.25')
            ->assertJsonPath('data.payments.0.reference', 'TRX-REC-1');
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

        $paymentId = $this->actingAs($cashier)
            ->postJson("/api/invoices/{$invoiceId}/payments", [
                'cash_session_id' => $sessionId,
                'method' => Payment::METHOD_CASH,
                'amount' => '17.25',
            ])
            ->assertCreated()
            ->json('data.payment.id');

        $this->actingAs($user)
            ->postJson("/api/invoices/{$invoiceId}/payments/{$paymentId}/void", [
                'reason' => 'Sin permiso para reversar',
            ])
            ->assertForbidden();

        $this->actingAs($cashier)
            ->postJson("/api/invoices/{$invoiceId}/payments/{$paymentId}/void", [
                'reason' => 'Cajero sin permiso de reverso',
            ])
            ->assertForbidden();
    }

    public function test_receipt_uses_invoice_item_snapshots_and_supports_institutional_paper_sizes(): void
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

        $receipt = $this->actingAs($cashier)
            ->getJson("/api/invoices/{$invoiceId}/receipt?width=half_letter")
            ->assertOk()
            ->assertJsonPath('data.width', 'half_letter')
            ->assertJsonPath('data.hospital.name', 'Hospital San Isidro')
            ->assertJsonPath('data.hospital.rtn', '08011999123456')
            ->assertJsonPath('data.fiscal.cai', 'TEST-CAI')
            ->assertJsonPath('data.fiscal.authorized_range', '000-001-01-00000001 a 000-001-01-99999999')
            ->assertJsonPath('data.fiscal.valid_until', now()->addYear()->toDateString())
            ->assertJsonPath('data.items.0.service_name', 'Glucosa')
            ->assertJsonPath('data.items.0.unit_price', '15.00')
            ->assertJsonPath('data.invoice.balance_due', '0.00')
            ->assertJsonCount(1, 'data.payments');

        $receiptItem = $receipt->json('data.items.0');
        foreach (['service_id', 'scan_code', 'barcode', 'qr_code'] as $technicalField) {
            $this->assertArrayNotHasKey($technicalField, $receiptItem);
        }

        $this->actingAs($cashier)
            ->getJson("/api/invoices/{$invoiceId}/receipt?width=a5")
            ->assertOk()
            ->assertJsonPath('data.width', 'a5');

        $this->actingAs($cashier)
            ->getJson("/api/invoices/{$invoiceId}/receipt?width=letter")
            ->assertOk()
            ->assertJsonPath('data.width', 'letter');

        $this->actingAs($cashier)
            ->getJson("/api/invoices/{$invoiceId}/receipt?width=80mm")
            ->assertOk()
            ->assertJsonPath('data.width', '80mm');

        $this->actingAs($cashier)
            ->getJson("/api/invoices/{$invoiceId}/receipt?width=58mm")
            ->assertOk()
            ->assertJsonPath('data.width', '58mm');

        Invoice::query()->whereKey($invoiceId)->update(['receipt_paper_size' => '80mm']);

        $this->actingAs($cashier)
            ->getJson("/api/invoices/{$invoiceId}/receipt")
            ->assertOk()
            ->assertJsonPath('data.width', '80mm')
            ->assertJsonPath('data.institutional.paper_size', '80mm');
    }

    public function test_zero_total_dialysis_prescription_invoice_is_paid_and_receiptable_with_zero_amount_audit_payment(): void
    {
        $this->seedBillingBase();
        $cashier = $this->cashier();
        $service = Service::query()->where('name', 'Eritropoyetina')->firstOrFail();
        $this->openSession($cashier, '0.00');

        $invoiceId = $this->actingAs($cashier)
            ->postJson('/api/invoices', [
                'patient_name' => 'Maria Lopez',
                'items' => [[
                    'service_id' => $service->id,
                    'quantity' => '1.00',
                    'dialysis_prescription' => true,
                ]],
            ])
            ->assertCreated()
            ->assertJsonPath('data.total', '0.00')
            ->assertJsonPath('data.balance_due', '0.00')
            ->assertJsonPath('data.status', Invoice::STATUS_PAID)
            ->json('data.id');

        $this->actingAs($cashier)
            ->getJson("/api/invoices/{$invoiceId}/receipt?width=half_letter")
            ->assertOk()
            ->assertJsonPath('data.invoice.total', '0.00')
            ->assertJsonPath('data.invoice.status', Invoice::STATUS_PAID)
            ->assertJsonPath('data.items.0.special_rule_applied', true)
            ->assertJsonCount(1, 'data.payments')
            ->assertJsonPath('data.payments.0.method', Payment::METHOD_OTHER)
            ->assertJsonPath('data.payments.0.amount', '0.00')
            ->assertJsonPath('data.payments.0.reference', 'Factura sin cobro por regla autorizada');

        $this->assertDatabaseHas('payments', [
            'invoice_id' => $invoiceId,
            'method' => Payment::METHOD_OTHER,
            'amount' => '0.00',
            'amount_cents' => 0,
            'reference' => 'Factura sin cobro por regla autorizada',
        ]);
        $this->assertDatabaseHas('audit_logs', [
            'action' => 'payment.registered',
            'entity_type' => Payment::class,
        ]);
        $this->assertDatabaseMissing('cash_movements', [
            'type' => CashMovement::TYPE_PAYMENT,
            'method' => Payment::METHOD_OTHER,
            'amount' => '0.00',
        ]);
    }

    public function test_cash_session_can_open_with_zero_initial_cash(): void
    {
        $this->seedBillingBase();
        $cashier = $this->cashier();

        $this->actingAs($cashier)
            ->postJson('/api/cash-sessions/open', ['opening_amount' => '0.00'])
            ->assertCreated()
            ->assertJsonPath('data.opening_amount', '0.00');
    }

    public function test_receipt_defaults_to_configured_width_and_uses_payment_cashier(): void
    {
        $this->seedBillingBase();
        FiscalSetting::query()->update(['receipt_paper_size' => 'letter']);
        $issuer = $this->cashier();
        $collector = User::factory()->create(['name' => 'Supervisor Caja']);
        $collector->assignRole('supervisor');
        $sessionId = $this->openSession($collector, '500.00');
        $this->openSession($issuer, '500.00');
        $invoiceId = $this->createInvoice($issuer, 'Glucosa');

        $this->actingAs($collector)
            ->postJson("/api/invoices/{$invoiceId}/payments", [
                'cash_session_id' => $sessionId,
                'method' => Payment::METHOD_CASH,
                'amount' => '17.25',
            ])
            ->assertCreated();

        $this->actingAs($collector)
            ->getJson("/api/invoices/{$invoiceId}/receipt")
            ->assertOk()
            ->assertJsonPath('data.width', 'letter')
            ->assertJsonPath('data.invoice.cashier', 'Supervisor Caja')
            ->assertJsonPath('data.payments.0.cashier', 'Supervisor Caja');
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

    private function openSession(User $cashier, string $openingAmount): int
    {
        return $this->actingAs($cashier)
            ->postJson('/api/cash-sessions/open', ['opening_amount' => $openingAmount])
            ->assertCreated()
            ->json('data.id');
    }

    private function createInvoice(User $cashier, string $serviceName): int
    {
        $this->ensureOpenSession($cashier);

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

    private function ensureOpenSession(User $cashier): int
    {
        $openSession = CashRegisterSession::query()
            ->where('user_id', $cashier->id)
            ->where('status', CashRegisterSession::STATUS_OPEN)
            ->first();

        return $openSession?->id ?? $this->openSession($cashier, '500.00');
    }
}
