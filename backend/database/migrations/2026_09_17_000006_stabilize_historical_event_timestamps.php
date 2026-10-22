<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * M-W2-DB-03 (hallazgo sistémico M-W2-FIN-02, mandato secciones 3, 15 y 19).
 *
 * Barrido completo de `information_schema.COLUMNS` sobre el esquema real
 * migrado desde cero en MariaDB 10.4.32 (`explicit_defaults_for_timestamp=0`)
 * detectó 7 columnas con `ON UPDATE current_timestamp()` heredado o declarado,
 * todas del mismo linaje: son la PRIMERA columna TIMESTAMP NOT NULL de su tabla
 * y por tanto reciben el atributo de forma IMPLÍCITA.
 *
 *   - cash_movements.occurred_at            (hecho: movimiento de caja)
 *   - client_error_logs.occurred_at         (hecho: error registrado)
 *   - institutional_receipts.issued_at      (hecho: emisión de recibo)
 *   - invoices.issued_at                    (hecho: emisión fiscal)
 *   - payments.paid_at                      (hecho: cobro)
 *   - scheduler_ticks.at                    (hecho: latido registrado)
 *   - service_price_histories.changed_at    (hecho: cambio de precio)
 *
 * Ninguna es semánticamente "última modificación": todas registran el instante
 * en que ocurrió un evento y se escriben al INSERT. `updated_at` (la única
 * columna que sí significa última modificación) NO tiene ON UPDATE en este
 * esquema (Laravel la declara `timestamp NULL`), así que no se toca.
 *
 * Consecuencia real ya demostrada: un UPDATE de la fila que no asigne la
 * columna hace que el motor reescriba la hora histórica con NOW(). Ya ocurrió
 * en `invoices.issued_at` (M-W2-FIN-02) y estaba latente en las otras seis.
 * `cash_register_sessions.opened_at` fue la primera y ya quedó estabilizada por
 * `2026_09_17_000004`.
 *
 * Qué hace esta migración:
 * - Redefine cada columna como `TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP`,
 *   sin `ON UPDATE`. Conserva el DEFAULT para que los INSERT sigan funcionando
 *   igual y no cambia el tipo ni la nulabilidad.
 * - NO recalcula, normaliza ni reescribe ningún valor: el ALTER solo cambia
 *   metadatos de columna.
 *
 * Idempotencia y reversibilidad:
 * - `up()` introspecta `information_schema` y solo actúa sobre columnas que aún
 *   tengan `ON UPDATE`. Correrlo dos veces es un no-op.
 * - `down()` restaura la definición literal previa
 *   (`TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`),
 *   que reproduce el defecto, pero SOLO donde el defecto puede existir
 *   (`explicit_defaults_for_timestamp = 0`). En un servidor con el flag en 1 el
 *   esquema nunca estuvo expuesto: `up()` fue no-op y `down()` también.
 * - `down()` no toca valores; solo metadatos.
 *
 * Compatibilidad:
 * - SQLite (y cualquier driver no MySQL/MariaDB) no aplica `ON UPDATE` a
 *   TIMESTAMP: la migración es un no-op declarado y el comportamiento correcto
 *   ya existe.
 *
 * Se usa SQL crudo por la misma razón que `2026_09_17_000004`: el compilador de
 * esquema de Laravel no puede "quitar el ON UPDATE" sin re-declarar la columna
 * completa, e `information_schema` da la comprobación de idempotencia por motor.
 */
return new class extends Migration
{
    /**
     * Columnas históricas a estabilizar: tabla => columna.
     *
     * @var array<string, string>
     */
    private const COLUMNS = [
        'cash_movements' => 'occurred_at',
        'client_error_logs' => 'occurred_at',
        'institutional_receipts' => 'issued_at',
        'invoices' => 'issued_at',
        'payments' => 'paid_at',
        'scheduler_ticks' => 'at',
        'service_price_histories' => 'changed_at',
    ];

    public function up(): void
    {
        if (! $this->appliesToCurrentDriver()) {
            return;
        }

        foreach (self::COLUMNS as $table => $column) {
            if (! Schema::hasTable($table) || ! Schema::hasColumn($table, $column)) {
                continue;
            }

            if (! $this->hasOnUpdate($table, $column)) {
                continue; // Ya estabilizada: no re-escribir el DDL.
            }

            DB::statement(
                'ALTER TABLE `'.$table.'` MODIFY `'.$column.'` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP'
            );
        }
    }

    public function down(): void
    {
        if (! $this->appliesToCurrentDriver()) {
            return;
        }

        // Con explicit_defaults_for_timestamp=1 el esquema nunca recibió el
        // ON UPDATE implícito: up() no hizo nada y down() tampoco debe hacerlo.
        if ($this->explicitDefaultsForTimestamp() !== 0) {
            return;
        }

        foreach (self::COLUMNS as $table => $column) {
            if (! Schema::hasTable($table) || ! Schema::hasColumn($table, $column)) {
                continue;
            }

            // Restaura la definición literal previa (equivalente al atributo
            // implícito que MariaDB renderiza). No modifica datos.
            DB::statement(
                'ALTER TABLE `'.$table.'` MODIFY `'.$column.'` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'
            );
        }
    }

    private function appliesToCurrentDriver(): bool
    {
        return in_array(DB::connection()->getDriverName(), ['mysql', 'mariadb'], true);
    }

    private function hasOnUpdate(string $table, string $column): bool
    {
        $extra = DB::table('information_schema.COLUMNS')
            ->where('TABLE_SCHEMA', DB::connection()->getDatabaseName())
            ->where('TABLE_NAME', $table)
            ->where('COLUMN_NAME', $column)
            ->value('EXTRA');

        return is_string($extra) && stripos($extra, 'on update') !== false;
    }

    private function explicitDefaultsForTimestamp(): int
    {
        $row = DB::selectOne('SELECT @@explicit_defaults_for_timestamp AS v');

        return (int) ($row->v ?? 0);
    }
};
