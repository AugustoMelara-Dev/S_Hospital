<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\BackupLog;
use App\Models\CashRegisterSession;
use App\Models\Category;
use App\Models\FiscalSequence;
use App\Models\FiscalSetting;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\Service;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Database\Seeders\ServiceCatalogSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Spatie\Permission\Models\Permission;
use Tests\TestCase;

class ReportsTest extends TestCase
{
    use RefreshDatabase;

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
            ->getJson("/api/reports/income?date_from={$date}&date_to={$date}")
            ->assertForbidden();

        $this->actingAs($cashier)
            ->getJson("/api/reports/categories?date_from={$date}&date_to={$date}")
            ->assertForbidden();

        $this->actingAs($cashier)
            ->getJson("/api/reports/services?date_from={$date}&date_to={$date}")
            ->assertForbidden();

        $this->actingAs($cashier)
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
    }

    public function test_daily_report_calculates_collected_totals_methods_and_statuses_without_void_income(): void
    {
        $this->seedBillingBase();
        $cashier = $this->cashier();
        $sessionId = $this->openSession($cashier);
        $cashInvoice = $this->createInvoice($cashier, 'Glucosa');
        $transferInvoice = $this->createInvoice($cashier, 'Hemograma Completo');
        $voidInvoice = $this->createInvoice($cashier, 'Eritropoyetina');

        $this->payInvoice($cashier, $cashInvoice, $sessionId, Payment::METHOD_CASH, '17.25');
        $this->payInvoice($cashier, $transferInvoice, $sessionId, Payment::METHOD_TRANSFER, '5.00');
        $this->payInvoice($cashier, $voidInvoice, $sessionId, Payment::METHOD_CARD, '28.75');

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
            ->assertJsonPath('data.invoice_count', 3)
            ->assertJsonPath('data.payment_count', 2)
            ->assertJsonPath('data.payments_by_method.cash', '17.25')
            ->assertJsonPath('data.payments_by_method.transfer', '5.00')
            ->assertJsonPath('data.payments_by_method.card', '0.00')
            ->assertJsonPath('data.invoices_by_status.paid.count', 1)
            ->assertJsonPath('data.invoices_by_status.partial.count', 1)
            ->assertJsonPath('data.invoices_by_status.void.count', 1);
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
            ->assertJsonPath('data.total_collected', '17.25')
            ->assertJsonPath('data.payment_count', 1)
            ->assertJsonPath('data.invoice_count', 1);

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

        $this->actingAs($this->supervisor())
            ->getJson('/api/reports/categories?date_from='.now()->toDateString().'&date_to='.now()->toDateString())
            ->assertOk()
            ->assertJsonPath('data.categories.0.category', $snapshotCategory)
            ->assertJsonPath('data.categories.0.item_count', 1)
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
        $this->payInvoice($otherCashier, $erythropoietinInvoice, $otherSessionId, Payment::METHOD_CARD, '28.75');

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
            ->assertJsonPath('data.payment_count', 1)
            ->assertJsonPath('data.payments_by_method.cash', '17.25')
            ->assertJsonPath('data.payments_by_method.card', '0.00')
            ->assertJsonPath('data.filters.category_id', (string) $laboratoryId)
            ->assertJsonPath('data.filters.method', Payment::METHOD_CASH)
            ->assertJsonPath('data.filters.status', Invoice::STATUS_PAID);

        $this->actingAs($this->admin())
            ->getJson("/api/reports/categories?{$filters}")
            ->assertOk()
            ->assertJsonCount(1, 'data.categories')
            ->assertJsonPath('data.filters.user_id', (string) $cashier->id)
            ->assertJsonPath('data.filters.method', Payment::METHOD_CASH)
            ->assertJsonPath('data.categories.0.category', 'Laboratorio')
            ->assertJsonPath('data.categories.0.total', '17.25');

        $this->actingAs($this->admin())
            ->getJson("/api/reports/services?{$filters}")
            ->assertOk()
            ->assertJsonCount(1, 'data.services')
            ->assertJsonPath('data.services.0.service', 'Glucosa')
            ->assertJsonPath('data.services.0.total', '17.25');

        $this->actingAs($this->admin())
            ->getJson("/api/reports/operations?{$filters}")
            ->assertOk()
            ->assertJsonPath('data.summary.cashier_count', 1)
            ->assertJsonPath('data.cashiers.0.user_id', $cashier->id)
            ->assertJsonPath('data.cashiers.0.total_collected', '17.25');

        $this->actingAs($this->admin())
            ->getJson('/api/reports/categories?date_from='.now()->toDateString().'&date_to='.now()->toDateString().'&method=cheque')
            ->assertUnprocessable()
            ->assertJsonValidationErrors('method');
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

        $this->payInvoice($cashier, $invoiceId, $sessionId, Payment::METHOD_CASH, '46.00');

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
        $viewer->givePermissionTo('reports.view', 'reports.managerial.view');
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
            ->assertHeader('content-type', 'text/csv; charset=UTF-8');

        $csv = $response->streamedContent();

        $this->assertStringContainsString('seccion,nombre,categoria,cantidad,total', $csv);
        $this->assertStringContainsString('ingresos,"Total cobrado",,,17.25', $csv);
        $this->assertStringContainsString('categoria,Laboratorio,Laboratorio,1.00,17.25', $csv);
        $this->assertStringContainsString('servicio,Glucosa,Laboratorio,1.00,17.25', $csv);
        $this->assertStringContainsString('cajero', $csv);
        $this->assertStringContainsString($cashier->username, $csv);
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
        $viewer->givePermissionTo('reports.view', 'reports.managerial.view', 'reports.export');

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

        $csv = $this->actingAs($viewer)
            ->get(str_replace('/operations?', '/export?', $url))
            ->assertOk()
            ->streamedContent();

        $this->assertStringNotContainsString('hospital-backup-sensitive.sql', $csv);
        $this->assertStringNotContainsString(str_repeat('b', 64), $csv);
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
                'width' => '80mm',
                'reason' => 'Paciente solicita copia',
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
            ->assertJsonPath('data.summary.reprint_count', 1)
            ->assertJsonPath('data.summary.backup_count', 1)
            ->assertJsonPath('data.summary.cashier_count', 0)
            ->assertJsonPath('data.voids.0.reason', 'Error de captura')
            ->assertJsonPath('data.reprints.0.reason', 'Paciente solicita copia')
            ->assertJsonPath('data.backups.0.filename', 'hospital-backup-test.sql');
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
        $this->payInvoice($cashier, $voidInvoice, $sessionId, Payment::METHOD_OTHER, '28.75');

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

        $cashier->givePermissionTo(Permission::findByName('reports.cash_session.view', 'web'));

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
            ->assertJsonPath('data.total_cash', '17.25')
            ->assertJsonPath('data.total_card', '11.50')
            ->assertJsonPath('data.total_other', '0.00')
            ->assertJsonCount(2, 'data.payments')
            ->assertJsonCount(5, 'data.movements');

        $this->actingAs($this->supervisor())
            ->getJson("/api/reports/cash-sessions/{$sessionId}")
            ->assertOk()
            ->assertJsonPath('data.cash_session.id', $sessionId);
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
        $this->seed([RolesAndPermissionsSeeder::class, ServiceCatalogSeeder::class]);
        FiscalSetting::query()->create([
            'hospital_name' => 'Hospital Demo',
            'rtn' => '08011999123456',
            'default_tax_rate' => '15.00',
            'receipt_width' => '80mm',
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
        CashRegisterSession::query()->firstOrCreate(
            [
                'user_id' => $cashier->id,
                'status' => CashRegisterSession::STATUS_OPEN,
            ],
            [
                'open_user_id' => $cashier->id,
                'opening_amount' => '500.00',
                'opened_at' => now(),
            ],
        );

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

    private function openSession(User $cashier): int
    {
        return $this->actingAs($cashier)
            ->postJson('/api/cash-sessions/open', ['opening_amount' => '500.00'])
            ->assertCreated()
            ->json('data.id');
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
}
