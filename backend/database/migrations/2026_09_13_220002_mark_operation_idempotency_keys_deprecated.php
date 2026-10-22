<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * F014 (T2-040): marcado de deprecacion trazable de la tabla legacy
 * `operation_idempotency_keys` mediante COMMENT de tabla (metadata, sin tocar
 * filas). La tabla no tiene escritores desde 2026-07-01; el middleware vigente
 * usa `idempotency_keys`. La poda de retencion sigue en
 * PruneIdempotencyKeysCommand.
 *
 * Reglas:
 * - Idempotente: si el comentario ya contiene el marcador, no hace nada.
 * - Fail-closed: si la tabla tuviera un comentario previo distinto al marcador,
 *   aborta para no perder metadata ajena.
 * - down(): restaura el comentario vacio original (el esquema Laravel no define
 *   comentarios de tabla propios).
 * - SQLite: no-op (no soporta comentarios de tabla en este esquema).
 *
 * NO elimina tabla, migraciones ni datos.
 */
return new class extends Migration
{
    private const TABLE = 'operation_idempotency_keys';

    private const MARKER = 'DEPRECATED T2-040';

    private const COMMENT = 'DEPRECATED T2-040: legacy sin escritores desde 2026-07-01; usar idempotency_keys. Retiro requiere copia verificada y autorizacion.';

    public function up(): void
    {
        if (! in_array(DB::connection()->getDriverName(), ['mysql', 'mariadb'], true)) {
            return;
        }

        if (! Schema::hasTable(self::TABLE)) {
            return;
        }

        $current = $this->tableComment();

        if ($current !== null && str_contains($current, self::MARKER)) {
            return;
        }

        if ($current !== null && trim($current) !== '') {
            throw new RuntimeException(
                'F014 fail-closed: `'.self::TABLE.'` tiene un comentario de tabla previo distinto al marcador de deprecacion: "'.$current.'". '.
                'Revise y documente ese comentario antes de continuar.'
            );
        }

        DB::statement('ALTER TABLE `'.self::TABLE."` COMMENT = '".self::COMMENT."'");
    }

    public function down(): void
    {
        if (! in_array(DB::connection()->getDriverName(), ['mysql', 'mariadb'], true)) {
            return;
        }

        if (! Schema::hasTable(self::TABLE)) {
            return;
        }

        $current = $this->tableComment();

        if ($current === null || ! str_contains($current, self::MARKER)) {
            return;
        }

        DB::statement('ALTER TABLE `'.self::TABLE."` COMMENT = ''");
    }

    private function tableComment(): ?string
    {
        $comment = DB::table('information_schema.TABLES')
            ->where('TABLE_SCHEMA', DB::connection()->getDatabaseName())
            ->where('TABLE_NAME', self::TABLE)
            ->value('TABLE_COMMENT');

        return $comment === null ? null : (string) $comment;
    }
};
