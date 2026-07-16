<?php

namespace Tests\Feature;

use App\Actions\Billing\CreateInvoiceAction;
use App\Actions\Cash\OpenCashSessionAction;
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
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class InvoiceReconciliationFiltersTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

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

    public function test_pending_reconciliation_filter_includes_direct_and_posted_payment_invoices_only(): void
    {
        [$targetCashier, $targetSession] = $this->cashierWithOpenSession();
        [, $otherSession] = $this->cashierWithClosedSession();

        $directInvoice = $this->createInvoice($targetCashier, 'Pendiente directa');
        $postedPaymentInvoice = $this->moveToSession(
            $this->createInvoice($targetCashier, 'Parcial antigua con pago en caja'),
            $otherSession,
        );
        $otherSessionInvoice = $this->moveToSession(
            $this->createInvoice($targetCashier, 'Pendiente de otra caja'),
            $otherSession,
        );
        $voidPaymentInvoice = $this->moveToSession(
            $this->createInvoice($targetCashier, 'Pago anulado en caja objetivo'),
            $otherSession,
        );

        $this->markPartial($postedPaymentInvoice, now()->subDays(3));
        $this->createPayment($postedPaymentInvoice, $targetSession, $targetCashier, Payment::STATUS_POSTED);
        $this->markPartial($voidPaymentInvoice, now());
        $this->createPayment($voidPaymentInvoice, $targetSession, $targetCashier, Payment::STATUS_VOID);

        $response = $this->actingAs($this->admin())
            ->getJson('/api/invoices?balance_state=pending&reconciliation_cash_session_id='.$targetSession->id)
            ->assertOk()
            ->assertJsonPath('meta.total', 2);

        $ids = collect($response->json('data'))->pluck('id');
        $this->assertTrue($ids->contains($directInvoice->id));
        $this->assertTrue($ids->contains($postedPaymentInvoice->id));
        $this->assertFalse($ids->contains($otherSessionInvoice->id));
        $this->assertFalse($ids->contains($voidPaymentInvoice->id));

        $directSessionResponse = $this->actingAs($this->admin())
            ->getJson('/api/invoices?date_from='.now()->subDays(5)->toDateString().'&cash_session_id='.$targetSession->id)
            ->assertOk();
        $directSessionIds = collect($directSessionResponse->json('data'))->pluck('id');
        $this->assertTrue($directSessionIds->contains($directInvoice->id));
        $this->assertFalse($directSessionIds->contains($postedPaymentInvoice->id));
        $this->assertSame($otherSession->id, $postedPaymentInvoice->cash_session_id);
    }

    public function test_missing_receipt_reconciliation_filter_includes_direct_and_old_paid_invoice_but_excludes_other_session_and_issued_receipt(): void
    {
        [$targetCashier, $targetSession] = $this->cashierWithOpenSession();
        [, $otherSession] = $this->cashierWithClosedSession();

        $directMissing = $this->markPaid($this->createInvoice($targetCashier, 'Pagada directa sin recibo'));
        $oldPaidInTargetSession = $this->markPaid(
            $this->moveToSession(
                $this->createInvoice($targetCashier, 'Pagada antigua en caja objetivo'),
                $otherSession,
            ),
            now()->subDays(4),
        );
        $this->createPayment($oldPaidInTargetSession, $targetSession, $targetCashier, Payment::STATUS_POSTED);

        $otherSessionMissing = $this->markPaid($this->moveToSession(
            $this->createInvoice($targetCashier, 'Pagada sin recibo de otra caja'),
            $otherSession,
        ));
        $withIssuedReceipt = $this->markPaid($this->createInvoice($targetCashier, 'Pagada con recibo'));
        $this->createIssuedReceipt($withIssuedReceipt, $targetSession, $targetCashier);

        $response = $this->actingAs($this->admin())
            ->getJson('/api/invoices?receipt_state=missing&reconciliation_cash_session_id='.$targetSession->id)
            ->assertOk()
            ->assertJsonPath('meta.total', 2);

        $ids = collect($response->json('data'))->pluck('id');
        $this->assertTrue($ids->contains($directMissing->id));
        $this->assertTrue($ids->contains($oldPaidInTargetSession->id));
        $this->assertFalse($ids->contains($otherSessionMissing->id));
        $this->assertFalse($ids->contains($withIssuedReceipt->id));
    }

    public function test_reconciliation_filter_values_and_required_session_are_validated(): void
    {
        [, $session] = $this->cashierWithOpenSession();
        $admin = $this->admin();

        $this->actingAs($admin)
            ->getJson('/api/invoices?balance_state=overdue&reconciliation_cash_session_id='.$session->id)
            ->assertUnprocessable()
            ->assertJsonValidationErrors('balance_state');

        $this->actingAs($admin)
            ->getJson('/api/invoices?receipt_state=missing')
            ->assertUnprocessable()
            ->assertJsonValidationErrors('reconciliation_cash_session_id');

        $this->actingAs($admin)
            ->getJson('/api/invoices?balance_state=pending&receipt_state=missing&reconciliation_cash_session_id='.$session->id)
            ->assertUnprocessable()
            ->assertJsonValidationErrors('balance_state');

    }

    /** @return array{User, CashRegisterSession} */
    private function cashierWithOpenSession(): array
    {
        $cashier = User::factory()->create();
        $cashier->assignRole('cajero');
        $cashier = $cashier->refresh()->load('roles.permissions');
        $session = app(OpenCashSessionAction::class)
            ->execute(['opening_amount' => '500.00'], $cashier);

        return [$cashier, $session];
    }

    /** @return array{User, CashRegisterSession} */
    private function cashierWithClosedSession(): array
    {
        $cashier = User::factory()->create();
        $cashier->assignRole('cajero');
        $cashier = $cashier->refresh()->load('roles.permissions');
        $session = CashRegisterSession::query()->create([
            'user_id' => $cashier->id,
            'open_user_id' => $cashier->id,
            'closed_by_user_id' => $cashier->id,
            'opening_amount' => '500.00',
            'closing_amount' => '500.00',
            'expected_amount' => '500.00',
            'difference_amount' => '0.00',
            'status' => CashRegisterSession::STATUS_CLOSED,
            'opened_at' => now()->subDays(5),
            'closed_at' => now()->subDays(5)->addHour(),
        ]);

        return [$cashier, $session];
    }

    private function createInvoice(User $cashier, string $patientName): Invoice
    {
        return app(CreateInvoiceAction::class)->execute([
            'patient_name' => $patientName,
            'items' => [[
                'service_id' => Service::query()->where('name', 'Glucosa')->firstOrFail()->id,
                'quantity' => '1.00',
            ]],
        ], $cashier->fresh());
    }

    private function moveToSession(Invoice $invoice, CashRegisterSession $session): Invoice
    {
        $invoice->forceFill(['cash_session_id' => $session->id])->save();

        return $invoice->refresh();
    }

    private function markPartial(Invoice $invoice, mixed $issuedAt): Invoice
    {
        $invoice->forceFill([
            'status' => Invoice::STATUS_PARTIAL,
            'paid_amount' => '5.00',
            'paid_amount_cents' => 500,
            'balance_due' => '12.25',
            'balance_due_cents' => 1225,
            'issued_at' => $issuedAt,
        ])->save();

        return $invoice->refresh();
    }

    private function markPaid(Invoice $invoice, mixed $issuedAt = null): Invoice
    {
        $invoice->forceFill([
            'status' => Invoice::STATUS_PAID,
            'paid_amount' => $invoice->total,
            'paid_amount_cents' => $invoice->total_cents,
            'balance_due' => '0.00',
            'balance_due_cents' => 0,
            ...($issuedAt ? ['issued_at' => $issuedAt] : []),
        ])->save();

        return $invoice->refresh();
    }

    private function createPayment(
        Invoice $invoice,
        CashRegisterSession $session,
        User $cashier,
        string $status,
    ): Payment {
        return Payment::query()->create([
            'invoice_id' => $invoice->id,
            'cash_session_id' => $session->id,
            'user_id' => $cashier->id,
            'method' => Payment::METHOD_CASH,
            'amount' => '5.00',
            'amount_cents' => 500,
            'status' => $status,
            'paid_at' => now(),
        ]);
    }

    private function createIssuedReceipt(
        Invoice $invoice,
        CashRegisterSession $session,
        User $cashier,
    ): InstitutionalReceipt {
        $series = InstitutionalReceiptSeries::query()->create([
            'document_type' => InstitutionalReceiptSeries::DOCUMENT_TYPE,
            'series' => 'REC-A',
            'prefix' => 'RA',
            'number_format' => '{series}-{number:08}',
            'min_number' => 1,
            'max_number' => 100,
            'current_number' => 1,
            'active' => true,
        ]);

        return InstitutionalReceipt::query()->create([
            'invoice_id' => $invoice->id,
            'cash_session_id' => $session->id,
            'series_id' => $series->id,
            'receipt_number' => 1,
            'receipt_number_full' => 'REC-A-00000001',
            'status' => InstitutionalReceipt::STATUS_ISSUED,
            'amount' => $invoice->total,
            'amount_cents' => $invoice->total_cents,
            'issued_at' => now(),
            'issued_by' => $cashier->id,
            'payer_name' => $invoice->patient_name,
            'concept' => 'Servicios hospitalarios',
            'amount_words' => 'DIECISIETE LEMPIRAS CON 25/100 CENTAVOS',
            'template_code' => 'institutional_classic',
            'print_profile_code' => 'half_letter',
            'copy_mode' => 'original_only',
            'institution_snapshot' => [],
            'series_snapshot' => [],
            'profile_snapshot' => [],
            'invoice_snapshot' => [],
            'items_snapshot' => [],
        ]);
    }

    private function admin(): User
    {
        $admin = User::factory()->create();
        $admin->assignRole('admin');

        return $admin->refresh()->load('roles.permissions');
    }
}
