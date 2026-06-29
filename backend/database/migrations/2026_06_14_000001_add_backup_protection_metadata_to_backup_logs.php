<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('backup_logs', function (Blueprint $table): void {
            $table->string('format', 32)->default('sql')->after('type');
            $table->string('compression', 32)->nullable()->after('format');
            $table->boolean('encrypted')->default(false)->after('compression');
            $table->string('encryption_key_id', 64)->nullable()->after('encrypted');
        });
    }

    public function down(): void
    {
        Schema::table('backup_logs', function (Blueprint $table): void {
            $table->dropColumn(['format', 'compression', 'encrypted', 'encryption_key_id']);
        });
    }
};
