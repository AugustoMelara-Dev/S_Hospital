<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('institutional_receipt_print_events', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('institutional_receipt_id')
                ->nullable()
                ->constrained('institutional_receipts')
                ->restrictOnDelete();
            $table->enum('event_type', ['issued_print', 'reprint', 'test_print', 'pdf_generated']);
            $table->string('copy_label', 40)->nullable();
            $table->json('profile_snapshot')->nullable();
            $table->text('reason')->nullable();
            $table->foreignId('user_id')->nullable()->constrained('users')->restrictOnDelete();
            $table->timestamp('created_at')->nullable();

            $table->index('institutional_receipt_id', 'receipt_print_events_receipt_id_index');
            $table->index('event_type');
            $table->index(['user_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('institutional_receipt_print_events');
    }
};
