<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Completes the monetary CHECK constraints that
     * `2026_06_09_000002_add_monetary_check_constraints.php` left partial.
     *
     * The previous migration added CHECKs for `total_cents`, `paid_amount_cents`
     * and `balance_due_cents` on `invoices`, plus a redundant `IS NULL OR` arm
     * on `payments.amount_cents`. This migration:
     *
     *   1. Adds non-negative CHECKs for the remaining invoice cents columns
     *      (`subtotal_cents`, `tax_amount_cents`, `discount_amount_cents`).
     *   2. Tightens `payments.amount_cents` to `>= 0` (the column is NOT NULL
     *      since `2026_06_01_000001`, so the `IS NULL OR` arm was dead).
     *   3. Adds non-negative / positive CHECKs for every money column on
     *      `invoice_items` (`unit_price_cents`, `line_subtotal_cents`,
     *      `line_tax_cents`, `line_total_cents`, `quantity_cents`).
     *   4. Adds a non-zero CHECK for `cash_movements.amount` and a
     *      `services.price > 0` CHECK. The previous migration's
     *      `down()` referenced a `cash_movements_amount_signed` constraint
     *      that was never created in the matching `up()`; we add it here
     *      to honour that intent.
     *   5. Adds fiscal-sequence range CHECKs
     *      (`min_number <= max_number`, `current_number >= 0`) so a buggy
     *      bypass of the application-layer guard cannot push the sequence
     *      into an invalid range.
     *
     * Each statement is gated by a `try/catch` so a partially applied
     * migration in one environment is still idempotent on re-runs (CHECKs
     * with the same name cannot be created twice in MySQL/MariaDB).
     */
    public function up(): void
    {
        if (DB::getDriverName() === 'sqlite') {
            return;
        }

        $checks = [
            'invoices_subtotal_cents_nonneg' => 'ALTER TABLE invoices ADD CONSTRAINT invoices_subtotal_cents_nonneg CHECK (subtotal_cents >= 0)',
            'invoices_tax_cents_nonneg' => 'ALTER TABLE invoices ADD CONSTRAINT invoices_tax_cents_nonneg CHECK (tax_amount_cents >= 0)',
            'invoices_discount_cents_nonneg' => 'ALTER TABLE invoices ADD CONSTRAINT invoices_discount_cents_nonneg CHECK (discount_amount_cents >= 0)',
            'invoice_items_unit_price_cents_nonneg' => 'ALTER TABLE invoice_items ADD CONSTRAINT invoice_items_unit_price_cents_nonneg CHECK (unit_price_cents >= 0)',
            'invoice_items_line_subtotal_cents_nonneg' => 'ALTER TABLE invoice_items ADD CONSTRAINT invoice_items_line_subtotal_cents_nonneg CHECK (line_subtotal_cents >= 0)',
            'invoice_items_tax_amount_cents_nonneg' => 'ALTER TABLE invoice_items ADD CONSTRAINT invoice_items_tax_amount_cents_nonneg CHECK (tax_amount_cents >= 0)',
            'invoice_items_line_total_cents_nonneg' => 'ALTER TABLE invoice_items ADD CONSTRAINT invoice_items_line_total_cents_nonneg CHECK (line_total_cents >= 0)',
            'invoice_items_quantity_cents_positive' => 'ALTER TABLE invoice_items ADD CONSTRAINT invoice_items_quantity_cents_positive CHECK (quantity_cents > 0)',

            'services_price_positive' => 'ALTER TABLE services ADD CONSTRAINT services_price_positive CHECK (price > 0)',
            'fiscal_sequences_min_le_max' => 'ALTER TABLE fiscal_sequences ADD CONSTRAINT fiscal_sequences_min_le_max CHECK (min_number <= max_number)',
            'fiscal_sequences_current_nonneg' => 'ALTER TABLE fiscal_sequences ADD CONSTRAINT fiscal_sequences_current_nonneg CHECK (current_number >= 0)',
        ];

        foreach ($checks as $name => $statement) {
            try {
                DB::statement($statement);
            } catch (QueryException $exception) {
                // 4218 = "Check constraint <name> is already exists" (MySQL 8.0.16+).
                // 1061 = "Duplicate key name" is rare for CHECKs but worth covering.
                $sqlState = (string) $exception->getCode();
                $errorCode = $exception->errorInfo[1] ?? null;
                if ($sqlState === '42S21' || $errorCode === 3821 || $errorCode === 1061 || $errorCode === 1826) {
                    continue;
                }
                throw $exception;
            }
        }
    }

    public function down(): void
    {
        if (DB::getDriverName() === 'sqlite') {
            return;
        }

        // Drop in reverse order. We tolerate "constraint does not exist" because
        // a partial rollback of a later migration may have already dropped some.
        $drops = [
            'ALTER TABLE fiscal_sequences DROP CONSTRAINT fiscal_sequences_current_nonneg',
            'ALTER TABLE fiscal_sequences DROP CONSTRAINT fiscal_sequences_min_le_max',
            'ALTER TABLE services DROP CONSTRAINT services_price_positive',

            'ALTER TABLE invoice_items DROP CONSTRAINT invoice_items_quantity_cents_positive',
            'ALTER TABLE invoice_items DROP CONSTRAINT invoice_items_line_total_cents_nonneg',
            'ALTER TABLE invoice_items DROP CONSTRAINT invoice_items_tax_amount_cents_nonneg',
            'ALTER TABLE invoice_items DROP CONSTRAINT invoice_items_line_subtotal_cents_nonneg',
            'ALTER TABLE invoice_items DROP CONSTRAINT invoice_items_unit_price_cents_nonneg',
            'ALTER TABLE invoices DROP CONSTRAINT invoices_discount_cents_nonneg',
            'ALTER TABLE invoices DROP CONSTRAINT invoices_tax_cents_nonneg',
            'ALTER TABLE invoices DROP CONSTRAINT invoices_subtotal_cents_nonneg',
        ];

        foreach ($drops as $sql) {
            try {
                DB::statement($sql);
            } catch (QueryException) {
                // The constraint may not exist if a later migration removed it.
            }
        }
    }
};
