<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->foreignId('area_id')
                ->nullable()
                ->after('active')
                ->constrained('areas')
                ->nullOnDelete();

            $table->index(['area_id', 'active']);
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->dropIndex(['area_id', 'active']);
            $table->dropConstrainedForeignId('area_id');
        });
    }
};
