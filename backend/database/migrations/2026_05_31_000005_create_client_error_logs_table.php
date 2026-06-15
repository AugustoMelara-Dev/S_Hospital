<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('client_error_logs')) {
            return;
        }

        Schema::create('client_error_logs', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('event_type', 80);
            $table->string('severity', 20);
            $table->string('safe_message', 500);
            $table->string('technical_code', 80)->nullable();
            $table->string('route', 180)->nullable();
            $table->unsignedSmallInteger('status_code')->nullable();
            $table->json('context_json')->nullable();
            $table->timestamp('occurred_at');
            $table->timestamps();

            $table->index('occurred_at');
            $table->index(['severity', 'occurred_at']);
            $table->index(['user_id', 'occurred_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('client_error_logs');
    }
};
