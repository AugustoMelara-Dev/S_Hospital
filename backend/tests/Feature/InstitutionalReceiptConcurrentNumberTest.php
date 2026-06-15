<?php

namespace Tests\Feature;

use App\Actions\InstitutionalReceipts\ReserveInstitutionalReceiptNumberAction;
use App\Models\CashRegisterSession;
use App\Models\FiscalSequence;
use App\Models\InstitutionalReceipt;
use App\Models\InstitutionalReceiptSeries;
use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Models\Payment;
use App\Models\User;
use Database\Seeders\ReceiptPrintProfileSeeder;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class InstitutionalReceiptConcurrentNumberTest extends TestCase
{
    use RefreshDatabase;

    public function test_receipt_number_reservation_uses_row_lock_and_unique_receipt_number_constraint(): void
    {
        $reflection = new \ReflectionClass(ReserveInstitutionalReceiptNumberAction::class);
        $source = file_get_contents($reflection->getFileName());

        $this->assertStringContainsString(
            'lockForUpdate',
            (string) $source,
            'Institutional receipt number reservation must lock the active series row before incrementing the current number.'
        );

        $this->assertTrue(
            collect(\Schema::getIndexes('institutional_receipts'))
                ->contains(fn (array $index): bool => ($index['unique'] ?? false) === true
                    && in_array('receipt_number_full', $index['columns'] ?? [], true)),
            'institutional_receipts.receipt_number_full must remain uniquely indexed as the database safety net.'
        );
    }

    public function test_sequential_lock_simulation_reserves_monotonic_unique_numbers(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $this->seed(ReceiptPrintProfileSeeder::class);

        $user = User::factory()->create();
        $user->assignRole('cajero');

        $cashSession = CashRegisterSession::query()->create([
            'user_id' => $user->id,
            'open_user_id' => $user->id,
            'opening_amount' => '100.00',
            'status' => CashRegisterSession::STATUS_OPEN,
            'opened_at' => now(),
        ]);

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

        $series = InstitutionalReceiptSeries::query()->create([
            'document_type' => InstitutionalReceiptSeries::DOCUMENT_TYPE,
            'series' => 'REC-C',
            'prefix' => 'RC',
            'number_format' => '{prefix}-{number:08}',
            'min_number' => 10,
            'max_number' => 12,
            'current_number' => 9,
            'active' => true,
            'created_by' => $user->id,
            'updated_by' => $user->id,
        ]);

        $first = $this->createPaidInvoice($sequence, $cashSession, $user, 'INV-CON-0001');
        $second = $this->createPaidInvoice($sequence, $cashSession, $user, 'INV-CON-0002');

        $this->actingAs($user)
            ->postJson('/api/institutional-receipts', ['invoice_id' => $first->id])
            ->assertCreated()
            ->assertJsonPath('data.receipt_number', 10)
            ->assertJsonPath('data.receipt_number_full', 'RC-00000010');

        $this->actingAs($user)
            ->postJson('/api/institutional-receipts', ['invoice_id' => $second->id])
            ->assertCreated()
            ->assertJsonPath('data.receipt_number', 11)
            ->assertJsonPath('data.receipt_number_full', 'RC-00000011');

        $this->assertSame(11, $series->fresh()->current_number);
        $this->assertSame(
            ['RC-00000010', 'RC-00000011'],
            InstitutionalReceipt::query()->orderBy('receipt_number')->pluck('receipt_number_full')->all()
        );
    }

    private function createPaidInvoice(
        FiscalSequence $sequence,
        CashRegisterSession $cashSession,
        User $user,
        string $invoiceNumber,
    ): Invoice {
        $invoice = Invoice::query()->create([
            'invoice_number' => $invoiceNumber,
            'fiscal_sequence_id' => $sequence->id,
            'tax_label' => 'ISV',
            'tax_rate_snapshot' => '15.00',
            'patient_name' => 'Paciente '.$invoiceNumber,
            'subtotal' => '25.00',
            'subtotal_cents' => 2500,
            'tax_amount' => '0.00',
            'tax_amount_cents' => 0,
            'discount_amount' => '0.00',
            'discount_amount_cents' => 0,
            'total' => '25.00',
            'total_cents' => 2500,
            'paid_amount' => '25.00',
            'paid_amount_cents' => 2500,
            'balance_due' => '0.00',
            'balance_due_cents' => 0,
            'status' => Invoice::STATUS_PAID,
            'cash_session_id' => $cashSession->id,
            'issued_by' => $user->id,
            'issued_at' => now(),
        ]);

        InvoiceItem::query()->create([
            'invoice_id' => $invoice->id,
            'service_name' => 'Eritropoyetina',
            'category_name' => 'Medicamentos',
            'area_name' => 'Farmacia',
            'quantity' => '1.00',
            'quantity_cents' => 100,
            'unit_price' => '25.00',
            'unit_price_cents' => 2500,
            'tax_rate' => '0.00',
            'tax_amount' => '0.00',
            'tax_amount_cents' => 0,
            'line_subtotal' => '25.00',
            'line_subtotal_cents' => 2500,
            'line_total' => '25.00',
            'line_total_cents' => 2500,
            'special_rule_applied' => false,
        ]);

        Payment::query()->create([
            'invoice_id' => $invoice->id,
            'cash_session_id' => $cashSession->id,
            'user_id' => $user->id,
            'method' => Payment::METHOD_CASH,
            'amount' => '25.00',
            'amount_cents' => 2500,
            'status' => Payment::STATUS_POSTED,
            'paid_at' => now(),
        ]);

        return $invoice;
    }
}
