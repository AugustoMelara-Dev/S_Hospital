<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            if (! Schema::hasColumn('payments', 'voided_by')) {
                $table->foreignId('voided_by')
                    ->nullable()
                    ->after('status')
                    ->constrained('users')
                    ->restrictOnDelete();
            }

            if (! Schema::hasColumn('payments', 'voided_at')) {
                $table->timestamp('voided_at')->nullable()->after('voided_by');
            }

            if (! Schema::hasColumn('payments', 'void_reason')) {
                $table->text('void_reason')->nullable()->after('voided_at');
            }
        });
    }

    public function down(): void
    {
        //
    }
};
