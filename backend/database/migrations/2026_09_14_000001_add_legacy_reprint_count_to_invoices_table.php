<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * T3-004 / F012 (path legacy JSON de recibos): contador durable de reimpresion
 * por factura.
 *
 * Contexto: las facturas sin recibo institucional usan GET/POST JSON como
 * comprobante secundario. Ese path no tenia contador persistente: el frontend
 * recordaba la primera impresion solo por sesion (Set<invoiceId>, T2-035), de
 * modo que tras recargar una impresion posterior volvia a considerarse primera
 * y la reimpresion no tenia numero visible. El numero NO puede derivarse de
 * COUNT(audit_logs) porque audit_logs es una bitacora podable.
 *
 * `invoices.legacy_reprint_count` es el contador autoritativo:
 *   - default 0 para todas las filas existentes y futuras (sin backfill: una
 *     factura historica sin reimpresiones registradas vale 0).
 *   - lo incrementa SOLO ReprintReceiptAction dentro de su transaccion y con
 *     lock de la fila de factura; el GET de recibo (primera impresion/vista)
 *     no lo modifica.
 *   - la etiqueta visible es `REIMPRESIÓN #n` con n = contador tras el
 *     incremento (primera reimpresion = #1).
 *
 * Compatibilidad:
 *   - Aditiva y no nullable: no reescribe ni borra datos historicos.
 *   - SQLite y MariaDB/MySQL portables (unsignedInteger + default).
 *   - Idempotente: up() no repite la columna si ya existe; down() solo la
 *     elimina si existe y conserva filas y demas columnas.
 */
return new class extends Migration
{
    private const TABLE = 'invoices';

    private const COLUMN = 'legacy_reprint_count';

    public function up(): void
    {
        if (! Schema::hasTable(self::TABLE) || Schema::hasColumn(self::TABLE, self::COLUMN)) {
            return;
        }

        Schema::table(self::TABLE, function (Blueprint $table): void {
            $table->unsignedInteger(self::COLUMN)->default(0)->after('status');
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable(self::TABLE) || ! Schema::hasColumn(self::TABLE, self::COLUMN)) {
            return;
        }

        Schema::table(self::TABLE, function (Blueprint $table): void {
            $table->dropColumn(self::COLUMN);
        });
    }
};
