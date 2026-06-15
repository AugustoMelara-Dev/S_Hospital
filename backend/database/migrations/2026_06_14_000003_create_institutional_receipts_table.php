<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('institutional_receipts', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('invoice_id')->nullable()->constrained('invoices')->restrictOnDelete();
            $table->foreignId('payment_id')->nullable()->constrained('payments')->restrictOnDelete();
            $table->foreignId('cash_session_id')->constrained('cash_register_sessions')->restrictOnDelete();
            $table->foreignId('series_id')->constrained('institutional_receipt_series')->restrictOnDelete();
            $table->unsignedBigInteger('receipt_number');
            $table->string('receipt_number_full', 80)->unique();
            $table->enum('status', ['issued', 'void'])->default('issued');
            $table->decimal('amount', 12, 2);
            $table->unsignedBigInteger('amount_cents');
            $table->timestamp('issued_at');
            $table->foreignId('issued_by')->constrained('users')->restrictOnDelete();
            $table->string('payer_name', 180);
            $table->text('concept');
            $table->string('amount_words', 255);
            $table->string('template_code', 80);
            $table->string('print_profile_code', 80);
            $table->enum('copy_mode', ['original_only', 'original_first', 'original_first_second'])->default('original_only');
            $table->json('institution_snapshot');
            $table->json('series_snapshot');
            $table->json('profile_snapshot');
            $table->json('invoice_snapshot')->nullable();
            $table->json('payment_snapshot')->nullable();
            $table->json('items_snapshot');
            $table->string('pdf_disk', 80)->nullable();
            $table->string('pdf_path', 255)->nullable();
            $table->string('pdf_sha256', 64)->nullable();
            $table->unsignedInteger('reprint_count')->default(0);
            $table->foreignId('voided_by')->nullable()->constrained('users')->restrictOnDelete();
            $table->timestamp('voided_at')->nullable();
            $table->text('void_reason')->nullable();
            $table->timestamps();

            $table->unique(['series_id', 'receipt_number'], 'institutional_receipts_series_number_unique');
            $table->index('invoice_id');
            $table->index('payment_id');
            $table->index('cash_session_id');
            $table->index('status');
            $table->index('issued_at');
            $table->index(['print_profile_code', 'issued_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('institutional_receipts');
    }
};
