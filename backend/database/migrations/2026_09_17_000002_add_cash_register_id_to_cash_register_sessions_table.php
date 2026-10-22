<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * M-W2-DB-01 (mandato §7): vincula cada sesion de caja con una caja fisica.
 *
 * - Agrega `cash_register_sessions.cash_register_id` NULLABLE (FK -> cash_registers,
 *   restrictOnDelete). Nullable para no romper instalaciones existentes ni filas
 *   previas: la asignacion historica se hace en el backfill de esta misma migracion.
 * - Conserva TODAS las columnas y constraints previos, incluido
 *   `unique(open_user_id)` (un usuario no mantiene dos sesiones abiertas a la vez).
 * - Backfill idempotente y por lotes (`chunkById`) de las sesiones existentes hacia
 *   la caja `principal`. Solo escribe `cash_register_id`; no toca montos, estados,
 *   fechas ni `updated_at`, para no alterar historia.
 *
 * El registro `principal` se garantiza con `firstOrCreate` logico (INSERT solo si
 * falta): la migracion debe poder asignar historia incluso si los seeders aun no
 * corrieron en una actualizacion. `CashRegisterSeeder` es la fuente declarativa y
 * no sobrescribe configuracion existente.
 *
 * SQLite no soporta `ALTER TABLE ... ADD CONSTRAINT`: alli se crea la columna y el
 * indice, y la FK real queda para MariaDB/MySQL (driver de produccion). El backfill
 * y los indices corren igual en ambas.
 */
return new class extends Migration
{
    private const REGISTER_CODE = 'principal';

    private const REGISTER_NAME = 'Caja principal';

    private const CHUNK_SIZE = 500;

    private const INDEX_NAME = 'cash_register_sessions_cash_register_id_index';

    private const FK_NAME = 'cash_register_sessions_cash_register_id_foreign';

    public function up(): void
    {
        if (! Schema::hasTable('cash_registers') || ! Schema::hasTable('cash_register_sessions')) {
            return;
        }

        $registerId = $this->ensurePrincipalRegister();

        if (! Schema::hasColumn('cash_register_sessions', 'cash_register_id')) {
            Schema::table('cash_register_sessions', function (Blueprint $table): void {
                $table->unsignedBigInteger('cash_register_id')->nullable();
                $table->index('cash_register_id', self::INDEX_NAME);
            });
        }

        $this->ensureForeignKey();

        $this->backfillRegisterId($registerId);
    }

    public function down(): void
    {
        if (! Schema::hasTable('cash_register_sessions')) {
            return;
        }

        if ($this->foreignKeyExists()) {
            Schema::table('cash_register_sessions', function (Blueprint $table): void {
                $table->dropForeign(self::FK_NAME);
            });
        }

        if (Schema::hasColumn('cash_register_sessions', 'cash_register_id')) {
            $this->dropIndexIfExists();

            Schema::table('cash_register_sessions', function (Blueprint $table): void {
                $table->dropColumn('cash_register_id');
            });
        }
    }

    private function ensurePrincipalRegister(): int
    {
        $existing = DB::table('cash_registers')->where('code', self::REGISTER_CODE)->value('id');

        if ($existing !== null) {
            return (int) $existing;
        }

        return (int) DB::table('cash_registers')->insertGetId([
            'code' => self::REGISTER_CODE,
            'name' => self::REGISTER_NAME,
            'active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function ensureForeignKey(): void
    {
        if (! in_array(DB::connection()->getDriverName(), ['mysql', 'mariadb'], true)) {
            // SQLite no admite agregar FK a una tabla existente; el indice plano
            // ya se creo y la cobertura real de FK corre en MariaDB.
            return;
        }

        if ($this->foreignKeyExists()) {
            return;
        }

        Schema::table('cash_register_sessions', function (Blueprint $table): void {
            $table->foreign('cash_register_id', self::FK_NAME)
                ->references('id')
                ->on('cash_registers')
                ->restrictOnDelete();
        });
    }

    private function backfillRegisterId(int $registerId): void
    {
        DB::table('cash_register_sessions')
            ->whereNull('cash_register_id')
            ->orderBy('id')
            ->chunkById(self::CHUNK_SIZE, function (Collection $rows) use ($registerId): void {
                $ids = $rows->pluck('id')->all();

                if ($ids === []) {
                    return;
                }

                DB::table('cash_register_sessions')
                    ->whereIn('id', $ids)
                    ->whereNull('cash_register_id')
                    ->update([
                        'cash_register_id' => $registerId,
                        // MariaDB con `explicit_defaults_for_timestamp=0` aplica
                        // ON UPDATE current_timestamp() al primer TIMESTAMP NOT NULL
                        // (`opened_at`). Asignar la columna a si misma inhibe el
                        // auto-update y preserva la hora de apertura historica.
                        'opened_at' => DB::raw('opened_at'),
                    ]);
            });
    }

    private function foreignKeyExists(): bool
    {
        if (! in_array(DB::connection()->getDriverName(), ['mysql', 'mariadb'], true)) {
            return false;
        }

        return DB::table('information_schema.TABLE_CONSTRAINTS')
            ->where('CONSTRAINT_SCHEMA', DB::connection()->getDatabaseName())
            ->where('TABLE_NAME', 'cash_register_sessions')
            ->where('CONSTRAINT_TYPE', 'FOREIGN KEY')
            ->where('CONSTRAINT_NAME', self::FK_NAME)
            ->exists();
    }

    private function dropIndexIfExists(): void
    {
        $driver = DB::connection()->getDriverName();

        if (in_array($driver, ['mysql', 'mariadb'], true)) {
            $exists = DB::table('information_schema.STATISTICS')
                ->where('TABLE_SCHEMA', DB::connection()->getDatabaseName())
                ->where('TABLE_NAME', 'cash_register_sessions')
                ->where('INDEX_NAME', self::INDEX_NAME)
                ->exists();

            if ($exists) {
                DB::statement('DROP INDEX `'.self::INDEX_NAME.'` ON `cash_register_sessions`');
            }

            return;
        }

        Schema::table('cash_register_sessions', function (Blueprint $table): void {
            $table->dropIndex(self::INDEX_NAME);
        });
    }
};
