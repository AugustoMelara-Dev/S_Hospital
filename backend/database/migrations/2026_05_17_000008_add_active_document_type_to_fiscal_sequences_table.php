<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('fiscal_sequences', function (Blueprint $table) {
            $table->string('active_document_type', 32)->nullable()->after('active')->unique();
        });
    }

    public function down(): void
    {
        Schema::table('fiscal_sequences', function (Blueprint $table) {
            $table->dropUnique(['active_document_type']);
            $table->dropColumn('active_document_type');
        });
    }
};
