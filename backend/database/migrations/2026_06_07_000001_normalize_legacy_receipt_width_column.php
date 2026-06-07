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
            DB::statement("ALTER TABLE fiscal_settings MODIFY receipt_width VARCHAR(32) NOT NULL DEFAULT 'half_letter'");
        }

        DB::table('fiscal_settings')
            ->whereIn('receipt_width', ['80mm', '58mm'])
            ->update(['receipt_width' => 'half_letter']);
    }

    public function down(): void
    {
        DB::table('fiscal_settings')
            ->whereNotIn('receipt_width', ['80mm', '58mm'])
            ->update(['receipt_width' => '80mm']);

        $driver = Schema::getConnection()->getDriverName();

        if (in_array($driver, ['mysql', 'mariadb'], true)) {
            DB::statement("ALTER TABLE fiscal_settings MODIFY receipt_width ENUM('80mm', '58mm') NOT NULL DEFAULT '80mm'");
        }
    }
};
