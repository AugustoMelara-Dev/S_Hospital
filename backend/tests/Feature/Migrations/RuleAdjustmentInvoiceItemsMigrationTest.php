<?php

namespace Tests\Feature\Migrations;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

/**
 * T-BE-02: migracion 2026_09_18_000002 que agrega el precio registrado y el
 * ajuste por regla a `invoice_items`.
 *
 * Verifica el backfill conservador (precio registrado = precio efectivo,
 * ajuste = 0), la idempotencia y el down(). Portable SQLite/MariaDB.
 */
class RuleAdjustmentInvoiceItemsMigrationTest extends TestCase
{
    use RefreshDatabase;

    public function test_columns_exist_on_a_fresh_database(): void
    {
        $this->assertTrue(Schema::hasColumn('invoice_items', 'unit_price_registered_cents'));
        $this->assertTrue(Schema::hasColumn('invoice_items', 'rule_adjustment_cents'));
    }

    public function test_backfill_uses_effective_price_and_zero_adjustment(): void
    {
        $migration = $this->migration();
        $migration->down();

        $itemId = $this->insertLegacyItem(2500);

        $migration->up();

        $row = DB::table('invoice_items')->where('id', $itemId)->first();
        $this->assertNotNull($row);
        // El ajuste historico no se inventa: precio efectivo y ajuste 0.
        $this->assertSame(2500, (int) $row->unit_price_registered_cents);
        $this->assertSame(0, (int) $row->rule_adjustment_cents);
    }

    public function test_migration_is_idempotent(): void
    {
        $migration = $this->migration();

        $migration->up();
        $migration->up();

        $this->assertTrue(Schema::hasColumn('invoice_items', 'rule_adjustment_cents'));
    }

    public function test_down_drops_columns_and_up_reapplies(): void
    {
        $migration = $this->migration();

        $migration->down();

        $this->assertFalse(Schema::hasColumn('invoice_items', 'unit_price_registered_cents'));
        $this->assertFalse(Schema::hasColumn('invoice_items', 'rule_adjustment_cents'));

        $migration->up();

        $this->assertTrue(Schema::hasColumn('invoice_items', 'unit_price_registered_cents'));
        $this->assertTrue(Schema::hasColumn('invoice_items', 'rule_adjustment_cents'));
    }

    private function migration(): object
    {
        return include base_path('database/migrations/2026_09_18_000002_add_rule_adjustment_to_invoice_items.php');
    }

    private function insertLegacyItem(int $unitPriceCents): int
    {
        $suffix = uniqid();

        $userId = (int) DB::table('users')->insertGetId([
            'name' => 'Backfill User '.$suffix,
            'email' => 'backfill-'.$suffix.'@test.local',
            'username' => 'backfill-'.$suffix,
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
            'cai' => 'TEST-BE02-'.$suffix,
            'valid_until' => now()->addYear()->toDateString(),
            'active' => 0,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $invoiceId = (int) DB::table('invoices')->insertGetId([
            'invoice_number' => 'BE02-'.$suffix,
            'fiscal_sequence_id' => $sequenceId,
            'patient_name' => 'Paciente Backfill',
            'subtotal' => '25.00',
            'subtotal_cents' => 2500,
            'tax_amount' => '0.00',
            'tax_amount_cents' => 0,
            'discount_amount' => '0.00',
            'discount_amount_cents' => 0,
            'total' => '25.00',
            'total_cents' => 2500,
            'paid_amount' => '0.00',
            'paid_amount_cents' => 0,
            'balance_due' => '25.00',
            'balance_due_cents' => 2500,
            'status' => 'issued',
            'issued_by' => $userId,
            'issued_at' => now(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return (int) DB::table('invoice_items')->insertGetId([
            'invoice_id' => $invoiceId,
            'service_id' => null,
            'service_name' => 'Servicio Backfill',
            'category_id' => null,
            'category_name' => 'Categoria Backfill',
            'area_id' => null,
            'area_name' => 'Otros',
            'quantity' => '1.00',
            'quantity_cents' => 100,
            'unit_price' => number_format($unitPriceCents / 100, 2, '.', ''),
            'unit_price_cents' => $unitPriceCents,
            'tax_rate' => '0.00',
            'tax_amount' => '0.00',
            'tax_amount_cents' => 0,
            'line_subtotal' => number_format($unitPriceCents / 100, 2, '.', ''),
            'line_subtotal_cents' => $unitPriceCents,
            'line_total' => number_format($unitPriceCents / 100, 2, '.', ''),
            'line_total_cents' => $unitPriceCents,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }
}
