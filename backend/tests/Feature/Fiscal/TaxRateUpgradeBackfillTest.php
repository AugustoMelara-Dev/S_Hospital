<?php

namespace Tests\Feature\Fiscal;

use App\Actions\Billing\CalculateInvoiceTotalsAction;
use App\Models\FiscalSetting;
use App\Models\Service;
use App\Models\TaxRate;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * A-03: upgrading a `.6`-style installation must materialise the configured
 * default rate and point every legacy taxable service at it, so the catalog UI
 * and the billing engine read the same `tax_rate_id`. `NULL` is always exempt.
 */
class TaxRateUpgradeBackfillTest extends TestCase
{
    use RefreshDatabase;

    private function runBackfillMigration(): void
    {
        $migration = require database_path('migrations/2026_10_22_000002_backfill_tax_rates_from_fiscal_settings.php');
        $migration->up();
    }

    private function legacyService(bool $taxable, string $name): int
    {
        // Bypass the model hook on purpose: this is the raw pre-upgrade row.
        return (int) DB::table('services')->insertGetId([
            'category_id' => DB::table('categories')->insertGetId([
                'name' => 'Legacy',
                'slug' => 'legacy-'.uniqid(),
                'active' => true,
                'sort_order' => 1,
                'created_at' => now(),
                'updated_at' => now(),
            ]),
            'name' => $name,
            'slug' => 'legacy-'.uniqid(),
            'price' => '100.00',
            'taxable' => $taxable,
            'tax_rate_id' => null,
            'active' => true,
            'visible_in_billing' => true,
            'is_billable' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function test_upgrade_backfills_the_configured_rate_and_keeps_exempt_services_exempt(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);

        FiscalSetting::query()->create([
            'hospital_name' => 'S_Hospital',
            'rtn' => '',
            'default_tax_rate' => '15.00',
            'receipt_template_mode' => 'institutional',
        ]);

        // Simulate the pre-upgrade state: no tax_rates and raw services.
        TaxRate::query()->delete();
        $taxableId = $this->legacyService(true, 'Servicio gravado legacy');
        $exemptId = $this->legacyService(false, 'Servicio exento legacy');

        $this->runBackfillMigration();

        $rate = TaxRate::query()->where('percentage', '15.00')->first();
        $this->assertNotNull($rate, 'The configured default rate must be materialised.');
        $this->assertTrue($rate->is_default);

        $this->assertSame($rate->id, (int) DB::table('services')->where('id', $taxableId)->value('tax_rate_id'));
        $this->assertNull(DB::table('services')->where('id', $exemptId)->value('tax_rate_id'));

        // One source of truth: the billing engine charges exactly the rate id.
        $action = app(CalculateInvoiceTotalsAction::class);
        $taxable = Service::query()->findOrFail($taxableId);
        $exempt = Service::query()->findOrFail($exemptId);

        $totals = $action->execute([
            ['service' => $taxable, 'quantity' => '1', 'notes' => null],
            ['service' => $exempt, 'quantity' => '1', 'notes' => null],
        ], '15.00');

        $this->assertSame('100.00', $totals['taxable_base']);
        $this->assertSame('15.00', $totals['tax_amount']);
        $this->assertSame('100.00', $totals['exempt']);
        $this->assertSame('215.00', $totals['total']);
    }

    public function test_null_rate_is_always_exempt_even_if_the_legacy_flag_says_taxable(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);

        $service = new Service([
            'id' => 999,
            'name' => 'Legacy taxable without rate',
            'price' => '100.00',
            'taxable' => true,
            'special_rule_code' => null,
        ]);

        $totals = app(CalculateInvoiceTotalsAction::class)->execute([
            ['service' => $service, 'quantity' => '1', 'notes' => null],
        ], '15.00');

        // A-03: no implicit global fallback. `NULL` means exempt.
        $this->assertSame('0.00', $totals['tax_amount']);
        $this->assertSame('100.00', $totals['total']);
        $this->assertSame('0.00', $totals['items'][0]['tax_rate']);
    }
}
