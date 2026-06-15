<?php

namespace Tests\Feature;

use App\Models\CashRegisterSession;
use App\Models\FiscalSequence;
use App\Models\FiscalSetting;
use App\Models\InstitutionalReceipt;
use App\Models\InstitutionalReceiptSeries;
use App\Models\Payment;
use App\Models\Service;
use App\Models\User;
use Database\Seeders\ReceiptPrintProfileSeeder;
use Database\Seeders\RolesAndPermissionsSeeder;
use Database\Seeders\ServiceCatalogSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
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
            ->assertJsonPath('data.institutional_receipt.receipt_number', 1)
            ->assertJsonPath('data.institutional_receipt.receipt_number_full', 'REC-A-00000001')
            ->assertJsonPath('data.institutional_receipt.print_profile_code', 'media_carta_horizontal')
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
            ->assertJsonPath('data.institutional_receipt.receipt_number_full', 'REC-A-00000001');

        $this->assertDatabaseCount('institutional_receipts', 1);
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
            ->json('data.institutional_receipt');

        $historyReceipt = $this->actingAs($cashier)
            ->getJson('/api/invoices')
            ->assertOk()
            ->assertJsonPath('data.0.institutional_receipt.id', $receiptId)
            ->assertJsonPath('data.0.institutional_receipt.receipt_number_full', 'REC-A-00000001')
            ->json('data.0.institutional_receipt');

        foreach ([$detailReceipt, $historyReceipt] as $receiptSummary) {
            $this->assertSame([
                'id',
                'receipt_number_full',
                'status',
                'reprint_count',
                'issued_at',
            ], array_keys($receiptSummary));
            $this->assertArrayNotHasKey('institution_snapshot', $receiptSummary);
            $this->assertArrayNotHasKey('series_snapshot', $receiptSummary);
            $this->assertArrayNotHasKey('profile_snapshot', $receiptSummary);
            $this->assertArrayNotHasKey('items_snapshot', $receiptSummary);
        }
    }

    private function seedBillingBase(bool $partialPayments = false): void
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
}
