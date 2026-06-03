<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('fiscal_settings', function (Blueprint $table) {
            $table->string('primary_color', 32)->default('indigo')->after('receipt_width');
            $table->string('address', 255)->nullable()->after('primary_color');
            $table->string('slogan', 255)->nullable()->after('address');
        });
    }

    public function down(): void
    {
        Schema::table('fiscal_settings', function (Blueprint $table) {
            $table->dropColumn(['primary_color', 'address', 'slogan']);
        });
    }
};
