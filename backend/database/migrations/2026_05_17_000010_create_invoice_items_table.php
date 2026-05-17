<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('invoice_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('invoice_id')->constrained('invoices')->cascadeOnDelete();
            $table->foreignId('service_id')->nullable()->constrained('services')->nullOnDelete();
            $table->string('service_name', 180);
            $table->foreignId('category_id')->nullable()->constrained('categories')->nullOnDelete();
            $table->string('category_name', 180);
            $table->decimal('quantity', 10, 2);
            $table->decimal('unit_price', 12, 2);
            $table->decimal('tax_rate', 5, 2);
            $table->decimal('tax_amount', 12, 2);
            $table->decimal('line_subtotal', 12, 2);
            $table->decimal('line_total', 12, 2);
            $table->string('special_rule_code', 80)->nullable();
            $table->boolean('special_rule_applied')->default(false);
            $table->string('notes', 255)->nullable();
            $table->timestamps();

            $table->index('service_id');
            $table->index('category_id');
            $table->index('special_rule_code');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('invoice_items');
    }
};
