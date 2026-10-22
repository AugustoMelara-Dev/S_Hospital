<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * F015 / T2-032: endurecer la FK `audit_logs.user_id` de ON DELETE SET NULL a
 * ON DELETE RESTRICT.
 *
 * Contexto (T2-004, probado en `f015_fk_trigger_probe`): una accion FK
 * ON DELETE SET NULL NO activa los triggers de inmutabilidad, por lo que un
 * `DELETE FROM users` ponia en NULL la autoria forense sin error. La
 * aplicacion ya prohibe borrar usuarios (App\Models\User::booted) y
 * `migrate:fresh`/herramientas de BD desechable recrean el esquema con
 * FOREIGN_KEY_CHECKS=0, por lo que RESTRICT no rompe tooling: la unica
 * excepcion operativa es un DROP/wipe manual de la base completa, documentado
 * en el informe T2-032.
 *
 * Preflight: solo se cambia la regla si la FK existente apunta a `users`
 * (fail-closed ante un esquema inesperado). No borra ni modifica filas.
 *
 * SQLite: se omite (la suite rapida conserva su esquema con SET NULL; los
 * tests que verifican RESTRICT son MariaDB-gated).
 *
 * Rollback: restaura exactamente la regla original ON DELETE SET NULL.
 */
return new class extends Migration
{
    private const TABLE = 'audit_logs';

    private const COLUMN = 'user_id';

    private const CONSTRAINT = 'audit_logs_user_id_foreign';

    public function up(): void
    {
        if (! in_array(DB::connection()->getDriverName(), ['mysql', 'mariadb'], true)) {
            return;
        }

        if (! Schema::hasTable(self::TABLE) || ! Schema::hasColumn(self::TABLE, self::COLUMN)) {
            return;
        }

        $foreignKey = $this->foreignKey();

        if ($foreignKey === null) {
            $this->addForeignKey('RESTRICT');

            return;
        }

        if (strtoupper((string) $foreignKey->REFERENCED_TABLE_NAME) !== 'USERS') {
            throw new RuntimeException(sprintf(
                'F015 fail-closed: la FK de `%s`.`%s` apunta a `%s` en lugar de `users`; revise el esquema antes de continuar.',
                self::TABLE,
                self::COLUMN,
                (string) $foreignKey->REFERENCED_TABLE_NAME,
            ));
        }

        if (strtoupper((string) $foreignKey->DELETE_RULE) === 'RESTRICT') {
            return;
        }

        DB::statement('ALTER TABLE `'.self::TABLE.'` DROP FOREIGN KEY `'.$foreignKey->CONSTRAINT_NAME.'`');
        $this->addForeignKey('RESTRICT');
    }

    public function down(): void
    {
        if (! in_array(DB::connection()->getDriverName(), ['mysql', 'mariadb'], true)) {
            return;
        }

        if (! Schema::hasTable(self::TABLE) || ! Schema::hasColumn(self::TABLE, self::COLUMN)) {
            return;
        }

        $foreignKey = $this->foreignKey();

        if ($foreignKey === null) {
            $this->addForeignKey('SET NULL');

            return;
        }

        if (strtoupper((string) $foreignKey->DELETE_RULE) === 'SET NULL') {
            return;
        }

        DB::statement('ALTER TABLE `'.self::TABLE.'` DROP FOREIGN KEY `'.$foreignKey->CONSTRAINT_NAME.'`');
        $this->addForeignKey('SET NULL');
    }

    private function foreignKey(): ?object
    {
        return DB::table('information_schema.REFERENTIAL_CONSTRAINTS')
            ->where('CONSTRAINT_SCHEMA', DB::connection()->getDatabaseName())
            ->where('TABLE_NAME', self::TABLE)
            ->where('CONSTRAINT_NAME', self::CONSTRAINT)
            ->first();
    }

    private function addForeignKey(string $onDelete): void
    {
        if (! in_array($onDelete, ['RESTRICT', 'SET NULL'], true)) {
            throw new RuntimeException("Regla FK no soportada: {$onDelete}");
        }

        DB::statement(
            'ALTER TABLE `'.self::TABLE.'` ADD CONSTRAINT `'.self::CONSTRAINT.'` '.
            'FOREIGN KEY (`'.self::COLUMN.'`) REFERENCES `users` (`id`) ON DELETE '.$onDelete
        );
    }
};
