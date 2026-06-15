<?php

namespace Tests\Feature;

use App\Models\CashRegisterSession;
use App\Models\FiscalSequence;
use App\Models\InstitutionalReceipt;
use App\Models\InstitutionalReceiptPrintEvent;
use App\Models\InstitutionalReceiptSeries;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\ReceiptPrintProfile;
use App\Models\ReceiptProfileAssignment;
use App\Models\User;
use Database\Seeders\ReceiptPrintProfileSeeder;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class InstitutionalReceiptSettingsMigrationTest extends TestCase
{
    use RefreshDatabase;

    public function test_database_seeding_creates_required_print_profiles_without_thermal_global_default(): void
    {
        $this->seed();

        $this->assertTrue(Schema::hasColumns('receipt_print_profiles', [
            'margin_top_mm',
            'margin_right_mm',
            'margin_bottom_mm',
            'margin_left_mm',
        ]));

        $requiredCodes = [
            'recibo_pequeno_personalizado',
            'media_carta_horizontal',
            'a5_horizontal',
            'carta_horizontal',
        ];

        $this->assertSame(
            $requiredCodes,
            ReceiptPrintProfile::query()
                ->whereIn('code', $requiredCodes)
                ->orderByRaw("case code when 'recibo_pequeno_personalizado' then 1 when 'media_carta_horizontal' then 2 when 'a5_horizontal' then 3 when 'carta_horizontal' then 4 end")
                ->pluck('code')
                ->all()
        );

        $this->assertDatabaseHas('receipt_print_profiles', [
            'code' => 'media_carta_horizontal',
            'paper_kind' => 'half_letter_landscape',
            'margin_top_mm' => '6.00',
            'margin_right_mm' => '6.00',
            'margin_bottom_mm' => '6.00',
            'margin_left_mm' => '6.00',
            'active' => true,
            'is_global_default' => true,
        ]);

        $globalDefaults = ReceiptPrintProfile::query()
            ->where('is_global_default', true)
            ->get();

        $this->assertCount(1, $globalDefaults);
        $this->assertSame('media_carta_horizontal', $globalDefaults->sole()->code);
        $this->assertNotContains($globalDefaults->sole()->paper_kind, ['thermal_80mm', 'thermal_58mm']);

        $this->assertDatabaseHas('receipt_print_profiles', [
            'code' => 'recibo_pequeno_personalizado',
            'paper_kind' => 'custom_mm',
            'width_mm' => '180.00',
            'height_mm' => '95.00',
            'active' => false,
            'is_global_default' => false,
        ]);

        $this->assertFalse(
            ReceiptPrintProfile::query()
                ->whereIn('paper_kind', ['thermal_80mm', 'thermal_58mm'])
                ->where('is_global_default', true)
                ->exists(),
            'Thermal profiles must never be seeded as the global default.'
        );

        foreach ([ReceiptPrintProfile::CODE_THERMAL_80, ReceiptPrintProfile::CODE_THERMAL_58] as $thermalCode) {
            $this->assertDatabaseHas('receipt_print_profiles', [
                'code' => $thermalCode,
                'active' => false,
                'is_global_default' => false,
            ]);
        }
    }

    public function test_print_profile_seeder_preserves_admin_configured_fields_on_rerun(): void
    {
        $this->seed(ReceiptPrintProfileSeeder::class);

        ReceiptPrintProfile::query()
            ->where('code', ReceiptPrintProfile::CODE_HALF_LETTER)
            ->update([
                'width_mm' => '220.00',
                'active' => false,
                'margin_left_mm' => '9.00',
            ]);

        $this->seed(ReceiptPrintProfileSeeder::class);

        $profile = ReceiptPrintProfile::query()
            ->where('code', ReceiptPrintProfile::CODE_HALF_LETTER)
            ->firstOrFail();

        $this->assertSame('220.00', $profile->width_mm);
        $this->assertFalse($profile->active);
        $this->assertSame('9.00', $profile->margin_left_mm);
    }

    public function test_schema_and_models_support_receipts_events_and_assignments_with_existing_references(): void
    {
        $this->assertTrue(Schema::hasColumns('institutional_receipts', [
            'invoice_id',
            'payment_id',
            'cash_session_id',
            'series_id',
            'receipt_number_full',
            'institution_snapshot',
            'series_snapshot',
            'profile_snapshot',
            'items_snapshot',
        ]));

        [
            'user' => $user,
            'cashSession' => $cashSession,
            'invoice' => $invoice,
            'payment' => $payment,
            'series' => $series,
            'profile' => $profile,
            'assignment' => $assignment,
            'receipt' => $receipt,
            'event' => $event,
        ] = $this->createReceiptGraph();

        $this->assertSame($cashSession->id, $receipt->cash_session_id);
        $this->assertSame($user->id, $receipt->issued_by);
        $this->assertSame($user->id, $event->user_id);
        $this->assertSame($receipt->id, $event->institutional_receipt_id);

        $this->assertTrue($series->fresh()->active);
        $this->assertSame('institutional_receipt', $series->fresh()->active_document_type);
        $this->assertTrue($assignment->printProfile->is($profile));
        $this->assertTrue($receipt->invoice->is($invoice));
        $this->assertTrue($receipt->payment->is($payment));
        $this->assertTrue($receipt->cashSession->is($cashSession));
        $this->assertTrue($receipt->series->is($series));
        $this->assertTrue($receipt->issuer->is($user));
        $this->assertTrue($event->receipt->is($receipt));
        $this->assertSame('media_carta_horizontal', $receipt->printProfile?->code);
        $this->assertSame('Hospital configurable', $receipt->institution_snapshot['name']);
    }

    public function test_historical_receipt_links_restrict_parent_deletion(): void
    {
        [
            'invoice' => $invoice,
            'receipt' => $receipt,
        ] = $this->createReceiptGraph();

        try {
            $invoice->delete();
            $this->fail('Deleting an invoice linked to an institutional receipt must be restricted.');
        } catch (QueryException $exception) {
            $this->assertNotSame('', $exception->getMessage());
        }

        try {
            $receipt->delete();
            $this->fail('Deleting a receipt linked to a print event must be restricted.');
        } catch (QueryException $exception) {
            $this->assertNotSame('', $exception->getMessage());
        }
    }

    /**
     * @return array{
     *     user: User,
     *     cashSession: CashRegisterSession,
     *     invoice: Invoice,
     *     payment: Payment,
     *     series: InstitutionalReceiptSeries,
     *     profile: ReceiptPrintProfile,
     *     assignment: ReceiptProfileAssignment,
     *     receipt: InstitutionalReceipt,
     *     event: InstitutionalReceiptPrintEvent
     * }
     */
    private function createReceiptGraph(): array
    {
        $this->seed(ReceiptPrintProfileSeeder::class);

        $user = User::factory()->create();
        $fiscalSequence = FiscalSequence::query()->create([
            'document_type' => 'invoice',
            'prefix' => '000-001-01',
            'min_number' => 1,
            'max_number' => 99999999,
            'current_number' => 0,
            'cai' => 'TEST-CAI-RECEIPT-'.bin2hex(random_bytes(3)),
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
            'invoice_number' => 'TEST-REC-'.str_pad((string) random_int(1, 99999999), 8, '0', STR_PAD_LEFT),
            'fiscal_sequence_id' => $fiscalSequence->id,
            'patient_name' => 'Maria Lopez',
            'subtotal' => '100.00',
            'subtotal_cents' => 10000,
            'tax_amount' => '15.00',
            'tax_amount_cents' => 1500,
            'discount_amount' => '0.00',
            'discount_amount_cents' => 0,
            'total' => '115.00',
            'total_cents' => 11500,
            'paid_amount' => '115.00',
            'paid_amount_cents' => 11500,
            'balance_due' => '0.00',
            'balance_due_cents' => 0,
            'status' => Invoice::STATUS_PAID,
            'cash_session_id' => $cashSession->id,
            'issued_by' => $user->id,
            'issued_at' => now(),
        ]);

        $payment = Payment::query()->create([
            'invoice_id' => $invoice->id,
            'cash_session_id' => $cashSession->id,
            'user_id' => $user->id,
            'method' => Payment::METHOD_CASH,
            'amount' => '115.00',
            'amount_cents' => 11500,
            'status' => Payment::STATUS_POSTED,
            'paid_at' => now(),
        ]);

        $series = InstitutionalReceiptSeries::query()->create([
            'series' => 'REC'.str_pad((string) random_int(1, 999), 3, '0', STR_PAD_LEFT),
            'prefix' => 'REC',
            'min_number' => 1,
            'max_number' => 99999999,
            'current_number' => 1,
            'active' => true,
            'created_by' => $user->id,
            'updated_by' => $user->id,
        ]);

        $profile = ReceiptPrintProfile::query()
            ->where('code', ReceiptPrintProfile::CODE_HALF_LETTER)
            ->firstOrFail();

        $assignment = ReceiptProfileAssignment::query()->create([
            'receipt_print_profile_id' => $profile->id,
            'scope_type' => 'global',
            'scope_id' => null,
            'active' => true,
            'created_by' => $user->id,
            'updated_by' => $user->id,
        ]);

        $receiptNumber = random_int(1, 99999999);
        $receipt = InstitutionalReceipt::query()->create([
            'invoice_id' => $invoice->id,
            'payment_id' => $payment->id,
            'cash_session_id' => $cashSession->id,
            'series_id' => $series->id,
            'receipt_number' => $receiptNumber,
            'receipt_number_full' => 'REC-'.str_pad((string) $receiptNumber, 8, '0', STR_PAD_LEFT),
            'amount' => '115.00',
            'amount_cents' => 11500,
            'issued_at' => now(),
            'issued_by' => $user->id,
            'payer_name' => 'Maria Lopez',
            'concept' => 'Servicios hospitalarios',
            'amount_words' => 'CIENTO QUINCE LEMPIRAS EXACTOS',
            'template_code' => 'institutional_classic',
            'print_profile_code' => $profile->code,
            'copy_mode' => 'original_only',
            'institution_snapshot' => ['name' => 'Hospital configurable'],
            'series_snapshot' => ['series' => $series->series],
            'profile_snapshot' => ['code' => $profile->code],
            'invoice_snapshot' => ['invoice_number' => $invoice->invoice_number],
            'payment_snapshot' => ['method' => $payment->method],
            'items_snapshot' => [['name' => 'Consulta', 'amount' => '115.00']],
        ]);

        $event = InstitutionalReceiptPrintEvent::query()->create([
            'institutional_receipt_id' => $receipt->id,
            'event_type' => 'issued_print',
            'copy_label' => 'ORIGINAL',
            'profile_snapshot' => ['code' => $profile->code],
            'user_id' => $user->id,
            'created_at' => now(),
        ]);

        return [
            'user' => $user,
            'cashSession' => $cashSession,
            'invoice' => $invoice,
            'payment' => $payment,
            'series' => $series,
            'profile' => $profile,
            'assignment' => $assignment,
            'receipt' => $receipt,
            'event' => $event,
        ];
    }
}
