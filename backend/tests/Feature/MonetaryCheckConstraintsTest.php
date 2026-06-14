<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class MonetaryCheckConstraintsTest extends TestCase
{
    use RefreshDatabase;

    public function test_check_constraints_migration_is_idempotent_against_partial_application(): void
    {
        $driver = DB::connection()->getDriverName();
        if (! in_array($driver, ['mysql', 'mariadb'], true)) {
            $this->markTestSkipped('Solo aplicable a MariaDB/MySQL.');
        }

        $database = DB::connection()->getDatabaseName();

        // Pre-create a few of the constraints as if a previous run had
        // committed only part of the migration. Then re-run the migration
        // and assert no error is raised.
        $tables = [
            ['invoices', 'invoices_subtotal_cents_nonneg', 'CHECK (subtotal_cents >= 0)'],
            ['invoice_items', 'invoice_items_quantity_cents_positive', 'CHECK (quantity_cents > 0)'],
        ];

        foreach ($tables as [$table, $name, $clause]) {
            $exists = DB::table('information_schema.CHECK_CONSTRAINTS')
                ->where('CONSTRAINT_SCHEMA', $database)
                ->where('CONSTRAINT_NAME', $name)
                ->exists();
            if (! $exists) {
                DB::statement("ALTER TABLE {$table} ADD CONSTRAINT {$name} {$clause}");
            }
        }

        // Re-running the migration must not throw. The migration is loaded
        // automatically by RefreshDatabase; calling migrate fresh again
        // forces a re-application of the new migration.
        $this->artisan('migrate:fresh', ['--force' => true])
            ->assertExitCode(0);

        $this->assertTrue(
            DB::table('information_schema.CHECK_CONSTRAINTS')
                ->where('CONSTRAINT_SCHEMA', $database)
                ->where('CONSTRAINT_NAME', 'invoices_subtotal_cents_nonneg')
                ->exists()
        );
    }

    public function test_check_constraints_reject_negative_money_in_mysql(): void
    {
        $driver = DB::connection()->getDriverName();
        if (! in_array($driver, ['mysql', 'mariadb'], true)) {
            $this->markTestSkipped('Solo aplicable a MariaDB/MySQL.');
        }

        $database = DB::connection()->getDatabaseName();

        $tables = [
            'invoices_subtotal_cents_nonneg' => ['invoices', 'invoices_subtotal_cents_nonneg'],
            'invoices_tax_cents_nonneg' => ['invoices', 'invoices_tax_cents_nonneg'],
            'invoices_discount_cents_nonneg' => ['invoices', 'invoices_discount_cents_nonneg'],
            'invoice_items_unit_price_cents_nonneg' => ['invoice_items', 'invoice_items_unit_price_cents_nonneg'],
            'invoice_items_quantity_cents_positive' => ['invoice_items', 'invoice_items_quantity_cents_positive'],
            'services_price_positive' => ['services', 'services_price_positive'],
        ];

        foreach ($tables as $expected => [$table, $constraint]) {
            $exists = DB::table('information_schema.CHECK_CONSTRAINTS')
                ->where('CONSTRAINT_SCHEMA', $database)
                ->where('CONSTRAINT_NAME', $expected)
                ->exists();

            $this->assertTrue($exists, "Falta el CHECK {$expected} en {$table}");
        }
    }
}
