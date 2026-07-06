<?php

namespace Tests\Feature;

use App\Actions\Billing\CreateInvoiceAction;
use App\Actions\Cash\OpenCashSessionAction;
use App\Actions\Payments\RegisterPaymentAction;
use App\Models\Area;
use App\Models\AuditLog;
use App\Models\BackupLog;
use App\Models\CashRegisterSession;
use App\Models\Category;
use App\Models\FiscalSequence;
use App\Models\FiscalSetting;
use App\Models\InstitutionalReceiptPrintEvent;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\Service;
use App\Models\User;
use App\Support\InvoiceAccess;
use Barryvdh\DomPDF\Facade\Pdf;
use Barryvdh\DomPDF\PDF as DomPdfWrapper;
use Database\Seeders\RolesAndPermissionsSeeder;
use Database\Seeders\ServiceCatalogSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use PhpOffice\PhpSpreadsheet\IOFactory;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\PermissionRegistrar;
use Tests\TestCase;

class ReportsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }

    public function test_reports_view_permission_is_required(): void
    {
        $this->seedBillingBase();
        $user = User::factory()->create();
        $cashier = $this->cashier();
        $sessionId = $this->openSession($cashier);
        $date = now()->toDateString();

        $this->actingAs($user)
            ->getJson('/api/reports/daily')
            ->assertForbidden();

        $this->actingAs($cashier)
            ->getJson('/api/reports/daily')
            ->assertForbidden();

        $this->actingAs($cashier)
            ->getJson('/api/reports/monthly?month='.now()->format('Y-m'))
            ->assertForbidden();

        $this->actingAs($cashier)
            ->getJson("/api/reports/income?date_from={$date}&date_to={$date}")
            ->assertForbidden();

        $this->actingAs($cashier)
            ->getJson("/api/reports/categories?date_from={$date}&date_to={$date}")
            ->assertForbidden();

        $this->actingAs($cashier)
            ->getJson("/api/reports/services?date_from={$date}&date_to={$date}")
            ->assertForbidden();

        $this->actingAs($user)
            ->getJson("/api/reports/cash-sessions/{$sessionId}")
            ->assertForbidden();
    }

    public function test_supervisor_and_admin_can_access_reports(): void
    {
        $this->seedBillingBase();

        $this->actingAs($this->supervisor())
            ->getJson('/api/reports/daily?date='.now()->toDateString())
            ->assertOk()
            ->assertJsonPath('data.date', now()->toDateString());

        $this->actingAs($this->admin())
            ->getJson('/api/reports/income?date_from='.now()->toDateString().'&date_to='.now()->toDateString())
            ->assertOk()
            ->assertJsonPath('data.total_collected', '0.00');

        $this->actingAs($this->admin())
            ->getJson('/api/reports/monthly?month='.now()->format('Y-m'))
            ->assertOk()
            ->assertJsonPath('data.month', now()->format('Y-m'));
    }

    public function test_dashboard_report_returns_cashier_summary_without_sql_errors(): void
    {
        $this->seedBillingBase();
        $cashier = $this->cashier();
        $sessionId = $this->openSession($cashier);
        $invoiceId = $this->createInvoice($cashier, 'Glucosa');

        $this->payInvoice($cashier, $invoiceId, $sessionId, Payment::METHOD_CASH, '17.25');

        $this->actingAs($this->admin())
            ->getJson('/api/reports/dashboard')
            ->assertOk()
            ->assertJsonPath('data.payments_by_method.cash', '17.25')
            ->assertJsonPath('data.payments_by_method.transfer', '0.00')
            ->assertJsonPath('data.cashiers_summary.0.username', $cashier->username)
            ->assertJsonPath('data.cashiers_summary.0.payment_count', 1)
            ->assertJsonPath('data.cashiers_summary.0.total_collected', '17.25');
    }

    public function test_daily_report_calculates_collected_totals_methods_and_statuses_without_void_income(): void
    {
        $this->seedBillingBase();
        FiscalSetting::query()->update(['partial_payments_enabled' => true]);
        $cashier = $this->cashier();
        $sessionId = $this->openSession($cashier);
        $cashInvoice = $this->createInvoice($cashier, 'Glucosa');
        $transferInvoice = $this->createInvoice($cashier, 'Hemograma Completo');
        $voidInvoice = $this->createInvoice($cashier, 'Eritropoyetina');

        $this->payInvoice($cashier, $cashInvoice, $sessionId, Payment::METHOD_CASH, '17.25');
        $this->payInvoice($cashier, $transferInvoice, $sessionId, Payment::METHOD_TRANSFER, '5.00');
        $this->payInvoice($cashier, $voidInvoice, $sessionId, Payment::METHOD_CARD, '25.00');

        Invoice::query()->whereKey($voidInvoice)->update([
            'status' => Invoice::STATUS_VOID,
            'voided_by' => $this->supervisor()->id,
            'voided_at' => now(),
            'void_reason' => 'Prueba de anulada',
        ]);

        $this->actingAs($this->supervisor())
            ->getJson('/api/reports/daily?date='.now()->toDateString())
            ->assertOk()
            ->assertJsonPath('data.total_billed', '28.75')
            ->assertJsonPath('data.total_collected', '22.25')
            ->assertJsonPath('data.total_balance_due', '6.50')
            ->assertJsonPath('data.invoice_count', 3)
            ->assertJsonPath('data.payment_count', 2)
            ->assertJsonPath('data.payments_by_method.cash', '17.25')
            ->assertJsonPath('data.payments_by_method.transfer', '5.00')
            ->assertJsonPath('data.payments_by_method.card', '0.00')
            ->assertJsonPath('data.invoices_by_status.paid.count', 1)
            ->assertJsonPath('data.invoices_by_status.partial.count', 1)
            ->assertJsonPath('data.invoices_by_status.void.count', 1);
    }

    public function test_monthly_report_summarizes_financial_facts_by_day_without_void_income(): void
    {
        $this->seedBillingBase();
        FiscalSetting::query()->update(['partial_payments_enabled' => true]);
        $cashier = $this->cashier();
        $sessionId = $this->openSession($cashier);
        $dateOne = now()->startOfMonth()->addDays(2);
        $dateTwo = $dateOne->copy()->addDay();
        $paidInvoice = $this->createInvoice($cashier, 'Glucosa');
        $partialInvoice = $this->createInvoice($cashier, 'Hemograma Completo');
        $issuedInvoice = $this->createInvoice($cashier, 'Eritropoyetina');
        $voidInvoice = $this->createInvoice($cashier, 'Glucosa');

        $this->payInvoice($cashier, $paidInvoice, $sessionId, Payment::METHOD_CASH, '17.25');
        $this->payInvoice($cashier, $partialInvoice, $sessionId, Payment::METHOD_TRANSFER, '5.00');
        $this->payInvoice($cashier, $voidInvoice, $sessionId, Payment::METHOD_CARD, '17.25');

        Invoice::query()->whereKey($paidInvoice)->update(['issued_at' => $dateOne->copy()->hour(9)]);
        Payment::query()->where('invoice_id', $paidInvoice)->update(['paid_at' => $dateOne->copy()->hour(10)]);

        Invoice::query()->whereKey($partialInvoice)->update(['issued_at' => $dateTwo->copy()->hour(8)]);
        Payment::query()->where('invoice_id', $partialInvoice)->update(['paid_at' => $dateTwo->copy()->hour(11)]);

        Invoice::query()->whereKey($issuedInvoice)->update(['issued_at' => $dateTwo->copy()->hour(12)]);

        Invoice::query()->whereKey($voidInvoice)->update([
            'status' => Invoice::STATUS_VOID,
            'issued_at' => $dateTwo->copy()->hour(13),
            'voided_by' => $this->supervisor()->id,
            'voided_at' => $dateTwo->copy()->hour(14),
            'void_reason' => 'No debe inflar el mensual',
        ]);
        Payment::query()->where('invoice_id', $voidInvoice)->update(['paid_at' => $dateTwo->copy()->hour(13)]);

        $this->actingAs($this->admin())
            ->getJson('/api/reports/monthly?month='.$dateOne->format('Y-m'))
            ->assertOk()
            ->assertJsonPath('data.month', $dateOne->format('Y-m'))
            ->assertJsonPath('data.total_billed', '53.75')
            ->assertJsonPath('data.total_collected', '22.25')
            ->assertJsonPath('data.total_pending', '31.50')
            ->assertJsonPath('data.total_partial', '11.50')
            ->assertJsonPath('data.total_voided', '17.25')
            ->assertJsonPath('data.payment_count', 2)
            ->assertJsonPath('data.invoice_count', 4)
            ->assertJsonPath('data.payments_by_method.cash', '17.25')
            ->assertJsonPath('data.payments_by_method.transfer', '5.00')
            ->assertJsonPath('data.payments_by_method.card', '0.00')
            ->assertJsonPath('data.invoices_by_status.paid.count', 1)
            ->assertJsonPath('data.invoices_by_status.partial.count', 1)
            ->assertJsonPath('data.invoices_by_status.issued.count', 1)
            ->assertJsonPath('data.invoices_by_status.void.count', 1)
            ->assertJsonPath('data.daily_totals.0.date', $dateOne->toDateString())
            ->assertJsonPath('data.daily_totals.0.total_billed', '17.25')
            ->assertJsonPath('data.daily_totals.0.total_collected', '17.25')
            ->assertJsonPath('data.daily_totals.1.date', $dateTwo->toDateString())
            ->assertJsonPath('data.daily_totals.1.total_billed', '36.50')
            ->assertJsonPath('data.daily_totals.1.total_collected', '5.00')
            ->assertJsonPath('data.daily_totals.1.total_pending', '31.50')
            ->assertJsonPath('data.daily_totals.1.total_voided', '17.25');

        $this->actingAs($this->admin())
            ->getJson('/api/reports/monthly?month=2026-13')
            ->assertUnprocessable()
            ->assertJsonValidationErrors('month');
    }

    public function test_monthly_report_counts_invoices_voided_in_month_even_when_issued_earlier(): void
    {
        $this->seedBillingBase();
        $cashier = $this->cashier();
        $this->openSession($cashier);
        $voidInvoice = $this->createInvoice($cashier, 'Glucosa');
        $voidedAt = now()->startOfMonth()->addDays(4)->hour(10);

        Invoice::query()->whereKey($voidInvoice)->update([
            'status' => Invoice::STATUS_VOID,
            'issued_at' => now()->startOfMonth()->subDay()->hour(15),
            'voided_by' => $this->supervisor()->id,
            'voided_at' => $voidedAt,
            'void_reason' => 'Anulacion revisada en cierre mensual',
        ]);

        $this->actingAs($this->admin())
            ->getJson('/api/reports/monthly?month='.$voidedAt->format('Y-m'))
            ->assertOk()
            ->assertJsonPath('data.invoice_count', 0)
            ->assertJsonPath('data.total_billed', '0.00')
            ->assertJsonPath('data.total_voided', '17.25')
            ->assertJsonPath('data.invoices_by_status.void.count', 1)
            ->assertJsonPath('data.invoices_by_status.void.total', '17.25')
            ->assertJsonPath('data.daily_totals.0.date', $voidedAt->toDateString())
            ->assertJsonPath('data.daily_totals.0.invoice_count', 0)
            ->assertJsonPath('data.daily_totals.0.total_voided', '17.25');
    }

    public function test_income_report_respects_date_range_and_invalid_ranges_return_422(): void
    {
        $this->seedBillingBase();
        $cashier = $this->cashier();
        $sessionId = $this->openSession($cashier);
        $todayInvoice = $this->createInvoice($cashier, 'Glucosa');
        $oldInvoice = $this->createInvoice($cashier, 'Hemograma Completo');

        $this->payInvoice($cashier, $todayInvoice, $sessionId, Payment::METHOD_CASH, '17.25');
        $this->payInvoice($cashier, $oldInvoice, $sessionId, Payment::METHOD_OTHER, '11.50');
        Payment::query()->where('invoice_id', $oldInvoice)->update(['paid_at' => now()->subDays(3)]);

        $this->actingAs($this->admin())
            ->getJson('/api/reports/income?date_from='.now()->toDateString().'&date_to='.now()->toDateString())
            ->assertOk()
            ->assertJsonPath('data.total_billed', '28.75')
            ->assertJsonPath('data.total_collected', '17.25')
            ->assertJsonPath('data.total_balance_due', '0.00')
            ->assertJsonPath('data.payment_count', 1)
            ->assertJsonPath('data.invoice_count', 2);

        $this->actingAs($this->admin())
            ->getJson('/api/reports/income?date_from='.now()->toDateString().'&date_to='.now()->subDay()->toDateString())
            ->assertUnprocessable()
            ->assertJsonValidationErrors('date_to');

        $this->actingAs($this->admin())
            ->getJson('/api/reports/income?date_from='.now()->subDays(40)->toDateString().'&date_to='.now()->toDateString())
            ->assertUnprocessable()
            ->assertJsonValidationErrors('date_to');

        $this->actingAs($this->admin())
            ->getJson('/api/reports/income?date_from=fecha-mala&date_to='.now()->toDateString())
            ->assertUnprocessable()
            ->assertJsonValidationErrors('date_from');

        $this->actingAs($this->admin())
            ->getJson('/api/reports/income?date_from=fecha-mala&date_to='.now()->addYear()->toDateString())
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['date_from', 'date_to']);
    }

    public function test_income_report_uses_payment_amount_cents_as_financial_source(): void
    {
        $this->seedBillingBase();
        $cashier = $this->cashier();
        $sessionId = $this->openSession($cashier);
        $invoiceId = $this->createInvoice($cashier, 'Glucosa');

        $this->payInvoice($cashier, $invoiceId, $sessionId, Payment::METHOD_CASH, '17.25');
        Payment::query()
            ->where('invoice_id', $invoiceId)
            ->update(['amount' => '99.99']);

        $this->actingAs($this->admin())
            ->getJson('/api/reports/income?date_from='.now()->toDateString().'&date_to='.now()->toDateString())
            ->assertOk()
            ->assertJsonPath('data.total_collected', '17.25')
            ->assertJsonPath('data.payments_by_method.cash', '17.25');

        $filters = http_build_query([
            'date_from' => now()->toDateString(),
            'date_to' => now()->toDateString(),
            'method' => Payment::METHOD_CASH,
        ]);

        $this->actingAs($this->admin())
            ->getJson("/api/reports/categories?{$filters}")
            ->assertOk()
            ->assertJsonPath('data.categories.0.total', '17.25');

        $this->actingAs($this->admin())
            ->getJson("/api/reports/areas?{$filters}")
            ->assertOk()
            ->assertJsonPath('data.areas.0.total', '17.25');

        $this->actingAs($this->admin())
            ->getJson("/api/reports/services?{$filters}")
            ->assertOk()
            ->assertJsonPath('data.services.0.total', '17.25');
    }

    public function test_category_report_uses_invoice_item_snapshots_and_ignores_current_catalog_changes(): void
    {
        $this->seedBillingBase();
        $cashier = $this->cashier();
        $invoiceId = $this->createInvoice($cashier, 'Glucosa');
        $snapshotCategory = Invoice::query()->findOrFail($invoiceId)->items()->firstOrFail()->category_name;
        $newCategory = Category::query()->create([
            'name' => 'Categoria Cambiada',
            'slug' => 'categoria-cambiada',
            'active' => true,
            'sort_order' => 99,
        ]);

        Service::query()->where('name', 'Glucosa')->update([
            'name' => 'Glucosa Cambiada',
            'category_id' => $newCategory->id,
        ]);
        Invoice::query()->findOrFail($invoiceId)->items()->update([
            'quantity' => '9.99',
            'line_subtotal' => '999.99',
            'tax_amount' => '999.99',
            'line_total' => '999.99',
        ]);

        $this->actingAs($this->supervisor())
            ->getJson('/api/reports/categories?date_from='.now()->toDateString().'&date_to='.now()->toDateString())
            ->assertOk()
            ->assertJsonPath('data.categories.0.category', $snapshotCategory)
            ->assertJsonPath('data.categories.0.item_count', 1)
            ->assertJsonPath('data.categories.0.quantity', '1.00')
            ->assertJsonPath('data.categories.0.subtotal', '15.00')
            ->assertJsonPath('data.categories.0.tax_amount', '2.25')
            ->assertJsonPath('data.categories.0.total', '17.25');
    }

    public function test_void_invoices_do_not_inflate_category_report(): void
    {
        $this->seedBillingBase();
        $cashier = $this->cashier();
        $invoiceId = $this->createInvoice($cashier, 'Glucosa');
        Invoice::query()->whereKey($invoiceId)->update([
            'status' => Invoice::STATUS_VOID,
            'voided_by' => $this->supervisor()->id,
            'voided_at' => now(),
            'void_reason' => 'No cuenta ingresos',
        ]);

        $this->actingAs($this->admin())
            ->getJson('/api/reports/categories?date_from='.now()->toDateString().'&date_to='.now()->toDateString())
            ->assertOk()
            ->assertJsonCount(0, 'data.categories');

        $query = 'date_from='.now()->toDateString().'&date_to='.now()->toDateString().'&status='.Invoice::STATUS_VOID;

        $this->actingAs($this->admin())
            ->getJson('/api/reports/income?'.$query)
            ->assertOk()
            ->assertJsonPath('data.total_collected', '0.00')
            ->assertJsonPath('data.payment_count', 0);

        $this->actingAs($this->admin())
            ->getJson('/api/reports/services?'.$query)
            ->assertOk()
            ->assertJsonCount(0, 'data.services');
    }

    public function test_service_sales_report_uses_snapshots_and_excludes_void_invoices(): void
    {
        $this->seedBillingBase();
        $cashier = $this->cashier();
        $glucoseInvoice = $this->createInvoice($cashier, 'Glucosa');
        $hemogramInvoice = $this->createInvoice($cashier, 'Hemograma Completo');
        $voidInvoice = $this->createInvoice($cashier, 'Eritropoyetina');

        Service::query()->where('name', 'Glucosa')->update(['name' => 'Glucosa Cambiada']);
        Invoice::query()->whereKey($voidInvoice)->update([
            'status' => Invoice::STATUS_VOID,
            'voided_by' => $this->supervisor()->id,
            'voided_at' => now(),
            'void_reason' => 'No cuenta para top servicios',
        ]);

        $this->actingAs($this->admin())
            ->getJson('/api/reports/services?date_from='.now()->toDateString().'&date_to='.now()->toDateString())
            ->assertOk()
            ->assertJsonCount(2, 'data.services')
            ->assertJsonFragment([
                'service' => 'Glucosa',
                'total' => '17.25',
            ])
            ->assertJsonFragment([
                'service' => 'Hemograma Completo',
                'total' => '11.50',
            ])
            ->assertJsonMissing(['service' => 'Eritropoyetina']);

        $this->assertNotSame($glucoseInvoice, $hemogramInvoice);
    }

    public function test_area_income_report_uses_invoice_item_snapshots_and_excludes_void_invoices(): void
    {
        $this->seedBillingBase();
        $cashier = $this->cashier();
        $glucoseInvoice = $this->createInvoice($cashier, 'Glucosa');
        $voidInvoice = $this->createInvoice($cashier, 'Hemograma Completo');
        $laboratoryArea = Area::query()->where('slug', 'laboratorio')->firstOrFail();
        $changedArea = Area::query()->create([
            'name' => 'Area cambiada',
            'slug' => 'area-cambiada',
            'active' => true,
        ]);

        Service::query()->where('name', 'Glucosa')->update(['area_id' => $changedArea->id]);
        Invoice::query()->whereKey($voidInvoice)->update([
            'status' => Invoice::STATUS_VOID,
            'voided_by' => $this->supervisor()->id,
            'voided_at' => now(),
            'void_reason' => 'No cuenta para ingresos por area',
        ]);

        $this->actingAs($this->admin())
            ->getJson('/api/reports/areas?date_from='.now()->toDateString().'&date_to='.now()->toDateString())
            ->assertOk()
            ->assertJsonCount(1, 'data.areas')
            ->assertJsonPath('data.areas.0.area_id', $laboratoryArea->id)
            ->assertJsonPath('data.areas.0.area', 'Laboratorio')
            ->assertJsonPath('data.areas.0.total', '17.25');

        $this->actingAs($this->admin())
            ->getJson('/api/reports/areas?date_from='.now()->toDateString().'&date_to='.now()->toDateString().'&area_id='.$changedArea->id)
            ->assertOk()
            ->assertJsonCount(0, 'data.areas');

        $this->assertNotSame($glucoseInvoice, $voidInvoice);
    }

    public function test_income_report_area_filter_prorates_mixed_invoice_financial_facts(): void
    {
        $this->seedBillingBase();
        $cashier = $this->cashier();
        $sessionId = $this->openSession($cashier);
        $glucose = Service::query()->where('name', 'Glucosa')->firstOrFail();
        $fingerXray = Service::query()->where('name', 'Dedo')->firstOrFail();

        $invoiceId = app(CreateInvoiceAction::class)
            ->execute([
                'patient_name' => 'Maria Lopez',
                'items' => [
                    [
                        'service_id' => $glucose->id,
                        'quantity' => '1.00',
                    ],
                    [
                        'service_id' => $fingerXray->id,
                        'quantity' => '1.00',
                    ],
                ],
            ], $cashier->fresh())
            ->id;

        $this->payInvoice($cashier, $invoiceId, $sessionId, Payment::METHOD_CASH, '69.00');
        Invoice::query()->whereKey($invoiceId)->update(['total' => '999.99']);
        Invoice::query()->findOrFail($invoiceId)->items()->update(['line_total' => '999.99']);

        $this->actingAs($this->admin())
            ->getJson('/api/reports/income?date_from='.now()->toDateString().'&date_to='.now()->toDateString().'&area_id='.$glucose->area_id)
            ->assertOk()
            ->assertJsonPath('data.total_billed', '17.25')
            ->assertJsonPath('data.total_collected', '17.25')
            ->assertJsonPath('data.total_pending', '0.00')
            ->assertJsonPath('data.payments_by_method.cash', '17.25')
            ->assertJsonPath('data.invoice_count', 1)
            ->assertJsonPath('data.payment_count', 1);

        $this->actingAs($this->admin())
            ->getJson('/api/reports/income?date_from='.now()->toDateString().'&date_to='.now()->toDateString().'&area_id='.$fingerXray->area_id)
            ->assertOk()
            ->assertJsonPath('data.total_billed', '51.75')
            ->assertJsonPath('data.total_collected', '51.75')
            ->assertJsonPath('data.payments_by_method.cash', '51.75');
    }

    public function test_operations_report_area_filter_prorates_cashier_totals_from_invoice_item_snapshots(): void
    {
        $this->seedBillingBase();
        $cashier = $this->cashier();
        $sessionId = $this->openSession($cashier);
        $glucose = Service::query()->where('name', 'Glucosa')->firstOrFail();
        $fingerXray = Service::query()->where('name', 'Dedo')->firstOrFail();

        $invoiceId = app(CreateInvoiceAction::class)
            ->execute([
                'patient_name' => 'Maria Lopez',
                'items' => [
                    [
                        'service_id' => $glucose->id,
                        'quantity' => '1.00',
                    ],
                    [
                        'service_id' => $fingerXray->id,
                        'quantity' => '1.00',
                    ],
                ],
            ], $cashier->fresh())
            ->id;

        $this->payInvoice($cashier, $invoiceId, $sessionId, Payment::METHOD_CASH, '69.00');

        $this->actingAs($this->admin())
            ->getJson('/api/reports/operations?date_from='.now()->toDateString().'&date_to='.now()->toDateString().'&area_id='.$glucose->area_id)
            ->assertOk()
            ->assertJsonPath('data.filters.area_id', (string) $glucose->area_id)
            ->assertJsonPath('data.summary.cashier_count', 1)
            ->assertJsonPath('data.cashiers.0.name', $cashier->name)
            ->assertJsonMissingPath('data.cashiers.0.username')
            ->assertJsonPath('data.cashiers.0.total_collected', '17.25');

        $this->actingAs($this->admin())
            ->getJson('/api/reports/operations?date_from='.now()->toDateString().'&date_to='.now()->toDateString().'&area_id='.$fingerXray->area_id)
            ->assertOk()
            ->assertJsonPath('data.filters.area_id', (string) $fingerXray->area_id)
            ->assertJsonPath('data.summary.cashier_count', 1)
            ->assertJsonPath('data.cashiers.0.total_collected', '51.75');
    }

    public function test_operations_report_uses_payment_amount_cents_as_financial_source(): void
    {
        $this->seedBillingBase();
        $cashier = $this->cashier();
        $sessionId = $this->openSession($cashier);
        $invoiceId = $this->createInvoice($cashier, 'Glucosa');

        $this->payInvoice($cashier, $invoiceId, $sessionId, Payment::METHOD_CASH, '17.25');
        Payment::query()
            ->where('invoice_id', $invoiceId)
            ->update(['amount' => '99.99']);

        $this->actingAs($this->admin())
            ->getJson('/api/reports/operations?date_from='.now()->toDateString().'&date_to='.now()->toDateString())
            ->assertOk()
            ->assertJsonPath('data.cashiers.0.name', $cashier->name)
            ->assertJsonMissingPath('data.cashiers.0.username')
            ->assertJsonPath('data.cashiers.0.total_collected', '17.25');
    }

    public function test_operations_report_area_filter_prorates_partial_payments_with_integer_cents(): void
    {
        $this->seedBillingBase();
        FiscalSetting::query()->update(['partial_payments_enabled' => true]);
        $cashier = $this->cashier();
        $sessionId = $this->openSession($cashier);
        $category = Category::query()->firstOrFail();
        $firstArea = Area::query()->create([
            'name' => 'Prorrateo uno',
            'slug' => 'prorrateo-uno',
            'active' => true,
        ]);
        $secondArea = Area::query()->create([
            'name' => 'Prorrateo dos',
            'slug' => 'prorrateo-dos',
            'active' => true,
        ]);
        $oneCentService = Service::query()->create([
            'category_id' => $category->id,
            'area_id' => $firstArea->id,
            'name' => 'Prorrateo un centavo',
            'slug' => 'prorrateo-un-centavo',
            'price' => '0.01',
            'taxable' => false,
            'active' => true,
            'visible_in_billing' => true,
            'is_billable' => true,
        ]);
        $twoCentService = Service::query()->create([
            'category_id' => $category->id,
            'area_id' => $secondArea->id,
            'name' => 'Prorrateo dos centavos',
            'slug' => 'prorrateo-dos-centavos',
            'price' => '0.02',
            'taxable' => false,
            'active' => true,
            'visible_in_billing' => true,
            'is_billable' => true,
        ]);

        $invoiceId = app(CreateInvoiceAction::class)
            ->execute([
                'patient_name' => 'Maria Lopez',
                'items' => [
                    [
                        'service_id' => $oneCentService->id,
                        'quantity' => '1.00',
                    ],
                    [
                        'service_id' => $twoCentService->id,
                        'quantity' => '1.00',
                    ],
                ],
            ], $cashier->fresh())
            ->id;

        $this->payInvoice($cashier, $invoiceId, $sessionId, Payment::METHOD_CASH, '0.01');

        $this->actingAs($this->admin())
            ->getJson('/api/reports/operations?date_from='.now()->toDateString().'&date_to='.now()->toDateString().'&area_id='.$firstArea->id)
            ->assertOk()
            ->assertJsonPath('data.cashiers.0.total_collected', '0.00');

        $this->actingAs($this->admin())
            ->getJson('/api/reports/operations?date_from='.now()->toDateString().'&date_to='.now()->toDateString().'&area_id='.$secondArea->id)
            ->assertOk()
            ->assertJsonPath('data.cashiers.0.total_collected', '0.01');
    }

    public function test_range_filters_apply_to_category_services_and_cashier_reports(): void
    {
        $this->seedBillingBase();
        $cashier = $this->cashier();
        $otherCashier = $this->cashier();
        $sessionId = $this->openSession($cashier);
        $otherSessionId = $this->openSession($otherCashier);
        $glucoseInvoice = $this->createInvoice($cashier, 'Glucosa');
        $erythropoietinInvoice = $this->createInvoice($otherCashier, 'Eritropoyetina');
        $laboratoryId = Service::query()->where('name', 'Glucosa')->firstOrFail()->category_id;

        $this->payInvoice($cashier, $glucoseInvoice, $sessionId, Payment::METHOD_CASH, '17.25');
        $this->payInvoice($otherCashier, $erythropoietinInvoice, $otherSessionId, Payment::METHOD_CARD, '25.00');

        $filters = http_build_query([
            'date_from' => now()->toDateString(),
            'date_to' => now()->toDateString(),
            'user_id' => $cashier->id,
            'cash_session_id' => $sessionId,
            'category_id' => $laboratoryId,
            'method' => Payment::METHOD_CASH,
            'status' => Invoice::STATUS_PAID,
        ]);

        $this->actingAs($this->admin())
            ->getJson("/api/reports/income?{$filters}")
            ->assertOk()
            ->assertJsonPath('data.total_collected', '17.25')
            ->assertJsonPath('data.total_billed', '17.25')
            ->assertJsonPath('data.total_balance_due', '0.00')
            ->assertJsonPath('data.payment_count', 1)
            ->assertJsonPath('data.payments_by_method.cash', '17.25')
            ->assertJsonPath('data.payments_by_method.card', '0.00')
            ->assertJsonPath('data.invoices_by_status.paid.count', 1)
            ->assertJsonPath('data.invoices_by_status.partial.count', 0)
            ->assertJsonPath('data.filters.category_id', (string) $laboratoryId)
            ->assertJsonPath('data.filters.method', Payment::METHOD_CASH)
            ->assertJsonPath('data.filters.status', Invoice::STATUS_PAID);

        $this->actingAs($this->admin())
            ->getJson("/api/reports/categories?{$filters}")
            ->assertOk()
            ->assertJsonCount(1, 'data.categories')
            ->assertJsonPath('data.amount_basis', 'collected_prorated')
            ->assertJsonPath('data.amount_label', 'Cobrado asignado proporcionalmente')
            ->assertJsonPath('data.amount_source', 'Pagos publicados filtrados, asignados proporcionalmente a items de factura por snapshot historico')
            ->assertJsonPath('data.filters.user_id', (string) $cashier->id)
            ->assertJsonPath('data.filters.method', Payment::METHOD_CASH)
            ->assertJsonPath('data.categories.0.category', 'Laboratorio')
            ->assertJsonPath('data.categories.0.total', '17.25');

        $this->actingAs($this->admin())
            ->getJson("/api/reports/services?{$filters}")
            ->assertOk()
            ->assertJsonCount(1, 'data.services')
            ->assertJsonPath('data.amount_basis', 'collected_prorated')
            ->assertJsonPath('data.amount_label', 'Cobrado asignado proporcionalmente')
            ->assertJsonPath('data.services.0.service', 'Glucosa')
            ->assertJsonPath('data.services.0.total', '17.25');

        $this->actingAs($this->admin())
            ->getJson("/api/reports/areas?{$filters}")
            ->assertOk()
            ->assertJsonCount(1, 'data.areas')
            ->assertJsonPath('data.amount_basis', 'collected_prorated')
            ->assertJsonPath('data.amount_label', 'Cobrado asignado proporcionalmente')
            ->assertJsonPath('data.areas.0.area', 'Laboratorio')
            ->assertJsonPath('data.areas.0.total', '17.25');

        $this->actingAs($this->admin())
            ->getJson("/api/reports/operations?{$filters}")
            ->assertOk()
            ->assertJsonPath('data.summary.cashier_count', 1)
            ->assertJsonPath('data.cashiers.0.name', $cashier->name)
            ->assertJsonMissingPath('data.cashiers.0.username')
            ->assertJsonPath('data.cashiers.0.total_collected', '17.25');

        $this->actingAs($this->admin())
            ->getJson('/api/reports/categories?date_from='.now()->toDateString().'&date_to='.now()->toDateString().'&method=cheque')
            ->assertUnprocessable()
            ->assertJsonValidationErrors('method');
    }

    public function test_income_report_method_filter_scopes_billed_and_pending_to_matching_payments(): void
    {
        $this->seedBillingBase();
        FiscalSetting::query()->update(['partial_payments_enabled' => true]);
        $cashier = $this->cashier();
        $sessionId = $this->openSession($cashier);
        $cashInvoice = $this->createInvoice($cashier, 'Glucosa');
        $transferInvoice = $this->createInvoice($cashier, 'Hemograma Completo');
        $this->createInvoice($cashier, 'Eritropoyetina');

        $this->payInvoice($cashier, $cashInvoice, $sessionId, Payment::METHOD_CASH, '17.25');
        $this->payInvoice($cashier, $transferInvoice, $sessionId, Payment::METHOD_TRANSFER, '5.00');

        $filters = http_build_query([
            'date_from' => now()->toDateString(),
            'date_to' => now()->toDateString(),
            'method' => Payment::METHOD_TRANSFER,
        ]);

        $this->actingAs($this->admin())
            ->getJson("/api/reports/income?{$filters}")
            ->assertOk()
            ->assertJsonPath('data.total_billed', '11.50')
            ->assertJsonPath('data.total_collected', '5.00')
            ->assertJsonPath('data.total_pending', '6.50')
            ->assertJsonPath('data.total_partial', '11.50')
            ->assertJsonPath('data.invoice_count', 1)
            ->assertJsonPath('data.payment_count', 1)
            ->assertJsonPath('data.payments_by_method.cash', '0.00')
            ->assertJsonPath('data.payments_by_method.transfer', '5.00')
            ->assertJsonPath('data.filters.method', Payment::METHOD_TRANSFER);
    }

    public function test_payment_scoped_breakdowns_use_payment_date_not_invoice_issue_date(): void
    {
        $this->seedBillingBase();
        $cashier = $this->cashier();
        $sessionId = $this->openSession($cashier);
        $invoiceId = $this->createInvoice($cashier, 'Glucosa');

        $this->payInvoice($cashier, $invoiceId, $sessionId, Payment::METHOD_CASH, '17.25');

        Invoice::query()
            ->whereKey($invoiceId)
            ->update(['issued_at' => now()->subDay()->setTime(9, 0)]);
        Payment::query()
            ->where('invoice_id', $invoiceId)
            ->update(['paid_at' => now()->setTime(10, 0)]);

        $filters = http_build_query([
            'date_from' => now()->toDateString(),
            'date_to' => now()->toDateString(),
            'method' => Payment::METHOD_CASH,
        ]);

        $this->actingAs($this->admin())
            ->getJson("/api/reports/income?{$filters}")
            ->assertOk()
            ->assertJsonPath('data.total_collected', '17.25')
            ->assertJsonPath('data.total_billed', '0.00');

        $this->actingAs($this->admin())
            ->getJson("/api/reports/categories?{$filters}")
            ->assertOk()
            ->assertJsonCount(1, 'data.categories')
            ->assertJsonPath('data.categories.0.category', 'Laboratorio')
            ->assertJsonPath('data.categories.0.total', '17.25');

        $this->actingAs($this->admin())
            ->getJson("/api/reports/areas?{$filters}")
            ->assertOk()
            ->assertJsonCount(1, 'data.areas')
            ->assertJsonPath('data.areas.0.area', 'Laboratorio')
            ->assertJsonPath('data.areas.0.total', '17.25');

        $this->actingAs($this->admin())
            ->getJson("/api/reports/services?{$filters}")
            ->assertOk()
            ->assertJsonCount(1, 'data.services')
            ->assertJsonPath('data.services.0.service', 'Glucosa')
            ->assertJsonPath('data.services.0.total', '17.25');
    }

    public function test_managerial_reports_without_close_any_are_scoped_to_own_activity(): void
    {
        $this->seedBillingBase();
        $viewer = $this->cashier();
        $this->grantPermissions($viewer, 'reports.view', 'reports.managerial.view', 'reports.export');
        $otherCashier = $this->cashier();
        $viewerSessionId = $this->openSession($viewer);
        $otherSessionId = $this->openSession($otherCashier);
        $viewerInvoice = $this->createInvoice($viewer, 'Glucosa');
        $otherInvoice = $this->createInvoice($otherCashier, 'Eritropoyetina');

        $this->payInvoice($viewer, $viewerInvoice, $viewerSessionId, Payment::METHOD_CASH, '17.25');
        $this->payInvoice($otherCashier, $otherInvoice, $otherSessionId, Payment::METHOD_CARD, '25.00');

        $query = 'date_from='.now()->toDateString().'&date_to='.now()->toDateString();

        $this->actingAs($viewer)
            ->getJson("/api/reports/categories?{$query}")
            ->assertOk()
            ->assertJsonCount(1, 'data.categories')
            ->assertJsonPath('data.categories.0.category', 'Laboratorio')
            ->assertJsonPath('data.categories.0.total', '17.25');

        $this->actingAs($viewer)
            ->getJson("/api/reports/services?{$query}")
            ->assertOk()
            ->assertJsonCount(1, 'data.services')
            ->assertJsonPath('data.services.0.service', 'Glucosa')
            ->assertJsonPath('data.services.0.total', '17.25');

        $this->actingAs($viewer)
            ->getJson("/api/reports/operations?{$query}")
            ->assertForbidden();

        $this->actingAs($viewer)
            ->getJson("/api/reports/income?{$query}&cash_session_id={$otherSessionId}")
            ->assertForbidden();

        $xlsx = $this->actingAs($viewer)
            ->get("/api/reports/export?{$query}")
            ->assertOk()
            ->assertHeader('content-type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
            ->streamedContent();

        $this->assertStringStartsWith("PK\x03\x04", $xlsx);
    }

    public function test_report_export_without_audit_view_omits_audit_sheet_but_keeps_cashier_summary(): void
    {
        $this->seedBillingBase();
        $viewer = User::factory()->create();
        $this->grantPermissions($viewer, 'reports.view', 'reports.managerial.view', 'reports.export');
        $cashier = $this->cashier();
        $sessionId = $this->openSession($cashier);
        $invoiceId = $this->createInvoice($cashier, 'Glucosa');
        $this->payInvoice($cashier, $invoiceId, $sessionId, Payment::METHOD_CASH, '17.25');

        Invoice::query()->whereKey($invoiceId)->update([
            'status' => Invoice::STATUS_VOID,
            'voided_by' => $this->supervisor()->id,
            'voided_at' => now(),
            'void_reason' => 'Motivo reservado sin auditoria',
        ]);

        $xlsx = $this->actingAs($viewer)
            ->get('/api/reports/export?date_from='.now()->toDateString().'&date_to='.now()->toDateString())
            ->assertOk()
            ->assertHeader('content-type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
            ->streamedContent();

        $path = tempnam(sys_get_temp_dir(), 'no-audit-export-');
        file_put_contents($path, $xlsx);

        try {
            $spreadsheet = IOFactory::load($path);
            $cashiersSheet = $spreadsheet->getSheetByName('Cajeros');

            $this->assertNotNull($cashiersSheet);
            $this->assertSame('Recaudaciones por Cajero', $cashiersSheet->getCell('B2')->getValue());
            $this->assertNull($spreadsheet->getSheetByName('Auditoría'));
        } finally {
            if ($path !== false && file_exists($path)) {
                unlink($path);
            }
        }
    }

    public function test_category_filtered_collections_are_allocated_to_matching_items(): void
    {
        $this->seedBillingBase();
        $cashier = $this->cashier();
        $sessionId = $this->openSession($cashier);
        $glucose = Service::query()->where('name', 'Glucosa')->firstOrFail();
        $erythropoietin = Service::query()->where('name', 'Eritropoyetina')->firstOrFail();

        $invoiceId = $this->actingAs($cashier)
            ->postJson('/api/invoices', [
                'patient_name' => 'Maria Lopez',
                'items' => [
                    ['service_id' => $glucose->id, 'quantity' => '1.00'],
                    ['service_id' => $erythropoietin->id, 'quantity' => '1.00'],
                ],
            ])
            ->assertCreated()
            ->json('data.id');

        $this->payInvoice($cashier, $invoiceId, $sessionId, Payment::METHOD_CASH, '42.25');

        $filters = http_build_query([
            'date_from' => now()->toDateString(),
            'date_to' => now()->toDateString(),
            'category_id' => $glucose->category_id,
        ]);

        $this->actingAs($this->admin())
            ->getJson("/api/reports/income?{$filters}")
            ->assertOk()
            ->assertJsonPath('data.total_collected', '17.25')
            ->assertJsonPath('data.payments_by_method.cash', '17.25');

        $this->actingAs($this->admin())
            ->getJson("/api/reports/operations?{$filters}")
            ->assertOk()
            ->assertJsonPath('data.cashiers.0.total_collected', '17.25');
    }

    public function test_report_export_requires_permission_and_uses_backend_aggregates(): void
    {
        $this->seedBillingBase();
        $cashier = $this->cashier();
        $viewer = User::factory()->create();
        $this->grantPermissions($viewer, 'reports.view', 'reports.managerial.view');
        $sessionId = $this->openSession($cashier);
        $invoiceId = $this->createInvoice($cashier, 'Glucosa');

        $this->payInvoice($cashier, $invoiceId, $sessionId, Payment::METHOD_CASH, '17.25');

        $url = '/api/reports/export?date_from='.now()->toDateString().'&date_to='.now()->toDateString();

        $this->actingAs($viewer)
            ->get($url)
            ->assertForbidden();

        $response = $this->actingAs($this->admin())
            ->get($url)
            ->assertOk()
            ->assertHeader('content-type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

        $this->assertStringContainsString('no-store', (string) $response->headers->get('Cache-Control'));
        $this->assertSame('no-cache', $response->headers->get('Pragma'));
        $this->assertSame('0', $response->headers->get('Expires'));

        $xlsx = $response->streamedContent();

        $this->assertStringStartsWith("PK\x03\x04", $xlsx);
    }

    public function test_report_export_includes_financial_reading_sheet_with_sources(): void
    {
        $this->seedBillingBase();
        FiscalSetting::query()->update(['partial_payments_enabled' => true]);
        $cashier = $this->cashier();
        $sessionId = $this->openSession($cashier);
        $paidInvoice = $this->createInvoice($cashier, 'Glucosa');
        $partialInvoice = $this->createInvoice($cashier, 'Hemograma Completo');
        $this->createInvoice($cashier, 'Eritropoyetina');
        $voidInvoice = $this->createInvoice($cashier, 'Glucosa');

        $this->payInvoice($cashier, $paidInvoice, $sessionId, Payment::METHOD_CASH, '17.25');
        $this->payInvoice($cashier, $partialInvoice, $sessionId, Payment::METHOD_TRANSFER, '5.00');
        $this->payInvoice($cashier, $voidInvoice, $sessionId, Payment::METHOD_CARD, '17.25');

        Invoice::query()->whereKey($voidInvoice)->update([
            'status' => Invoice::STATUS_VOID,
            'voided_by' => $this->supervisor()->id,
            'voided_at' => now(),
            'void_reason' => 'No debe inflar export',
        ]);

        $xlsx = $this->actingAs($this->admin())
            ->get('/api/reports/export?date_from='.now()->toDateString().'&date_to='.now()->toDateString())
            ->assertOk()
            ->assertHeader('content-type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
            ->streamedContent();

        $path = tempnam(sys_get_temp_dir(), 'financial-reading-');
        file_put_contents($path, $xlsx);

        try {
            $reader = IOFactory::createReader('Xlsx');
            $reader->setIncludeCharts(true);
            $spreadsheet = $reader->load($path);
            $summarySheet = $spreadsheet->getSheetByName('Resumen General');
            $sheet = $spreadsheet->getSheetByName('Lectura Financiera');

            $this->assertNotNull($summarySheet);
            $charts = $summarySheet->getChartCollection();
            $this->assertGreaterThanOrEqual(1, $charts->count());
            $paymentChart = $charts->offsetGet(0);
            $this->assertNotNull($paymentChart);
            $this->assertSame(
                'Distribución de Cobros por Método de Pago',
                $paymentChart->getTitle()?->getCaptionText($spreadsheet),
            );
            $this->assertNotNull($sheet);
            $this->assertSame('Lectura financiera del periodo', $sheet->getCell('B2')->getValue());
            $this->assertSame('Concepto', $sheet->getCell('B5')->getValue());
            $this->assertSame('Monto', $sheet->getCell('C5')->getValue());
            $this->assertSame('Fuente', $sheet->getCell('D5')->getValue());
            $this->assertSame('Facturado', $sheet->getCell('B6')->getValue());
            $this->assertSame(53.75, $sheet->getCell('C6')->getValue());
            $this->assertSame('Facturas no anuladas emitidas en el rango', $sheet->getCell('D6')->getValue());
            $this->assertSame('Cobrado', $sheet->getCell('B7')->getValue());
            $this->assertSame(22.25, $sheet->getCell('C7')->getValue());
            $this->assertSame('Pagos publicados no anulados en el rango', $sheet->getCell('D7')->getValue());
            $this->assertSame('Pendiente', $sheet->getCell('B8')->getValue());
            $this->assertSame(31.50, $sheet->getCell('C8')->getValue());
            $this->assertSame('Saldo actual de facturas emitidas o parciales', $sheet->getCell('D8')->getValue());
            $this->assertSame('Parcial', $sheet->getCell('B9')->getValue());
            $this->assertSame(11.50, $sheet->getCell('C9')->getValue());
            $this->assertSame('Facturas con pago parcial separadas de pagadas', $sheet->getCell('D9')->getValue());
            $this->assertSame('Anulado', $sheet->getCell('B10')->getValue());
            $this->assertSame(17.25, $sheet->getCell('C10')->getValue());
            $this->assertSame('Facturas anuladas reportadas fuera de ingresos', $sheet->getCell('D10')->getValue());
        } finally {
            if ($path !== false && file_exists($path)) {
                unlink($path);
            }
        }
    }

    public function test_report_export_includes_area_income_sheet(): void
    {
        $this->seedBillingBase();
        $cashier = $this->cashier();
        $sessionId = $this->openSession($cashier);
        $invoiceId = $this->createInvoice($cashier, 'Glucosa');

        $this->payInvoice($cashier, $invoiceId, $sessionId, Payment::METHOD_CASH, '17.25');

        $xlsx = $this->actingAs($this->admin())
            ->get('/api/reports/export?date_from='.now()->toDateString().'&date_to='.now()->toDateString())
            ->assertOk()
            ->assertHeader('content-type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
            ->streamedContent();

        $path = tempnam(sys_get_temp_dir(), 'area-report-');
        file_put_contents($path, $xlsx);

        try {
            $spreadsheet = IOFactory::load($path);
            $categorySheet = $spreadsheet->getSheetByName('Categorías');
            $sheet = $spreadsheet->getSheetByName('Áreas');
            $serviceSheet = $spreadsheet->getSheetByName('Servicios');

            $this->assertNotNull($categorySheet);
            $this->assertSame('Facturación por Categoría de Servicio', $categorySheet->getCell('B2')->getValue());
            $this->assertSame('Cantidad Facturada', $categorySheet->getCell('C5')->getValue());
            $this->assertSame('Monto Facturado', $categorySheet->getCell('D5')->getValue());
            $this->assertNotSame('Ventas por Categoría de Servicio', $categorySheet->getCell('B2')->getValue());
            $this->assertNotNull($sheet);
            $this->assertSame('Facturación por Área Institucional', $sheet->getCell('B2')->getValue());
            $this->assertSame('Monto Facturado', $sheet->getCell('E5')->getValue());
            $this->assertNotSame('Ingresos por Area Institucional', $sheet->getCell('B2')->getValue());
            $this->assertSame('Laboratorio', $sheet->getCell('B6')->getValue());
            $this->assertSame(1, $sheet->getCell('C6')->getValue());
            $this->assertSame(17.25, $sheet->getCell('E6')->getValue());
            $this->assertNotNull($serviceSheet);
            $this->assertSame('Facturación Detallada por Servicio', $serviceSheet->getCell('B2')->getValue());
            $this->assertSame('Monto Facturado', $serviceSheet->getCell('E5')->getValue());
            $this->assertNotSame('Ventas Detalladas por Servicio', $serviceSheet->getCell('B2')->getValue());
        } finally {
            if ($path !== false && file_exists($path)) {
                unlink($path);
            }
        }
    }

    public function test_report_export_labels_payment_scoped_breakdowns_as_prorated_collected_amounts(): void
    {
        $this->seedBillingBase();
        $cashier = $this->cashier();
        $sessionId = $this->openSession($cashier);
        $invoiceId = $this->createInvoice($cashier, 'Glucosa');

        $this->payInvoice($cashier, $invoiceId, $sessionId, Payment::METHOD_CASH, '17.25');

        $xlsx = $this->actingAs($this->admin())
            ->get('/api/reports/export?date_from='.now()->toDateString().'&date_to='.now()->toDateString().'&method='.Payment::METHOD_CASH)
            ->assertOk()
            ->assertHeader('content-type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
            ->streamedContent();

        $path = tempnam(sys_get_temp_dir(), 'payment-scoped-report-');
        file_put_contents($path, $xlsx);

        try {
            $spreadsheet = IOFactory::load($path);
            $categorySheet = $spreadsheet->getSheetByName('Categorías');
            $areaSheet = $spreadsheet->getSheetByName('Áreas');
            $serviceSheet = $spreadsheet->getSheetByName('Servicios');

            $this->assertNotNull($categorySheet);
            $this->assertSame('Cobros asignados por Categoría de Servicio', $categorySheet->getCell('B2')->getValue());
            $this->assertSame('Cobrado asignado proporcionalmente', $categorySheet->getCell('D5')->getValue());

            $this->assertNotNull($areaSheet);
            $this->assertSame('Cobros asignados por Área Institucional', $areaSheet->getCell('B2')->getValue());
            $this->assertSame('Cobrado asignado proporcionalmente', $areaSheet->getCell('E5')->getValue());

            $this->assertNotNull($serviceSheet);
            $this->assertSame('Servicios con cobro asignado', $serviceSheet->getCell('B2')->getValue());
            $this->assertSame('Cobrado asignado proporcionalmente', $serviceSheet->getCell('E5')->getValue());
        } finally {
            if ($path !== false && file_exists($path)) {
                unlink($path);
            }
        }
    }

    public function test_report_export_records_active_filters_with_human_labels(): void
    {
        $this->seedBillingBase();
        $cashier = $this->cashier();
        $sessionId = $this->openSession($cashier);
        $glucose = Service::query()->where('name', 'Glucosa')->firstOrFail();
        $invoiceId = $this->createInvoice($cashier, 'Glucosa');

        $this->payInvoice($cashier, $invoiceId, $sessionId, Payment::METHOD_CASH, '17.25');

        $query = http_build_query([
            'date_from' => now()->toDateString(),
            'date_to' => now()->toDateString(),
            'method' => Payment::METHOD_CASH,
            'status' => Invoice::STATUS_PAID,
            'user_id' => $cashier->id,
            'cash_session_id' => $sessionId,
            'area_id' => $glucose->area_id,
            'category_id' => $glucose->category_id,
        ]);

        $xlsx = $this->actingAs($this->admin())
            ->get("/api/reports/export?{$query}")
            ->assertOk()
            ->assertHeader('content-type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
            ->streamedContent();

        $path = tempnam(sys_get_temp_dir(), 'human-filter-report-');
        file_put_contents($path, $xlsx);

        try {
            $spreadsheet = IOFactory::load($path);
            $sheet = $spreadsheet->getSheetByName('Filtros Aplicados');

            $this->assertNotNull($sheet);

            $filters = [];
            foreach (range(7, 24) as $row) {
                $label = (string) $sheet->getCell('B'.$row)->getValue();
                $value = (string) $sheet->getCell('C'.$row)->getValue();

                if ($label !== '') {
                    $filters[$label] = $value;
                }
            }

            $this->assertSame('Efectivo', $filters['Método de pago'] ?? null);
            $this->assertSame('Pagada', $filters['Estado de factura'] ?? null);
            $this->assertSame($cashier->name, $filters['Cajero'] ?? null);
            $this->assertStringContainsString($cashier->name, $filters['Caja'] ?? '');
            $this->assertStringContainsString(now()->format('d/m/Y'), $filters['Caja'] ?? '');
            $this->assertStringContainsString('Abierta', $filters['Caja'] ?? '');
            $this->assertStringNotContainsString('Caja #'.(string) $sessionId, $filters['Caja'] ?? '');
            $this->assertSame('Laboratorio', $filters['Área'] ?? null);
            $this->assertSame('Laboratorio', $filters['Categoría'] ?? null);
            $this->assertNotContains((string) $cashier->id, $filters);
            $this->assertNotContains((string) $sessionId, $filters);
            $this->assertNotContains((string) $glucose->area_id, $filters);
            $this->assertNotContains((string) $glucose->category_id, $filters);
        } finally {
            if ($path !== false && file_exists($path)) {
                unlink($path);
            }
        }
    }

    public function test_report_export_uses_institutional_logo_placeholder_without_technical_branding(): void
    {
        $this->seedBillingBase();
        Storage::disk('public')->delete('branding/logo.png');

        $cashier = $this->cashier();
        $sessionId = $this->openSession($cashier);
        $invoiceId = $this->createInvoice($cashier, 'Glucosa');

        $this->payInvoice($cashier, $invoiceId, $sessionId, Payment::METHOD_CASH, '17.25');

        $xlsx = $this->actingAs($this->admin())
            ->get('/api/reports/export?date_from='.now()->toDateString().'&date_to='.now()->toDateString())
            ->assertOk()
            ->assertHeader('content-type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
            ->streamedContent();

        $path = tempnam(sys_get_temp_dir(), 'branding-report-');
        file_put_contents($path, $xlsx);

        try {
            $spreadsheet = IOFactory::load($path);
            $summarySheet = $spreadsheet->getSheetByName('Resumen General');

            $this->assertNotNull($summarySheet);
            $this->assertStringNotContainsString('HOSPITAL OS', (string) $summarySheet->getCell('B2')->getValue());
            $this->assertSame("Logo\nInstitucional", $summarySheet->getCell('B2')->getValue());
        } finally {
            if ($path !== false && file_exists($path)) {
                unlink($path);
            }
        }
    }

    public function test_report_export_guest_receives_json_unauthenticated_for_download_accept_header(): void
    {
        $date = now()->toDateString();

        $this
            ->withHeaders(['Accept' => 'application/json, application/octet-stream, text/csv'])
            ->get("/api/reports/export?date_from={$date}&date_to={$date}")
            ->assertUnauthorized()
            ->assertJsonPath('message', 'Unauthenticated.');
    }

    public function test_operations_and_export_hide_backup_metadata_without_backup_permission(): void
    {
        $this->seedBillingBase();
        $viewer = User::factory()->create();
        $this->grantPermissions($viewer, 'reports.view', 'reports.managerial.view', 'reports.export', 'audit.view');

        BackupLog::query()->create([
            'filename' => 'hospital-backup-sensitive.sql',
            'path' => 'backups/hospital-backup-sensitive.sql',
            'disk' => 'local',
            'size_bytes' => 2048,
            'checksum_sha256' => str_repeat('b', 64),
            'status' => BackupLog::STATUS_SUCCESS,
            'type' => BackupLog::TYPE_MANUAL,
            'created_by' => $this->admin()->id,
            'completed_at' => now(),
        ]);

        $url = '/api/reports/operations?date_from='.now()->toDateString().'&date_to='.now()->toDateString();

        $this->actingAs($viewer)
            ->getJson($url)
            ->assertOk()
            ->assertJsonPath('data.summary.backup_count', 0)
            ->assertJsonCount(0, 'data.backups');

        $xlsx = $this->actingAs($viewer)
            ->get(str_replace('/operations?', '/export?', $url))
            ->assertOk()
            ->assertHeader('content-type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
            ->streamedContent();

        $this->assertStringStartsWith("PK\x03\x04", $xlsx);
    }

    public function test_operations_summary_counts_are_not_limited_to_preview_rows(): void
    {
        $this->seedBillingBase();
        $admin = $this->admin();

        for ($i = 1; $i <= 30; $i++) {
            BackupLog::query()->create([
                'filename' => "hospital-backup-{$i}.sql",
                'path' => "backups/hospital-backup-{$i}.sql",
                'disk' => 'local',
                'size_bytes' => 1024,
                'checksum_sha256' => hash('sha256', "backup-{$i}"),
                'status' => BackupLog::STATUS_FAILED,
                'type' => BackupLog::TYPE_MANUAL,
                'created_by' => $admin->id,
                'completed_at' => now(),
            ]);
        }

        $this->actingAs($admin)
            ->getJson('/api/reports/operations?date_from='.now()->toDateString().'&date_to='.now()->toDateString())
            ->assertOk()
            ->assertJsonPath('data.summary.backup_count', 30)
            ->assertJsonPath('data.summary.failed_backup_count', 30)
            ->assertJsonCount(25, 'data.backups');
    }

    public function test_operations_report_lists_voids_reprints_and_backups(): void
    {
        $this->seedBillingBase();
        $cashier = $this->cashier();
        $admin = $this->admin();
        $invoiceId = $this->createInvoice($cashier, 'Glucosa');

        Invoice::query()->whereKey($invoiceId)->update([
            'status' => Invoice::STATUS_VOID,
            'voided_by' => $admin->id,
            'voided_at' => now(),
            'void_reason' => 'Error de captura',
        ]);

        AuditLog::query()->create([
            'user_id' => $admin->id,
            'action' => 'invoice.reprinted',
            'entity_type' => Invoice::class,
            'entity_id' => $invoiceId,
            'new_values' => [
                'invoice_number' => '000-001-01-00000001',
                'width' => 'half_letter',
                'reason' => 'Paciente solicita copia',
            ],
            'created_at' => now(),
        ]);

        InstitutionalReceiptPrintEvent::query()->create([
            'institutional_receipt_id' => null,
            'event_type' => InstitutionalReceiptPrintEvent::TYPE_REPRINT,
            'reason' => 'Copia institucional solicitada',
            'user_id' => $admin->id,
            'created_at' => now()->addMinute(),
        ]);

        AuditLog::query()->create([
            'user_id' => $admin->id,
            'action' => 'payment.voided',
            'entity_type' => Payment::class,
            'entity_id' => 99,
            'reason' => 'Reversion validada por supervisor',
            'result' => 'success',
            'new_values' => [
                'invoice_number' => '000-001-01-00000001',
                'amount' => '17.25',
            ],
            'created_at' => now(),
        ]);

        BackupLog::query()->create([
            'filename' => 'hospital-backup-test.sql',
            'path' => 'backups/hospital-backup-test.sql',
            'disk' => 'local',
            'size_bytes' => 2048,
            'checksum_sha256' => str_repeat('a', 64),
            'status' => BackupLog::STATUS_SUCCESS,
            'type' => BackupLog::TYPE_MANUAL,
            'created_by' => $admin->id,
            'completed_at' => now(),
        ]);

        $this->actingAs($admin)
            ->getJson('/api/reports/operations?date_from='.now()->toDateString().'&date_to='.now()->toDateString())
            ->assertOk()
            ->assertJsonPath('data.summary.void_count', 1)
            ->assertJsonPath('data.summary.reprint_count', 2)
            ->assertJsonPath('data.summary.backup_count', 1)
            ->assertJsonPath('data.summary.audit_event_count', 3)
            ->assertJsonPath('data.summary.cashier_count', 0)
            ->assertJsonPath('data.voids.0.reason', 'Error de captura')
            ->assertJsonPath('data.reprints.0.reason', 'Copia institucional solicitada')
            ->assertJsonPath('data.reprints.0.source', 'institutional_receipt')
            ->assertJsonPath('data.backups.0.filename', 'hospital-backup-test.sql')
            ->assertJsonMissingPath('data.voids.0.invoice_id')
            ->assertJsonMissingPath('data.voids.0.patient_name')
            ->assertJsonMissingPath('data.reprints.0.invoice_id')
            ->assertJsonMissingPath('data.backups.0.id')
            ->assertJsonMissingPath('data.backups.0.checksum_sha256')
            ->assertJsonMissingPath('data.cashiers.0.user_id');
    }

    public function test_operations_report_lists_catalog_service_changes_without_technical_ids(): void
    {
        $this->seedBillingBase();
        $admin = $this->admin();
        $service = Service::query()->where('name', 'Glucosa')->firstOrFail();

        $this->actingAs($admin)
            ->patchJson("/api/services/{$service->id}", [
                'price' => '18.00',
                'price_change_reason' => 'Ajuste aprobado por administracion',
            ])
            ->assertOk();

        $this->actingAs($admin)
            ->getJson('/api/reports/operations?date_from='.now()->toDateString().'&date_to='.now()->toDateString())
            ->assertOk()
            ->assertJsonPath('data.summary.service_change_count', 1)
            ->assertJsonCount(1, 'data.catalog_changes')
            ->assertJsonPath('data.catalog_changes.0.action', 'service.price_updated')
            ->assertJsonPath('data.catalog_changes.0.service', 'Glucosa')
            ->assertJsonPath('data.catalog_changes.0.user', $admin->name)
            ->assertJsonPath('data.catalog_changes.0.old_values.price', '15.00')
            ->assertJsonPath('data.catalog_changes.0.new_values.price', '18.00')
            ->assertJsonPath('data.catalog_changes.0.new_values.price_change_reason', 'Ajuste aprobado por administracion')
            ->assertJsonMissingPath('data.catalog_changes.0.service_id')
            ->assertJsonMissingPath('data.catalog_changes.0.entity_id')
            ->assertJsonMissingPath('data.catalog_changes.0.old_values.category_id')
            ->assertJsonMissingPath('data.catalog_changes.0.new_values.category_id');
    }

    public function test_operations_report_lists_payment_reversals(): void
    {
        $this->seedBillingBase();
        $cashier = $this->cashier();
        $supervisor = $this->supervisor();
        $sessionId = $this->openSession($cashier);
        $invoiceId = $this->createInvoice($cashier, 'Glucosa');

        $paymentId = $this->actingAs($cashier)
            ->postJson("/api/invoices/{$invoiceId}/payments", [
                'cash_session_id' => $sessionId,
                'method' => Payment::METHOD_CASH,
                'amount' => '17.25',
            ])
            ->assertCreated()
            ->json('data.payment.id');

        $this->actingAs($supervisor)
            ->postJson("/api/invoices/{$invoiceId}/payments/{$paymentId}/void", [
                'reason' => 'Cobro registrado por error',
            ])
            ->assertOk();

        $this->actingAs($this->admin())
            ->getJson('/api/reports/operations?date_from='.now()->toDateString().'&date_to='.now()->toDateString())
            ->assertOk()
            ->assertJsonPath('data.summary.payment_void_count', 1)
            ->assertJsonCount(1, 'data.payment_voids')
            ->assertJsonPath('data.payment_voids.0.invoice_number', '000-001-01-00000001')
            ->assertJsonPath('data.payment_voids.0.method', Payment::METHOD_CASH)
            ->assertJsonPath('data.payment_voids.0.amount', '17.25')
            ->assertJsonPath('data.payment_voids.0.reason', 'Cobro registrado por error')
            ->assertJsonPath('data.payment_voids.0.voided_by', $supervisor->name)
            ->assertJsonMissingPath('data.payment_voids.0.patient_name');

        $xlsx = $this->actingAs($this->admin())
            ->get('/api/reports/export?date_from='.now()->toDateString().'&date_to='.now()->toDateString())
            ->assertOk()
            ->assertHeader('content-type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
            ->streamedContent();

        $path = tempnam(sys_get_temp_dir(), 'payment-voids-');
        file_put_contents($path, $xlsx);

        try {
            $spreadsheet = IOFactory::load($path);
            $sheet = $spreadsheet->getSheetByName('Auditoría');

            $this->assertNotNull($sheet);
            $this->assertSame('Historial de Reversos de Pago', $sheet->getCell('B14')->getValue());
            $this->assertSame('Factura', $sheet->getCell('B16')->getValue());
            $this->assertSame('Método', $sheet->getCell('D16')->getValue());
            $this->assertSame('000-001-01-00000001', $sheet->getCell('B17')->getValue());
            $this->assertSame('Efectivo', $sheet->getCell('D17')->getValue());
            $this->assertSame(17.25, $sheet->getCell('E17')->getValue());
            $this->assertSame('Cobro registrado por error', $sheet->getCell('F17')->getValue());
            $this->assertSame($supervisor->name, $sheet->getCell('G17')->getValue());
        } finally {
            if ($path !== false && file_exists($path)) {
                unlink($path);
            }
        }
    }

    public function test_cash_session_report_returns_expected_amounts_payments_movements_and_permissions(): void
    {
        $this->seedBillingBase();
        $cashier = $this->cashier();
        $otherCashier = $this->cashier();
        $sessionId = $this->openSession($cashier);
        $otherSessionId = $this->openSession($otherCashier);
        $cashInvoice = $this->createInvoice($cashier, 'Glucosa');
        $cardInvoice = $this->createInvoice($cashier, 'Hemograma Completo');
        $voidInvoice = $this->createInvoice($cashier, 'Eritropoyetina');

        $this->payInvoice($cashier, $cashInvoice, $sessionId, Payment::METHOD_CASH, '17.25');
        $this->payInvoice($cashier, $cardInvoice, $sessionId, Payment::METHOD_CARD, '11.50');
        $this->payInvoice($cashier, $voidInvoice, $sessionId, Payment::METHOD_OTHER, '25.00');

        Invoice::query()->whereKey($voidInvoice)->update([
            'status' => Invoice::STATUS_VOID,
            'voided_by' => $this->supervisor()->id,
            'voided_at' => now(),
            'void_reason' => 'No debe aparecer en reporte de caja',
        ]);

        $this->actingAs($cashier)
            ->postJson("/api/cash-sessions/{$sessionId}/close", [
                'closing_amount' => '518.00',
                'notes' => 'Diferencia validada para reporte',
            ])
            ->assertOk();

        $this->grantPermissions($cashier, 'reports.cash_session.view');

        $this->actingAs($cashier)
            ->getJson('/api/reports/daily?date='.now()->toDateString())
            ->assertForbidden();

        $this->actingAs($cashier)
            ->getJson("/api/reports/cash-sessions/{$otherSessionId}")
            ->assertForbidden();

        $this->actingAs($cashier)
            ->getJson("/api/reports/cash-sessions/{$sessionId}")
            ->assertOk()
            ->assertJsonPath('data.cash_session.id', $sessionId)
            ->assertJsonPath('data.cash_session.opening_amount', '500.00')
            ->assertJsonPath('data.cash_session.expected_amount', '517.25')
            ->assertJsonPath('data.cash_session.closing_amount', '518.00')
            ->assertJsonPath('data.cash_session.difference_amount', '0.75')
            ->assertJsonPath('data.cash_session.closing_notes', 'Diferencia validada para reporte')
            ->assertJsonPath('data.total_cash', '17.25')
            ->assertJsonPath('data.total_card', '11.50')
            ->assertJsonPath('data.total_other', '0.00')
            ->assertJsonPath('data.payments_count', 2)
            ->assertJsonPath('data.payments_total', '28.75')
            ->assertJsonPath('data.expected_cash_amount', '517.25')
            ->assertJsonPath('data.pending_invoice_count', 0)
            ->assertJsonPath('data.pending_amount', '0.00')
            ->assertJsonCount(2, 'data.payments')
            ->assertJsonCount(5, 'data.movements');

        $this->actingAs($this->supervisor())
            ->getJson("/api/reports/cash-sessions/{$sessionId}")
            ->assertOk()
            ->assertJsonPath('data.cash_session.id', $sessionId);
    }

    public function test_seeded_cashier_can_view_own_cash_session_report_only(): void
    {
        $this->seedBillingBase();
        $cashier = $this->cashier();
        $otherCashier = $this->cashier();
        $sessionId = $this->openSession($cashier);
        $otherSessionId = $this->openSession($otherCashier);
        $invoiceId = $this->createInvoice($cashier, 'Glucosa');
        $otherInvoiceId = $this->createInvoice($otherCashier, 'Eritropoyetina');

        $this->payInvoice($cashier, $invoiceId, $sessionId, Payment::METHOD_CASH, '17.25');
        $this->payInvoice($otherCashier, $otherInvoiceId, $otherSessionId, Payment::METHOD_CARD, '25.00');

        $this->actingAs($cashier)
            ->getJson("/api/reports/cash-sessions/{$sessionId}")
            ->assertOk()
            ->assertJsonPath('data.cash_session.id', $sessionId)
            ->assertJsonPath('data.total_cash', '17.25')
            ->assertJsonPath('data.total_card', '0.00');

        $this->actingAs($cashier)
            ->getJson("/api/reports/cash-sessions/{$otherSessionId}")
            ->assertForbidden();
    }

    public function test_closed_cash_session_report_uses_close_snapshot_after_later_payment_correction(): void
    {
        $this->seedBillingBase();
        $cashier = $this->cashier();
        $sessionId = $this->openSession($cashier);
        $cashInvoice = $this->createInvoice($cashier, 'Glucosa');
        $cardInvoice = $this->createInvoice($cashier, 'Hemograma Completo');

        $this->payInvoice($cashier, $cashInvoice, $sessionId, Payment::METHOD_CASH, '17.25');
        $this->payInvoice($cashier, $cardInvoice, $sessionId, Payment::METHOD_CARD, '11.50');

        $this->actingAs($cashier)
            ->postJson("/api/cash-sessions/{$sessionId}/close", [
                'closing_amount' => '517.25',
            ])
            ->assertOk();

        Invoice::query()->whereKey($cardInvoice)->update([
            'status' => Invoice::STATUS_VOID,
            'voided_by' => $this->supervisor()->id,
            'voided_at' => now()->addMinute(),
            'void_reason' => 'Correccion posterior al cierre',
        ]);

        $this->grantPermissions($cashier, 'reports.cash_session.view');

        $this->actingAs($cashier)
            ->getJson("/api/reports/cash-sessions/{$sessionId}")
            ->assertOk()
            ->assertJsonPath('data.total_cash', '17.25')
            ->assertJsonPath('data.total_card', '11.50')
            ->assertJsonPath('data.payments_count', 2)
            ->assertJsonPath('data.payments_total', '28.75')
            ->assertJsonPath('data.expected_cash_amount', '517.25')
            ->assertJsonPath('data.pending_invoice_count', 0)
            ->assertJsonPath('data.pending_amount', '0.00')
            ->assertJsonCount(2, 'data.payments')
            ->assertJsonPath('data.payments.1.invoice.status', Invoice::STATUS_VOID);
    }

    public function test_open_cash_session_report_exposes_pending_without_counting_it_as_collected(): void
    {
        $this->seedBillingBase();
        FiscalSetting::query()->update(['partial_payments_enabled' => true]);
        $cashier = $this->cashier();
        $sessionId = $this->openSession($cashier);
        $cashInvoice = $this->createInvoice($cashier, 'Glucosa');
        $partialInvoice = $this->createInvoice($cashier, 'Eritropoyetina');

        $this->payInvoice($cashier, $cashInvoice, $sessionId, Payment::METHOD_CASH, '17.25');
        $this->payInvoice($cashier, $partialInvoice, $sessionId, Payment::METHOD_CARD, '5.00');

        $this->grantPermissions($cashier, 'reports.cash_session.view');

        $this->actingAs($cashier)
            ->getJson("/api/reports/cash-sessions/{$sessionId}")
            ->assertOk()
            ->assertJsonPath('data.total_cash', '17.25')
            ->assertJsonPath('data.total_card', '5.00')
            ->assertJsonPath('data.payments_total', '22.25')
            ->assertJsonPath('data.expected_cash_amount', '517.25')
            ->assertJsonPath('data.pending_invoice_count', 1)
            ->assertJsonPath('data.pending_amount', '20.00')
            ->assertJsonPath('data.payments.1.invoice.status', Invoice::STATUS_PARTIAL)
            ->assertJsonPath('data.payments.1.invoice.balance_due', '20.00');
    }

    public function test_cash_session_export_allows_cashier_scoped_permission_only_for_own_session(): void
    {
        $this->seedBillingBase();
        $cashier = $this->cashier();
        $otherCashier = $this->cashier();
        $sessionId = $this->openSession($cashier);
        $otherSessionId = $this->openSession($otherCashier);
        $invoiceId = $this->createInvoice($cashier, 'Glucosa');
        $otherInvoiceId = $this->createInvoice($otherCashier, 'Eritropoyetina');

        $this->payInvoice($cashier, $invoiceId, $sessionId, Payment::METHOD_CASH, '17.25');
        $this->payInvoice($otherCashier, $otherInvoiceId, $otherSessionId, Payment::METHOD_CARD, '25.00');

        $this->grantPermissions($cashier,
            'reports.cash_session.view',
            'reports.export',
        );

        $query = 'date_from='.now()->toDateString().'&date_to='.now()->toDateString();

        $xlsx = $this->actingAs($cashier)
            ->get("/api/reports/export?{$query}&cash_session_id={$sessionId}")
            ->assertOk()
            ->assertHeader('content-type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
            ->streamedContent();

        $this->assertStringStartsWith("PK\x03\x04", $xlsx);

        $this->actingAs($cashier)
            ->get("/api/reports/export?{$query}&cash_session_id={$otherSessionId}")
            ->assertForbidden();

        $this->actingAs($cashier)
            ->get("/api/reports/export?{$query}")
            ->assertForbidden();
    }

    public function test_cash_session_export_uses_cash_session_dates_even_when_request_range_is_wrong(): void
    {
        $this->seedBillingBase();
        $cashier = $this->cashier();
        $sessionId = $this->openSession($cashier);
        $invoiceId = $this->createInvoice($cashier, 'Glucosa');
        $sessionDate = now()->subDays(7)->setTime(8, 0);

        $this->payInvoice($cashier, $invoiceId, $sessionId, Payment::METHOD_CASH, '17.25');

        CashRegisterSession::query()
            ->whereKey($sessionId)
            ->update([
                'opened_at' => $sessionDate,
                'closed_at' => $sessionDate->copy()->setTime(16, 0),
                'status' => CashRegisterSession::STATUS_CLOSED,
            ]);

        Invoice::query()
            ->whereKey($invoiceId)
            ->update(['issued_at' => $sessionDate->copy()->setTime(9, 0)]);

        Payment::query()
            ->where('invoice_id', $invoiceId)
            ->update(['paid_at' => $sessionDate->copy()->setTime(10, 0)]);

        $this->grantPermissions($cashier, 'reports.cash_session.view', 'reports.export');

        $xlsx = $this->actingAs($cashier)
            ->get('/api/reports/export?date_from='.now()->toDateString().'&date_to='.now()->toDateString().'&cash_session_id='.$sessionId)
            ->assertOk()
            ->assertHeader('content-type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
            ->streamedContent();

        $path = tempnam(sys_get_temp_dir(), 'cash-session-export-dates-');
        file_put_contents($path, $xlsx);

        try {
            $spreadsheet = IOFactory::load($path);
            $filtersSheet = $spreadsheet->getSheetByName('Filtros Aplicados');
            $financialSheet = $spreadsheet->getSheetByName('Lectura Financiera');

            $this->assertNotNull($filtersSheet);
            $this->assertSame($sessionDate->format('d/m/Y'), $filtersSheet->getCell('C7')->getValue());
            $this->assertSame($sessionDate->format('d/m/Y'), $filtersSheet->getCell('C8')->getValue());

            $this->assertNotNull($financialSheet);
            $this->assertSame(17.25, $financialSheet->getCell('C7')->getValue());
        } finally {
            if ($path !== false && file_exists($path)) {
                unlink($path);
            }
        }
    }

    public function test_report_indexes_exist_for_payment_and_category_queries(): void
    {
        $this->assertContains('payments_status_paid_at_index', $this->indexNames('payments'));
        $this->assertContains('invoice_items_category_name_index', $this->indexNames('invoice_items'));
    }

    /**
     * @return list<string>
     */
    private function indexNames(string $table): array
    {
        $driver = DB::connection()->getDriverName();

        if ($driver === 'sqlite') {
            return collect(DB::select(
                "select name from sqlite_master where type = 'index' and tbl_name = ?",
                [$table],
            ))
                ->pluck('name')
                ->filter()
                ->values()
                ->all();
        }

        if ($driver === 'mysql' || $driver === 'mariadb') {
            return collect(DB::select('show index from '.$table))
                ->pluck('Key_name')
                ->filter()
                ->unique()
                ->values()
                ->all();
        }

        return [];
    }

    private function seedBillingBase(): void
    {
        app(PermissionRegistrar::class)->forgetCachedPermissions();
        $this->seed([RolesAndPermissionsSeeder::class, ServiceCatalogSeeder::class]);
        app(PermissionRegistrar::class)->forgetCachedPermissions();

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

    private function createInvoice(User $cashier, string $serviceName): int
    {
        if (! CashRegisterSession::query()
            ->where('user_id', $cashier->id)
            ->where('status', CashRegisterSession::STATUS_OPEN)
            ->exists()) {
            $this->openSession($cashier);
        }

        return app(CreateInvoiceAction::class)
            ->execute([
                'patient_name' => 'Maria Lopez',
                'items' => [[
                    'service_id' => Service::query()->where('name', $serviceName)->firstOrFail()->id,
                    'quantity' => '1.00',
                ]],
            ], $cashier->fresh())
            ->id;
    }

    private function payInvoice(
        User $cashier,
        int $invoiceId,
        int $sessionId,
        string $method,
        string $amount,
    ): void {
        app(RegisterPaymentAction::class)
            ->execute(
                Invoice::query()->findOrFail($invoiceId),
                [
                    'cash_session_id' => $sessionId,
                    'method' => $method,
                    'amount' => $amount,
                    'reference' => in_array($method, [Payment::METHOD_CARD, Payment::METHOD_TRANSFER], true)
                        ? "REF-{$method}-{$invoiceId}"
                        : null,
                ],
                $cashier->fresh(),
                app(InvoiceAccess::class),
            );
    }

    private function openSession(User $cashier): int
    {
        $existingSession = CashRegisterSession::query()
            ->where('user_id', $cashier->id)
            ->where('status', CashRegisterSession::STATUS_OPEN)
            ->first();

        if ($existingSession) {
            return $existingSession->id;
        }

        if (CashRegisterSession::query()->where('status', CashRegisterSession::STATUS_OPEN)->exists()) {
            return CashRegisterSession::query()->create([
                'user_id' => $cashier->id,
                'open_user_id' => $cashier->id,
                'opening_amount' => '500.00',
                'status' => CashRegisterSession::STATUS_OPEN,
                'opened_at' => now(),
            ])->id;
        }

        return app(OpenCashSessionAction::class)
            ->execute(['opening_amount' => '500.00'], $cashier->fresh())
            ->id;
    }

    public function test_pdf_export_requires_reports_export_permission(): void
    {
        $this->seedBillingBase();
        $user = User::factory()->create();
        $reportViewer = User::factory()->create();
        $this->grantPermissions($reportViewer, 'reports.view', 'reports.managerial.view');
        $date = now()->toDateString();

        $this->getJson("/api/reports/pdf?date={$date}")
            ->assertUnauthorized();

        $this->actingAs($user)
            ->getJson("/api/reports/pdf?date={$date}")
            ->assertForbidden();

        $this->actingAs($reportViewer)
            ->getJson("/api/reports/pdf?date={$date}")
            ->assertForbidden();
    }

    public function test_cash_session_report_user_cannot_export_managerial_daily_pdf(): void
    {
        $this->seedBillingBase();
        $cashier = $this->cashier();
        $this->grantPermissions($cashier, 'reports.cash_session.view', 'reports.export');
        $date = now()->toDateString();

        $this->actingAs($cashier)
            ->getJson("/api/reports/pdf?date={$date}")
            ->assertForbidden();

        $this->actingAs($cashier)
            ->getJson('/api/reports/pdf?date=fecha-mala')
            ->assertForbidden();
    }

    public function test_daily_closure_pdf_export_succeeds(): void
    {
        $this->seedBillingBase();
        $admin = $this->admin();
        $date = now()->toDateString();

        $response = $this->actingAs($admin)
            ->get("/api/reports/pdf?date={$date}")
            ->assertOk()
            ->assertHeader('Content-Type', 'application/pdf');

        $this->assertStringStartsWith('%PDF', $response->getContent());
    }

    public function test_daily_closure_pdf_export_includes_financial_reading_with_sources(): void
    {
        $this->seedBillingBase();
        $admin = $this->admin();
        FiscalSetting::query()->update(['partial_payments_enabled' => true]);
        $cashier = $this->cashier();
        $sessionId = $this->openSession($cashier);
        $paidInvoice = $this->createInvoice($cashier, 'Glucosa');
        $partialInvoice = $this->createInvoice($cashier, 'Hemograma Completo');
        $this->createInvoice($cashier, 'Eritropoyetina');
        $voidInvoice = $this->createInvoice($cashier, 'Glucosa');

        $this->payInvoice($cashier, $paidInvoice, $sessionId, Payment::METHOD_CASH, '17.25');
        $this->payInvoice($cashier, $partialInvoice, $sessionId, Payment::METHOD_TRANSFER, '5.00');
        $this->payInvoice($cashier, $voidInvoice, $sessionId, Payment::METHOD_CARD, '17.25');

        Invoice::query()->whereKey($voidInvoice)->update([
            'status' => Invoice::STATUS_VOID,
            'voided_by' => $this->supervisor()->id,
            'voided_at' => now(),
            'void_reason' => 'No debe inflar PDF diario',
        ]);

        $capturedHtml = null;
        Pdf::shouldReceive('loadHTML')
            ->once()
            ->with(\Mockery::on(function (string $html) use (&$capturedHtml): bool {
                $capturedHtml = $html;

                return true;
            }))
            ->andReturn(tap(\Mockery::mock(DomPdfWrapper::class), function ($pdf): void {
                $pdf->shouldReceive('output')
                    ->once()
                    ->andReturn('%PDF-daily-financial-reading');
            }));

        $date = now()->toDateString();
        $this->actingAs($admin)
            ->get("/api/reports/pdf?date={$date}")
            ->assertOk()
            ->assertHeader('Content-Type', 'application/pdf')
            ->assertSee('%PDF-daily-financial-reading', false);

        $this->assertIsString($capturedHtml);
        $this->assertStringContainsString('Lectura Financiera del Dia', $capturedHtml);
        $this->assertStringContainsString('Facturado', $capturedHtml);
        $this->assertStringContainsString('L. 53.75', $capturedHtml);
        $this->assertStringContainsString('Facturas no anuladas emitidas en el dia', $capturedHtml);
        $this->assertStringContainsString('Cobrado', $capturedHtml);
        $this->assertStringContainsString('L. 22.25', $capturedHtml);
        $this->assertStringContainsString('Pagos publicados no anulados en el dia', $capturedHtml);
        $this->assertStringContainsString('Pendiente', $capturedHtml);
        $this->assertStringContainsString('L. 31.50', $capturedHtml);
        $this->assertStringContainsString('Saldo actual de facturas emitidas o parciales del dia', $capturedHtml);
        $this->assertStringContainsString('Parcial', $capturedHtml);
        $this->assertStringContainsString('L. 11.50', $capturedHtml);
        $this->assertStringContainsString('Facturas con pago parcial separadas de pagadas', $capturedHtml);
        $this->assertStringContainsString('Anulado', $capturedHtml);
        $this->assertStringContainsString('L. 17.25', $capturedHtml);
        $this->assertStringContainsString('Facturas anuladas reportadas fuera de ingresos', $capturedHtml);
    }

    public function test_period_closure_pdf_export_succeeds(): void
    {
        $this->seedBillingBase();
        $admin = $this->admin();
        $dateFrom = now()->toDateString();
        $dateTo = now()->toDateString();

        $response = $this->actingAs($admin)
            ->get("/api/reports/pdf?date_from={$dateFrom}&date_to={$dateTo}")
            ->assertOk()
            ->assertHeader('Content-Type', 'application/pdf');

        $this->assertStringStartsWith('%PDF', $response->getContent());
    }

    public function test_cash_session_period_pdf_uses_cash_session_dates_even_when_request_range_is_wrong(): void
    {
        $this->seedBillingBase();
        $cashier = $this->cashier();
        $sessionId = $this->openSession($cashier);
        $invoiceId = $this->createInvoice($cashier, 'Glucosa');
        $sessionDate = now()->subDays(7)->setTime(8, 0);

        $this->payInvoice($cashier, $invoiceId, $sessionId, Payment::METHOD_CASH, '17.25');

        CashRegisterSession::query()
            ->whereKey($sessionId)
            ->update([
                'opened_at' => $sessionDate,
                'closed_at' => $sessionDate->copy()->setTime(16, 0),
                'status' => CashRegisterSession::STATUS_CLOSED,
            ]);

        Invoice::query()
            ->whereKey($invoiceId)
            ->update(['issued_at' => $sessionDate->copy()->setTime(9, 0)]);

        Payment::query()
            ->where('invoice_id', $invoiceId)
            ->update(['paid_at' => $sessionDate->copy()->setTime(10, 0)]);

        $this->grantPermissions($cashier, 'reports.cash_session.view', 'reports.export');

        $capturedHtml = null;
        Pdf::shouldReceive('loadHTML')
            ->once()
            ->with(\Mockery::on(function (string $html) use (&$capturedHtml): bool {
                $capturedHtml = $html;

                return true;
            }))
            ->andReturn(tap(\Mockery::mock(DomPdfWrapper::class), function ($pdf): void {
                $pdf->shouldReceive('output')
                    ->once()
                    ->andReturn('%PDF-cash-session-period');
            }));

        $this->actingAs($cashier)
            ->get('/api/reports/pdf?date_from='.now()->toDateString().'&date_to='.now()->toDateString().'&cash_session_id='.$sessionId)
            ->assertOk()
            ->assertHeader('Content-Type', 'application/pdf')
            ->assertSee('%PDF-cash-session-period', false);

        $this->assertIsString($capturedHtml);
        $this->assertStringContainsString(
            'Período: '.$sessionDate->toDateString().' al '.$sessionDate->toDateString(),
            $capturedHtml,
        );
        $this->assertStringContainsString('L. 17.25', $capturedHtml);
    }

    public function test_period_closure_pdf_export_validates_range_filters(): void
    {
        $this->seedBillingBase();
        $admin = $this->admin();
        $dateFrom = now()->subDays(40)->toDateString();
        $dateTo = now()->toDateString();

        $this->actingAs($admin)
            ->getJson("/api/reports/pdf?date_from={$dateFrom}&date_to={$dateTo}")
            ->assertUnprocessable()
            ->assertJsonValidationErrors('date_to');

        $this->actingAs($admin)
            ->getJson('/api/reports/pdf?date_from=fecha-mala&date_to='.now()->toDateString())
            ->assertUnprocessable()
            ->assertJsonValidationErrors('date_from');

        $this->actingAs($admin)
            ->getJson('/api/reports/pdf?date_from=fecha-mala&date_to='.now()->addYear()->toDateString())
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['date_from', 'date_to']);

        $this->actingAs($admin)
            ->getJson('/api/reports/pdf?date_from='.now()->toDateString().'&date_to='.now()->toDateString().'&method=cheque')
            ->assertUnprocessable()
            ->assertJsonValidationErrors('method');
    }

    public function test_period_closure_pdf_declares_active_filters_with_human_labels(): void
    {
        $this->seedBillingBase();
        $admin = $this->admin();
        $cashier = $this->cashier();
        $sessionId = $this->openSession($cashier);
        $glucose = Service::query()->where('name', 'Glucosa')->firstOrFail();
        $invoiceId = $this->createInvoice($cashier, 'Glucosa');

        $this->payInvoice($cashier, $invoiceId, $sessionId, Payment::METHOD_CASH, '17.25');

        $capturedHtml = null;
        Pdf::shouldReceive('loadHTML')
            ->once()
            ->with(\Mockery::on(function (string $html) use (&$capturedHtml): bool {
                $capturedHtml = $html;

                return true;
            }))
            ->andReturn(tap(\Mockery::mock(DomPdfWrapper::class), function ($pdf): void {
                $pdf->shouldReceive('output')
                    ->once()
                    ->andReturn('%PDF-human-filters');
            }));

        $date = now()->toDateString();
        $query = http_build_query([
            'date_from' => $date,
            'date_to' => $date,
            'method' => Payment::METHOD_CASH,
            'status' => Invoice::STATUS_PAID,
            'user_id' => $cashier->id,
            'cash_session_id' => $sessionId,
            'area_id' => $glucose->area_id,
            'category_id' => $glucose->category_id,
        ]);

        $this->actingAs($admin)
            ->get("/api/reports/pdf?{$query}")
            ->assertOk()
            ->assertHeader('Content-Type', 'application/pdf')
            ->assertSee('%PDF-human-filters', false);

        $this->assertIsString($capturedHtml);
        $this->assertStringContainsString('Filtros aplicados', $capturedHtml);
        $this->assertStringContainsString('Metodo de pago', $capturedHtml);
        $this->assertStringContainsString('Efectivo', $capturedHtml);
        $this->assertStringContainsString('Estado de factura', $capturedHtml);
        $this->assertStringContainsString('Pagada', $capturedHtml);
        $this->assertStringContainsString('Cajero', $capturedHtml);
        $this->assertStringContainsString(htmlspecialchars($cashier->name, ENT_QUOTES | ENT_HTML5, 'UTF-8'), $capturedHtml);
        $this->assertStringContainsString('Caja', $capturedHtml);
        $this->assertStringContainsString(now()->format('d/m/Y'), $capturedHtml);
        $this->assertStringContainsString('Abierta', $capturedHtml);
        $this->assertStringContainsString('Area', $capturedHtml);
        $this->assertStringContainsString('Categoria', $capturedHtml);
        $this->assertStringNotContainsString('Caja #'.(string) $sessionId, $capturedHtml);
    }

    public function test_period_closure_pdf_export_includes_financial_reading_with_sources(): void
    {
        $this->seedBillingBase();
        $admin = $this->admin();
        FiscalSetting::query()->update(['partial_payments_enabled' => true]);
        $cashier = $this->cashier();
        $sessionId = $this->openSession($cashier);
        $paidInvoice = $this->createInvoice($cashier, 'Glucosa');
        $partialInvoice = $this->createInvoice($cashier, 'Hemograma Completo');
        $this->createInvoice($cashier, 'Eritropoyetina');
        $voidInvoice = $this->createInvoice($cashier, 'Glucosa');

        $this->payInvoice($cashier, $paidInvoice, $sessionId, Payment::METHOD_CASH, '17.25');
        $this->payInvoice($cashier, $partialInvoice, $sessionId, Payment::METHOD_TRANSFER, '5.00');
        $this->payInvoice($cashier, $voidInvoice, $sessionId, Payment::METHOD_CARD, '17.25');

        Invoice::query()->whereKey($voidInvoice)->update([
            'status' => Invoice::STATUS_VOID,
            'voided_by' => $this->supervisor()->id,
            'voided_at' => now(),
            'void_reason' => 'No debe inflar PDF',
        ]);

        $capturedHtml = null;
        Pdf::shouldReceive('loadHTML')
            ->once()
            ->with(\Mockery::on(function (string $html) use (&$capturedHtml): bool {
                $capturedHtml = $html;

                return true;
            }))
            ->andReturn(tap(\Mockery::mock(DomPdfWrapper::class), function ($pdf): void {
                $pdf->shouldReceive('output')
                    ->once()
                    ->andReturn('%PDF-financial-reading');
            }));

        $date = now()->toDateString();
        $this->actingAs($admin)
            ->get("/api/reports/pdf?date_from={$date}&date_to={$date}")
            ->assertOk()
            ->assertHeader('Content-Type', 'application/pdf')
            ->assertSee('%PDF-financial-reading', false);

        $this->assertIsString($capturedHtml);
        $this->assertStringContainsString('Cierre de Operaciones y Facturacion', $capturedHtml);
        $this->assertStringNotContainsString('Cierre de Operaciones y Ventas', $capturedHtml);
        $this->assertStringContainsString('Lectura Financiera del Periodo', $capturedHtml);
        $this->assertStringContainsString('Facturado', $capturedHtml);
        $this->assertStringContainsString('L. 53.75', $capturedHtml);
        $this->assertStringContainsString('Facturas no anuladas emitidas en el rango', $capturedHtml);
        $this->assertStringContainsString('Cobrado', $capturedHtml);
        $this->assertStringContainsString('L. 22.25', $capturedHtml);
        $this->assertStringContainsString('Pagos publicados no anulados en el rango', $capturedHtml);
        $this->assertStringContainsString('Pendiente', $capturedHtml);
        $this->assertStringContainsString('L. 31.50', $capturedHtml);
        $this->assertStringContainsString('Saldo actual de facturas emitidas o parciales', $capturedHtml);
        $this->assertStringContainsString('Parcial', $capturedHtml);
        $this->assertStringContainsString('L. 11.50', $capturedHtml);
        $this->assertStringContainsString('Facturas con pago parcial separadas de pagadas', $capturedHtml);
        $this->assertStringContainsString('Anulado', $capturedHtml);
        $this->assertStringContainsString('L. 17.25', $capturedHtml);
        $this->assertStringContainsString('Facturas anuladas reportadas fuera de ingresos', $capturedHtml);
    }

    public function test_period_closure_pdf_escapes_institutional_catalog_and_audit_text(): void
    {
        $this->seedBillingBase();
        $admin = $this->admin();
        $cashier = $this->cashier();
        $supervisor = $this->supervisor();

        FiscalSetting::query()->update([
            'hospital_name' => 'Hospital <script>alert(1)</script>',
            'rtn' => '0801"><script>alert(2)</script>',
        ]);

        $service = Service::query()->where('name', 'Glucosa')->firstOrFail();
        Category::query()
            ->whereKey($service->category_id)
            ->update(['name' => 'Categoria <script>alert(3)</script>']);
        Area::query()
            ->whereKey($service->area_id)
            ->update(['name' => 'Area <script>alert(4)</script>']);
        $service->update(['name' => 'Servicio <img src=x onerror=alert(5)>']);

        $invoiceId = $this->createInvoice($cashier, 'Servicio <img src=x onerror=alert(5)>');
        $voidInvoiceId = $this->createInvoice($cashier, 'Servicio <img src=x onerror=alert(5)>');

        Invoice::query()->whereKey($voidInvoiceId)->update([
            'status' => Invoice::STATUS_VOID,
            'voided_by' => $supervisor->id,
            'voided_at' => now(),
            'void_reason' => 'Motivo <script>alert(6)</script>',
        ]);

        $this->assertNotSame($invoiceId, $voidInvoiceId);

        $capturedHtml = null;
        Pdf::shouldReceive('loadHTML')
            ->once()
            ->with(\Mockery::on(function (string $html) use (&$capturedHtml): bool {
                $capturedHtml = $html;

                return true;
            }))
            ->andReturn(tap(\Mockery::mock(DomPdfWrapper::class), function ($pdf): void {
                $pdf->shouldReceive('output')
                    ->once()
                    ->andReturn('%PDF-escaped-report');
            }));

        $date = now()->toDateString();
        $this->actingAs($admin)
            ->get("/api/reports/pdf?date_from={$date}&date_to={$date}")
            ->assertOk()
            ->assertHeader('Content-Type', 'application/pdf')
            ->assertSee('%PDF-escaped-report', false);

        $this->assertIsString($capturedHtml);
        $this->assertStringContainsString('Hospital &lt;script&gt;alert(1)&lt;/script&gt;', $capturedHtml);
        $this->assertStringContainsString('0801&quot;&gt;&lt;script&gt;alert(2)&lt;/script&gt;', $capturedHtml);
        $this->assertStringContainsString('Categoria &lt;script&gt;alert(3)&lt;/script&gt;', $capturedHtml);
        $this->assertStringContainsString('Area &lt;script&gt;alert(4)&lt;/script&gt;', $capturedHtml);
        $this->assertStringContainsString('Servicio &lt;img src=x onerror=alert(5)&gt;', $capturedHtml);
        $this->assertStringContainsString('Motivo &lt;script&gt;alert(6)&lt;/script&gt;', $capturedHtml);
        $this->assertStringNotContainsString('<script>', $capturedHtml);
        $this->assertStringNotContainsString('<img src=x', $capturedHtml);
    }

    public function test_period_closure_pdf_labels_service_totals_as_billed_not_collected(): void
    {
        $this->seedBillingBase();
        $admin = $this->admin();
        $cashier = $this->cashier();
        $this->createInvoice($cashier, 'Glucosa');

        $capturedHtml = null;
        Pdf::shouldReceive('loadHTML')
            ->once()
            ->with(\Mockery::on(function (string $html) use (&$capturedHtml): bool {
                $capturedHtml = $html;

                return true;
            }))
            ->andReturn(tap(\Mockery::mock(DomPdfWrapper::class), function ($pdf): void {
                $pdf->shouldReceive('output')
                    ->once()
                    ->andReturn('%PDF-service-labels');
            }));

        $date = now()->toDateString();
        $this->actingAs($admin)
            ->get("/api/reports/pdf?date_from={$date}&date_to={$date}")
            ->assertOk()
            ->assertHeader('Content-Type', 'application/pdf')
            ->assertSee('%PDF-service-labels', false);

        $this->assertIsString($capturedHtml);
        $categoryStart = strpos($capturedHtml, 'Facturación por Categoría de Servicio');
        $categoryEnd = strpos($capturedHtml, 'Facturación por Área Institucional');
        $this->assertIsInt($categoryStart);
        $this->assertIsInt($categoryEnd);

        $categorySection = substr($capturedHtml, $categoryStart, $categoryEnd - $categoryStart);
        $this->assertStringContainsString('Monto Facturado (LPS)', $categorySection);
        $this->assertStringNotContainsString('Ventas por Categoría de Servicio', $categorySection);
        $this->assertStringNotContainsString('<th class=\'text-right\'>Total (LPS)</th>', $categorySection);

        $sectionStart = strpos($capturedHtml, 'Servicios Más Facturados');
        $sectionEnd = strpos($capturedHtml, 'Resumen de Auditoría Operativa');
        $this->assertIsInt($sectionStart);
        $this->assertIsInt($sectionEnd);

        $servicesSection = substr($capturedHtml, $sectionStart, $sectionEnd - $sectionStart);
        $this->assertStringContainsString('Monto Facturado (LPS)', $servicesSection);
        $this->assertStringNotContainsString('Top Servicios Más Vendidos', $servicesSection);
        $this->assertStringNotContainsString('Total Recaudado (LPS)', $servicesSection);
    }

    public function test_period_closure_pdf_without_audit_view_omits_operational_audit_section(): void
    {
        $this->seedBillingBase();
        $viewer = User::factory()->create();
        $this->grantPermissions($viewer, 'reports.view', 'reports.managerial.view', 'reports.export');
        $cashier = $this->cashier();
        $sessionId = $this->openSession($cashier);
        $invoiceId = $this->createInvoice($cashier, 'Glucosa');
        $this->payInvoice($cashier, $invoiceId, $sessionId, Payment::METHOD_CASH, '17.25');

        Invoice::query()->whereKey($invoiceId)->update([
            'status' => Invoice::STATUS_VOID,
            'voided_by' => $this->supervisor()->id,
            'voided_at' => now(),
            'void_reason' => 'Motivo reservado sin auditoria',
        ]);

        $capturedHtml = null;
        Pdf::shouldReceive('loadHTML')
            ->once()
            ->with(\Mockery::on(function (string $html) use (&$capturedHtml): bool {
                $capturedHtml = $html;

                return true;
            }))
            ->andReturn(tap(\Mockery::mock(DomPdfWrapper::class), function ($pdf): void {
                $pdf->shouldReceive('output')
                    ->once()
                    ->andReturn('%PDF-no-audit-section');
            }));

        $date = now()->toDateString();
        $this->actingAs($viewer)
            ->get("/api/reports/pdf?date_from={$date}&date_to={$date}")
            ->assertOk()
            ->assertHeader('Content-Type', 'application/pdf')
            ->assertSee('%PDF-no-audit-section', false);

        $this->assertIsString($capturedHtml);
        $this->assertStringNotContainsString('Resumen de Auditor', $capturedHtml);
        $this->assertStringNotContainsString('Detalle de Anulaciones', $capturedHtml);
        $this->assertStringNotContainsString('Motivo reservado sin auditoria', $capturedHtml);
        $this->assertStringContainsString('Servicios', $capturedHtml);
    }

    public function test_period_closure_pdf_labels_area_totals_as_billed_not_generic_income(): void
    {
        $this->seedBillingBase();
        $admin = $this->admin();
        $cashier = $this->cashier();
        $this->createInvoice($cashier, 'Glucosa');

        $capturedHtml = null;
        Pdf::shouldReceive('loadHTML')
            ->once()
            ->with(\Mockery::on(function (string $html) use (&$capturedHtml): bool {
                $capturedHtml = $html;

                return true;
            }))
            ->andReturn(tap(\Mockery::mock(DomPdfWrapper::class), function ($pdf): void {
                $pdf->shouldReceive('output')
                    ->once()
                    ->andReturn('%PDF-area-labels');
            }));

        $date = now()->toDateString();
        $this->actingAs($admin)
            ->get("/api/reports/pdf?date_from={$date}&date_to={$date}")
            ->assertOk()
            ->assertHeader('Content-Type', 'application/pdf')
            ->assertSee('%PDF-area-labels', false);

        $this->assertIsString($capturedHtml);
        $sectionStart = strpos($capturedHtml, 'Facturación por Área Institucional');
        $sectionEnd = strpos($capturedHtml, 'Recaudación por Método de Pago');
        $this->assertIsInt($sectionStart);
        $this->assertIsInt($sectionEnd);

        $areaSection = substr($capturedHtml, $sectionStart, $sectionEnd - $sectionStart);
        $this->assertStringContainsString('Monto Facturado (LPS)', $areaSection);
        $this->assertStringNotContainsString('Ingresos por Area Institucional', $areaSection);
        $this->assertStringNotContainsString('<th class=\'text-right\'>Total (LPS)</th>', $areaSection);
    }

    public function test_period_closure_pdf_labels_payment_scoped_breakdowns_as_prorated_collected_amounts(): void
    {
        $this->seedBillingBase();
        $admin = $this->admin();
        $cashier = $this->cashier();
        $sessionId = $this->openSession($cashier);
        $invoiceId = $this->createInvoice($cashier, 'Glucosa');

        $this->payInvoice($cashier, $invoiceId, $sessionId, Payment::METHOD_CASH, '17.25');

        $capturedHtml = null;
        Pdf::shouldReceive('loadHTML')
            ->once()
            ->with(\Mockery::on(function (string $html) use (&$capturedHtml): bool {
                $capturedHtml = $html;

                return true;
            }))
            ->andReturn(tap(\Mockery::mock(DomPdfWrapper::class), function ($pdf): void {
                $pdf->shouldReceive('output')
                    ->once()
                    ->andReturn('%PDF-payment-scoped-labels');
            }));

        $date = now()->toDateString();
        $this->actingAs($admin)
            ->get("/api/reports/pdf?date_from={$date}&date_to={$date}&method=".Payment::METHOD_CASH)
            ->assertOk()
            ->assertHeader('Content-Type', 'application/pdf')
            ->assertSee('%PDF-payment-scoped-labels', false);

        $this->assertIsString($capturedHtml);

        $categoryStart = strpos($capturedHtml, 'Cobros asignados por Categoria de Servicio');
        $categoryEnd = strpos($capturedHtml, 'Cobros asignados por Area Institucional');
        $this->assertIsInt($categoryStart);
        $this->assertIsInt($categoryEnd);
        $categorySection = substr($capturedHtml, $categoryStart, $categoryEnd - $categoryStart);
        $this->assertStringContainsString('Cobrado asignado proporcionalmente (LPS)', $categorySection);
        $this->assertStringContainsString('Pagos publicados filtrados, asignados proporcionalmente', $categorySection);
        $this->assertStringNotContainsString('Monto Facturado (LPS)', $categorySection);

        $areaStart = strpos($capturedHtml, 'Cobros asignados por Area Institucional');
        $areaEnd = strpos($capturedHtml, 'Recaudaci');
        $this->assertIsInt($areaStart);
        $this->assertIsInt($areaEnd);
        $areaSection = substr($capturedHtml, $areaStart, $areaEnd - $areaStart);
        $this->assertStringContainsString('Cobrado asignado proporcionalmente (LPS)', $areaSection);

        $serviceStart = strpos($capturedHtml, 'Servicios con cobro asignado');
        $serviceEnd = strpos($capturedHtml, 'Resumen de Auditor');
        $this->assertIsInt($serviceStart);
        $this->assertIsInt($serviceEnd);
        $serviceSection = substr($capturedHtml, $serviceStart, $serviceEnd - $serviceStart);
        $this->assertStringContainsString('Cobrado asignado proporcionalmente (LPS)', $serviceSection);
        $this->assertStringNotContainsString('Monto Facturado (LPS)', $serviceSection);
    }

    public function test_period_closure_pdf_export_includes_payment_reversals_without_technical_ids(): void
    {
        $this->seedBillingBase();
        $admin = $this->admin();
        $cashier = $this->cashier();
        $supervisor = $this->supervisor();
        $supervisor->forceFill(['name' => 'Supervisor Hospital'])->save();
        $sessionId = $this->openSession($cashier);
        $invoiceId = $this->createInvoice($cashier, 'Glucosa');

        $paymentId = $this->actingAs($cashier)
            ->postJson("/api/invoices/{$invoiceId}/payments", [
                'cash_session_id' => $sessionId,
                'method' => Payment::METHOD_CASH,
                'amount' => '17.25',
            ])
            ->assertCreated()
            ->json('data.payment.id');

        $this->actingAs($supervisor)
            ->postJson("/api/invoices/{$invoiceId}/payments/{$paymentId}/void", [
                'reason' => 'Cobro registrado por error',
            ])
            ->assertOk();

        $capturedHtml = null;
        Pdf::shouldReceive('loadHTML')
            ->once()
            ->with(\Mockery::on(function (string $html) use (&$capturedHtml): bool {
                $capturedHtml = $html;

                return true;
            }))
            ->andReturn(tap(\Mockery::mock(DomPdfWrapper::class), function ($pdf): void {
                $pdf->shouldReceive('output')
                    ->once()
                    ->andReturn('%PDF-payment-voids');
            }));

        $date = now()->toDateString();
        $this->actingAs($admin)
            ->get("/api/reports/pdf?date_from={$date}&date_to={$date}")
            ->assertOk()
            ->assertHeader('Content-Type', 'application/pdf')
            ->assertSee('%PDF-payment-voids', false);

        $this->assertIsString($capturedHtml);
        $this->assertStringContainsString('Reversos de Pago', $capturedHtml);
        $this->assertStringContainsString('Reversos de Pago:</td>', $capturedHtml);
        $this->assertStringContainsString('<td>1</td>', $capturedHtml);
        $this->assertStringContainsString('000-001-01-00000001', $capturedHtml);
        $this->assertStringContainsString('Efectivo', $capturedHtml);
        $this->assertStringContainsString('L. 17.25', $capturedHtml);
        $this->assertStringContainsString('Cobro registrado por error', $capturedHtml);
        $this->assertStringContainsString(e($supervisor->name), $capturedHtml);
        $this->assertStringNotContainsString('payment_id', $capturedHtml);
        $this->assertStringNotContainsString('ID de Pago', $capturedHtml);
    }

    private function admin(): User
    {
        $admin = User::factory()->create();
        $admin->assignRole('admin');
        $this->grantDirectPermissions($admin, RolesAndPermissionsSeeder::PERMISSIONS);

        return $admin->refresh();
    }

    private function supervisor(): User
    {
        $supervisor = User::factory()->create();
        $supervisor->assignRole('supervisor');
        $this->grantDirectPermissions($supervisor, [
            'settings.fiscal.view',
            'catalog.view',
            'catalog.manage',
            'invoices.view',
            'invoices.create',
            'invoices.void',
            'cash.view',
            'cash.open',
            'cash.close',
            'cash.close_any',
            'payments.create',
            'payments.view',
            'payments.void',
            'receipts.view',
            'receipts.reprint',
            'receipts.reprint_any',
            'reports.view',
            'reports.managerial.view',
            'reports.cash_session.view',
            'reports.export',
            'audit.view',
        ]);

        return $supervisor->refresh();
    }

    private function cashier(): User
    {
        $cashier = User::factory()->create();
        $cashier->assignRole('cajero');
        $this->grantDirectPermissions($cashier, [
            'catalog.view',
            'invoices.view',
            'invoices.create',
            'cash.view',
            'cash.open',
            'cash.close',
            'payments.create',
            'payments.view',
            'receipts.view',
            'receipts.reprint',
        ]);

        return $cashier->refresh();
    }

    /**
     * Keep report tests isolated from Spatie's process-level permission cache
     * when SQLite transactions roll back seeded permission IDs between tests.
     *
     * @param  array<int, string>  $permissionNames
     */
    private function grantDirectPermissions(User $user, array $permissionNames): void
    {
        $uniquePermissionNames = array_values(array_unique($permissionNames));
        $permissions = Permission::query()
            ->whereIn('name', $uniquePermissionNames)
            ->get();

        $this->assertCount(count($uniquePermissionNames), $permissions);

        app(PermissionRegistrar::class)->forgetCachedPermissions();
        $user->givePermissionTo($permissions);
        $user->refresh();
        $user->load('permissions', 'roles.permissions');
    }

    private function grantPermissions(User $user, mixed ...$permissionNames): void
    {
        $this->grantDirectPermissions($user, collect($permissionNames)
            ->flatten()
            ->map(fn (mixed $permissionName): string => (string) $permissionName)
            ->all());
    }
}
