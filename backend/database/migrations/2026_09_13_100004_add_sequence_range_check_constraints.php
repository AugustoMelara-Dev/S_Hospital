<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * F017 (T2-004/T2-014): rango de numeracion `current_number <= max_number`.
 *
 * - `institutional_receipt_series`: la tabla ya tiene min<=max y current>=0,
 *   pero no impedia que un UPDATE directo dejara current por encima de max.
 * - `fiscal_sequences`: ya esta cubierta por el CHECK
 *   `fiscal_sequences_range_valid` de 2026_06_15_000004. Se verifica su
 *   presencia y solo si faltara (instalacion con esa migracion saltada) se
 *   agrega un CHECK defensivo bajo otro nombre.
 *
 * Fail-closed: si alguna serie ya tiene current_number > max_number, aborta
 * con mensaje. No se reinician correlativos: la numeracion fiscal requiere
 * decision humana y trazabilidad.
 *
 * SQLite: guard por driver; la suite rapida no cambia y la cobertura corre en
 * MariaDB.
 *
 * Rollback: solo elimina los CHECK creados por ESTA migracion; no toca
 * `fiscal_sequences_range_valid`, que pertenece a 2026_06_15_000004.
 */
return new class extends Migration
{
    private const SERIES_CHECK = 'institutional_receipt_series_current_le_max';

    private const SEQUENCES_FALLBACK_CHECK = 'fiscal_sequences_current_le_max';

    private const SEQUENCES_LEGACY_CHECK = 'fiscal_sequences_range_valid';

    public function up(): void
    {
        if (! in_array(DB::connection()->getDriverName(), ['mysql', 'mariadb'], true)) {
            return;
        }

        $this->assertRangeCoherent('institutional_receipt_series');
        $this->assertRangeCoherent('fiscal_sequences');

        if (Schema::hasTable('institutional_receipt_series') && ! $this->checkExists(self::SERIES_CHECK)) {
            DB::statement(
                'ALTER TABLE `institutional_receipt_series` ADD CONSTRAINT `'.self::SERIES_CHECK.'` '.
                'CHECK (`current_number` <= `max_number`)'
            );
        }

        if (Schema::hasTable('fiscal_sequences')
            && ! $this->checkExists(self::SEQUENCES_LEGACY_CHECK)
            && ! $this->checkExists(self::SEQUENCES_FALLBACK_CHECK)
        ) {
            DB::statement(
                'ALTER TABLE `fiscal_sequences` ADD CONSTRAINT `'.self::SEQUENCES_FALLBACK_CHECK.'` '.
                'CHECK (`current_number` <= `max_number`)'
            );
        }
    }

    public function down(): void
    {
        if (! in_array(DB::connection()->getDriverName(), ['mysql', 'mariadb'], true)) {
            return;
        }

        $this->dropCheckIfExists('institutional_receipt_series', self::SERIES_CHECK);
        $this->dropCheckIfExists('fiscal_sequences', self::SEQUENCES_FALLBACK_CHECK);
    }

    private function assertRangeCoherent(string $table): void
    {
        if (! Schema::hasTable($table) || ! Schema::hasColumn($table, 'current_number') || ! Schema::hasColumn($table, 'max_number')) {
            return;
        }

        $violations = (int) DB::table($table)->whereRaw('`current_number` > `max_number`')->count();

        if ($violations > 0) {
            throw new RuntimeException(sprintf(
                'F017 fail-closed: `%s` tiene %d fila(s) con current_number > max_number. '.
                'No se reinician correlativos automaticamente; investigue y documente la reconciliacion antes de continuar.',
                $table,
                $violations,
            ));
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

    private function dropCheckIfExists(string $table, string $name): void
    {
        if (! Schema::hasTable($table) || ! $this->checkExists($name)) {
            return;
        }

        try {
            DB::statement("ALTER TABLE `{$table}` DROP CONSTRAINT `{$name}`");
        } catch (QueryException) {
        }
    }
};
