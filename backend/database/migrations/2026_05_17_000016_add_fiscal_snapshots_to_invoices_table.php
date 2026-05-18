<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('invoices', function (Blueprint $table) {
            $table->string('fiscal_cai')->nullable()->after('fiscal_sequence_id');
            $table->string('fiscal_range_from')->nullable()->after('fiscal_cai');
            $table->string('fiscal_range_to')->nullable()->after('fiscal_range_from');
            $table->date('fiscal_valid_until')->nullable()->after('fiscal_range_to');
            $table->string('fiscal_prefix', 32)->nullable()->after('fiscal_valid_until');
            $table->string('hospital_name')->nullable()->after('fiscal_prefix');
            $table->string('hospital_rtn', 32)->nullable()->after('hospital_name');
        });
    }

    public function down(): void
    {
        Schema::table('invoices', function (Blueprint $table) {
            $table->dropColumn([
                'fiscal_cai',
                'fiscal_range_from',
                'fiscal_range_to',
                'fiscal_valid_until',
                'fiscal_prefix',
                'hospital_name',
                'hospital_rtn',
            ]);
        });
    }
};
