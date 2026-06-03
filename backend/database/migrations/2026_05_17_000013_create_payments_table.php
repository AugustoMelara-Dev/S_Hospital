<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('invoice_id')->constrained('invoices')->restrictOnDelete();
            $table->foreignId('cash_session_id')->constrained('cash_register_sessions')->restrictOnDelete();
            $table->foreignId('user_id')->constrained('users')->restrictOnDelete();
            $table->string('method', 24);
            $table->decimal('amount', 12, 2);
            $table->string('reference', 120)->nullable();
            $table->string('status', 24)->default('posted');
            $table->timestamp('paid_at');
            $table->timestamps();

            $table->index('invoice_id');
            $table->index(['cash_session_id', 'paid_at']);
            $table->index(['user_id', 'paid_at']);
            $table->index('method');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payments');
    }
};
