<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * F017 (T2-004/T2-014): un solo assignment activo de perfil de impresion por
 * scope en `receipt_profile_assignments`.
 *
 * `InstitutionalReceiptSettingsController::upsertAssignment()` desactiva los
 * assignments previos del scope antes de crear el nuevo, pero dos peticiones
 * concurrentes pueden crear dos activos. `ResolveReceiptPrintProfileAction`
 * resuelve por `latest('id')`, asi que el duplicado silencioso ya era posible.
 *
 * MariaDB/MySQL no tienen indices parciales; se usa el patron ya presente en
 * el repositorio (2026_06_15_000004): columna generada STORED que vale la
 * clave del scope solo cuando active=1 y NULL en caso contrario, con UNIQUE
 * encima. Los NULL multiples son permitidos por el indice, por lo que se
 * pueden conservar N assignments inactivos y el historial.
 *
 * Fail-closed: si ya existen duplicados activos por scope, aborta con mensaje.
 *
 * SQLite: guard por driver (no porta columnas generadas con esta semantica);
 * la suite rapida no cambia y la cobertura corre en MariaDB.
 *
 * Rollback: elimina indice y columna generada creados por esta migracion.
 */
return new class extends Migration
{
    private const TABLE = 'receipt_profile_assignments';

    private const COLUMN = 'active_scope_key';

    private const INDEX_NAME = 'uniq_receipt_profile_assignments_active_scope';

    public function up(): void
    {
        if (! in_array(DB::connection()->getDriverName(), ['mysql', 'mariadb'], true)) {
            return;
        }

        if (! Schema::hasTable(self::TABLE)) {
            return;
        }

        $duplicates = DB::selectOne(
            'SELECT COUNT(*) AS c FROM ('.
            '  SELECT 1 FROM `'.self::TABLE.'` WHERE `active` = 1 '.
            '  GROUP BY `scope_type`, COALESCE(`scope_id`, 0) HAVING COUNT(*) > 1'.
            ') AS duplicate_scopes'
        );

        $duplicateCount = (int) ($duplicates->c ?? 0);

        if ($duplicateCount > 0) {
            throw new RuntimeException(sprintf(
                'F017 fail-closed: `%s` tiene %d scope(s) con mas de un assignment activo. '.
                'No se desactiva ni borra ninguno automaticamente; resuelva manualmente el alcance vigente y vuelva a ejecutar.',
                self::TABLE,
                $duplicateCount,
            ));
        }

        if (! Schema::hasColumn(self::TABLE, self::COLUMN)) {
            DB::statement(
                'ALTER TABLE `'.self::TABLE.'` ADD COLUMN `'.self::COLUMN.'` VARCHAR(80) '.
                "GENERATED ALWAYS AS (CASE WHEN `active` = 1 THEN CONCAT(`scope_type`, ':', COALESCE(`scope_id`, 0)) ELSE NULL END) STORED"
            );
        }

        if (! $this->indexExists(self::INDEX_NAME)) {
            DB::statement(
                'CREATE UNIQUE INDEX `'.self::INDEX_NAME.'` ON `'.self::TABLE.'` (`'.self::COLUMN.'`)'
            );
        }
    }

    public function down(): void
    {
        if (! in_array(DB::connection()->getDriverName(), ['mysql', 'mariadb'], true)) {
            return;
        }

        if (! Schema::hasTable(self::TABLE)) {
            return;
        }

        if ($this->indexExists(self::INDEX_NAME)) {
            try {
                DB::statement('DROP INDEX `'.self::INDEX_NAME.'` ON `'.self::TABLE.'`');
            } catch (QueryException) {
            }
        }

        if (Schema::hasColumn(self::TABLE, self::COLUMN)) {
            try {
                DB::statement('ALTER TABLE `'.self::TABLE.'` DROP COLUMN `'.self::COLUMN.'`');
            } catch (QueryException) {
            }
        }
    }

    private function indexExists(string $name): bool
    {
        $database = DB::connection()->getDatabaseName();

        return DB::table('information_schema.STATISTICS')
            ->where('TABLE_SCHEMA', $database)
            ->where('TABLE_NAME', self::TABLE)
            ->where('INDEX_NAME', $name)
            ->exists();
    }
};
