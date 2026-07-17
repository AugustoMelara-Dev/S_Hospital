<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('login_attempts', function (Blueprint $table): void {
            $table->index(['attempted_at', 'id'], 'login_attempts_attempted_at_id_index');
        });

        Schema::table('client_error_logs', function (Blueprint $table): void {
            $table->dropIndex('client_error_logs_occurred_at_index');
            $table->index(['occurred_at', 'id'], 'client_error_logs_occurred_at_id_index');
        });
    }

    public function down(): void
    {
        Schema::table('client_error_logs', function (Blueprint $table): void {
            $table->dropIndex('client_error_logs_occurred_at_id_index');
            $table->index('occurred_at', 'client_error_logs_occurred_at_index');
        });

        Schema::table('login_attempts', function (Blueprint $table): void {
            $table->dropIndex('login_attempts_attempted_at_id_index');
        });
    }
};
