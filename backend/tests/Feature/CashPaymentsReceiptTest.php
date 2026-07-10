<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\CashMovement;
use App\Models\CashRegisterSession;
use App\Models\FiscalSequence;
use App\Models\FiscalSetting;
use App\Models\InstitutionalReceipt;
use App\Models\InstitutionalReceiptSeries;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\Service;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Database\Seeders\ServiceCatalogSeeder;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Tests\TestCase;

class CashPaymentsReceiptTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->withoutMiddleware(ThrottleRequests::class);
    }

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

    public function test_only_one_cash_session_can_be_open_for_the_local_drawer(): void
    {
        $this->seedBillingBase();
        $cashier = $this->cashier();
        $otherCashier = $this->cashier();

        $this->openSession($cashier, '500.00');

        $this->actingAs($otherCashier)
            ->postJson('/api/cash-sessions/open', ['opening_amount' => '100.00'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('cash_session');

        $this->assertSame(1, CashRegisterSession::query()->where('status', CashRegisterSession::STATUS_OPEN)->count());
        $this->assertSame(1, CashMovement::query()->where('type', CashMovement::TYPE_OPENING)->count());
        $this->assertSame(1, AuditLog::query()->where('action', 'cash_session.opened')->count());
    }

    public function test_another_cashier_can_open_the_local_drawer_after_previous_session_is_closed(): void
    {
        $this->seedBillingBase();
        $cashier = $this->cashier();
        $otherCashier = $this->cashier();
        $sessionId = $this->openSession($cashier, '500.00');

        $this->actingAs($cashier)
            ->postJson("/api/cash-sessions/{$sessionId}/close", ['closing_amount' => '500.00'])
            ->assertOk()
            ->assertJsonPath('data.status', CashRegisterSession::STATUS_CLOSED);

        $this->actingAs($otherCashier)
            ->postJson('/api/cash-sessions/open', ['opening_amount' => '100.00'])
            ->assertCreated()
            ->assertJsonPath('data.open_user_id', $otherCashier->id);

        $this->assertSame(1, CashRegisterSession::query()->where('status', CashRegisterSession::STATUS_OPEN)->count());
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

    public function test_cannot_close_an_already_closed_cash_session(): void
    {
        $this->seedBillingBase();
        $cashier = $this->cashier();
        $sessionId = $this->openSession($cashier, '500.00');

        $this->actingAs($cashier)
            ->postJson("/api/cash-sessions/{$sessionId}/close", ['closing_amount' => '500.00'])
            ->assertOk()
            ->assertJsonPath('data.status', CashRegisterSession::STATUS_CLOSED);

        $this->actingAs($cashier)
            ->postJson("/api/cash-sessions/{$sessionId}/close", ['closing_amount' => '500.00'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('cash_session')
            ->assertJsonPath('errors.cash_session.0', 'La caja ya esta cerrada.');

        $this->assertSame(1, CashMovement::query()
            ->where('cash_session_id', $sessionId)
            ->where('type', CashMovement::TYPE_CLOSING)
            ->count());
    }

    public function test_cashier_cannot_close_other_cashiers_session(): void
    {
        $this->seedBillingBase();
        $cashier = $this->cashier();
        $otherCashier = $this->cashier();
        $otherSessionId = $this->openSession($otherCashier, '100.00');

        $this->actingAs($cashier)
            ->postJson("/api/cash-sessions/{$otherSessionId}/close", ['closing_amount' => '100.00'])
            ->assertForbidden();

        $this->assertDatabaseHas('cash_register_sessions', [
            'id' => $otherSessionId,
            'user_id' => $otherCashier->id,
            'status' => CashRegisterSession::STATUS_OPEN,
            'open_user_id' => $otherCashier->id,
        ]);
        $this->assertDatabaseMissing('cash_movements', [
            'cash_session_id' => $otherSessionId,
            'type' => CashMovement::TYPE_CLOSING,
        ]);
    }

    public function test_supervisor_close_records_closing_user_in_session_and_report(): void
    {
        $this->seedBillingBase();
        $cashier = $this->cashier();
        $supervisor = User::factory()->create(['name' => 'Supervisor Cierre']);
        $supervisor->assignRole('supervisor');
        $sessionId = $this->openSession($cashier, '100.00');

        $this->actingAs($supervisor)
            ->postJson("/api/cash-sessions/{$sessionId}/close", ['closing_amount' => '100.00'])
            ->assertOk()
            ->assertJsonPath('data.status', CashRegisterSession::STATUS_CLOSED)
            ->assertJsonPath('data.user.id', $cashier->id)
            ->assertJsonPath('data.closed_by.id', $supervisor->id)
            ->assertJsonPath('data.closed_by.name', 'Supervisor Cierre');

        $this->assertDatabaseHas('cash_register_sessions', [
            'id' => $sessionId,
            'user_id' => $cashier->id,
            'closed_by_user_id' => $supervisor->id,
        ]);

        $this->actingAs($supervisor)
            ->getJson("/api/reports/cash-sessions/{$sessionId}")
            ->assertOk()
            ->assertJsonPath('data.cash_session.user.id', $cashier->id)
            ->assertJsonPath('data.cash_session.closed_by.id', $supervisor->id)
            ->assertJsonPath('data.cash_session.closed_by.name', 'Supervisor Cierre');
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

        $this->createIssuedInstitutionalReceipt($invoiceId, $sessionId, $cashier);

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

        $this->createIssuedInstitutionalReceipt($invoiceId, $sessionId, $cashier);

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
            ['service' => 'Glucosa', 'method' => Payment::METHOD_TRANSFER, 'amount' => '17.25', 'reference' => 'TRX-CASH-1'],
            ['service' => 'Hemograma Completo', 'method' => Payment::METHOD_CARD, 'amount' => '11.50', 'reference' => 'CARD-CASH-1'],
            ['service' => 'Eritropoyetina', 'method' => Payment::METHOD_OTHER, 'amount' => '25.00'],
        ] as $paymentCase) {
            $invoiceId = $this->createInvoice($cashier, $paymentCase['service']);

            $this->actingAs($cashier)
                ->postJson("/api/invoices/{$invoiceId}/payments", [
                    'cash_session_id' => $sessionId,
                    'method' => $paymentCase['method'],
                    'amount' => $paymentCase['amount'],
                    'reference' => $paymentCase['reference'] ?? null,
                ])
                ->assertCreated();

            $this->createIssuedInstitutionalReceipt($invoiceId, $sessionId, $cashier);
        }

        $this->actingAs($cashier)
            ->postJson("/api/cash-sessions/{$sessionId}/close", ['closing_amount' => '500.00'])
            ->assertOk()
            ->assertJsonPath('data.expected_amount', '500.00')
            ->assertJsonPath('data.difference_amount', '0.00');
    }

    public function test_card_and_transfer_payments_require_a_reference(): void
    {
        $this->seedBillingBase();
        $cashier = $this->cashier();
        $sessionId = $this->openSession($cashier, '500.00');

        foreach ([Payment::METHOD_CARD, Payment::METHOD_TRANSFER] as $method) {
            $invoiceId = $this->createInvoice($cashier, 'Glucosa');

            $this->actingAs($cashier)
                ->postJson("/api/invoices/{$invoiceId}/payments", [
                    'cash_session_id' => $sessionId,
                    'method' => $method,
                    'amount' => '17.25',
                    'reference' => '   ',
                ])
                ->assertUnprocessable()
                ->assertJsonValidationErrors('reference');

            $this->assertDatabaseMissing('payments', [
                'invoice_id' => $invoiceId,
                'method' => $method,
            ]);
        }
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
                'reference' => 'TRX-CURRENT-1',
            ])
            ->assertCreated();

        $this->actingAs($cashier)
            ->postJson("/api/invoices/{$partialInvoice}/payments", [
                'cash_session_id' => $sessionId,
                'method' => Payment::METHOD_CARD,
                'amount' => '5.00',
                'reference' => 'CARD-CURRENT-1',
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
            ->assertJsonPath('data.pending_amount', '20.00');

        $this->actingAs($cashier)
            ->postJson("/api/cash-sessions/{$sessionId}/close", ['closing_amount' => '517.25'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('cash_session');
    }

    public function test_cannot_close_collecting_cash_session_with_cross_session_partial_invoice(): void
    {
        $this->seedBillingBase();
        FiscalSetting::query()->update(['partial_payments_enabled' => true]);
        $issuer = $this->cashier();
        $collector = User::factory()->create(['name' => 'Supervisor Caja']);
        $collector->assignRole('supervisor');

        $this->createOpenSessionFixture($issuer, '500.00');
        $collectorSessionId = $this->createOpenSessionFixture($collector, '500.00');
        $invoiceId = $this->createInvoice($issuer, 'Glucosa');

        $this->actingAs($collector)
            ->postJson("/api/invoices/{$invoiceId}/payments", [
                'cash_session_id' => $collectorSessionId,
                'method' => Payment::METHOD_CASH,
                'amount' => '5.00',
            ])
            ->assertCreated();

        $this->actingAs($collector)
            ->getJson('/api/cash-sessions/current')
            ->assertOk()
            ->assertJsonPath('data.payments_total', '5.00')
            ->assertJsonPath('data.pending_invoice_count', 1)
            ->assertJsonPath('data.pending_amount', '12.25');

        $this->actingAs($collector)
            ->postJson("/api/cash-sessions/{$collectorSessionId}/close", ['closing_amount' => '505.00'])
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

        $otherSessionId = $this->createOpenSessionFixture($otherCashier, '100.00');

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
        $this->createOpenSessionFixture($otherCashier, '500.00');
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
            'amount_cents' => 1000,
        ]);
        $this->assertDatabaseHas('invoices', [
            'id' => $invoiceId,
            'paid_amount_cents' => 1000,
            'balance_due_cents' => 725,
        ]);
        $this->assertDatabaseHas('cash_movements', [
            'cash_session_id' => $sessionId,
            'type' => CashMovement::TYPE_PAYMENT,
            'method' => Payment::METHOD_CASH,
            'amount' => '10.00',
        ]);

        $transferPaymentId = $this->actingAs($cashier)
            ->postJson("/api/invoices/{$invoiceId}/payments", [
                'cash_session_id' => $sessionId,
                'method' => Payment::METHOD_TRANSFER,
                'amount' => '7.25',
                'reference' => 'TRX-1',
            ])
            ->assertCreated()
            ->assertJsonPath('data.invoice.status', Invoice::STATUS_PAID)
            ->assertJsonPath('data.invoice.paid_amount', '17.25')
            ->assertJsonPath('data.invoice.balance_due', '0.00')
            ->json('data.payment.id');

        $this->assertDatabaseHas('payments', [
            'invoice_id' => $invoiceId,
            'cash_session_id' => $sessionId,
            'method' => Payment::METHOD_TRANSFER,
            'amount' => '7.25',
            'reference' => 'TRX-1',
        ]);

        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $cashier->id,
            'action' => 'payment.registered',
            'entity_type' => Payment::class,
        ]);
        $audit = AuditLog::query()
            ->where('action', 'payment.registered')
            ->where('entity_type', Payment::class)
            ->where('entity_id', $transferPaymentId)
            ->firstOrFail();
        $this->assertSame('TRX-1', $audit->new_values['reference'] ?? null);
        $this->assertSame(Payment::METHOD_TRANSFER, $audit->new_values['method'] ?? null);
        $this->assertDatabaseHas('invoices', [
            'id' => $invoiceId,
            'paid_amount_cents' => 1725,
            'balance_due_cents' => 0,
        ]);
    }

    public function test_partial_payment_rejected_when_partial_payments_disabled(): void
    {
        $this->seedBillingBase();
        FiscalSetting::query()->update(['partial_payments_enabled' => false]);
        $cashier = $this->cashier();
        $sessionId = $this->openSession($cashier, '500.00');
        $invoiceId = $this->createInvoice($cashier, 'Glucosa');

        $this->actingAs($cashier)
            ->postJson("/api/invoices/{$invoiceId}/payments", [
                'cash_session_id' => $sessionId,
                'method' => Payment::METHOD_CASH,
                'amount' => '10.00',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('amount')
            ->assertJsonPath('errors.amount.0', 'El monto recibido es menor al total.');

        $this->assertDatabaseMissing('payments', [
            'invoice_id' => $invoiceId,
            'cash_session_id' => $sessionId,
            'amount' => '10.00',
        ]);
        $this->assertDatabaseHas('invoices', [
            'id' => $invoiceId,
            'status' => Invoice::STATUS_ISSUED,
            'paid_amount' => '0.00',
            'balance_due' => '17.25',
        ]);
    }

    public function test_repeated_payment_submit_with_same_idempotency_key_returns_original_payment(): void
    {
        $this->seedBillingBase();
        $cashier = $this->cashier();
        $sessionId = $this->openSession($cashier, '500.00');
        $invoiceId = $this->createInvoice($cashier, 'Glucosa');
        $payload = [
            'cash_session_id' => $sessionId,
            'method' => Payment::METHOD_CASH,
            'amount' => '17.25',
        ];

        $first = $this->actingAs($cashier)
            ->withHeaders(['Idempotency-Key' => 'payment-key-1'])
            ->postJson("/api/invoices/{$invoiceId}/payments", $payload)
            ->assertCreated()
            ->json('data.payment');

        $second = $this->actingAs($cashier)
            ->withHeaders(['Idempotency-Key' => 'payment-key-1'])
            ->postJson("/api/invoices/{$invoiceId}/payments", $payload)
            ->assertCreated()
            ->json('data.payment');

        $this->assertSame($first['id'], $second['id']);
        $this->assertSame(1, Payment::query()->count());
        $this->assertDatabaseHas('invoices', [
            'id' => $invoiceId,
            'paid_amount' => '17.25',
            'balance_due' => '0.00',
            'status' => Invoice::STATUS_PAID,
        ]);
    }

    public function test_reused_payment_idempotency_key_with_different_payload_returns_conflict(): void
    {
        $this->seedBillingBase();
        FiscalSetting::query()->update(['partial_payments_enabled' => true]);
        $cashier = $this->cashier();
        $sessionId = $this->openSession($cashier, '500.00');
        $invoiceId = $this->createInvoice($cashier, 'Glucosa');

        $this->actingAs($cashier)
            ->withHeaders(['Idempotency-Key' => 'payment-key-conflict'])
            ->postJson("/api/invoices/{$invoiceId}/payments", [
                'cash_session_id' => $sessionId,
                'method' => Payment::METHOD_CASH,
                'amount' => '10.00',
            ])
            ->assertCreated();

        $this->actingAs($cashier)
            ->withHeaders(['Idempotency-Key' => 'payment-key-conflict'])
            ->postJson("/api/invoices/{$invoiceId}/payments", [
                'cash_session_id' => $sessionId,
                'method' => Payment::METHOD_CASH,
                'amount' => '7.25',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('idempotency_key');

        $this->assertSame(1, Payment::query()->count());
    }

    public function test_cash_session_cannot_close_with_partial_invoice_balance(): void
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
            ->assertJsonPath('data.invoice.status', Invoice::STATUS_PARTIAL);

        $this->actingAs($cashier)
            ->postJson("/api/cash-sessions/{$sessionId}/close", ['closing_amount' => '510.00'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('cash_session');

        $this->assertDatabaseHas('cash_register_sessions', [
            'id' => $sessionId,
            'status' => CashRegisterSession::STATUS_OPEN,
        ]);
    }

    public function test_cash_session_cannot_close_paid_invoice_without_institutional_receipt(): void
    {
        $this->seedBillingBase();
        $cashier = $this->cashier();
        $sessionId = $this->openSession($cashier, '500.00');
        $invoiceId = $this->createInvoice($cashier, 'Glucosa');
        $cashier->syncRoles([]);
        $cashier->syncPermissions(['payments.create', 'cash.close']);
        $cashier->refresh();

        $this->actingAs($cashier)
            ->postJson("/api/invoices/{$invoiceId}/payments", [
                'cash_session_id' => $sessionId,
                'method' => Payment::METHOD_CASH,
                'amount' => '17.25',
            ])
            ->assertCreated()
            ->assertJsonPath('data.invoice.status', Invoice::STATUS_PAID)
            ->assertJsonPath('data.receipt_outcome', 'recovery_required')
            ->assertJsonPath('data.institutional_receipt', null)
            ->assertJsonPath(
                'data.institutional_receipt_error',
                'Pago registrado. Un usuario autorizado debe emitir el recibo institucional desde Historial de facturas.',
            );

        $this->assertDatabaseHas('payments', [
            'invoice_id' => $invoiceId,
            'status' => Payment::STATUS_POSTED,
        ]);

        $this->actingAs($cashier)
            ->postJson("/api/cash-sessions/{$sessionId}/close", ['closing_amount' => '517.25'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('cash_session')
            ->assertJsonPath('errors.cash_session.0', 'No se puede cerrar la caja con 1 factura(s) pagadas sin recibo institucional emitido. Genere el recibo institucional pendiente antes de cerrar.');

        $this->assertDatabaseHas('cash_register_sessions', [
            'id' => $sessionId,
            'status' => CashRegisterSession::STATUS_OPEN,
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
                'amount' => '10.00',
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
                'reason' => '   ',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('reason');

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

    public function test_receipt_view_writes_audit_without_mutating_invoice_or_reprint_count(): void
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
            ->getJson("/api/invoices/{$invoiceId}/receipt?width=half_letter")
            ->assertOk()
            ->assertJsonPath('data.width', 'half_letter')
            ->assertJsonPath('data.invoice.status', Invoice::STATUS_PAID)
            ->assertJsonPath('data.invoice.paid_amount', '17.25')
            ->assertJsonPath('data.invoice.balance_due', '0.00');

        $audit = AuditLog::query()
            ->where('action', 'receipt.viewed')
            ->where('entity_type', Invoice::class)
            ->where('entity_id', $invoiceId)
            ->firstOrFail();

        $this->assertSame($cashier->id, $audit->user_id);
        $this->assertSame('success', $audit->result);
        $this->assertSame('half_letter', $audit->new_values['width'] ?? null);
        $this->assertSame('paid', $audit->new_values['invoice_status'] ?? null);
        $this->assertSame(0, AuditLog::query()
            ->where('entity_type', Invoice::class)
            ->where('entity_id', $invoiceId)
            ->where('action', 'invoice.reprinted')
            ->count());
        $this->assertDatabaseHas('invoices', [
            'id' => $invoiceId,
            'status' => Invoice::STATUS_PAID,
            'paid_amount' => '17.25',
            'balance_due' => '0.00',
        ]);
    }

    public function test_payment_reversal_cash_movement_uses_amount_cents_as_financial_source(): void
    {
        $this->seedBillingBase();
        $cashier = $this->cashier();
        $supervisor = User::factory()->create();
        $supervisor->assignRole('supervisor');
        $sessionId = $this->openSession($cashier, '500.00');
        $invoiceId = $this->createInvoice($cashier, 'Glucosa');

        $paymentId = $this->actingAs($cashier)
            ->postJson("/api/invoices/{$invoiceId}/payments", [
                'cash_session_id' => $sessionId,
                'method' => Payment::METHOD_CASH,
                'amount' => '17.25',
            ])
            ->assertCreated()
            ->json('data.payment.id');

        Payment::query()
            ->whereKey($paymentId)
            ->update(['amount' => '99.99']);
        Invoice::query()
            ->whereKey($invoiceId)
            ->update(['total' => '99.99']);

        $this->actingAs($supervisor)
            ->postJson("/api/invoices/{$invoiceId}/payments/{$paymentId}/void", [
                'reason' => 'Correccion de monto en caja',
            ])
            ->assertOk()
            ->assertJsonPath('data.invoice.status', Invoice::STATUS_ISSUED)
            ->assertJsonPath('data.invoice.paid_amount', '0.00')
            ->assertJsonPath('data.invoice.balance_due', '17.25');

        $this->assertDatabaseHas('cash_movements', [
            'cash_session_id' => $sessionId,
            'payment_id' => $paymentId,
            'type' => CashMovement::TYPE_PAYMENT_VOID,
            'method' => Payment::METHOD_CASH,
            'amount' => '-17.25',
        ]);
    }

    public function test_legacy_receipt_uses_cents_as_financial_source_when_decimal_columns_drift(): void
    {
        $this->seedBillingBase();
        $cashier = $this->cashier();
        $sessionId = $this->openSession($cashier, '500.00');
        $invoiceId = $this->createInvoice($cashier, 'Glucosa');

        $paymentId = $this->actingAs($cashier)
            ->postJson("/api/invoices/{$invoiceId}/payments", [
                'cash_session_id' => $sessionId,
                'method' => Payment::METHOD_CASH,
                'amount' => '17.25',
            ])
            ->assertCreated()
            ->json('data.payment.id');

        Payment::query()
            ->whereKey($paymentId)
            ->update(['amount' => '99.99']);
        Invoice::query()
            ->whereKey($invoiceId)
            ->update([
                'total' => '99.99',
                'paid_amount' => '99.99',
                'balance_due' => '99.99',
            ]);

        $this->actingAs($cashier)
            ->getJson("/api/invoices/{$invoiceId}/receipt?width=half_letter")
            ->assertOk()
            ->assertJsonPath('data.invoice.total', '17.25')
            ->assertJsonPath('data.invoice.paid_amount', '17.25')
            ->assertJsonPath('data.invoice.balance_due', '0.00')
            ->assertJsonPath('data.payments.0.amount', '17.25');
    }

    public function test_voiding_payment_from_closed_cash_session_is_rejected_without_changing_report_snapshot(): void
    {
        $this->seedBillingBase();
        $cashier = $this->cashier();
        $supervisor = User::factory()->create();
        $supervisor->assignRole('supervisor');
        $sessionId = $this->openSession($cashier, '500.00');
        $invoiceId = $this->createInvoice($cashier, 'Glucosa');

        $paymentId = $this->actingAs($cashier)
            ->postJson("/api/invoices/{$invoiceId}/payments", [
                'cash_session_id' => $sessionId,
                'method' => Payment::METHOD_CASH,
                'amount' => '17.25',
            ])
            ->assertCreated()
            ->json('data.payment.id');

        $this->createIssuedInstitutionalReceipt($invoiceId, $sessionId, $cashier);

        $this->actingAs($cashier)
            ->postJson("/api/cash-sessions/{$sessionId}/close", [
                'closing_amount' => '517.25',
            ])
            ->assertOk()
            ->assertJsonPath('data.status', CashRegisterSession::STATUS_CLOSED)
            ->assertJsonPath('data.payments_total_snapshot', '17.25');

        $this->actingAs($supervisor)
            ->postJson("/api/invoices/{$invoiceId}/payments/{$paymentId}/void", [
                'reason' => 'Correccion solicitada despues de cierre',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('cash_session');

        $this->assertDatabaseHas('payments', [
            'id' => $paymentId,
            'status' => Payment::STATUS_POSTED,
            'voided_by' => null,
        ]);
        $this->assertDatabaseMissing('cash_movements', [
            'cash_session_id' => $sessionId,
            'payment_id' => $paymentId,
            'type' => CashMovement::TYPE_PAYMENT_VOID,
        ]);

        $this->actingAs($supervisor)
            ->getJson("/api/reports/cash-sessions/{$sessionId}")
            ->assertOk()
            ->assertJsonPath('data.cash_session.status', CashRegisterSession::STATUS_CLOSED)
            ->assertJsonPath('data.payments_total', '17.25')
            ->assertJsonPath('data.payments_count', 1);
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
            ->assertJsonPath('data.fiscal.cai', 'REAL-CAI-2026')
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

        $receiptInvoice = $receipt->json('data.invoice');
        $receiptPayment = $receipt->json('data.payments.0');
        $this->assertArrayNotHasKey('id', $receiptInvoice);
        $this->assertArrayNotHasKey('id', $receiptPayment);

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
            ->getJson("/api/invoices/{$invoiceId}/receipt?width=a5")
            ->assertOk()
            ->assertJsonPath('data.width', 'a5');

        Invoice::query()->whereKey($invoiceId)->update(['receipt_paper_size' => '80mm']);

        $this->actingAs($cashier)
            ->getJson("/api/invoices/{$invoiceId}/receipt")
            ->assertOk()
            ->assertJsonPath('data.width', '80mm')
            ->assertJsonPath('data.institutional.paper_size', '80mm');
    }

    public function test_zero_total_dialysis_prescription_invoice_creates_zero_payment_trace_without_cash_movement(): void
    {
        $this->seedBillingBase();
        $cashier = $this->cashier();
        $service = Service::query()->where('name', 'Eritropoyetina')->firstOrFail();
        $this->openSession($cashier, '0.00');

        $invoiceId = $this->actingAs($cashier)
            ->postJson('/api/invoices', [
                'patient_name' => 'Maria Lopez',
                'dialysis_prescription' => true,
                'items' => [[
                    'service_id' => $service->id,
                    'quantity' => '1.00',
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
            ->assertJsonPath('data.payments.0.reference', 'Receta dialisis: factura sin cobro')
            ->assertJsonPath('data.payments.0.cashier', $cashier->name);

        $this->assertDatabaseHas('payments', [
            'invoice_id' => $invoiceId,
            'cash_session_id' => CashRegisterSession::query()->where('user_id', $cashier->id)->value('id'),
            'user_id' => $cashier->id,
            'method' => Payment::METHOD_OTHER,
            'amount' => '0.00',
            'amount_cents' => 0,
            'reference' => 'Receta dialisis: factura sin cobro',
            'status' => Payment::STATUS_POSTED,
        ]);
        $this->assertNotNull(Payment::query()->where('invoice_id', $invoiceId)->value('paid_at'));
        $this->assertDatabaseHas('audit_logs', [
            'action' => 'invoice.zero_amount_registered',
            'entity_type' => Invoice::class,
            'entity_id' => $invoiceId,
        ]);
        $this->assertDatabaseMissing('cash_movements', [
            'type' => CashMovement::TYPE_PAYMENT,
            'method' => Payment::METHOD_OTHER,
            'amount' => '0.00',
        ]);

        $this->actingAs($cashier)
            ->getJson('/api/cash-sessions/current')
            ->assertOk()
            ->assertJsonPath('data.payments_count', 1)
            ->assertJsonPath('data.payments_total', '0.00')
            ->assertJsonPath('data.payments_by_method.other', '0.00')
            ->assertJsonPath('data.expected_cash_amount', '0.00');
    }

    public function test_cash_session_can_open_with_zero_initial_cash(): void
    {
        $this->seedBillingBase();
        $cashier = $this->cashier();

        $this->actingAs($cashier)
            ->postJson('/api/cash-sessions/open', ['opening_amount' => '0.00'])
            ->assertCreated()
            ->assertJsonPath('data.opening_amount', '0.00');

        $this->assertDatabaseMissing('cash_movements', [
            'user_id' => $cashier->id,
            'type' => CashMovement::TYPE_OPENING,
            'amount' => '0.00',
        ]);
    }

    public function test_receipt_defaults_to_configured_width_and_uses_payment_cashier(): void
    {
        $this->seedBillingBase();
        FiscalSetting::query()->update(['receipt_paper_size' => 'letter']);
        $issuer = $this->cashier();
        $collector = User::factory()->create(['name' => 'Supervisor Caja']);
        $collector->assignRole('supervisor');
        $sessionId = $this->openSession($collector, '500.00');
        $this->createOpenSessionFixture($issuer, '500.00');
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
            'cai' => 'REAL-CAI-2026',
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

    private function createOpenSessionFixture(User $cashier, string $openingAmount): int
    {
        return CashRegisterSession::query()->create([
            'user_id' => $cashier->id,
            'open_user_id' => $cashier->id,
            'opening_amount' => $openingAmount,
            'status' => CashRegisterSession::STATUS_OPEN,
            'opened_at' => now(),
        ])->id;
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

    private function createIssuedInstitutionalReceipt(int $invoiceId, int $sessionId, User $cashier): void
    {
        $invoice = Invoice::query()->findOrFail($invoiceId);
        $number = 90000000 + $invoice->id;
        $series = InstitutionalReceiptSeries::query()->create([
            'document_type' => InstitutionalReceiptSeries::DOCUMENT_TYPE,
            'series' => 'REC-TST',
            'prefix' => 'RT',
            'number_format' => '{series}-{number:08}',
            'min_number' => 1,
            'max_number' => 99999999,
            'current_number' => $number,
            'active' => false,
        ]);

        InstitutionalReceipt::query()->create([
            'invoice_id' => $invoice->id,
            'payment_id' => Payment::query()
                ->where('invoice_id', $invoice->id)
                ->where('cash_session_id', $sessionId)
                ->where('status', Payment::STATUS_POSTED)
                ->value('id'),
            'cash_session_id' => $sessionId,
            'series_id' => $series->id,
            'receipt_number' => $number,
            'receipt_number_full' => 'REC-TST-'.str_pad((string) $number, 8, '0', STR_PAD_LEFT),
            'status' => InstitutionalReceipt::STATUS_ISSUED,
            'amount' => $invoice->total,
            'amount_cents' => $invoice->total_cents,
            'issued_at' => now(),
            'issued_by' => $cashier->id,
            'payer_name' => $invoice->patient_name,
            'concept' => 'Servicios hospitalarios',
            'amount_words' => 'Monto de prueba',
            'template_code' => 'institutional_classic',
            'print_profile_code' => 'half_letter',
            'copy_mode' => 'original_only',
            'institution_snapshot' => ['hospital_name' => 'Hospital San Isidro'],
            'series_snapshot' => ['series' => 'REC-TST'],
            'profile_snapshot' => ['code' => 'half_letter'],
            'invoice_snapshot' => ['invoice_number' => $invoice->invoice_number],
            'payment_snapshot' => null,
            'items_snapshot' => [],
        ]);
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
