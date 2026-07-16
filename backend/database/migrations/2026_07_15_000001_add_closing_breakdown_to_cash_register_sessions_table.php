<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('cash_register_sessions', 'closing_breakdown')) {
            Schema::table('cash_register_sessions', function (Blueprint $table): void {
                $table->json('closing_breakdown')->nullable()->after('closing_notes');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('cash_register_sessions', 'closing_breakdown')) {
            Schema::table('cash_register_sessions', function (Blueprint $table): void {
                $table->dropColumn('closing_breakdown');
            });
        }
    }
};
