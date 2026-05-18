<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('services', function (Blueprint $table) {
            $table->id();
            $table->foreignId('category_id')->constrained('categories')->restrictOnDelete();
            $table->string('name');
            $table->string('slug');
            $table->string('source_key')->nullable()->unique();
            $table->string('source_hash', 64)->nullable();
            $table->decimal('price', 12, 2);
            $table->boolean('taxable')->default(true);
            $table->boolean('active')->default(true);
            $table->string('special_rule_code', 80)->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(['category_id', 'slug']);
            $table->index(['category_id', 'active']);
            $table->index(['active', 'name']);
            $table->index('special_rule_code');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('services');
    }
};
