<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if ($this->usesMysqlDriver()) {
            if ($this->foreignKeyExists('service_price_histories_service_id_foreign')) {
                DB::statement('ALTER TABLE service_price_histories DROP FOREIGN KEY service_price_histories_service_id_foreign');
            }

            DB::statement('ALTER TABLE service_price_histories ADD CONSTRAINT service_price_histories_service_id_foreign FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE SET NULL');

            return;
        }

        Schema::table('service_price_histories', function (Blueprint $table) {
            $table->dropForeign(['service_id']);
            $table->foreign('service_id')
                ->nullOnDelete()
                ->references('id')
                ->on('services');
        });
    }

    public function down(): void
    {
        if ($this->usesMysqlDriver()) {
            if ($this->foreignKeyExists('service_price_histories_service_id_foreign')) {
                DB::statement('ALTER TABLE service_price_histories DROP FOREIGN KEY service_price_histories_service_id_foreign');
            }

            DB::statement('ALTER TABLE service_price_histories ADD CONSTRAINT service_price_histories_service_id_foreign FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE');

            return;
        }

        Schema::table('service_price_histories', function (Blueprint $table) {
            $table->dropForeign(['service_id']);
            $table->foreign('service_id')
                ->cascadeOnDelete()
                ->references('id')
                ->on('services');
        });
    }

    private function usesMysqlDriver(): bool
    {
        return in_array(Schema::getConnection()->getDriverName(), ['mysql', 'mariadb'], true);
    }

    private function foreignKeyExists(string $constraintName): bool
    {
        return DB::table('information_schema.TABLE_CONSTRAINTS')
            ->where('CONSTRAINT_SCHEMA', DB::getDatabaseName())
            ->where('TABLE_NAME', 'service_price_histories')
            ->where('CONSTRAINT_NAME', $constraintName)
            ->where('CONSTRAINT_TYPE', 'FOREIGN KEY')
            ->exists();
    }
};
