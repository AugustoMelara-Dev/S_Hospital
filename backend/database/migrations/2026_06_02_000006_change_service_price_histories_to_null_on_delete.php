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
            $table->foreignId('service_id')->nullable()->change();
            $table->foreign('service_id')
                ->nullOnDelete()
                ->references('id')
                ->on('services');
        });
    }

    public function down(): void
    {
        // The previous `down()` re-created the FK with `cascadeOnDelete()`,
        // which would cascade-delete the entire price history of a service
        // when the service is deleted. That destroys audit-grade price
        // snapshots used in historical invoice items.
        //
        // Keep `nullOnDelete()` on rollback: the price history row stays,
        // `service_id` is already nullable, and the audit trail is preserved.
        // If a stricter behaviour is ever required, use a NEW forward-only
        // migration rather than overloading this `down()`.
        Schema::table('service_price_histories', function (Blueprint $table) {
            $table->dropForeign(['service_id']);
            $table->foreign('service_id')
                ->nullOnDelete()
                ->references('id')
                ->on('services');
        });
    }
};
