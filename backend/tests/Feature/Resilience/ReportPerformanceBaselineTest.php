<?php

declare(strict_types=1);

namespace Tests\Feature\Resilience;

use App\Actions\Reports\DailyReportService;
use App\Actions\Reports\DashboardReportService;
use App\Actions\Reports\IncomeReportService;
use App\Models\CashRegisterSession;
use App\Models\FiscalSequence;
use App\Models\FiscalSetting;
use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Models\Payment;
use App\Models\Service;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Database\Seeders\ServiceCatalogSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Resilience audit: a moderately busy day at the cashier desk (100
 * invoices, ~3 payments each) must keep the report endpoints under
 * a reasonable budget on the in-memory SQLite test driver. SQLite is
 * serialized, so the actual MySQL/MariaDB production driver will be
 * faster. The numbers here are regression floors, not SLA targets.
 */
class ReportPerformanceBaselineTest extends TestCase
{
    use RefreshDatabase;

    public function test_daily_report_computes_within_budget_for_typical_day(): void
    {
        $this->seedBillingBase();
        $this->seedOneHundredInvoices();

        $start = microtime(true);
        $report = app(DailyReportService::class)->report(now()->toDateString());
        $elapsed = microtime(true) - $start;

        $this->assertSame(100, $report['invoice_count']);
        $this->assertSame(100, $report['payment_count']);
        $this->assertLessThan(
            2.5,
            $elapsed,
            "Daily report took {$elapsed}s for 100 invoices; expected under 2.5s on SQLite. ".
            'Investigate missing indexes or N+1 queries before shipping.'
        );
    }

    public function test_dashboard_report_computes_within_budget_for_typical_day(): void
    {
        $this->seedBillingBase();
        $this->seedOneHundredInvoices();

        $start = microtime(true);
        $report = app(DashboardReportService::class)->report();
        $elapsed = microtime(true) - $start;

        $this->assertNotEmpty($report['last_7_days']);
        $this->assertNotEmpty($report['current_month']);
        $this->assertNotEmpty($report['payments_by_method']);
        $this->assertLessThan(
            3.0,
            $elapsed,
            "Dashboard report took {$elapsed}s for 100 invoices + 7-day window; expected under 3s on SQLite."
        );
    }

    public function test_income_report_totals_match_seeded_facts(): void
    {
        $this->seedBillingBase();
        $this->seedOneHundredInvoices();

        $expectedTotalCents = (int) Payment::query()
            ->where('status', Payment::STATUS_POSTED)
            ->sum('amount_cents');

        $start = microtime(true);
        $report = app(IncomeReportService::class)->report([
            'date_from' => now()->toDateString(),
            'date_to' => now()->toDateString(),
        ]);
        $elapsed = microtime(true) - $start;

        $reportedTotalCents = (int) round(((float) $report['total_collected']) * 100);

        $this->assertSame(
            $expectedTotalCents,
            $reportedTotalCents,
            'Income report must equal the sum of posted payments for the date range.'
        );
        $this->assertLessThan(
            2.5,
            $elapsed,
            "Income report took {$elapsed}s; expected under 2.5s on SQLite."
        );
    }

    public function test_facturado_cobrado_saldo_cuadra_with_seeded_data(): void
    {
        $this->seedBillingBase();
        $this->seedOneHundredInvoices();

        $totalBilledCents = (int) Invoice::query()
            ->where('status', '!=', Invoice::STATUS_VOID)
            ->sum('total_cents');
        $totalCollectedCents = (int) Payment::query()
            ->where('status', Payment::STATUS_POSTED)
            ->sum('amount_cents');
        $totalBalanceCents = (int) Invoice::query()
            ->whereIn('status', [Invoice::STATUS_ISSUED, Invoice::STATUS_PARTIAL])
            ->sum('balance_due_cents');

        $this->assertSame(
            $totalBilledCents,
            $totalCollectedCents + $totalBalanceCents,
            'facturado - cobrado = saldo. Any drift here is a cents-handling bug.'
        );
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
            'cai' => 'TEST-CAI',
            'valid_until' => now()->addYear()->toDateString(),
            'active' => true,
        ]);
    }

    private function seedOneHundredInvoices(): void
    {
        $cashier = User::factory()->create([
            'username' => 'perf-cashier',
        ]);
        $cashier->assignRole('cajero');
        $session = CashRegisterSession::query()->create([
            'user_id' => $cashier->id,
            'open_user_id' => $cashier->id,
            'opening_amount' => '0.00',
            'status' => CashRegisterSession::STATUS_OPEN,
            'opened_at' => now()->subHour(),
        ]);

        $services = Service::query()
            ->with(['category:id,name', 'area:id,name'])
            ->take(3)
            ->get();
        $fiscalSequence = FiscalSequence::query()->first();
        $totalCents = 0;
        $counter = 1;

        for ($i = 0; $i < 100; $i++) {
            $service = $services[$i % 3];
            $lineSubtotalCents = (int) $service->price_cents;
            $taxCents = (int) round($lineSubtotalCents * 0.15);
            $lineTotalCents = $lineSubtotalCents + $taxCents;
            $totalCents += $lineTotalCents;

            $invoiceNumber = 'PERF-'.str_pad((string) $counter, 8, '0', STR_PAD_LEFT);
            $counter++;

            $invoice = Invoice::query()->create([
                'invoice_number' => $invoiceNumber,
                'fiscal_sequence_id' => $fiscalSequence->id,
                'fiscal_cai' => $fiscalSequence->cai,
                'patient_name' => 'Paciente '.$i,
                'subtotal' => number_format($lineSubtotalCents / 100, 2, '.', ''),
                'subtotal_cents' => $lineSubtotalCents,
                'tax_amount' => number_format($taxCents / 100, 2, '.', ''),
                'tax_amount_cents' => $taxCents,
                'discount_amount' => '0.00',
                'discount_amount_cents' => 0,
                'total' => number_format($lineTotalCents / 100, 2, '.', ''),
                'total_cents' => $lineTotalCents,
                'paid_amount' => number_format($lineTotalCents / 100, 2, '.', ''),
                'paid_amount_cents' => $lineTotalCents,
                'balance_due' => '0.00',
                'balance_due_cents' => 0,
                'status' => Invoice::STATUS_PAID,
                'cash_session_id' => $session->id,
                'issued_by' => $cashier->id,
                'issued_at' => now(),
            ]);

            InvoiceItem::query()->create([
                'invoice_id' => $invoice->id,
                'service_id' => $service->id,
                'service_name' => $service->name,
                'category_id' => $service->category_id,
                'area_id' => $service->area_id,
                'category_name' => $service->category?->name ?? '',
                'area_name' => $service->area?->name ?? '',
                'quantity' => '1.00',
                'quantity_cents' => 100,
                'unit_price' => number_format($service->price_cents / 100, 2, '.', ''),
                'unit_price_cents' => (int) $service->price_cents,
                'tax_rate' => '15.00',
                'tax_amount' => number_format($taxCents / 100, 2, '.', ''),
                'tax_amount_cents' => $taxCents,
                'discount_amount' => '0.00',
                'discount_amount_cents' => 0,
                'line_subtotal' => number_format($lineSubtotalCents / 100, 2, '.', ''),
                'line_subtotal_cents' => $lineSubtotalCents,
                'line_total' => number_format($lineTotalCents / 100, 2, '.', ''),
                'line_total_cents' => $lineTotalCents,
            ]);

            Payment::query()->create([
                'invoice_id' => $invoice->id,
                'cash_session_id' => $session->id,
                'user_id' => $cashier->id,
                'method' => Payment::METHOD_CASH,
                'amount' => number_format($lineTotalCents / 100, 2, '.', ''),
                'amount_cents' => $lineTotalCents,
                'reference' => (string) Str::uuid(),
                'status' => Payment::STATUS_POSTED,
                'paid_at' => now(),
            ]);
        }
    }
}
