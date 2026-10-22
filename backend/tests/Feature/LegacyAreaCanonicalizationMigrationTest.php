<?php

namespace Tests\Feature;

use Database\Seeders\ServiceCatalogSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

/**
 * F016 fase 1 (T2-040): migracion 220001 que garantiza contraparte canonica en
 * `areas` para las areas legacy de `service_areas` (por slug), con
 * trazabilidad en `legacy_area_backfill_map` y down() seguro.
 *
 * Portable SQLite/MariaDB (solo Schema/query builder).
 */
class LegacyAreaCanonicalizationMigrationTest extends TestCase
{
    use RefreshDatabase;

    public function test_otros_is_mapped_on_a_fresh_database(): void
    {
        $area = DB::table('areas')->where('slug', 'otros')->first();
        $marker = DB::table('legacy_area_backfill_map')->where('slug', 'otros')->first();

        $this->assertNotNull($area, 'La migracion debe crear la contraparte canonica de "otros" incluso antes del seed.');
        $this->assertSame('Otros', $area->name);
        $this->assertNotNull($marker);
        $this->assertSame((int) $area->id, (int) $marker->area_id);
    }

    public function test_migration_is_idempotent(): void
    {
        $migration = $this->migration();

        $migration->up();
        $migration->up();

        $this->assertSame(1, (int) DB::table('areas')->where('slug', 'otros')->count());
        $this->assertSame(1, (int) DB::table('legacy_area_backfill_map')->where('slug', 'otros')->count());
    }

    public function test_down_removes_created_counterpart_and_up_reapplies(): void
    {
        $migration = $this->migration();

        $migration->down();

        $this->assertNull(DB::table('areas')->where('slug', 'otros')->first());
        $this->assertFalse(Schema::hasTable('legacy_area_backfill_map'));

        $migration->up();

        $this->assertNotNull(DB::table('areas')->where('slug', 'otros')->first());
        $this->assertTrue(Schema::hasTable('legacy_area_backfill_map'));
    }

    public function test_existing_canonical_area_is_not_overwritten_nor_marked(): void
    {
        $migration = $this->migration();
        $migration->down();

        $this->seed(ServiceCatalogSeeder::class);

        $existingId = (int) DB::table('areas')->insertGetId([
            'name' => 'Otros Personalizado',
            'slug' => 'otros',
            'active' => 1,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $migration->up();

        $area = DB::table('areas')->where('slug', 'otros')->first();
        $this->assertSame($existingId, (int) $area->id);
        $this->assertSame('Otros Personalizado', $area->name);
        $this->assertSame(0, (int) DB::table('legacy_area_backfill_map')->where('slug', 'otros')->count());
    }

    public function test_down_keeps_area_referenced_by_services(): void
    {
        $migration = $this->migration();
        $this->seed(ServiceCatalogSeeder::class);

        $area = DB::table('areas')->where('slug', 'otros')->first();
        $category = DB::table('categories')->first();
        $this->assertNotNull($area);
        $this->assertNotNull($category);

        DB::table('services')->insert([
            'category_id' => $category->id,
            'area_id' => $area->id,
            'name' => 'Servicio Otros T2040',
            'slug' => 'servicio-otros-t2040',
            'price' => '1.00',
            'taxable' => 0,
            'active' => 1,
            'visible_in_billing' => 1,
            'is_billable' => 1,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $migration->down();

        $this->assertNotNull(
            DB::table('areas')->where('slug', 'otros')->first(),
            'down() no debe borrar una contraparte referenciada por servicios.'
        );
    }

    public function test_down_keeps_area_referenced_by_historical_invoice_snapshots(): void
    {
        $migration = $this->migration();
        $this->seed(ServiceCatalogSeeder::class);

        $area = DB::table('areas')->where('slug', 'otros')->first();
        $this->assertNotNull($area);

        $userId = (int) DB::table('users')->insertGetId([
            'name' => 'Snapshot User T2040',
            'email' => 'snapshot-t2040@test.local',
            'username' => 'snapshot-t2040',
            'password' => 'x',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $sequenceId = (int) DB::table('fiscal_sequences')->insertGetId([
            'document_type' => 'invoice',
            'prefix' => '000-001-01',
            'min_number' => 1,
            'max_number' => 99999999,
            'current_number' => 0,
            'cai' => 'TEST-F016-'.uniqid(),
            'valid_until' => now()->addYear()->toDateString(),
            'active' => 0,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $invoiceId = (int) DB::table('invoices')->insertGetId([
            'invoice_number' => 'F016-'.uniqid(),
            'fiscal_sequence_id' => $sequenceId,
            'patient_name' => 'Paciente Snapshot',
            'subtotal' => '100.00',
            'subtotal_cents' => 10000,
            'tax_amount' => '15.00',
            'tax_amount_cents' => 1500,
            'discount_amount' => '0.00',
            'discount_amount_cents' => 0,
            'total' => '115.00',
            'total_cents' => 11500,
            'paid_amount' => '0.00',
            'paid_amount_cents' => 0,
            'balance_due' => '115.00',
            'balance_due_cents' => 11500,
            'status' => 'issued',
            'issued_by' => $userId,
            'issued_at' => now(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('invoice_items')->insert([
            'invoice_id' => $invoiceId,
            'service_id' => null,
            'service_name' => 'Servicio Snapshot',
            'category_id' => null,
            'category_name' => 'Categoria Snapshot',
            'area_id' => $area->id,
            'area_name' => 'Otros',
            'quantity' => '1.00',
            'quantity_cents' => 100,
            'unit_price' => '1.00',
            'unit_price_cents' => 100,
            'tax_rate' => '0.00',
            'tax_amount' => '0.00',
            'tax_amount_cents' => 0,
            'line_subtotal' => '1.00',
            'line_subtotal_cents' => 100,
            'line_total' => '1.00',
            'line_total_cents' => 100,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $migration->down();

        $this->assertNotNull(
            DB::table('areas')->where('slug', 'otros')->first(),
            'down() no debe borrar una contraparte referenciada por snapshots historicos.'
        );
    }

    public function test_up_fails_closed_on_empty_legacy_slug(): void
    {
        $migration = $this->migration();
        $migration->down();

        DB::table('service_areas')->insert([
            'name' => 'Slug Vacio T2040',
            'slug' => '',
            'active' => 1,
            'sort_order' => 0,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        try {
            $migration->up();
            $this->fail('La migracion debio abortar ante un slug legacy vacio.');
        } catch (\RuntimeException $exception) {
            $this->assertStringContainsString('F016 fail-closed', $exception->getMessage());
        } finally {
            DB::table('service_areas')->where('slug', '')->delete();
            $migration->up();
        }

        $this->assertNotNull(DB::table('areas')->where('slug', 'otros')->first());
    }

    private function migration(): object
    {
        return include base_path('database/migrations/2026_09_13_220001_ensure_canonical_areas_for_legacy_taxonomy.php');
    }
}
