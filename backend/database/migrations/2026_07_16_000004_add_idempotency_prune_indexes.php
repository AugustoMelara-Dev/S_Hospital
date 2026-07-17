<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('idempotency_keys', function (Blueprint $table): void {
            $table->dropIndex('idempotency_keys_completed_at_index');
            $table->index(
                ['completed_at', 'updated_at', 'id'],
                'idempotency_keys_completed_updated_id_index',
            );
        });

        Schema::table('operation_idempotency_keys', function (Blueprint $table): void {
            $table->index(['updated_at', 'id'], 'operation_idempotency_keys_updated_at_id_index');
        });
    }

    public function down(): void
    {
        Schema::table('operation_idempotency_keys', function (Blueprint $table): void {
            $table->dropIndex('operation_idempotency_keys_updated_at_id_index');
        });

        Schema::table('idempotency_keys', function (Blueprint $table): void {
            $table->dropIndex('idempotency_keys_completed_updated_id_index');
            $table->index('completed_at', 'idempotency_keys_completed_at_index');
        });
    }
};
