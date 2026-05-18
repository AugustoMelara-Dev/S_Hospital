<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('services', function (Blueprint $table) {
            $table->string('scan_code', 120)->nullable()->after('source_hash');
            $table->string('barcode', 120)->nullable()->after('scan_code');
            $table->string('qr_code', 120)->nullable()->after('barcode');

            $table->unique('scan_code');
            $table->unique('barcode');
            $table->unique('qr_code');
            $table->index(['active', 'scan_code']);
        });
    }

    public function down(): void
    {
        Schema::table('services', function (Blueprint $table) {
            $table->dropIndex(['active', 'scan_code']);
            $table->dropUnique(['scan_code']);
            $table->dropUnique(['barcode']);
            $table->dropUnique(['qr_code']);
            $table->dropColumn(['scan_code', 'barcode', 'qr_code']);
        });
    }
};
