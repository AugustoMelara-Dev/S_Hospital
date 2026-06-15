<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('operation_idempotency_keys')) {
            return;
        }

        Schema::create('operation_idempotency_keys', function (Blueprint $table): void {
            $table->id();
            $table->string('key', 120);
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('operation', 80);
            $table->string('resource_type', 120)->nullable();
            $table->unsignedBigInteger('resource_id')->nullable();
            $table->string('request_hash', 64);
            $table->timestamps();

            $table->unique(['operation', 'key']);
            $table->index(['user_id', 'operation']);
            $table->index(['resource_type', 'resource_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('operation_idempotency_keys');
    }
};
