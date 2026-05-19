<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
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

        Schema::table('invoice_items', function (Blueprint $table) {
            $table->foreign('invoice_id')
                ->references('id')
                ->on('invoices')
                ->cascadeOnDelete();
        });
    }
};
