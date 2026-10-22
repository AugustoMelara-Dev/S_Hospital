<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * T-BE-01 / MANDATO_DEV §8: representar explicitamente la EMISION SIN COBRO.
 *
 * Hasta ahora una factura de total 0 se marcaba `paid` y ademas creaba un
 * `Payment` de 0.00 en metodo `other` (cobro ficticio) mas auditoria
 * `invoice.zero_amount_registered`. El mandato prohibe fingir un ingreso: una
 * operacion totalmente gratuita no crea pago ni movimiento de caja.
 *
 * Se agrega `invoices.settlement` para separar la liquidacion contable real de
 * la gratuidad autorizada, sin tocar `status` (que se conserva `paid` para no
 * romper emision de recibo, anulacion ni consultas existentes):
 *
 *  - `pending`        : emitida con saldo pendiente (o parcial).
 *  - `paid`           : liquidada por cobros reales.
 *  - `free_by_rule`   : total cero por la regla EPO por linea (sin cobro).
 *  - `zero_price`     : total cero porque todo el carrito tiene precio 0.
 *
 * Backfill de historicos: las facturas `paid` con `paid_amount_cents = 0`
 * (incluidos los asientos tecnicos de cero) se marcan `free_by_rule`; las que
 * tienen cobro real quedan `paid`. Los asientos historicos NO se borran; solo
 * se separan de los cobros reales en consultas y reportes.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('invoices') || Schema::hasColumn('invoices', 'settlement')) {
            return;
        }

        Schema::table('invoices', function (Blueprint $table): void {
            $table->string('settlement', 24)->default('pending')->after('status')->index();
        });

        DB::table('invoices')
            ->where('status', 'paid')
            ->where('paid_amount_cents', 0)
            ->update(['settlement' => 'free_by_rule']);

        DB::table('invoices')
            ->where('status', 'paid')
            ->where('paid_amount_cents', '>', 0)
            ->update(['settlement' => 'paid']);
    }

    public function down(): void
    {
        if (! Schema::hasTable('invoices') || ! Schema::hasColumn('invoices', 'settlement')) {
            return;
        }

        Schema::table('invoices', function (Blueprint $table): void {
            $table->dropIndex(['settlement']);
            $table->dropColumn('settlement');
        });
    }
};
