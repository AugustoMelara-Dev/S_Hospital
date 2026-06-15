<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! in_array(DB::connection()->getDriverName(), ['mysql', 'mariadb'], true)) {
            return;
        }

        if (Schema::hasTable('idempotency_keys') && Schema::hasColumn('idempotency_keys', 'user_id')) {
            Schema::table('idempotency_keys', function (Blueprint $table): void {
                $table->dropForeign('idempotency_keys_user_id_foreign');
                $table->foreign('user_id', 'idempotency_keys_user_id_foreign')
                    ->references('id')
                    ->on('users')
                    ->restrictOnDelete();
            });
        }

        if (Schema::hasTable('operation_idempotency_keys') && Schema::hasColumn('operation_idempotency_keys', 'user_id')) {
            Schema::table('operation_idempotency_keys', function (Blueprint $table): void {
                $table->dropForeign('operation_idempotency_keys_user_id_foreign');
                $table->foreign('user_id', 'operation_idempotency_keys_user_id_foreign')
                    ->references('id')
                    ->on('users')
                    ->restrictOnDelete();
            });
        }

        if (Schema::hasTable('payments') && Schema::hasColumn('payments', 'voided_by')) {
            Schema::table('payments', function (Blueprint $table): void {
                $table->dropForeign('payments_voided_by_foreign');
                $table->foreign('voided_by', 'payments_voided_by_foreign')
                    ->references('id')
                    ->on('users')
                    ->restrictOnDelete();
            });
        }
    }

    public function down(): void
    {
        //
    }
};
