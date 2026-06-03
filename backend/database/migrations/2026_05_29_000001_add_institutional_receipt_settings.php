<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('fiscal_settings', function (Blueprint $table) {
            $table->boolean('scanner_enabled')->default(false)->after('slogan');
            $table->boolean('partial_payments_enabled')->default(false)->after('scanner_enabled');
            $table->string('receipt_template_mode', 32)->default('institutional')->after('partial_payments_enabled');
            $table->string('receipt_paper_size', 32)->default('half_letter')->after('receipt_template_mode');
            $table->string('government_line', 120)->nullable()->after('receipt_paper_size');
            $table->string('secretariat_line', 160)->nullable()->after('government_line');
            $table->string('receipt_location', 160)->nullable()->after('secretariat_line');
            $table->string('receipt_footer_text', 255)->nullable()->after('receipt_location');
        });

        Schema::table('invoices', function (Blueprint $table) {
            $table->string('hospital_address', 255)->nullable()->after('hospital_rtn');
            $table->string('hospital_slogan', 255)->nullable()->after('hospital_address');
            $table->string('receipt_template_mode', 32)->nullable()->after('hospital_slogan');
            $table->string('receipt_paper_size', 32)->nullable()->after('receipt_template_mode');
            $table->string('receipt_government_line', 120)->nullable()->after('receipt_paper_size');
            $table->string('receipt_secretariat_line', 160)->nullable()->after('receipt_government_line');
            $table->string('receipt_location', 160)->nullable()->after('receipt_secretariat_line');
            $table->string('receipt_footer_text', 255)->nullable()->after('receipt_location');
            $table->string('tax_label', 32)->default('ISV')->after('receipt_footer_text');
            $table->decimal('tax_rate_snapshot', 5, 2)->nullable()->after('tax_label');
        });
    }

    public function down(): void
    {
        Schema::table('invoices', function (Blueprint $table) {
            $table->dropColumn([
                'hospital_address',
                'hospital_slogan',
                'receipt_template_mode',
                'receipt_paper_size',
                'receipt_government_line',
                'receipt_secretariat_line',
                'receipt_location',
                'receipt_footer_text',
                'tax_label',
                'tax_rate_snapshot',
            ]);
        });

        Schema::table('fiscal_settings', function (Blueprint $table) {
            $table->dropColumn([
                'scanner_enabled',
                'partial_payments_enabled',
                'receipt_template_mode',
                'receipt_paper_size',
                'government_line',
                'secretariat_line',
                'receipt_location',
                'receipt_footer_text',
            ]);
        });
    }
};
