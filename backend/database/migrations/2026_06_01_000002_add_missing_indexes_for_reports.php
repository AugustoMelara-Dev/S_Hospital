<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('cash_movements', function (Blueprint $table) {
            $table->index('user_id', 'cash_movements_user_id_index');
        });

        Schema::table('invoices', function (Blueprint $table) {
            $table->index(['cash_session_id', 'status'], 'invoices_session_status_index');
        });
    }

    public function down(): void
    {
        Schema::table('cash_movements', function (Blueprint $table) {
            $table->dropIndex('cash_movements_user_id_index');
        });

        Schema::table('invoices', function (Blueprint $table) {
            $table->dropIndex('invoices_session_status_index');
        });
    }
};
