<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const INDEX = 'backup_logs_status_completed_at_id_index';

    public function up(): void
    {
        Schema::table('backup_logs', function (Blueprint $table): void {
            $table->index(['status', 'completed_at', 'id'], self::INDEX);
        });
    }

    public function down(): void
    {
        Schema::table('backup_logs', function (Blueprint $table): void {
            $table->dropIndex(self::INDEX);
        });
    }
};
