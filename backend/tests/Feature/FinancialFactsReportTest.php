<?php

namespace Tests\Feature;

use App\Models\FiscalSequence;
use App\Models\FiscalSetting;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\Service;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Database\Seeders\ServiceCatalogSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class FinancialFactsReportTest extends TestCase
{
    use RefreshDatabase;

    public function test_daily_report_separates_billed_collected_pending_partial_and_voided_amounts(): void
    {
        $this->seedBillingBase();
        FiscalSetting::query()->update(['partial_payments_enabled' => true]);
        $cashier = $this->cashier();
        $sessionId = $this->openSession($cashier, '500.00');

        $paidCashInvoice = $this->createInvoice($cashier, 'Glucosa');
        $partialTransferInvoice = $this->createInvoice($cashier, 'Hemograma Completo');
        $issuedUnpaidInvoice = $this->createInvoice($cashier, 'Eritropoyetina');
        $voidCardInvoice = $this->createInvoice($cashier, 'Glucosa');

        $this->payInvoice($cashier, $paidCashInvoice, $sessionId, Payment::METHOD_CASH, '17.25');
        $this->payInvoice($cashier, $partialTransferInvoice, $sessionId, Payment::METHOD_TRANSFER, '5.00');
        $this->payInvoice($cashier, $voidCardInvoice, $sessionId, Payment::METHOD_CARD, '17.25');

        Invoice::query()->whereKey($voidCardInvoice)->update([
            'status' => Invoice::STATUS_VOID,
            'voided_by' => $this->supervisor()->id,
            'voided_at' => now(),
            'void_reason' => 'No debe inflar ingresos',
        ]);

        $this->actingAs($this->supervisor())
            ->getJson('/api/reports/daily?date='.now()->toDateString())
            ->assertOk()
            ->assertJsonPath('data.total_billed', '57.50')
            ->assertJsonPath('data.total_collected', '22.25')
            ->assertJsonPath('data.total_pending', '35.25')
            ->assertJsonPath('data.total_partial', '11.50')
            ->assertJsonPath('data.total_voided', '17.25')
            ->assertJsonPath('data.payment_count', 2)
            ->assertJsonPath('data.payments_by_method.cash', '17.25')
            ->assertJsonPath('data.payments_by_method.transfer', '5.00')
            ->assertJsonPath('data.payments_by_method.card', '0.00')
            ->assertJsonPath('data.invoices_by_status.issued.count', 1)
            ->assertJsonPath('data.invoices_by_status.partial.count', 1)
            ->assertJsonPath('data.invoices_by_status.paid.count', 1)
            ->assertJsonPath('data.invoices_by_status.void.count', 1)
            ->assertJsonPath('data.invoices_by_status.partial.total', '11.50')
            ->assertJsonPath('data.invoices_by_status.void.total', '17.25');

        $this->assertDatabaseHas('invoices', [
            'id' => $partialTransferInvoice,
            'status' => Invoice::STATUS_PARTIAL,
            'paid_amount' => '5.00',
            'balance_due' => '6.50',
        ]);
        $this->assertDatabaseHas('invoices', [
            'id' => $issuedUnpaidInvoice,
            'status' => Invoice::STATUS_ISSUED,
            'balance_due' => '28.75',
        ]);
    }

    public function test_income_report_exposes_same_financial_fact_fields_for_date_ranges(): void
    {
        $this->seedBillingBase();
        FiscalSetting::query()->update(['partial_payments_enabled' => true]);
        $cashier = $this->cashier();
        $sessionId = $this->openSession($cashier, '100.00');
        $paidInvoice = $this->createInvoice($cashier, 'Glucosa');
        $partialInvoice = $this->createInvoice($cashier, 'Hemograma Completo');
        $voidInvoice = $this->createInvoice($cashier, 'Eritropoyetina');

        $this->payInvoice($cashier, $paidInvoice, $sessionId, Payment::METHOD_CASH, '17.25');
        $this->payInvoice($cashier, $partialInvoice, $sessionId, Payment::METHOD_OTHER, '1.50');
        $this->payInvoice($cashier, $voidInvoice, $sessionId, Payment::METHOD_CARD, '28.75');

        Invoice::query()->whereKey($voidInvoice)->update([
            'status' => Invoice::STATUS_VOID,
            'voided_by' => $this->supervisor()->id,
            'voided_at' => now(),
            'void_reason' => 'Anulada para reporte',
        ]);

        $query = http_build_query([
            'date_from' => now()->toDateString(),
            'date_to' => now()->toDateString(),
        ]);

        $this->actingAs($this->admin())
            ->getJson("/api/reports/income?{$query}")
            ->assertOk()
            ->assertJsonPath('data.total_billed', '28.75')
            ->assertJsonPath('data.total_collected', '18.75')
            ->assertJsonPath('data.total_pending', '10.00')
            ->assertJsonPath('data.total_partial', '11.50')
            ->assertJsonPath('data.total_voided', '28.75')
            ->assertJsonPath('data.payments_by_method.cash', '17.25')
            ->assertJsonPath('data.payments_by_method.other', '1.50')
            ->assertJsonPath('data.payments_by_method.card', '0.00')
            ->assertJsonPath('data.invoice_count', 3)
            ->assertJsonPath('data.payment_count', 2);
    }

    public function test_income_report_counts_unpaid_invoices_when_not_payment_scoped(): void
    {
        $this->seedBillingBase();
        $cashier = $this->cashier();
        $sessionId = $this->openSession($cashier, '100.00');
        $paidInvoice = $this->createInvoice($cashier, 'Glucosa');
        $this->createInvoice($cashier, 'Eritropoyetina');

        $this->payInvoice($cashier, $paidInvoice, $sessionId, Payment::METHOD_CASH, '17.25');

        $query = http_build_query([
            'date_from' => now()->toDateString(),
            'date_to' => now()->toDateString(),
        ]);

        $this->actingAs($this->admin())
            ->getJson("/api/reports/income?{$query}")
            ->assertOk()
            ->assertJsonPath('data.total_billed', '46.00')
            ->assertJsonPath('data.total_collected', '17.25')
            ->assertJsonPath('data.total_pending', '28.75')
            ->assertJsonPath('data.invoice_count', 2)
            ->assertJsonPath('data.payment_count', 1);
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
            'partial_payments_enabled' => true,
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

    private function admin(): User
    {
        $admin = User::factory()->create();
        $admin->assignRole('admin');

        return $admin;
    }

    private function supervisor(): User
    {
        $supervisor = User::factory()->create();
        $supervisor->assignRole('supervisor');

        return $supervisor;
    }

    private function cashier(): User
    {
        $cashier = User::factory()->create();
        $cashier->assignRole('cajero');

        return $cashier;
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

    private function payInvoice(
        User $cashier,
        int $invoiceId,
        int $sessionId,
        string $method,
        string $amount,
    ): void {
        $this->actingAs($cashier)
            ->postJson("/api/invoices/{$invoiceId}/payments", [
                'cash_session_id' => $sessionId,
                'method' => $method,
                'amount' => $amount,
            ])
            ->assertCreated();
    }
}
