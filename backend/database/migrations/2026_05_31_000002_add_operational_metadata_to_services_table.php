<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('services', function (Blueprint $table): void {
            if (! Schema::hasColumn('services', 'aliases')) {
                $table->text('aliases')->nullable()->after('qr_code');
            }

            if (! Schema::hasColumn('services', 'description')) {
                $table->string('description', 255)->nullable()->after('aliases');
            }

            if (! Schema::hasColumn('services', 'internal_code')) {
                $table->string('internal_code', 80)->nullable()->unique()->after('description');
            }

            if (! Schema::hasColumn('services', 'print_on_receipt')) {
                $table->boolean('print_on_receipt')->default(true)->after('special_rule_code');
            }

            if (! Schema::hasColumn('services', 'visible_in_billing')) {
                $table->boolean('visible_in_billing')->default(true)->after('print_on_receipt');
            }

            if (! Schema::hasColumn('services', 'is_billable')) {
                $table->boolean('is_billable')->default(true)->after('visible_in_billing');
            }

            $table->index(['visible_in_billing', 'is_billable', 'active']);
        });
    }

    public function down(): void
    {
        Schema::table('services', function (Blueprint $table): void {
            $table->dropIndex(['visible_in_billing', 'is_billable', 'active']);

            foreach (['description', 'internal_code', 'print_on_receipt'] as $column) {
                if (Schema::hasColumn('services', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
