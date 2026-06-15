<?php

namespace Tests\Feature\Offline;

use App\Models\FiscalSequence;
use App\Models\FiscalSetting;
use Database\Seeders\RolesAndPermissionsSeeder;
use Database\Seeders\ServiceCatalogSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class OfflineCheckConstraintsMigrationTest extends TestCase
{
    use RefreshDatabase;

    public function test_constraints_migration_is_no_op_on_sqlite(): void
    {
        $this->seedBillingBase();
        $this->assertTrue(DB::connection()->getPdo() instanceof \PDO);

        $this->artisan('migrate')->assertSuccessful();
        $this->artisan('migrate')->assertSuccessful();
    }

    public function test_constraints_migration_runs_clean_on_existing_db(): void
    {
        $this->seedBillingBase();

        $this->artisan('migrate:status')
            ->assertSuccessful();
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
}
