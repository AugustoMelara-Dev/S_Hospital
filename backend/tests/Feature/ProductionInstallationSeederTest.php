<?php

namespace Tests\Feature;

use App\Actions\InstitutionalReceipts\InstitutionalReceiptHtmlBuilder;
use App\Models\AuditLog;
use App\Models\CashRegister;
use App\Models\Category;
use App\Models\FiscalSequence;
use App\Models\FiscalSetting;
use App\Models\InstitutionalReceiptSeries;
use App\Models\ReceiptPrintProfile;
use App\Models\Service;
use App\Models\TaxRate;
use App\Models\User;
use App\Support\HospitalName;
use Database\Seeders\ProductionInstallationSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class ProductionInstallationSeederTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_installs_only_production_master_data_for_a_fresh_installation(): void
    {
        $this->seed(ProductionInstallationSeeder::class);

        $this->assertEqualsCanonicalizing(
            ['admin', 'auditor', 'cajero', 'soporte_tecnico', 'supervisor'],
            Role::query()->pluck('name')->all(),
        );
        $this->assertDatabaseHas('cash_registers', [
            'code' => 'principal',
            'name' => 'Caja principal',
            'active' => true,
        ]);

        $this->assertSame(151, Service::query()->count());
        $this->assertSame(149, Service::query()->where('active', true)->count());
        $this->assertGreaterThan(0, Category::query()->count());
        $this->assertDatabaseHas('services', [
            'source_key' => 'csv:service:medicamentos:eritropoyetina',
            'price' => '25.00',
            'taxable' => false,
            'tax_rate_id' => null,
            'special_rule_code' => 'ERYTHROPOIETIN_DIALYSIS_PRESCRIPTION',
        ]);

        // H-02/H-15: the seed catalog is installed exempt and the fiscal rate
        // catalog starts with the explicit "Exento 0 %" choice.
        $this->assertSame(0, Service::query()->whereNotNull('tax_rate_id')->count());
        $exemptRate = TaxRate::query()->sole();
        $this->assertSame('Exento 0 %', $exemptRate->name);
        $this->assertSame('0.00', $exemptRate->percentage);
        $this->assertTrue($exemptRate->active);
        $this->assertFalse($exemptRate->is_default);

        $profile = ReceiptPrintProfile::query()
            ->where('code', ReceiptPrintProfile::CODE_LETTER_PORTRAIT)
            ->firstOrFail();

        $this->assertTrue($profile->active);
        $this->assertTrue($profile->is_global_default);
        $this->assertSame('letter_portrait', $profile->paper_kind);
        $this->assertSame('institutional_compact', $profile->template_code);
        $this->assertSame('original_first', $profile->copies_mode);
        $this->assertSame(
            ['ORIGINAL', 'PRIMERA COPIA'],
            app(InstitutionalReceiptHtmlBuilder::class)->copyLabels($profile->copies_mode),
        );
        $this->assertTrue((bool) config('institutional_receipts.two_zone_sheet.enabled'));
        $this->assertGreaterThanOrEqual(
            (float) config('institutional_receipts.two_zone_sheet.min_paper_height_mm'),
            (float) $profile->height_mm,
        );
        $this->assertSame('Línea de corte', config('institutional_receipts.cut_line_label'));

        $series = InstitutionalReceiptSeries::query()->sole();
        $this->assertSame(InstitutionalReceiptSeries::DOCUMENT_TYPE, $series->document_type);
        $this->assertSame('REC-A', $series->series);
        $this->assertSame(0, $series->current_number);
        $this->assertTrue($series->active);
        $this->assertNull($series->range_authorization);

        $this->assertSame(0, User::query()->count());
        $this->assertSame(0, FiscalSetting::query()->count());
        $this->assertSame(0, FiscalSequence::query()->count());
        $this->assertSame(0, DB::table('invoices')->count());
        $this->assertSame(0, DB::table('invoice_items')->count());
        $this->assertSame(0, DB::table('payments')->count());
        $this->assertSame(0, DB::table('cash_register_sessions')->count());
        $this->assertSame(0, DB::table('cash_movements')->count());
        $this->assertSame(0, DB::table('institutional_receipts')->count());
        $this->assertSame(0, DB::table('institutional_receipt_print_events')->count());
        $this->assertSame(0, DB::table('backup_logs')->count());
        $masterAuditLogs = AuditLog::query()->get();
        $this->assertNotEmpty($masterAuditLogs);
        $this->assertContains('created', $masterAuditLogs->pluck('action')->all());
        $this->assertContains('permission.attached', $masterAuditLogs->pluck('action')->all());
        $this->assertContains('receipt_print_profile.template_adopted', $masterAuditLogs->pluck('action')->all());
        $this->assertTrue($masterAuditLogs->every(
            static fn (AuditLog $log): bool => $log->user_id === null
                && in_array($log->entity_type, [Role::class, Permission::class, ReceiptPrintProfile::class], true),
        ));

        foreach (['user.%', 'invoice.%', 'payment.%', 'cash_session.%', 'institutional_receipt.%', 'backup.%'] as $action) {
            $this->assertFalse(AuditLog::query()->where('action', 'like', $action)->exists());
        }
    }

    public function test_it_installs_no_qa_users_probe_categories_fake_cai_or_concrete_hospital_identity(): void
    {
        $this->seed(ProductionInstallationSeeder::class);

        // H-03: nothing from the laboratory validation fixtures may ship.
        $this->assertSame(0, User::query()->count());
        $this->assertSame(0, User::query()->where('username', 'like', '%.validacion')->count());
        $this->assertSame(0, User::query()->where('username', 'like', 'azb.qa.%')->count());
        $this->assertSame(0, User::query()->where('email', 'like', '%@hospital-san-isidro.local')->count());
        $this->assertSame(0, FiscalSetting::query()->count());
        $this->assertSame(0, FiscalSequence::query()->count());
        $this->assertSame(
            0,
            Category::query()
                ->where('name', 'like', 'EUPC-%')
                ->orWhere('name', 'like', 'AZB-%')
                ->count(),
        );

        // The product fallback is neutral; actual configured hospital names
        // remain valid identities instead of being replaced by the brand.
        $configuredGeneralHospital = 'Hospital '.'General '.('San '.'Isidro');
        $configuredHospital = 'Hospital '.('San '.'Isidro');
        $this->assertSame('S_Hospital', HospitalName::display(null));
        $this->assertSame($configuredGeneralHospital, HospitalName::display($configuredGeneralHospital));
        $this->assertSame($configuredHospital, HospitalName::display($configuredHospital));

        foreach (['categories', 'services'] as $table) {
            foreach (DB::table($table)->pluck('name') as $name) {
                $this->assertStringNotContainsStringIgnoringCase('san isidro', (string) $name);
                $this->assertStringNotContainsStringIgnoringCase('tocoa', (string) $name);
            }
        }
    }

    public function test_rerun_preserves_operational_catalog_paper_cash_and_numbering_values(): void
    {
        $this->seed(ProductionInstallationSeeder::class);

        $cashRegister = CashRegister::query()->where('code', 'principal')->firstOrFail();
        $cashRegister->update(['name' => 'Caja admisiones', 'active' => false]);

        $profile = ReceiptPrintProfile::query()
            ->where('code', ReceiptPrintProfile::CODE_LETTER_PORTRAIT)
            ->firstOrFail();
        $profile->update(['copies_mode' => 'original_only', 'font_scale' => '1.10']);

        $series = InstitutionalReceiptSeries::query()->sole();
        $series->update([
            'prefix' => 'HOSP',
            'current_number' => 41,
            'range_authorization' => 'AUTORIZACION-INSTITUCIONAL',
        ]);

        $service = Service::query()
            ->where('source_key', 'csv:service:medicamentos:eritropoyetina')
            ->firstOrFail();
        $configuredRate = TaxRate::query()->create([
            'name' => 'ISV 15 %',
            'percentage' => '15.00',
            'active' => true,
            'is_default' => true,
        ]);
        $service->update([
            'price' => '177.35',
            'taxable' => true,
            'tax_rate_id' => $configuredRate->id,
            'active' => false,
        ]);

        $countsBefore = [
            'cash_registers' => CashRegister::query()->count(),
            'profiles' => ReceiptPrintProfile::query()->count(),
            'series' => InstitutionalReceiptSeries::query()->count(),
            'services' => Service::query()->count(),
        ];

        $this->seed(ProductionInstallationSeeder::class);

        $this->assertSame($countsBefore, [
            'cash_registers' => CashRegister::query()->count(),
            'profiles' => ReceiptPrintProfile::query()->count(),
            'series' => InstitutionalReceiptSeries::query()->count(),
            'services' => Service::query()->count(),
        ]);
        $this->assertDatabaseHas('cash_registers', [
            'code' => 'principal',
            'name' => 'Caja admisiones',
            'active' => false,
        ]);
        $this->assertDatabaseHas('receipt_print_profiles', [
            'code' => ReceiptPrintProfile::CODE_LETTER_PORTRAIT,
            'copies_mode' => 'original_only',
            'font_scale' => '1.10',
        ]);
        $this->assertDatabaseHas('institutional_receipt_series', [
            'id' => $series->id,
            'prefix' => 'HOSP',
            'current_number' => 41,
            'range_authorization' => 'AUTORIZACION-INSTITUCIONAL',
        ]);
        $this->assertDatabaseHas('services', [
            'id' => $service->id,
            'price' => '177.35',
            'taxable' => true,
            'tax_rate_id' => $configuredRate->id,
            'active' => false,
        ]);
    }

    public function test_existing_institutional_series_is_not_replaced_or_duplicated(): void
    {
        InstitutionalReceiptSeries::query()->create([
            'document_type' => InstitutionalReceiptSeries::DOCUMENT_TYPE,
            'series' => 'HOSP-2026',
            'prefix' => 'HSI',
            'number_format' => '{series}-{number:06}',
            'min_number' => 1,
            'max_number' => 999999,
            'current_number' => 73,
            'range_authorization' => null,
            'active' => true,
            'reprint_behavior' => InstitutionalReceiptSeries::REPRINT_AUDIT_ONLY,
            'void_behavior' => InstitutionalReceiptSeries::VOID_PERMISSION_REASON_AUDIT,
        ]);

        $this->seed(ProductionInstallationSeeder::class);

        $this->assertSame(1, InstitutionalReceiptSeries::query()->count());
        $this->assertDatabaseHas('institutional_receipt_series', [
            'series' => 'HOSP-2026',
            'prefix' => 'HSI',
            'current_number' => 73,
            'active' => true,
        ]);
        $this->assertDatabaseMissing('institutional_receipt_series', ['series' => 'REC-A']);
    }
}
