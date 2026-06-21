<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! $this->isMysqlLike() || ! Schema::hasTable('cash_movements')) {
            return;
        }

        $this->dropConstraintIfExists('cash_movements', 'cash_movements_amount_nonzero');

        DB::statement(
            'ALTER TABLE `cash_movements` ADD CONSTRAINT `cash_movements_amount_nonzero` '.
            "CHECK (amount <> 0 OR type IN ('opening','closing'))"
        );
    }

    public function down(): void
    {
        if (! $this->isMysqlLike() || ! Schema::hasTable('cash_movements')) {
            return;
        }

        $this->dropConstraintIfExists('cash_movements', 'cash_movements_amount_nonzero');

        DB::statement(
            'ALTER TABLE `cash_movements` ADD CONSTRAINT `cash_movements_amount_nonzero` '.
            "CHECK (amount <> 0 OR type = 'opening')"
        );
    }

    private function isMysqlLike(): bool
    {
        return in_array(DB::connection()->getDriverName(), ['mysql', 'mariadb'], true);
    }

    private function dropConstraintIfExists(string $table, string $constraint): void
    {
        $exists = collect(DB::select(
            'SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS '.
            'WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND CONSTRAINT_NAME = ?',
            [$table, $constraint]
        ))->isNotEmpty();

        if ($exists) {
            DB::statement("ALTER TABLE `{$table}` DROP CONSTRAINT `{$constraint}`");
        }
    }
};
