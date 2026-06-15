<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('institutional_receipts')) {
            return;
        }

        $driver = DB::connection()->getDriverName();

        if (in_array($driver, ['mysql', 'mariadb'], true)) {
            if (! Schema::hasColumn('institutional_receipts', 'issued_invoice_id')) {
                DB::statement(
                    "ALTER TABLE institutional_receipts
                    ADD issued_invoice_id BIGINT UNSIGNED
                    GENERATED ALWAYS AS (
                        CASE WHEN status = 'issued' THEN invoice_id ELSE NULL END
                    ) STORED"
                );
            }

            if (! $this->indexExists('institutional_receipts', 'institutional_receipts_one_issued_per_invoice')) {
                DB::statement(
                    'CREATE UNIQUE INDEX institutional_receipts_one_issued_per_invoice
                    ON institutional_receipts (issued_invoice_id)'
                );
            }
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable('institutional_receipts')) {
            return;
        }

        $driver = DB::connection()->getDriverName();

        if (in_array($driver, ['mysql', 'mariadb'], true)) {
            if ($this->indexExists('institutional_receipts', 'institutional_receipts_one_issued_per_invoice')) {
                DB::statement('DROP INDEX institutional_receipts_one_issued_per_invoice ON institutional_receipts');
            }

            if (Schema::hasColumn('institutional_receipts', 'issued_invoice_id')) {
                DB::statement('ALTER TABLE institutional_receipts DROP COLUMN issued_invoice_id');
            }
        }
    }

    private function indexExists(string $table, string $indexName): bool
    {
        $database = DB::connection()->getDatabaseName();

        return DB::table('information_schema.STATISTICS')
            ->where('TABLE_SCHEMA', $database)
            ->where('TABLE_NAME', $table)
            ->where('INDEX_NAME', $indexName)
            ->exists();
    }
};
