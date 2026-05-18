<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('invoice_items', function (Blueprint $table) {
            $table->string('scan_code', 120)->nullable()->after('category_name');
            $table->string('barcode', 120)->nullable()->after('scan_code');
            $table->string('qr_code', 120)->nullable()->after('barcode');
        });
    }

    public function down(): void
    {
        Schema::table('invoice_items', function (Blueprint $table) {
            $table->dropColumn(['scan_code', 'barcode', 'qr_code']);
        });
    }
};