<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('fiscal_settings', 'phone')) {
            Schema::table('fiscal_settings', function (Blueprint $table): void {
                $table->string('phone', 64)->nullable()->after('address');
            });
        }

        if (! Schema::hasColumn('invoices', 'hospital_phone')) {
            Schema::table('invoices', function (Blueprint $table): void {
                $table->string('hospital_phone', 64)->nullable()->after('hospital_address');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('invoices', 'hospital_phone')) {
            Schema::table('invoices', function (Blueprint $table): void {
                $table->dropColumn('hospital_phone');
            });
        }

        if (Schema::hasColumn('fiscal_settings', 'phone')) {
            Schema::table('fiscal_settings', function (Blueprint $table): void {
                $table->dropColumn('phone');
            });
        }
    }
};
