<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * History: the original `2026_05_17_000010_create_invoice_items_table.php`
     * already declared `restrictOnDelete()` on `invoice_items.invoice_id`.
     * This migration is a no-op defense layer: it re-applies the same
     * restriction in case the FK is ever rebuilt by a hotfix or a different
     * driver. Critically, the `down()` MUST keep `restrictOnDelete()`.
     *
     * The previous `down()` re-created the FK with `cascadeOnDelete()`,
     * which silently destroys historical invoice line snapshots if anyone
     * ever runs `migrate:rollback` against this migration. AGENTS.md
     * explicitly states: "no borrar facturas" and "Guardar snapshots
     * de precios y nombres en invoice_items; nunca recalcular facturas
     * historicas desde services."
     */
    public function up(): void
    {
        if (DB::getDriverName() === 'sqlite') {
            return;
        }

        Schema::table('invoice_items', function (Blueprint $table) {
            $table->dropForeign(['invoice_id']);
        });

        Schema::table('invoice_items', function (Blueprint $table) {
            $table->foreign('invoice_id')
                ->references('id')
                ->on('invoices')
                ->restrictOnDelete();
        });
    }

    public function down(): void
    {
        if (DB::getDriverName() === 'sqlite') {
            return;
        }

        Schema::table('invoice_items', function (Blueprint $table) {
            $table->dropForeign(['invoice_id']);
        });

        // Intentionally keep restrictOnDelete() to preserve the AGENTS.md
        // contract: invoice line snapshots must never be cascade-deleted
        // with their parent invoice. A rollback must not destroy evidence.
        Schema::table('invoice_items', function (Blueprint $table) {
            $table->foreign('invoice_id')
                ->references('id')
                ->on('invoices')
                ->restrictOnDelete();
        });
    }
};
