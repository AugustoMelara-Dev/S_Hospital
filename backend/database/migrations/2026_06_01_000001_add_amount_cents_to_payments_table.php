<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->bigInteger('amount_cents')->after('amount')->nullable();
        });

        DB::table('payments')->whereNotNull('amount')->update([
            'amount_cents' => DB::raw('CAST(amount * 100 AS SIGNED)'),
        ]);

        Schema::table('payments', function (Blueprint $table) {
            $table->bigInteger('amount_cents')->nullable(false)->change();
        });
    }

    public function down(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->dropColumn('amount_cents');
        });
    }
};