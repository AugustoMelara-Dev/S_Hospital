<?php

declare(strict_types=1);

namespace Tests\Feature\Billing;

use App\Actions\InstitutionalReceipts\InstitutionalReceiptPdfService;
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
use Mockery\MockInterface;
use Tests\TestCase;

/**
 * R2-MONEY-BE (task 3): a PDF generation failure must never charge again.
 *
 * Requesting the PDF of an already issued institutional receipt is a read
 * operation. If the PDF engine fails, the response may be an error, but the
 * payment, cash movement and receipt counts must stay untouched, and retrying
 * the PDF must not register a second payment.
 */
class PdfFailureDoesNotRechargeTest extends TestCase
{
    use RefreshDatabase;

    public function test_failed_pdf_generation_does_not_register_a_second_payment(): void
    {
        $this->seedBillingBase();
        $cashier = $this->cashier();
        $sessionId = $this->openSession($cashier);
        $glucose = Service::query()->where('name', 'Glucosa')->firstOrFail();

        $invoiceId = $this->actingAs($cashier)
            ->postJson('/api/invoices', [
                'patient_name' => 'Pdf Falla',
                'items' => [['service_id' => $glucose->id, 'quantity' => '1.00']],
            ])
            ->assertCreated()
            ->json('data.id');

        $receiptId = $this->actingAs($cashier)
            ->postJson("/api/invoices/{$invoiceId}/payments", [
                'cash_session_id' => $sessionId,
                'method' => Payment::METHOD_CASH,
                'amount' => '17.25',
            ])
            ->assertCreated()
            ->assertJsonPath('data.receipt_outcome', 'issued')
            ->json('data.institutional_receipt.id');

        $this->assertNotNull($receiptId);
        $this->assertSame(1, Payment::query()->where('invoice_id', $invoiceId)->count());

        // Simulate a PDF engine failure for the document request.
        $this->mock(
            InstitutionalReceiptPdfService::class,
            function (MockInterface $mock): void {
                $mock->shouldReceive('pdfForAuthorizedReceipt')
                    ->andThrow(new \RuntimeException('pdf engine unavailable'));
            },
        );

        $this->actingAs($cashier)
            ->postJson("/api/institutional-receipts/{$receiptId}/pdf")
            ->assertStatus(500);

        // Retry: still no second charge, movement or receipt.
        $this->actingAs($cashier)
            ->postJson("/api/institutional-receipts/{$receiptId}/pdf")
            ->assertStatus(500);

        $this->assertSame(1, Payment::query()->where('invoice_id', $invoiceId)->count());
        $this->assertSame(1, CashMovement::query()->where('cash_session_id', $sessionId)->count());
        $this->assertSame(1, InstitutionalReceipt::query()->where('invoice_id', $invoiceId)->count());

        $invoice = Invoice::query()->findOrFail($invoiceId);
        $this->assertSame(Invoice::STATUS_PAID, $invoice->status);
        $this->assertSame(1725, (int) $invoice->paid_amount_cents);
        $this->assertSame(0, (int) $invoice->balance_due_cents);
    }

    private function seedBillingBase(): void
    {
        $this->seed([RolesAndPermissionsSeeder::class, ServiceCatalogSeeder::class, ReceiptPrintProfileSeeder::class]);

        FiscalSetting::query()->create([
            'receipt_template_mode' => 'institutional',
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
        $cashier = User::factory()->create(['username' => 'pdf-'.uniqid()]);
        $cashier->assignRole('cajero');

        return $cashier->refresh();
    }

    private function openSession(User $cashier): int
    {
        $session = CashRegisterSession::query()->create([
            'user_id' => $cashier->id,
            'open_user_id' => $cashier->id,
            'opening_amount' => '500.00',
            'status' => CashRegisterSession::STATUS_OPEN,
            'opened_at' => now(),
        ]);

        return (int) $session->id;
    }
}
