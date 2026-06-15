<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('audit_logs', function (Blueprint $table): void {
            $table->string('result', 20)->default('success')->after('action');
            $table->text('reason')->nullable()->after('new_values');
            $table->string('ip_address', 64)->nullable()->after('reason');
            $table->text('user_agent')->nullable()->after('ip_address');

            $table->index(['result', 'created_at']);
            $table->index(['user_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::table('audit_logs', function (Blueprint $table): void {
            $table->dropIndex(['result', 'created_at']);
            $table->dropIndex(['user_id', 'created_at']);
            $table->dropColumn(['result', 'reason', 'ip_address', 'user_agent']);
        });
    }
};
