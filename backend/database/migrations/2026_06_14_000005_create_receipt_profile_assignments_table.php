<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('receipt_profile_assignments', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('receipt_print_profile_id')->constrained('receipt_print_profiles')->restrictOnDelete();
            $table->enum('scope_type', ['global', 'user', 'cash_session', 'cash_register']);
            $table->unsignedBigInteger('scope_id')->nullable();
            $table->boolean('active')->default(true);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['scope_type', 'scope_id', 'active'], 'receipt_profile_assignments_scope_active_index');
            $table->index('receipt_print_profile_id', 'receipt_profile_assignments_profile_id_index');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('receipt_profile_assignments');
    }
};
