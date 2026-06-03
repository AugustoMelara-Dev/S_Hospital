<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('services', function (Blueprint $table) {
            $table->text('aliases')->nullable()->after('name');
            $table->boolean('visible_in_billing')->default(true)->after('active');
            $table->boolean('is_billable')->default(true)->after('visible_in_billing');

            $table->index(['active', 'visible_in_billing', 'is_billable'], 'services_billing_visibility_index');
        });
    }

    public function down(): void
    {
        Schema::table('services', function (Blueprint $table) {
            $table->dropIndex('services_billing_visibility_index');
            $table->dropColumn(['aliases', 'visible_in_billing', 'is_billable']);
        });
    }
};
