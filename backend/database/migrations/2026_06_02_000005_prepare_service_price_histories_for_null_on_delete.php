<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $driver = Schema::getConnection()->getDriverName();

        if (in_array($driver, ['mysql', 'mariadb'], true)) {
            DB::statement('ALTER TABLE service_price_histories MODIFY service_id BIGINT UNSIGNED NULL');
        }
    }

    public function down(): void
    {
        // Preserve historical rows whose service was deleted after SET NULL became active.
    }
};
