<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('services', function (Blueprint $table): void {
            $table->foreignId('area_id')
                ->nullable()
                ->after('category_id')
                ->constrained('service_areas')
                ->nullOnDelete();
            $table->json('aliases')->nullable()->after('qr_code');
            $table->string('description', 255)->nullable()->after('aliases');
            $table->string('internal_code', 80)->nullable()->unique()->after('description');
            $table->boolean('print_on_receipt')->default(true)->after('special_rule_code');
            $table->boolean('visible_in_billing')->default(true)->after('print_on_receipt');
            $table->boolean('is_billable')->default(true)->after('visible_in_billing');

            $table->index(['area_id', 'active']);
            $table->index(['visible_in_billing', 'is_billable', 'active']);
        });
    }

    public function down(): void
    {
        Schema::table('services', function (Blueprint $table): void {
            $table->dropIndex(['area_id', 'active']);
            $table->dropIndex(['visible_in_billing', 'is_billable', 'active']);
            $table->dropForeign(['area_id']);
            $table->dropColumn([
                'area_id',
                'aliases',
                'description',
                'internal_code',
                'print_on_receipt',
                'visible_in_billing',
                'is_billable',
            ]);
        });
    }
};
