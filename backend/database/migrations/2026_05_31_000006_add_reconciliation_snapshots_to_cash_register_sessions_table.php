<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('cash_register_sessions', function (Blueprint $table) {
            $table->unsignedInteger('payments_count_snapshot')->nullable()->after('difference_amount');
            $table->decimal('payments_total_snapshot', 12, 2)->nullable()->after('payments_count_snapshot');
            $table->json('method_totals_snapshot')->nullable()->after('payments_total_snapshot');
            $table->unsignedInteger('pending_invoice_count_snapshot')->nullable()->after('method_totals_snapshot');
            $table->decimal('pending_amount_snapshot', 12, 2)->nullable()->after('pending_invoice_count_snapshot');
        });
    }

    public function down(): void
    {
        Schema::table('cash_register_sessions', function (Blueprint $table) {
            $table->dropColumn([
                'payments_count_snapshot',
                'payments_total_snapshot',
                'method_totals_snapshot',
                'pending_invoice_count_snapshot',
                'pending_amount_snapshot',
            ]);
        });
    }
};
