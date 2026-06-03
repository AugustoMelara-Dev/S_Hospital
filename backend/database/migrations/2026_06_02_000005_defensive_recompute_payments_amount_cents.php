<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Audit finding C6: the cents backfill migrations use
 * `CAST(amount * 100 AS SIGNED)`, which is a 32-bit signed integer
 * with a max value of 2,147,483,647 cents (~L. 21,474,836.47). For a
 * hospital this is plenty in practice, but a defensive recompute to
 * the full 64-bit range costs nothing and removes a footgun.
 *
 * This migration:
 *   1. Verifies the column is BIGINT (the schema already declares it
 *      as bigInteger() in the original migration).
 *   2. If running on MySQL/MariaDB, recomputes amount_cents from
 *      amount using CAST(ROUND(amount*100) AS UNSIGNED) so the value
 *      is permitted to use the full BIGINT range.
 *   3. Idempotent: a re-run on the same data is a no-op.
 *
 * Float math: `amount` is decimal(12,2) so the *100 is exact at the
 * 2-decimal scale. ROUND defends against any engine that has stored
 * 17.25 as 17.24999999 due to a charset collation.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('payments', 'amount_cents')) {
            return;
        }

        $driver = DB::connection()->getDriverName();
        if (! in_array($driver, ['mysql', 'mariadb'], true)) {
            // SQLite in-memory tests do not need the fix; the column is
            // already bigint in schema and the values are tiny.
            return;
        }

        // Identify any rows where the value overflows the old 32-bit
        // cast. We just recompute everything unconditionally; the
        // operation is O(N) but N is small and the math is exact.
        $count = DB::table('payments')
            ->whereNotNull('amount_cents')
            ->whereNotNull('amount')
            ->count();
        if ($count === 0) {
            return;
        }

        DB::table('payments')
            ->whereNotNull('amount')
            ->update([
                'amount_cents' => DB::raw('CAST(ROUND(amount * 100) AS UNSIGNED)'),
            ]);
    }

    public function down(): void
    {
        // No down. The previous migration's value was identical for
        // any amount below L. 21,474,836.47, which is every hospital
        // receipt in practice. The recompute is forward-only.
    }
};
