<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        if ($this->driverSupportsPartialIndex()) {
            DB::statement('CREATE UNIQUE INDEX idx_single_active_per_document ON fiscal_sequences (document_type) WHERE active = 1');
        }
    }

    public function down(): void
    {
        if ($this->driverSupportsPartialIndex()) {
            DB::statement('DROP INDEX idx_single_active_per_document ON fiscal_sequences');
        }
    }

    private function driverSupportsPartialIndex(): bool
    {
        $driver = DB::connection()->getDriverName();

        return $driver === 'mysql' || $driver === 'mariadb';
    }
};
