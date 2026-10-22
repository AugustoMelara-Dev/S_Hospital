<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * F017 (T2-004/T2-014): una factura pagada o parcial debe estar asociada a
 * una caja. AGENTS.md lo exige como regla no negociable ("Toda factura pagada
 * debe quedar asociada a caja, cajero, metodo de pago y fecha") y
 * CreateInvoiceAction ya exige caja abierta al emitir.
 *
 * La columna `cash_session_id` se mantiene nullable para no romper filas
 * historicas `issued`/`void` sin caja; el CHECK solo alcanza a los estados
 * `paid` y `partial`.
 *
 * Fail-closed: si ya existen facturas paid/partial sin caja, aborta con el
 * conteo; no se inventan asociaciones de caja.
 *
 * SQLite: guard por driver; la suite rapida no cambia y la cobertura corre en
 * MariaDB.
 *
 * Rollback: elimina exactamente el CHECK creado por esta migracion.
 */
return new class extends Migration
{
    private const TABLE = 'invoices';

    private const CHECK_NAME = 'invoices_paid_requires_cash_session';

    public function up(): void
    {
        if (! in_array(DB::connection()->getDriverName(), ['mysql', 'mariadb'], true)) {
            return;
        }

        if (! Schema::hasTable(self::TABLE)
            || ! Schema::hasColumn(self::TABLE, 'status')
            || ! Schema::hasColumn(self::TABLE, 'cash_session_id')
        ) {
            return;
        }

        $violations = (int) DB::table(self::TABLE)
            ->whereIn('status', ['paid', 'partial'])
            ->whereNull('cash_session_id')
            ->count();

        if ($violations > 0) {
            throw new RuntimeException(sprintf(
                'F017 fail-closed: `%s` tiene %d factura(s) paid/partial sin `cash_session_id`. '.
                'No se asocian cajas automaticamente; investigue y documente el historico antes de continuar.',
                self::TABLE,
                $violations,
            ));
        }

        if (! $this->checkExists(self::CHECK_NAME)) {
            DB::statement(
                'ALTER TABLE `'.self::TABLE.'` ADD CONSTRAINT `'.self::CHECK_NAME.'` '.
                "CHECK (`status` NOT IN ('paid','partial') OR `cash_session_id` IS NOT NULL)"
            );
        }
    }

    public function down(): void
    {
        if (! in_array(DB::connection()->getDriverName(), ['mysql', 'mariadb'], true)) {
            return;
        }

        if (! Schema::hasTable(self::TABLE) || ! $this->checkExists(self::CHECK_NAME)) {
            return;
        }

        try {
            DB::statement('ALTER TABLE `'.self::TABLE.'` DROP CONSTRAINT `'.self::CHECK_NAME.'`');
        } catch (QueryException) {
        }
    }

    private function checkExists(string $name): bool
    {
        $database = DB::connection()->getDatabaseName();

        return DB::table('information_schema.CHECK_CONSTRAINTS')
            ->where('CONSTRAINT_SCHEMA', $database)
            ->where('CONSTRAINT_NAME', $name)
            ->exists();
    }
};
