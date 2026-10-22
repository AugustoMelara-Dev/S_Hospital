<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * F017 (T2-004/T2-014): singleton efectivo de `fiscal_settings`.
 *
 * Toda la aplicacion asume una unica fila de configuracion fiscal
 * (firstOrNew()/first()), pero la tabla podia acumular filas y el resultado
 * dependia del orden fisico. Se agrega:
 *   - columna `singleton` con DEFAULT 1,
 *   - indice unico sobre `singleton` (portable, no requiere expresiones),
 *   - CHECK (singleton = 1) para cerrar el bypass de escribir un valor
 *     explicito distinto de 1.
 *
 * Fail-closed: si ya existen 2+ filas, la migracion aborta con mensaje claro.
 * Elegir la fila vigente es una decision de negocio: no se borra ni fusiona
 * nada automaticamente.
 *
 * SQLite: guard por driver; la suite rapida no cambia y la cobertura corre en
 * MariaDB (phpunit.mysql.xml).
 *
 * Rollback: retira CHECK, indice y columna creados por esta migracion.
 */
return new class extends Migration
{
    private const TABLE = 'fiscal_settings';

    private const COLUMN = 'singleton';

    private const CHECK_NAME = 'fiscal_settings_singleton_valid';

    private const INDEX_NAME = 'fiscal_settings_singleton_unique';

    public function up(): void
    {
        if (! in_array(DB::connection()->getDriverName(), ['mysql', 'mariadb'], true)) {
            return;
        }

        if (! Schema::hasTable(self::TABLE)) {
            return;
        }

        $rows = (int) DB::table(self::TABLE)->count();

        if ($rows > 1) {
            throw new RuntimeException(sprintf(
                'F017 fail-closed: `%s` tiene %d filas y el dominio exige una sola configuracion fiscal. '.
                'No se elimina ni fusiona automaticamente; reconcilie manualmente cual fila es la vigente y vuelva a ejecutar.',
                self::TABLE,
                $rows,
            ));
        }

        if (! Schema::hasColumn(self::TABLE, self::COLUMN)) {
            DB::statement('ALTER TABLE `'.self::TABLE.'` ADD COLUMN `'.self::COLUMN.'` TINYINT(1) NOT NULL DEFAULT 1');
        }

        if (! $this->checkExists(self::CHECK_NAME)) {
            DB::statement(
                'ALTER TABLE `'.self::TABLE.'` ADD CONSTRAINT `'.self::CHECK_NAME.'` CHECK (`'.self::COLUMN.'` = 1)'
            );
        }

        if (! $this->indexExists(self::INDEX_NAME)) {
            DB::statement('CREATE UNIQUE INDEX `'.self::INDEX_NAME.'` ON `'.self::TABLE.'` (`'.self::COLUMN.'`)');
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

        if ($this->checkExists(self::CHECK_NAME)) {
            try {
                DB::statement('ALTER TABLE `'.self::TABLE.'` DROP CONSTRAINT `'.self::CHECK_NAME.'`');
            } catch (QueryException) {
            }
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

    private function checkExists(string $name): bool
    {
        $database = DB::connection()->getDatabaseName();

        return DB::table('information_schema.CHECK_CONSTRAINTS')
            ->where('CONSTRAINT_SCHEMA', $database)
            ->where('CONSTRAINT_NAME', $name)
            ->exists();
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
