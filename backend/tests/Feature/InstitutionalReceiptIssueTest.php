<?php

namespace Tests\Feature;

use App\Models\CashRegisterSession;
use App\Models\FiscalSequence;
use App\Models\FiscalSetting;
use App\Models\InstitutionalReceipt;
use App\Models\InstitutionalReceiptSeries;
use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Models\Payment;
use App\Models\ReceiptPrintProfile;
use App\Models\ReceiptProfileAssignment;
use App\Models\User;
use Database\Seeders\ReceiptPrintProfileSeeder;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class InstitutionalReceiptIssueTest extends TestCase
{
    use RefreshDatabase;

    public function test_cashier_can_issue_first_receipt_number_for_own_paid_invoice(): void
    {
        $context = $this->createIssueContext();

        $response = $this->actingAs($context['user'])
            ->postJson('/api/institutional-receipts', [
                'invoice_id' => $context['invoice']->id,
                'payment_id' => $context['payment']->id,
            ])
            ->assertCreated()
            ->assertJsonPath('data.receipt_number', 1)
            ->assertJsonPath('data.receipt_number_full', 'REC-A-00000001')
            ->assertJsonPath('data.status', InstitutionalReceipt::STATUS_ISSUED)
            ->assertJsonPath('data.amount', '1234.56')
            ->assertJsonPath('data.amount_cents', 123456)
            ->assertJsonPath('data.payer_name', 'Maria Lopez')
            ->assertJsonPath('data.template_code', 'institutional_classic')
            ->assertJsonPath('data.print_profile_code', ReceiptPrintProfile::CODE_HALF_LETTER)
            ->assertJsonPath('data.copy_mode', 'original_only');

        $receiptId = $response->json('data.id');

        $this->assertDatabaseHas('institutional_receipt_series', [
            'id' => $context['series']->id,
            'current_number' => 1,
        ]);
        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $context['user']->id,
            'action' => 'institutional_receipt.issued',
            'entity_type' => InstitutionalReceipt::class,
            'entity_id' => $receiptId,
        ]);

        $receipt = InstitutionalReceipt::query()->findOrFail($receiptId);
        $this->assertSame('MIL DOSCIENTOS TREINTA Y CUATRO LEMPIRAS CON 56/100 CENTAVOS', $receipt->amount_words);
        $this->assertNull($receipt->pdf_disk);
        $this->assertNull($receipt->pdf_path);
        $this->assertNull($receipt->pdf_sha256);
    }

    public function test_issue_rejects_secondary_thermal_profile_when_requested_directly(): void
    {
        $context = $this->createIssueContext();
        $thermalProfile = ReceiptPrintProfile::query()
            ->where('code', ReceiptPrintProfile::CODE_THERMAL_80)
            ->firstOrFail();
        $thermalProfile->update(['active' => true]);

        $this->actingAs($context['user'])
            ->postJson('/api/institutional-receipts', [
                'invoice_id' => $context['invoice']->id,
                'payment_id' => $context['payment']->id,
                'profile_code' => ReceiptPrintProfile::CODE_THERMAL_80,
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('profile_code');

        $this->actingAs($context['user'])
            ->postJson('/api/institutional-receipts', [
                'invoice_id' => $context['invoice']->id,
                'payment_id' => $context['payment']->id,
                'profile_id' => $thermalProfile->id,
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('profile_id');

        $this->assertDatabaseCount('institutional_receipts', 0);
        $this->assertSame(0, $context['series']->fresh()->current_number);
    }

    public function test_issue_rejects_secondary_thermal_profile_from_assignment(): void
    {
        $context = $this->createIssueContext();
        $thermalProfile = ReceiptPrintProfile::query()
            ->where('code', ReceiptPrintProfile::CODE_THERMAL_80)
            ->firstOrFail();
        $thermalProfile->update(['active' => true]);

        ReceiptProfileAssignment::query()->create([
            'receipt_print_profile_id' => $thermalProfile->id,
            'scope_type' => ReceiptProfileAssignment::SCOPE_GLOBAL,
            'scope_id' => null,
            'active' => true,
            'created_by' => $context['user']->id,
            'updated_by' => $context['user']->id,
        ]);

        $this->actingAs($context['user'])
            ->postJson('/api/institutional-receipts', [
                'invoice_id' => $context['invoice']->id,
                'payment_id' => $context['payment']->id,
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('print_profile');

        $this->assertDatabaseCount('institutional_receipts', 0);
        $this->assertSame(0, $context['series']->fresh()->current_number);
    }

    public function test_exhausted_series_rejects_issue_without_creating_receipt(): void
    {
        $context = $this->createIssueContext(seriesOverrides: [
            'max_number' => 1,
            'current_number' => 1,
        ]);

        $this->actingAs($context['user'])
            ->postJson('/api/institutional-receipts', [
                'invoice_id' => $context['invoice']->id,
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('series');

        $this->assertDatabaseCount('institutional_receipts', 0);
        $this->assertSame(1, $context['series']->fresh()->current_number);
    }

    public function test_duplicate_issue_for_same_non_void_invoice_is_rejected(): void
    {
        $context = $this->createIssueContext();

        $this->actingAs($context['user'])
            ->postJson('/api/institutional-receipts', [
                'invoice_id' => $context['invoice']->id,
            ])
            ->assertCreated();

        $this->actingAs($context['user'])
            ->postJson('/api/institutional-receipts', [
                'invoice_id' => $context['invoice']->id,
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('invoice_id');

        $this->assertDatabaseCount('institutional_receipts', 1);
        $this->assertSame(1, $context['series']->fresh()->current_number);
    }

    public function test_unpaid_invoice_is_rejected(): void
    {
        $context = $this->createIssueContext(invoiceOverrides: [
            'paid_amount' => '25.00',
            'paid_amount_cents' => 2500,
            'balance_due' => '1209.56',
            'balance_due_cents' => 120956,
            'status' => Invoice::STATUS_PARTIAL,
        ], createPayment: false);

        $this->actingAs($context['user'])
            ->postJson('/api/institutional-receipts', [
                'invoice_id' => $context['invoice']->id,
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('invoice_id');

        $this->assertDatabaseCount('institutional_receipts', 0);
        $this->assertSame(0, $context['series']->fresh()->current_number);
    }

    public function test_zero_total_paid_invoice_can_issue_without_artificial_payment(): void
    {
        $context = $this->createIssueContext(invoiceOverrides: [
            'subtotal' => '0.00',
            'subtotal_cents' => 0,
            'tax_amount' => '0.00',
            'tax_amount_cents' => 0,
            'total' => '0.00',
            'total_cents' => 0,
            'paid_amount' => '0.00',
            'paid_amount_cents' => 0,
            'balance_due' => '0.00',
            'balance_due_cents' => 0,
            'status' => Invoice::STATUS_PAID,
        ], itemOverrides: [
            'unit_price' => '0.00',
            'unit_price_cents' => 0,
            'tax_amount' => '0.00',
            'tax_amount_cents' => 0,
            'line_subtotal' => '0.00',
            'line_subtotal_cents' => 0,
            'line_total' => '0.00',
            'line_total_cents' => 0,
            'special_rule_code' => 'dialysis_prescription',
            'special_rule_applied' => true,
        ], createPayment: false);

        $this->actingAs($context['user'])
            ->postJson('/api/institutional-receipts', [
                'invoice_id' => $context['invoice']->id,
            ])
            ->assertCreated()
            ->assertJsonPath('data.amount', '0.00')
            ->assertJsonPath('data.amount_words', 'CERO LEMPIRAS CON 00/100 CENTAVOS')
            ->assertJsonPath('data.payment_id', null);

        $receipt = InstitutionalReceipt::query()->firstOrFail();
        $this->assertNull($receipt->payment_snapshot['selected_payment']);
        $this->assertSame([], $receipt->payment_snapshot['posted_payments']);
    }

    public function test_issue_rejects_cash_session_that_does_not_match_invoice_payment_context(): void
    {
        $context = $this->createIssueContext();
        $otherUser = User::factory()->create();
        $otherUser->assignRole('cajero');
        $otherSession = CashRegisterSession::query()->create([
            'user_id' => $otherUser->id,
            'open_user_id' => $otherUser->id,
            'opening_amount' => '100.00',
            'status' => CashRegisterSession::STATUS_OPEN,
            'opened_at' => now(),
        ]);

        $this->actingAs($context['user'])
            ->postJson('/api/institutional-receipts', [
                'invoice_id' => $context['invoice']->id,
                'cash_session_id' => $otherSession->id,
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('cash_session_id');

        $this->assertDatabaseCount('institutional_receipts', 0);
        $this->assertSame(0, $context['series']->fresh()->current_number);
    }

    public function test_cashier_cannot_issue_for_inaccessible_invoice(): void
    {
        $ownerContext = $this->createIssueContext();
        $cashier = User::factory()->create();
        $cashier->assignRole('cajero');

        $this->actingAs($cashier)
            ->postJson('/api/institutional-receipts', [
                'invoice_id' => $ownerContext['invoice']->id,
            ])
            ->assertForbidden();

        $this->assertDatabaseCount('institutional_receipts', 0);
    }

    public function test_snapshot_excludes_barcode_qr_scan_internal_ids_and_status_fields(): void
    {
        $context = $this->createIssueContext(itemOverrides: [
            'scan_code' => 'SCAN-123',
            'barcode' => 'BAR-456',
            'qr_code' => 'QR-789',
        ]);

        $this->actingAs($context['user'])
            ->postJson('/api/institutional-receipts', [
                'invoice_id' => $context['invoice']->id,
                'payment_id' => $context['payment']->id,
            ])
            ->assertCreated();

        $receipt = InstitutionalReceipt::query()->firstOrFail();

        $this->assertSame('Consulta general', $receipt->items_snapshot[0]['service_name']);
        $this->assertSame('Consulta', $receipt->items_snapshot[0]['category_name']);
        $this->assertSnapshotDoesNotExposeTechnicalFields([
            'institution' => $receipt->institution_snapshot,
            'series' => $receipt->series_snapshot,
            'profile' => $receipt->profile_snapshot,
            'invoice' => $receipt->invoice_snapshot,
            'payment' => $receipt->payment_snapshot,
            'items' => $receipt->items_snapshot,
        ]);
    }

    /**
     * @param  array<string, mixed>  $invoiceOverrides
     * @param  array<string, mixed>  $seriesOverrides
     * @param  array<string, mixed>  $itemOverrides
     * @return array{user: User, cashSession: CashRegisterSession, invoice: Invoice, payment: Payment|null, series: InstitutionalReceiptSeries}
     */
    private function createIssueContext(
        array $invoiceOverrides = [],
        array $seriesOverrides = [],
        array $itemOverrides = [],
        bool $createPayment = true,
    ): array {
        $this->seed(RolesAndPermissionsSeeder::class);
        $this->seed(ReceiptPrintProfileSeeder::class);

        FiscalSetting::query()->create([
            'hospital_name' => 'Hospital San Isidro',
            'rtn' => '08011999123456',
            'default_tax_rate' => '15.00',
            'receipt_width' => '80mm',
            'primary_color' => 'indigo',
            'address' => 'Barrio El Centro',
            'slogan' => 'Servicio institucional',
            'scanner_enabled' => false,
            'partial_payments_enabled' => false,
            'receipt_template_mode' => 'institutional',
            'receipt_paper_size' => 'half_letter',
            'government_line' => 'Gobierno de Honduras',
            'secretariat_line' => 'Secretaria de Salud',
            'receipt_location' => 'La Esperanza',
            'receipt_footer_text' => 'Gracias por su pago',
        ]);

        $user = User::factory()->create(['name' => 'Cajera Uno']);
        $user->assignRole('cajero');

        $sequence = FiscalSequence::query()->create([
            'document_type' => 'invoice',
            'prefix' => '000-001-01',
            'min_number' => 1,
            'max_number' => 99999999,
            'current_number' => 1,
            'cai' => 'CAI-TEST-'.bin2hex(random_bytes(3)),
            'valid_until' => now()->addYear()->toDateString(),
            'active' => false,
        ]);

        $cashSession = CashRegisterSession::query()->create([
            'user_id' => $user->id,
            'open_user_id' => $user->id,
            'opening_amount' => '100.00',
            'status' => CashRegisterSession::STATUS_OPEN,
            'opened_at' => now(),
        ]);

        $invoice = Invoice::query()->create([
            'invoice_number' => 'INV-'.str_pad((string) random_int(1, 99999999), 8, '0', STR_PAD_LEFT),
            'fiscal_sequence_id' => $sequence->id,
            'hospital_name' => 'Hospital San Isidro',
            'hospital_rtn' => '08011999123456',
            'hospital_address' => 'Barrio El Centro',
            'hospital_slogan' => 'Servicio institucional',
            'receipt_template_mode' => 'institutional',
            'receipt_paper_size' => 'half_letter',
            'receipt_government_line' => 'Gobierno de Honduras',
            'receipt_secretariat_line' => 'Secretaria de Salud',
            'receipt_location' => 'La Esperanza',
            'receipt_footer_text' => 'Gracias por su pago',
            'tax_label' => 'ISV',
            'tax_rate_snapshot' => '15.00',
            'patient_name' => 'Maria Lopez',
            'subtotal' => '1073.53',
            'subtotal_cents' => 107353,
            'tax_amount' => '161.03',
            'tax_amount_cents' => 16103,
            'discount_amount' => '0.00',
            'discount_amount_cents' => 0,
            'total' => '1234.56',
            'total_cents' => 123456,
            'paid_amount' => '1234.56',
            'paid_amount_cents' => 123456,
            'balance_due' => '0.00',
            'balance_due_cents' => 0,
            'status' => Invoice::STATUS_PAID,
            'cash_session_id' => $cashSession->id,
            'issued_by' => $user->id,
            'issued_at' => now(),
            ...$invoiceOverrides,
        ]);

        InvoiceItem::query()->create([
            'invoice_id' => $invoice->id,
            'service_name' => 'Consulta general',
            'category_name' => 'Consulta',
            'area_name' => 'Caja',
            'scan_code' => null,
            'barcode' => null,
            'qr_code' => null,
            'quantity' => '1.00',
            'quantity_cents' => 100,
            'unit_price' => '1073.53',
            'unit_price_cents' => 107353,
            'tax_rate' => '15.00',
            'tax_amount' => '161.03',
            'tax_amount_cents' => 16103,
            'line_subtotal' => '1073.53',
            'line_subtotal_cents' => 107353,
            'line_total' => '1234.56',
            'line_total_cents' => 123456,
            'special_rule_applied' => false,
            ...$itemOverrides,
        ]);

        $payment = null;
        if ($createPayment) {
            $payment = Payment::query()->create([
                'invoice_id' => $invoice->id,
                'cash_session_id' => $cashSession->id,
                'user_id' => $user->id,
                'method' => Payment::METHOD_CASH,
                'amount' => '1234.56',
                'amount_cents' => 123456,
                'status' => Payment::STATUS_POSTED,
                'paid_at' => now(),
            ]);
        }

        $series = InstitutionalReceiptSeries::query()->create([
            'document_type' => InstitutionalReceiptSeries::DOCUMENT_TYPE,
            'series' => 'REC-A',
            'prefix' => 'RA',
            'number_format' => '{series}-{number:08}',
            'min_number' => 1,
            'max_number' => 100,
            'current_number' => 0,
            'range_authorization' => 'AUT-REC',
            'legal_text' => 'Recibo institucional',
            'receipt_number_color' => '#b91c1c',
            'active' => true,
            'reprint_behavior' => InstitutionalReceiptSeries::REPRINT_AUDIT_ONLY,
            'void_behavior' => InstitutionalReceiptSeries::VOID_PERMISSION_REASON_AUDIT,
            'created_by' => $user->id,
            'updated_by' => $user->id,
            ...$seriesOverrides,
        ]);

        return [
            'user' => $user,
            'cashSession' => $cashSession,
            'invoice' => $invoice,
            'payment' => $payment,
            'series' => $series,
        ];
    }

    /**
     * @param  array<string, mixed>  $snapshot
     */
    private function assertSnapshotDoesNotExposeTechnicalFields(array $snapshot): void
    {
        $encoded = json_encode($snapshot, JSON_THROW_ON_ERROR);

        foreach ([
            'barcode',
            'qr_code',
            'scan_code',
            'special_rule_code',
            'special_rule_applied',
        ] as $needle) {
            $this->assertStringNotContainsString($needle, $encoded);
        }

        foreach ([
            'id',
            'status',
            'audit',
            'log',
            'entity_id',
            'user_id',
            'cash_session_id',
            'invoice_id',
            'payment_id',
        ] as $forbiddenKey) {
            $this->assertStringNotContainsString('"'.$forbiddenKey.'":', $encoded);
        }
    }
}
