<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('service_price_histories', function (Blueprint $table) {
            $table->dropForeign(['service_id']);
            $table->foreign('service_id')
                ->nullOnDelete()
                ->references('id')
                ->on('services');
        });
    }

    public function down(): void
    {
        Schema::table('service_price_histories', function (Blueprint $table) {
            $table->dropForeign(['service_id']);
            $table->foreign('service_id')
                ->cascadeOnDelete()
                ->references('id')
                ->on('services');
        });
    }
};
