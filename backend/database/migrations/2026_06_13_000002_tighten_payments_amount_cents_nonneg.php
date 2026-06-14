<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Tighten `payments_amount_cents_nonneg` to `amount_cents >= 0` (no `IS NULL OR`).
     *
     * The original constraint in `2026_06_09_000002_add_monetary_check_constraints.php`
     * added the constraint as `CHECK (amount_cents IS NULL OR amount_cents >= 0)`.
     * However, `2026_06_01_000001_add_amount_cents_to_payments_table.php` makes
     * the column `NOT NULL`. The `IS NULL OR` arm is therefore dead code that
     * only confuses readers. This migration replaces the constraint with a
     * tighter one.
     */
    public function up(): void
    {
        $driver = DB::connection()->getDriverName();
        if (! in_array($driver, ['mysql', 'mariadb'], true)) {
            return;
        }

        $database = DB::connection()->getDatabaseName();
        $exists = DB::table('information_schema.CHECK_CONSTRAINTS')
            ->where('CONSTRAINT_SCHEMA', $database)
            ->where('CONSTRAINT_NAME', 'payments_amount_cents_nonneg')
            ->exists();

        if (! $exists) {
            // Nothing to tighten; the original migration was never run on this
            // schema. Add the tight variant so future regressions are caught.
            try {
                DB::statement('ALTER TABLE payments ADD CONSTRAINT payments_amount_cents_nonneg CHECK (amount_cents >= 0)');
            } catch (QueryException $exception) {
                $sqlState = (string) $exception->getCode();
                $errorCode = $exception->errorInfo[1] ?? null;
                if ($sqlState !== '42S21' && $errorCode !== 3821 && $errorCode !== 1061) {
                    throw $exception;
                }
            }

            return;
        }

        // Drop and re-add with the tighter expression.
        DB::statement('ALTER TABLE payments DROP CHECK payments_amount_cents_nonneg');
        DB::statement('ALTER TABLE payments ADD CONSTRAINT payments_amount_cents_nonneg CHECK (amount_cents >= 0)');
    }

    public function down(): void
    {
        $driver = DB::connection()->getDriverName();
        if (! in_array($driver, ['mysql', 'mariadb'], true)) {
            return;
        }

        $database = DB::connection()->getDatabaseName();
        $exists = DB::table('information_schema.CHECK_CONSTRAINTS')
            ->where('CONSTRAINT_SCHEMA', $database)
            ->where('CONSTRAINT_NAME', 'payments_amount_cents_nonneg')
            ->exists();

        if (! $exists) {
            return;
        }

        DB::statement('ALTER TABLE payments DROP CHECK payments_amount_cents_nonneg');
        DB::statement('ALTER TABLE payments ADD CONSTRAINT payments_amount_cents_nonneg CHECK (amount_cents IS NULL OR amount_cents >= 0)');
    }
};
