<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tax_rates', function (Blueprint $table) {
            $table->id();
            $table->string('name', 60);
            $table->decimal('percentage', 5, 2);
            $table->boolean('active')->default(true);
            $table->boolean('is_default')->default(false);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index('active');
            $table->index('is_default');
        });

        Schema::table('services', function (Blueprint $table) {
            // NULL = exempt. Existing invoices keep their per-item snapshot.
            $table->foreignId('tax_rate_id')->nullable()->after('taxable')
                ->constrained('tax_rates')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('services', function (Blueprint $table) {
            $table->dropConstrainedForeignId('tax_rate_id');
        });

        Schema::dropIfExists('tax_rates');
    }
};
