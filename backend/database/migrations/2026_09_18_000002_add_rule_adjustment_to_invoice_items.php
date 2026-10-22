<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * T-BE-02 / MANDATO_DEV §8 y §14: persistir el PRECIO REGISTRADO y el AJUSTE POR
 * REGLA de cada linea de factura.
 *
 * `CalculateInvoiceTotalsAction` ya calculaba `unit_price_registered_cents`
 * (precio de catalogo antes de aplicar la regla EPO) y `rule_adjustment_cents`
 * (diferencia registrado - aplicado), pero `invoice_items` no tenia columnas:
 * el reporte ejecutivo siempre mostraba `rule_adjustment: "0.00"` con
 * `rule_adjustment_persisted: false`. Se agregan columnas enteras en centavos
 * con default 0.
 *
 * Backfill conservador de historicos:
 *  - `unit_price_registered_cents` = `unit_price_cents` (mejor dato disponible;
 *    en las lineas historicas ya ajustadas ese precio NO incluye la gratuidad
 *    porque nunca se guardo el precio de catalogo).
 *  - `rule_adjustment_cents` = 0 (no se inventa el ajuste no persistido).
 *
 * Los asientos historicos NO se borran y los totales NO se recalculan: el
 * ajuste es informativo y ya esta incorporado en `unit_price_cents = 0`.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('invoice_items') || Schema::hasColumn('invoice_items', 'rule_adjustment_cents')) {
            return;
        }

        Schema::table('invoice_items', function (Blueprint $table): void {
            $table->bigInteger('unit_price_registered_cents')->default(0)->after('unit_price_cents');
            $table->bigInteger('rule_adjustment_cents')->default(0)->after('unit_price_registered_cents');
        });

        // Backfill conservador: precio registrado = precio efectivo guardado.
        // `rule_adjustment_cents` queda en su default 0.
        DB::table('invoice_items')->update([
            'unit_price_registered_cents' => DB::raw('unit_price_cents'),
        ]);
    }

    public function down(): void
    {
        if (! Schema::hasTable('invoice_items') || ! Schema::hasColumn('invoice_items', 'rule_adjustment_cents')) {
            return;
        }

        Schema::table('invoice_items', function (Blueprint $table): void {
            $table->dropColumn(['unit_price_registered_cents', 'rule_adjustment_cents']);
        });
    }
};
