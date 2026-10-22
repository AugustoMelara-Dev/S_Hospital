<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * M-W2-DB-02 TAREA 1 (hallazgo M-W2-DB-01 seccion 5; mandato seccion 7 y 15).
 *
 * En MariaDB/MySQL con `explicit_defaults_for_timestamp=0` (default de la
 * instancia de laboratorio XAMPP), la primera columna TIMESTAMP NOT NULL de una
 * tabla recibe implicitamente
 * `DEFAULT current_timestamp() ON UPDATE current_timestamp()`.
 *
 * `cash_register_sessions.opened_at` es esa primera columna. Por eso cualquier
 * UPDATE de la fila que no asigne `opened_at` la reescribe a NOW(): lo hace ya
 * `CloseCashSessionAction::execute()` al cerrar la caja (forceFill + save) y lo
 * hariamos tambien al liberar `open_marker` en el cierre. El resultado es una
 * hora de apertura historica corrompida.
 *
 * Esta migracion redefine la columna como
 * `TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP`, sin `ON UPDATE`, de modo que
 * los cierres y cualquier UPDATE posterior conserven el valor real de apertura.
 *
 * Garantias:
 * - No recalcula, normaliza ni reescribe ningun valor: solo cambia la
 *   definicion de columna (ALTER no toca datos).
 * - Idempotente: si la columna ya no tiene ON UPDATE implicito, no hace nada.
 * - Reversible (`down()`): restaura la definicion literal original
 *   (`TIMESTAMP NOT NULL`), que en MariaDB con explicit_defaults_for_timestamp=0
 *   vuelve a producir el `ON UPDATE` implicito previo. Tampoco toca valores.
 * - SQLite no aplica `ON UPDATE CURRENT_TIMESTAMP` a columnas TIMESTAMP; alli
 *   esta migracion es un no-op declarado y el comportamiento correcto ya existe.
 *
 * Se usa SQL crudo porque el compilador de esquema de Laravel no puede expresar
 * "quitar el ON UPDATE" sin re-declarar la columna completa, y porque
 * information_schema permite la comprobacion de idempotencia por motor.
 */
return new class extends Migration
{
    private const TABLE = 'cash_register_sessions';

    private const COLUMN = 'opened_at';

    public function up(): void
    {
        if (! $this->appliesToCurrentDriver()) {
            return;
        }

        if (! Schema::hasTable(self::TABLE) || ! Schema::hasColumn(self::TABLE, self::COLUMN)) {
            return;
        }

        if (! $this->hasImplicitOnUpdate()) {
            return; // Ya estabilizada: no re-escribir el DDL.
        }

        DB::statement(
            'ALTER TABLE `'.self::TABLE.'` MODIFY `'.self::COLUMN.'` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP'
        );
    }

    public function down(): void
    {
        if (! $this->appliesToCurrentDriver()) {
            return;
        }

        if (! Schema::hasTable(self::TABLE) || ! Schema::hasColumn(self::TABLE, self::COLUMN)) {
            return;
        }

        // Restaura la definicion original de la migracion de creacion. El ALTER
        // solo cambia metadatos de columna: no modifica la hora de apertura.
        DB::statement(
            'ALTER TABLE `'.self::TABLE.'` MODIFY `'.self::COLUMN.'` TIMESTAMP NOT NULL'
        );
    }

    private function appliesToCurrentDriver(): bool
    {
        return in_array(DB::connection()->getDriverName(), ['mysql', 'mariadb'], true);
    }

    private function hasImplicitOnUpdate(): bool
    {
        $extra = DB::table('information_schema.COLUMNS')
            ->where('TABLE_SCHEMA', DB::connection()->getDatabaseName())
            ->where('TABLE_NAME', self::TABLE)
            ->where('COLUMN_NAME', self::COLUMN)
            ->value('EXTRA');

        return is_string($extra) && stripos($extra, 'on update') !== false;
    }
};
