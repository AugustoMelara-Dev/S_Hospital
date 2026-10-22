<?php

namespace Tests\Feature;

use App\Actions\InstitutionalReceipts\InstitutionalReceiptPdfService;
use App\Models\AuditLog;
use App\Models\CashMovement;
use App\Models\CashRegister;
use App\Models\CashRegisterSession;
use App\Models\FiscalSequence;
use App\Models\FiscalSetting;
use App\Models\InstitutionalReceipt;
use App\Models\InstitutionalReceiptPrintEvent;
use App\Models\InstitutionalReceiptSeries;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\Service;
use App\Models\User;
use Closure;
use Database\Seeders\ReceiptPrintProfileSeeder;
use Database\Seeders\RolesAndPermissionsSeeder;
use Database\Seeders\ServiceCatalogSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class InstitutionalReceiptPaymentIntegrationTest extends TestCase
{
    use RefreshDatabase;

    public function test_paid_payment_response_issues_institutional_receipt_with_configured_number(): void
    {
        $this->seedBillingBase();
        $cashier = $this->cashier();
        $sessionId = $this->openSession($cashier);
        $invoiceId = $this->createInvoice($cashier, 'Glucosa');

        $receiptId = $this->actingAs($cashier)
            ->postJson("/api/invoices/{$invoiceId}/payments", [
                'cash_session_id' => $sessionId,
                'method' => Payment::METHOD_CASH,
                'amount' => '17.25',
            ])
            ->assertCreated()
            ->assertJsonPath('data.invoice.status', 'paid')
            ->assertJsonPath('data.receipt_outcome', 'issued')
            ->assertJsonPath('data.institutional_receipt.receipt_number', 1)
            ->assertJsonPath('data.institutional_receipt.receipt_number_full', 'REC-A-00000001')
            // C1-RCP-02 (mandato §12): la instalación nueva resuelve carta
            // vertical como diseño principal, no media carta apaisada.
            ->assertJsonPath('data.institutional_receipt.print_profile_code', 'carta_vertical')
            ->assertJsonPath('data.institutional_receipt_error', null)
            ->json('data.institutional_receipt.id');

        $receipt = InstitutionalReceipt::query()->findOrFail($receiptId);
        $this->assertSame('Maria Lopez', $receipt->payer_name);
        $this->assertSame('Glucosa', $receipt->items_snapshot[0]['service_name']);
        $this->assertSame('DIECISIETE LEMPIRAS CON 25/100 CENTAVOS', $receipt->amount_words);
        $this->assertStringNotContainsString('qr_code', json_encode($receipt->items_snapshot, JSON_THROW_ON_ERROR));
        $this->assertStringNotContainsString('barcode', json_encode($receipt->items_snapshot, JSON_THROW_ON_ERROR));
        $this->assertStringNotContainsString('scan_code', json_encode($receipt->items_snapshot, JSON_THROW_ON_ERROR));

        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $cashier->id,
            'action' => 'institutional_receipt.issued',
            'entity_type' => InstitutionalReceipt::class,
            'entity_id' => $receiptId,
        ]);
        $this->assertDatabaseHas('institutional_receipt_series', [
            'series' => 'REC-A',
            'current_number' => 1,
        ]);
    }

    public function test_partial_payment_waits_until_invoice_is_fully_paid_before_issuing_receipt(): void
    {
        $this->seedBillingBase(partialPayments: true);
        $cashier = $this->cashier();
        $sessionId = $this->openSession($cashier);
        $invoiceId = $this->createInvoice($cashier, 'Glucosa');

        $this->actingAs($cashier)
            ->postJson("/api/invoices/{$invoiceId}/payments", [
                'cash_session_id' => $sessionId,
                'method' => Payment::METHOD_CASH,
                'amount' => '10.00',
            ])
            ->assertCreated()
            ->assertJsonPath('data.invoice.status', 'partial')
            ->assertJsonPath('data.receipt_outcome', 'not_required')
            ->assertJsonPath('data.institutional_receipt', null)
            ->assertJsonPath('data.institutional_receipt_error', null);

        $this->assertDatabaseCount('institutional_receipts', 0);

        $this->actingAs($cashier)
            ->postJson("/api/invoices/{$invoiceId}/payments", [
                'cash_session_id' => $sessionId,
                'method' => Payment::METHOD_TRANSFER,
                'amount' => '7.25',
                'reference' => 'TRX-FINAL',
            ])
            ->assertCreated()
            ->assertJsonPath('data.invoice.status', 'paid')
            ->assertJsonPath('data.receipt_outcome', 'issued')
            ->assertJsonPath('data.institutional_receipt.receipt_number_full', 'REC-A-00000001');

        $this->assertDatabaseCount('institutional_receipts', 1);
    }

    public function test_institutional_receipt_html_lists_each_mixed_payment_with_its_own_details(): void
    {
        Carbon::setTestNow('2026-07-15 08:00:00');

        try {
            $this->seedBillingBase(partialPayments: true);
            $cashier = $this->cashier();
            $sessionId = $this->openSession($cashier);
            $invoiceId = $this->createInvoice($cashier, 'Glucosa');

            Carbon::setTestNow('2026-07-15 08:30:00');
            $this->actingAs($cashier)
                ->postJson("/api/invoices/{$invoiceId}/payments", [
                    'cash_session_id' => $sessionId,
                    'method' => Payment::METHOD_CASH,
                    'amount' => '10.00',
                ])
                ->assertCreated()
                ->assertJsonPath('data.invoice.status', Invoice::STATUS_PARTIAL);

            Carbon::setTestNow('2026-07-15 08:35:00');
            $receiptId = $this->actingAs($cashier)
                ->postJson("/api/invoices/{$invoiceId}/payments", [
                    'cash_session_id' => $sessionId,
                    'method' => Payment::METHOD_TRANSFER,
                    'amount' => '7.25',
                    'reference' => 'TRX-FINAL',
                ])
                ->assertCreated()
                ->assertJsonPath('data.invoice.status', Invoice::STATUS_PAID)
                ->json('data.institutional_receipt.id');

            $html = app(InstitutionalReceiptPdfService::class)
                ->htmlForReceipt(InstitutionalReceipt::query()->findOrFail($receiptId));

            $this->assertStringContainsString('Pagos mixtos (2)', $html);
            $this->assertMatchesRegularExpression(
                '/15\/07\/2026 08:30.*Efectivo.*L\. 10\.00/s',
                $html,
            );
            $this->assertStringContainsString('Sin referencia', $html);
            $this->assertMatchesRegularExpression(
                '/15\/07\/2026 08:35.*Transferencia.*L\. 7\.25.*TRX-FINAL/s',
                $html,
            );
            $this->assertDoesNotMatchRegularExpression(
                '/<span class="label">M[eé]todo<\/span><br>Transferencia.*L\. 17\.25/s',
                $html,
            );
        } finally {
            Carbon::setTestNow();
        }
    }

    public function test_institutional_receipt_snapshot_uses_cents_as_financial_source_when_decimal_columns_drift(): void
    {
        $this->seedBillingBase(createSeries: false);
        $cashier = $this->cashier();
        $sessionId = $this->openSession($cashier);
        $invoiceId = $this->createInvoice($cashier, 'Glucosa');

        $paymentId = $this->actingAs($cashier)
            ->postJson("/api/invoices/{$invoiceId}/payments", [
                'cash_session_id' => $sessionId,
                'method' => Payment::METHOD_CASH,
                'amount' => '17.25',
            ])
            ->assertCreated()
            ->assertJsonPath('data.invoice.status', Invoice::STATUS_PAID)
            ->json('data.payment.id');

        $this->withLegacyDecimalDriftAllowed(function () use ($paymentId, $invoiceId): void {
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
        });

        $this->createReceiptSeries();

        $receiptId = $this->actingAs($cashier)
            ->postJson('/api/institutional-receipts', ['invoice_id' => $invoiceId])
            ->assertCreated()
            ->json('data.id');

        $receipt = InstitutionalReceipt::query()->findOrFail($receiptId);

        $this->assertSame('17.25', $receipt->invoice_snapshot['total']);
        $this->assertSame(1725, $receipt->invoice_snapshot['total_cents']);
        $this->assertSame('17.25', $receipt->invoice_snapshot['paid_amount']);
        $this->assertSame('0.00', $receipt->invoice_snapshot['balance_due']);
        $this->assertNull($receipt->payment_snapshot['selected_payment']);
        $this->assertSame('17.25', $receipt->payment_snapshot['posted_payments'][0]['amount']);
        $this->assertSame(1725, $receipt->payment_snapshot['posted_payments'][0]['amount_cents']);
    }

    public function test_snapshot_uses_the_configured_cash_register_name_not_the_technical_id(): void
    {
        $this->seedBillingBase();
        $cashier = $this->cashier();

        $register = CashRegister::query()->create([
            'code' => 'trc02_principal',
            'name' => 'Caja principal',
            'active' => true,
        ]);

        $sessionId = CashRegisterSession::query()->create([
            'cash_register_id' => $register->id,
            'open_marker' => CashRegisterSession::OPEN_MARKER,
            'user_id' => $cashier->id,
            'open_user_id' => $cashier->id,
            'opening_amount' => '500.00',
            'status' => CashRegisterSession::STATUS_OPEN,
            'opened_at' => now(),
        ])->id;

        $invoiceId = $this->createInvoice($cashier, 'Glucosa');

        $receiptId = $this->actingAs($cashier)
            ->postJson("/api/invoices/{$invoiceId}/payments", [
                'cash_session_id' => $sessionId,
                'method' => Payment::METHOD_CASH,
                'amount' => '17.25',
            ])
            ->assertCreated()
            ->assertJsonPath('data.receipt_outcome', 'issued')
            ->json('data.institutional_receipt.id');

        $receipt = InstitutionalReceipt::query()->findOrFail($receiptId);

        // The operator-facing label is the configured register name; the
        // technical session id is only a fallback when no register is linked.
        $this->assertSame('Caja principal', $receipt->payment_snapshot['cash_context']['cash_register_label']);
        $this->assertStringNotContainsString('Caja #'.$sessionId, $receipt->payment_snapshot['cash_context']['cash_register_label']);
    }

    public function test_voiding_paid_payment_voids_issued_institutional_receipt_with_audit(): void
    {
        $this->seedBillingBase();
        $cashier = $this->cashier();
        $supervisor = $this->supervisor();
        $sessionId = $this->openSession($cashier);
        $invoiceId = $this->createInvoice($cashier, 'Glucosa');

        $response = $this->actingAs($cashier)
            ->postJson("/api/invoices/{$invoiceId}/payments", [
                'cash_session_id' => $sessionId,
                'method' => Payment::METHOD_CASH,
                'amount' => '17.25',
            ])
            ->assertCreated();

        $paymentId = $response->json('data.payment.id');
        $receiptId = $response->json('data.institutional_receipt.id');

        $this->actingAs($supervisor)
            ->postJson("/api/invoices/{$invoiceId}/payments/{$paymentId}/void", [
                'reason' => 'Pago reversado por error de cobro',
            ])
            ->assertOk()
            ->assertJsonPath('data.payment.status', Payment::STATUS_VOID);

        $this->assertDatabaseHas('institutional_receipts', [
            'id' => $receiptId,
            'status' => InstitutionalReceipt::STATUS_VOID,
            'voided_by' => $supervisor->id,
            'void_reason' => 'Pago reversado por error de cobro',
        ]);
        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $supervisor->id,
            'action' => 'institutional_receipt.voided',
            'entity_type' => InstitutionalReceipt::class,
            'entity_id' => $receiptId,
        ]);
    }

    public function test_invoice_history_and_detail_expose_minimal_institutional_receipt_summary(): void
    {
        $this->seedBillingBase();
        $cashier = $this->cashier();
        $sessionId = $this->openSession($cashier);
        $invoiceId = $this->createInvoice($cashier, 'Glucosa');

        $receiptId = $this->actingAs($cashier)
            ->postJson("/api/invoices/{$invoiceId}/payments", [
                'cash_session_id' => $sessionId,
                'method' => Payment::METHOD_CASH,
                'amount' => '17.25',
            ])
            ->assertCreated()
            ->json('data.institutional_receipt.id');

        $detailReceipt = $this->actingAs($cashier)
            ->getJson("/api/invoices/{$invoiceId}")
            ->assertOk()
            ->assertJsonPath('data.institutional_receipt.id', $receiptId)
            ->assertJsonPath('data.institutional_receipt.receipt_number_full', 'REC-A-00000001')
            ->assertJsonPath('data.institutional_receipt.copy_mode', 'original_only')
            ->json('data.institutional_receipt');

        $historyReceipt = $this->actingAs($cashier)
            ->getJson('/api/invoices')
            ->assertOk()
            ->assertJsonPath('data.0.institutional_receipt.id', $receiptId)
            ->assertJsonPath('data.0.institutional_receipt.receipt_number_full', 'REC-A-00000001')
            ->assertJsonPath('data.0.institutional_receipt.copy_mode', 'original_only')
            ->json('data.0.institutional_receipt');

        foreach ([$detailReceipt, $historyReceipt] as $receiptSummary) {
            $this->assertSame([
                'id',
                'receipt_number_full',
                'status',
                'reprint_count',
                'copy_mode',
                'print_events_count',
                'has_print_events',
                'issued_at',
            ], array_keys($receiptSummary));
            $this->assertSame(0, $receiptSummary['print_events_count']);
            $this->assertFalse($receiptSummary['has_print_events']);
            $this->assertArrayNotHasKey('institution_snapshot', $receiptSummary);
            $this->assertArrayNotHasKey('series_snapshot', $receiptSummary);
            $this->assertArrayNotHasKey('profile_snapshot', $receiptSummary);
            $this->assertArrayNotHasKey('items_snapshot', $receiptSummary);
        }
    }

    public function test_institutional_receipt_pdf_get_does_not_record_print_audit(): void
    {
        $this->seedBillingBase();
        $cashier = $this->cashier();
        $sessionId = $this->openSession($cashier);
        $invoiceId = $this->createInvoice($cashier, 'Glucosa');

        $receiptId = $this->actingAs($cashier)
            ->postJson("/api/invoices/{$invoiceId}/payments", [
                'cash_session_id' => $sessionId,
                'method' => Payment::METHOD_CASH,
                'amount' => '17.25',
            ])
            ->assertCreated()
            ->json('data.institutional_receipt.id');

        $this->actingAs($cashier)
            ->get("/api/institutional-receipts/{$receiptId}/pdf")
            ->assertOk()
            ->assertHeader('Content-Type', 'application/pdf');

        $this->assertDatabaseHas('institutional_receipts', [
            'id' => $receiptId,
            'reprint_count' => 0,
        ]);
        $this->assertDatabaseMissing('institutional_receipt_print_events', [
            'institutional_receipt_id' => $receiptId,
        ]);

        $this->actingAs($cashier)
            ->getJson("/api/invoices/{$invoiceId}")
            ->assertOk()
            ->assertJsonPath('data.institutional_receipt.print_events_count', 0)
            ->assertJsonPath('data.institutional_receipt.has_print_events', false);

        $this->actingAs($cashier)
            ->getJson('/api/invoices')
            ->assertOk()
            ->assertJsonPath('data.0.institutional_receipt.print_events_count', 0)
            ->assertJsonPath('data.0.institutional_receipt.has_print_events', false);
    }

    public function test_explicit_print_event_records_first_print_and_idempotent_replay(): void
    {
        $this->seedBillingBase();
        $cashier = $this->cashier();
        $sessionId = $this->openSession($cashier);
        $invoiceId = $this->createInvoice($cashier, 'Glucosa');

        $receiptId = $this->actingAs($cashier)
            ->postJson("/api/invoices/{$invoiceId}/payments", [
                'cash_session_id' => $sessionId,
                'method' => Payment::METHOD_CASH,
                'amount' => '17.25',
            ])
            ->assertCreated()
            ->json('data.institutional_receipt.id');

        $first = $this->actingAs($cashier)
            ->withHeaders(['Idempotency-Key' => 'receipt-print-1'])
            ->postJson("/api/institutional-receipts/{$receiptId}/print-events")
            ->assertCreated()
            ->assertJsonPath('data.event.event_type', InstitutionalReceiptPrintEvent::TYPE_ISSUED_PRINT)
            ->assertJsonPath('data.receipt.reprint_count', 0)
            ->json('data.event.id');

        $second = $this->actingAs($cashier)
            ->withHeaders(['Idempotency-Key' => 'receipt-print-1'])
            ->postJson("/api/institutional-receipts/{$receiptId}/print-events")
            ->assertCreated()
            ->assertHeader('Idempotent-Replay', 'true')
            ->json('data.event.id');

        $this->assertSame($first, $second);
        $this->assertSame(1, InstitutionalReceiptPrintEvent::query()->where('institutional_receipt_id', $receiptId)->count());
    }

    public function test_reprint_event_requires_reason_after_first_print(): void
    {
        $this->seedBillingBase();
        $cashier = $this->cashier();
        $sessionId = $this->openSession($cashier);
        $invoiceId = $this->createInvoice($cashier, 'Glucosa');

        $receiptId = $this->actingAs($cashier)
            ->postJson("/api/invoices/{$invoiceId}/payments", [
                'cash_session_id' => $sessionId,
                'method' => Payment::METHOD_CASH,
                'amount' => '17.25',
            ])
            ->assertCreated()
            ->json('data.institutional_receipt.id');

        $this->actingAs($cashier)
            ->postJson("/api/institutional-receipts/{$receiptId}/print-events")
            ->assertCreated();

        $this->actingAs($cashier)
            ->get("/api/institutional-receipts/{$receiptId}/pdf")
            ->assertOk()
            ->assertHeader('Content-Type', 'application/pdf');

        $this->actingAs($cashier)
            ->postJson("/api/institutional-receipts/{$receiptId}/print-events")
            ->assertUnprocessable()
            ->assertJsonValidationErrors('reason');

        $this->actingAs($cashier)
            ->postJson("/api/institutional-receipts/{$receiptId}/print-events", [
                'reason' => 'Reimpresion solicitada por extravio del comprobante',
            ])
            ->assertCreated()
            ->assertJsonPath('data.event.event_type', InstitutionalReceiptPrintEvent::TYPE_REPRINT)
            ->assertJsonPath('data.receipt.reprint_count', 1);

        $this->assertDatabaseCount('institutional_receipt_print_events', 2);
    }

    public function test_paid_receipt_can_be_issued_after_cash_session_closed_when_payment_was_already_posted(): void
    {
        $this->seedBillingBase(createSeries: false);
        $cashier = $this->cashier();
        $sessionId = $this->openSession($cashier);
        $invoiceId = $this->createInvoice($cashier, 'Glucosa');

        $paymentId = $this->actingAs($cashier)
            ->postJson("/api/invoices/{$invoiceId}/payments", [
                'cash_session_id' => $sessionId,
                'method' => Payment::METHOD_CASH,
                'amount' => '17.25',
            ])
            ->assertCreated()
            ->assertJsonPath('data.invoice.status', 'paid')
            ->assertJsonPath('data.receipt_outcome', 'recovery_required')
            ->assertJsonPath('data.institutional_receipt', null)
            ->assertJsonPath('data.institutional_receipt_error', 'No hay una serie activa para recibos institucionales.')
            ->json('data.payment.id');

        $this->createReceiptSeries();
        CashRegisterSession::query()->whereKey($sessionId)->update([
            'status' => CashRegisterSession::STATUS_CLOSED,
            'closed_at' => now(),
        ]);

        $payload = [
            'invoice_id' => $invoiceId,
            'payment_id' => $paymentId,
            'cash_session_id' => $sessionId,
        ];
        $idempotencyKey = 'receipt-recovery-retry-'.$invoiceId;

        $receiptId = $this->actingAs($cashier)
            ->withHeaders(['Idempotency-Key' => $idempotencyKey])
            ->postJson('/api/institutional-receipts', $payload)
            ->assertCreated()
            ->assertJsonPath('data.cash_session_id', $sessionId)
            ->assertJsonPath('data.payment_id', $paymentId)
            ->json('data.id');

        // Recovery retry is idempotent: replaying the same request reuses the receipt
        // and the original payment, without registering a second charge.
        $this->actingAs($cashier)
            ->withHeaders(['Idempotency-Key' => $idempotencyKey])
            ->postJson('/api/institutional-receipts', $payload)
            ->assertCreated()
            ->assertHeader('Idempotent-Replay', 'true')
            ->assertJsonPath('data.id', $receiptId)
            ->assertJsonPath('data.payment_id', $paymentId);

        $this->assertSame(1, InstitutionalReceipt::query()->where('invoice_id', $invoiceId)->count());
        $this->assertSame(1, Payment::query()->where('invoice_id', $invoiceId)->count());
        $this->assertSame(1, CashMovement::query()->where('cash_session_id', $sessionId)->count());

        $audit = AuditLog::query()
            ->where('action', 'institutional_receipt.issued')
            ->where('entity_id', $receiptId)
            ->firstOrFail();

        $this->assertTrue($audit->new_values['post_close_issue'] ?? false);
    }

    private function seedBillingBase(bool $partialPayments = false, bool $createSeries = true): void
    {
        $this->seed([RolesAndPermissionsSeeder::class, ServiceCatalogSeeder::class, ReceiptPrintProfileSeeder::class]);

        FiscalSetting::query()->create([
            'hospital_name' => 'Hospital San Isidro',
            'rtn' => '08011999123456',
            'default_tax_rate' => '15.00',
            'receipt_paper_size' => 'half_letter',
            'receipt_template_mode' => 'institutional',
            'government_line' => 'Gobierno de Honduras',
            'secretariat_line' => 'Secretaria de Salud',
            'receipt_location' => 'Tocoa, Colon',
            'receipt_footer_text' => 'Original: Oficina Recaudadora',
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

        if ($createSeries) {
            $this->createReceiptSeries();
        }
    }

    private function createReceiptSeries(): void
    {
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

    private function cashier(): User
    {
        $cashier = User::factory()->create();
        $cashier->assignRole('cajero');

        return $cashier->refresh();
    }

    private function supervisor(): User
    {
        $supervisor = User::factory()->create();
        $supervisor->assignRole('supervisor');

        return $supervisor->refresh();
    }

    private function openSession(User $cashier): int
    {
        return CashRegisterSession::query()->create([
            'user_id' => $cashier->id,
            'open_user_id' => $cashier->id,
            'opening_amount' => '500.00',
            'status' => CashRegisterSession::STATUS_OPEN,
            'opened_at' => now(),
        ])->id;
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

    /**
     * Drift decimal/cents deliberado para probar que el snapshot institucional
     * usa las columnas enteras. En MariaDB el CHECK de coherencia (T2-014)
     * bloquearia el UPDATE del drift; se suspende su evaluacion SOLO en esta
     * sesion y se restaura en finally (patron driver-aware de T3-022). Sin DDL:
     * el DDL provoca commit implicito y romperia RefreshDatabase.
     */
    private function withLegacyDecimalDriftAllowed(Closure $callback): mixed
    {
        if (! in_array(DB::connection()->getDriverName(), ['mysql', 'mariadb'], true)) {
            return $callback();
        }

        DB::statement('SET SESSION check_constraint_checks = OFF');

        try {
            return $callback();
        } finally {
            DB::statement('SET SESSION check_constraint_checks = ON');
        }
    }
}
