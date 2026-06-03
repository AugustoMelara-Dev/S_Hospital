<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('fiscal_sequences', function (Blueprint $table) {
            $table->id();
            $table->string('document_type')->default('invoice');
            $table->string('prefix', 32);
            $table->unsignedBigInteger('min_number');
            $table->unsignedBigInteger('max_number');
            $table->unsignedBigInteger('current_number')->default(0);
            $table->string('cai', 128);
            $table->date('valid_until');
            $table->boolean('active')->default(false)->index();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(['document_type', 'prefix', 'cai']);
            $table->index(['document_type', 'active', 'valid_until']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('fiscal_sequences');
    }
};
