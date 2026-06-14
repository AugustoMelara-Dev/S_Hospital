<?php

declare(strict_types=1);

namespace App\Support;

use Closure;
use Illuminate\Support\Facades\DB;
use Throwable;

/**
 * Centralized helper for operations that must run inside the MariaDB/MySQL
 * `audit_logs` append-only bypass. The forensic immutability trigger installed
 * by `2026_06_09_000001_add_forensic_columns_and_immutability_to_audit_logs.php`
 * blocks UPDATE/DELETE on `audit_logs` unless the session variable
 * `@app_audit_admin_op` is set to 1.
 *
 * SQLite (used in CI) does not install the trigger, so a naive
 * `DB::table('audit_logs')->delete()` passes in tests but explodes in
 * production. This helper makes the bypass explicit, scoped, and reset on
 * exit (even when the callback throws).
 *
 * Usage:
 *   AuditAdmin::run(function (): int {
 *       return DB::table('audit_logs')->where('created_at', '<', $cutoff)->delete();
 *   });
 */
final class AuditAdmin
{
    public static function run(Closure $callback): mixed
    {
        $driver = DB::connection()->getDriverName();

        if (! in_array($driver, ['mysql', 'mariadb'], true)) {
            return $callback();
        }

        DB::statement('SET @app_audit_admin_op = 1');

        try {
            return $callback();
        } finally {
            try {
                DB::statement('SET @app_audit_admin_op = NULL');
            } catch (Throwable) {
                // Resetting the variable must never mask the original exception.
            }
        }
    }
}
