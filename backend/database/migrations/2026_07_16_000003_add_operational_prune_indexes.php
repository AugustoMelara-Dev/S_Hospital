<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('audit_logs', function (Blueprint $table): void {
            $table->index(['created_at', 'id'], 'audit_logs_created_at_id_index');
        });

        Schema::table('failed_jobs', function (Blueprint $table): void {
            $table->index(['failed_at', 'id'], 'failed_jobs_failed_at_id_index');
        });
    }

    public function down(): void
    {
        Schema::table('audit_logs', function (Blueprint $table): void {
            $table->dropIndex('audit_logs_created_at_id_index');
        });

        Schema::table('failed_jobs', function (Blueprint $table): void {
            $table->dropIndex('failed_jobs_failed_at_id_index');
        });
    }
};
