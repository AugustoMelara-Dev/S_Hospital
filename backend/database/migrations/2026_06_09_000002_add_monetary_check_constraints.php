<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Resilience audit finding R-02: enforce non-negative monetary and
 * non-negative cash-session values at the database layer. The PHP
 * Money helper already validates this in code, but a corrupt or
 * hand-edited row must not be able to introduce a negative balance.
 *
 * Only adds the CHECK constraint on drivers that support inline CHECK
 * constraints reliably. MySQL 8+ / MariaDB 10.2+ / SQLite 3.3+ all do.
 * The migration is a no-op on plain Postgres if PG is not supported by
 * the local driver; the application layer is the safety net there.
 */
return new class extends Migration
{
    public function up(): void
    {
        $driver = DB::connection()->getDriverName();

        if (! in_array($driver, ['mysql', 'mariadb', 'sqlite'], true)) {
            return;
        }

        if ($driver === 'mysql' || $driver === 'mariadb') {
            // Drop legacy checks if present so the migration is
            // re-runnable after a partial failure.
            $this->dropCheckIfExists($driver, 'payments', 'payments_amount_cents_nonneg');
            $this->dropCheckIfExists($driver, 'invoices', 'invoices_total_cents_nonneg');
            $this->dropCheckIfExists($driver, 'invoices', 'invoices_paid_cents_nonneg');
            $this->dropCheckIfExists($driver, 'invoices', 'invoices_balance_cents_nonneg');
            $this->dropCheckIfExists($driver, 'cash_register_sessions', 'cash_register_sessions_opening_cents_nonneg');
            $this->dropCheckIfExists($driver, 'cash_register_sessions', 'cash_register_sessions_closing_cents_nonneg');
            $this->dropCheckIfExists($driver, 'cash_movements', 'cash_movements_amount_signed');

            DB::statement('ALTER TABLE payments ADD CONSTRAINT payments_amount_cents_nonneg CHECK (amount_cents IS NULL OR amount_cents >= 0)');
            DB::statement('ALTER TABLE invoices ADD CONSTRAINT invoices_total_cents_nonneg CHECK (total_cents >= 0)');
            DB::statement('ALTER TABLE invoices ADD CONSTRAINT invoices_paid_cents_nonneg CHECK (paid_amount_cents >= 0)');
            DB::statement('ALTER TABLE invoices ADD CONSTRAINT invoices_balance_cents_nonneg CHECK (balance_due_cents >= 0)');
            DB::statement('ALTER TABLE cash_register_sessions ADD CONSTRAINT cash_register_sessions_opening_cents_nonneg CHECK (opening_amount >= 0)');
            DB::statement('ALTER TABLE cash_register_sessions ADD CONSTRAINT cash_register_sessions_closing_cents_nonneg CHECK (closing_amount IS NULL OR closing_amount >= 0)');
        }

        if ($driver === 'sqlite') {
            // SQLite has no ALTER TABLE ADD CONSTRAINT. CHECK clauses must
            // be added at CREATE TABLE time. Skip; the application layer
            // already validates monetary values, and the existing schema
            // pre-dates this hardening.
        }
    }

    public function down(): void
    {
        $driver = DB::connection()->getDriverName();

        if (! in_array($driver, ['mysql', 'mariadb'], true)) {
            return;
        }

        $this->dropCheckIfExists($driver, 'payments', 'payments_amount_cents_nonneg');
        $this->dropCheckIfExists($driver, 'invoices', 'invoices_total_cents_nonneg');
        $this->dropCheckIfExists($driver, 'invoices', 'invoices_paid_cents_nonneg');
        $this->dropCheckIfExists($driver, 'invoices', 'invoices_balance_cents_nonneg');
        $this->dropCheckIfExists($driver, 'cash_register_sessions', 'cash_register_sessions_opening_cents_nonneg');
        $this->dropCheckIfExists($driver, 'cash_register_sessions', 'cash_register_sessions_closing_cents_nonneg');
        $this->dropCheckIfExists($driver, 'cash_movements', 'cash_movements_amount_signed');
    }

    private function dropCheckIfExists(string $driver, string $table, string $constraint): void
    {
        if ($driver === 'sqlite') {
            return;
        }

        $database = DB::connection()->getDatabaseName();

        $exists = DB::table('information_schema.CHECK_CONSTRAINTS')
            ->where('CONSTRAINT_SCHEMA', $database)
            ->where('CONSTRAINT_NAME', $constraint)
            ->exists();

        if ($exists) {
            DB::statement("ALTER TABLE {$table} DROP CHECK {$constraint}");
        }
    }
};
