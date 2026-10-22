<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * M-W2-DB-01 (mandato §7 y §15): dimension explicita de caja fisica/terminal.
 *
 * Antes de esta migracion no existia ninguna columna de caja: la unica
 * restriccion era `cash_register_sessions.open_user_id` UNIQUE, global para
 * todo el sistema. Esta tabla permite modelar varias cajas sin reescribir el
 * dominio: el modo inicial sigue siendo una sola caja (`principal`) y habilitar
 * puestos adicionales es agregar filas, no redisenar el esquema.
 *
 * `code` es el identificador estable (UNIQUE) y `name` la etiqueta visible.
 * `active` permite retirar un puesto sin borrar su historial de sesiones.
 *
 * Migracion puramente aditiva y reversible: no toca `cash_register_sessions`.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('cash_registers')) {
            return;
        }

        Schema::create('cash_registers', function (Blueprint $table): void {
            $table->id();
            $table->string('code', 32)->unique();
            $table->string('name', 80);
            $table->boolean('active')->default(true);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        // El orden de rollback (000003 -> 000002 -> 000001) garantiza que ya no
        // existan FKs desde `cash_register_sessions` al ejecutar este down().
        Schema::dropIfExists('cash_registers');
    }
};
