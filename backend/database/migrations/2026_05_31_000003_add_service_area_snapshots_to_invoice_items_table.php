<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('invoice_items', function (Blueprint $table): void {
            $table->foreignId('service_area_id')
                ->nullable()
                ->after('category_name')
                ->constrained('service_areas')
                ->nullOnDelete();
            $table->string('service_area_name', 120)->nullable()->after('service_area_id');

            $table->index('service_area_id');
            $table->index('service_area_name');
        });
    }

    public function down(): void
    {
        Schema::table('invoice_items', function (Blueprint $table): void {
            $table->dropIndex(['service_area_id']);
            $table->dropIndex(['service_area_name']);
            $table->dropForeign(['service_area_id']);
            $table->dropColumn(['service_area_id', 'service_area_name']);
        });
    }
};
