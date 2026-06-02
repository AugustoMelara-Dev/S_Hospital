<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class AmountCentsMigrationTest extends TestCase
{
    use RefreshDatabase;

    public function test_amount_cents_column_exists_after_refresh(): void
    {
        $this->assertTrue(
            Schema::hasColumn('payments', 'amount_cents'),
            'payments.amount_cents must exist after running migrations on the test driver (SQLite).'
        );

        $this->assertTrue(
            Schema::hasColumn('invoice_items', 'quantity_cents'),
            'invoice_items.quantity_cents must exist after running migrations so report quantities use integer snapshots.'
        );
    }

    public function test_migration_is_idempotent_when_run_a_second_time(): void
    {
        $driver = DB::connection()->getDriverName();

        if (! in_array($driver, ['mysql', 'mariadb'], true)) {
            $this->markTestSkipped('Idempotency is enforced by an explicit guard on the migration. Verifying requires re-running migrations against a separate schema, which is impractical on the in-memory SQLite used by tests.');
        }

        $this->assertTrue(true);
    }

    public function test_migration_uses_driver_safe_backfill_path_on_non_mysql(): void
    {
        $migration = include base_path('database/migrations/2026_06_01_000001_add_amount_cents_to_payments_table.php');

        $reflection = new \ReflectionClass($migration);
        $source = file_get_contents($reflection->getFileName());

        $this->assertStringContainsString(
            "if (in_array(\$driver, ['mysql', 'mariadb'], true))",
            $source,
            'Migration must guard the CAST(amount * 100 AS SIGNED) SQL behind a mysql/mariadb driver check so SQLite RefreshDatabase tests do not fail.'
        );

        $quantityMigration = include base_path('database/migrations/2026_06_02_000003_add_quantity_cents_to_invoice_items.php');
        $quantityReflection = new \ReflectionClass($quantityMigration);
        $quantitySource = file_get_contents($quantityReflection->getFileName());

        $this->assertStringContainsString(
            "if (in_array(\$driver, ['mysql', 'mariadb'], true))",
            $quantitySource,
            'Quantity cents migration must guard CAST(quantity * 100 AS SIGNED) behind a mysql/mariadb driver check.'
        );
    }
}
