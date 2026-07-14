<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('cash_register_sessions', 'closed_by_user_id')) {
            Schema::table('cash_register_sessions', function (Blueprint $table) {
                $table->foreignId('closed_by_user_id')
                    ->nullable()
                    ->after('open_user_id')
                    ->constrained('users')
                    ->restrictOnDelete();

                $table->index(['closed_by_user_id', 'closed_at']);
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('cash_register_sessions', 'closed_by_user_id')) {
            Schema::table('cash_register_sessions', function (Blueprint $table) {
                $table->dropIndex(['closed_by_user_id', 'closed_at']);
                $table->dropConstrainedForeignId('closed_by_user_id');
            });
        }
    }
};
