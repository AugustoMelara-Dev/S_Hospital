<?php

namespace Tests\Feature;

use App\Actions\Billing\CreateInvoiceAction;
use App\Actions\Cash\OpenCashSessionAction;
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
use Database\Seeders\ReceiptPrintProfileSeeder;
use Database\Seeders\RolesAndPermissionsSeeder;
use Database\Seeders\ServiceCatalogSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class InvoiceReverseTest extends TestCase
{
    use RefreshDatabase;

    public function test_reverse_paid_invoice_voids_payments_then_voids_invoice(): void
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
            ->postJson("/api/invoices/{$invoiceId}/reverse", [
                'reason' => 'Factura cobrada por error tras reimprimir muestra',
            ])
            ->assertOk()
            ->assertJsonPath('data.status', Invoice::STATUS_VOID)
            ->assertJsonPath('data.paid_amount', '0.00')
            ->assertJsonPath('data.balance_due', '17.25')
            ->assertJsonPath('data.void_reason', 'Factura cobrada por error tras reimprimir muestra')
            ->assertJsonPath('data.payments.0.status', Payment::STATUS_VOID);

        $this->assertDatabaseHas('payments', [
            'id' => $paymentId,
            'status' => Payment::STATUS_VOID,
        ]);

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'invoice.reversed',
            'entity_type' => Invoice::class,
            'entity_id' => $invoiceId,
        ]);

        $this->assertSame(1, CashMovement::query()
            ->where('type', CashMovement::TYPE_PAYMENT_VOID)
            ->where('payment_id', $paymentId)
            ->count());
    }

    public function test_reverse_with_multiple_payments_voids_all_and_recomputes_invoice(): void
    {
        $this->seedBillingBase(partialPayments: true);
        $cashier = $this->cashier();
        $supervisor = $this->supervisor();
        $sessionId = $this->openSession($cashier);
        $invoiceId = $this->createInvoice($cashier, 'Jose Perez', 'Hemograma Completo');

        $first = $this->actingAs($cashier)
            ->postJson("/api/invoices/{$invoiceId}/payments", [
                'cash_session_id' => $sessionId,
                'method' => Payment::METHOD_CASH,
                'amount' => '5.75',
            ])->assertCreated()->json('data.payment.id');

        $second = $this->actingAs($cashier)
            ->postJson("/api/invoices/{$invoiceId}/payments", [
                'cash_session_id' => $sessionId,
                'method' => Payment::METHOD_CARD,
                'amount' => '5.75',
            ])->assertCreated()->json('data.payment.id');

        $this->actingAs($supervisor)
            ->postJson("/api/invoices/{$invoiceId}/reverse", [
                'reason' => 'Multiples pagos cobrados al paciente equivocado',
            ])
            ->assertOk()
            ->assertJsonPath('data.status', Invoice::STATUS_VOID)
            ->assertJsonPath('data.paid_amount', '0.00');

        $this->assertDatabaseHas('payments', ['id' => $first, 'status' => Payment::STATUS_VOID]);
        $this->assertDatabaseHas('payments', ['id' => $second, 'status' => Payment::STATUS_VOID]);

        $this->assertSame(2, CashMovement::query()
            ->where('type', CashMovement::TYPE_PAYMENT_VOID)
            ->whereIn('payment_id', [$first, $second])
            ->count());
    }

    public function test_reverse_paid_invoice_voids_issued_institutional_receipt_with_audit(): void
    {
        $this->seedBillingBase(createInstitutionalReceiptSeries: true);
        $cashier = $this->cashier();
        $supervisor = $this->supervisor();
        $sessionId = $this->openSession($cashier);
        $invoiceId = $this->createInvoice($cashier, 'Paciente con recibo', 'Glucosa');

        $receiptId = $this->actingAs($cashier)
            ->postJson("/api/invoices/{$invoiceId}/payments", [
                'cash_session_id' => $sessionId,
                'method' => Payment::METHOD_CASH,
                'amount' => '17.25',
            ])
            ->assertCreated()
            ->assertJsonPath('data.institutional_receipt.status', InstitutionalReceipt::STATUS_ISSUED)
            ->json('data.institutional_receipt.id');

        $this->actingAs($supervisor)
            ->postJson("/api/invoices/{$invoiceId}/reverse", [
                'reason' => 'Factura cobrada con recibo institucional equivocado',
            ])
            ->assertOk()
            ->assertJsonPath('data.status', Invoice::STATUS_VOID);

        $this->assertDatabaseHas('institutional_receipts', [
            'id' => $receiptId,
            'status' => InstitutionalReceipt::STATUS_VOID,
            'voided_by' => $supervisor->id,
            'void_reason' => 'Reverso de factura: Factura cobrada con recibo institucional equivocado',
        ]);
        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $supervisor->id,
            'action' => 'institutional_receipt.voided',
            'entity_type' => InstitutionalReceipt::class,
            'entity_id' => $receiptId,
        ]);
    }

    public function test_reverse_paid_invoice_after_cash_session_close_is_rejected_without_mutating_closed_cash(): void
    {
        $this->seedBillingBase();
        $cashier = $this->cashier();
        $supervisor = $this->supervisor();
        $sessionId = $this->openSession($cashier);
        $invoiceId = $this->createInvoice($cashier, 'Paciente cierre', 'Glucosa');

        $paymentId = $this->actingAs($cashier)
            ->postJson("/api/invoices/{$invoiceId}/payments", [
                'cash_session_id' => $sessionId,
                'method' => Payment::METHOD_CASH,
                'amount' => '17.25',
            ])->assertCreated()->json('data.payment.id');

        $this->actingAs($cashier)
            ->postJson("/api/cash-sessions/{$sessionId}/close", [
                'closing_amount' => '517.25',
            ])
            ->assertOk();

        $this->actingAs($supervisor)
            ->postJson("/api/invoices/{$invoiceId}/reverse", [
                'reason' => 'Correccion administrativa posterior al cierre',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('cash_session');

        $this->assertDatabaseHas('payments', [
            'id' => $paymentId,
            'status' => Payment::STATUS_POSTED,
        ]);

        $this->assertSame(0, CashMovement::query()
            ->where('type', CashMovement::TYPE_PAYMENT_VOID)
            ->where('payment_id', $paymentId)
            ->count());

        $this->assertDatabaseHas('invoices', [
            'id' => $invoiceId,
            'status' => Invoice::STATUS_PAID,
        ]);
    }

    public function test_reverse_unpaid_invoice_is_rejected_without_mutating_invoice(): void
    {
        $this->seedBillingBase();
        $cashier = $this->cashier();
        $supervisor = $this->supervisor();
        $this->openSession($cashier);
        $invoiceId = $this->createInvoice($cashier, 'Solo emitida', 'Glucosa');

        $this->actingAs($supervisor)
            ->postJson("/api/invoices/{$invoiceId}/reverse", [
                'reason' => 'Emitida por error antes de cobrar',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('invoice');

        $this->assertSame(0, CashMovement::query()
            ->where('type', CashMovement::TYPE_PAYMENT_VOID)
            ->count());

        $this->assertDatabaseHas('invoices', [
            'id' => $invoiceId,
            'status' => Invoice::STATUS_ISSUED,
            'void_reason' => null,
            'voided_by' => null,
        ]);
    }

    public function test_reverse_requires_the_invoices_reverse_permission(): void
    {
        $this->seedBillingBase();
        $cashier = $this->cashier();
        $this->openSession($cashier);
        $invoiceId = $this->createInvoice($cashier, 'Maria Lopez', 'Glucosa');

        $this->actingAs($cashier)
            ->postJson("/api/invoices/{$invoiceId}/reverse", [
                'reason' => 'Intento sin permiso',
            ])
            ->assertForbidden();
    }

    public function test_reverse_rejects_short_reason(): void
    {
        $this->seedBillingBase();
        $cashier = $this->cashier();
        $supervisor = $this->supervisor();
        $this->openSession($cashier);
        $invoiceId = $this->createInvoice($cashier, 'Maria Lopez', 'Glucosa');

        $this->actingAs($supervisor)
            ->postJson("/api/invoices/{$invoiceId}/reverse", [
                'reason' => 'no',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('reason');
    }

    public function test_reverse_on_already_void_invoice_rejects(): void
    {
        $this->seedBillingBase();
        $cashier = $this->cashier();
        $supervisor = $this->supervisor();
        $this->openSession($cashier);
        $invoiceId = $this->createInvoice($cashier, 'Maria Lopez', 'Glucosa');

        $this->actingAs($supervisor)
            ->postJson("/api/invoices/{$invoiceId}/void", [
                'reason' => 'Anulacion normal sin pagos',
            ])
            ->assertOk();

        $this->actingAs($supervisor)
            ->postJson("/api/invoices/{$invoiceId}/reverse", [
                'reason' => 'Intento de reverso sobre ya anulada',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('invoice');
    }

    public function test_reverse_after_all_payments_are_voided_is_rejected_without_mutating_invoice(): void
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
            ])->assertCreated()->json('data.payment.id');

        // Manually void the payment first; this simulates a previous
        // supervisor action. The reverse flow now finds no posted
        // payments and just voids the invoice.
        $this->actingAs($supervisor)
            ->postJson("/api/invoices/{$invoiceId}/payments/{$paymentId}/void", [
                'reason' => 'Reverso previo manual',
            ])
            ->assertOk();

        $this->actingAs($supervisor)
            ->postJson("/api/invoices/{$invoiceId}/reverse", [
                'reason' => 'Reverso final tras pago ya anulado',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('invoice');

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'payment.voided',
            'entity_id' => $paymentId,
        ]);
        $this->assertDatabaseMissing('audit_logs', [
            'action' => 'invoice.reversed',
            'entity_id' => $invoiceId,
        ]);
        $this->assertDatabaseHas('invoices', [
            'id' => $invoiceId,
            'status' => Invoice::STATUS_ISSUED,
            'void_reason' => null,
            'voided_by' => null,
        ]);
    }

    private function seedBillingBase(bool $partialPayments = false, bool $createInstitutionalReceiptSeries = false): void
    {
        $this->seed([RolesAndPermissionsSeeder::class, ServiceCatalogSeeder::class, ReceiptPrintProfileSeeder::class]);
        FiscalSetting::query()->create([
            'receipt_template_mode' => $createInstitutionalReceiptSeries ? 'institutional' : 'thermal',
            'hospital_name' => 'Hospital San Isidro',
            'rtn' => '08011999123456',
            'default_tax_rate' => '15.00',
            'receipt_paper_size' => 'half_letter',
            'partial_payments_enabled' => $partialPayments,
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

        if ($createInstitutionalReceiptSeries) {
            InstitutionalReceiptSeries::query()->create([
                'document_type' => InstitutionalReceiptSeries::DOCUMENT_TYPE,
                'series' => 'REC-A',
                'prefix' => 'RA',
                'number_format' => '{series}-{number:08}',
                'min_number' => 1,
                'max_number' => 100,
                'current_number' => 0,
                'range_authorization' => 'AUT-REC',
                'legal_text' => 'Suscribe. CERTIFICA haber enterado en esta oficina la suma de',
                'receipt_number_color' => '#b91c1c',
                'active' => true,
            ]);
        }
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
