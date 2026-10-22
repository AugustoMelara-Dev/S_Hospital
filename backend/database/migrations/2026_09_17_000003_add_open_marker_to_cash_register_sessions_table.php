<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * M-W2-DB-01 (mandato §7 y §15): guard real de "una caja abierta por caja".
 *
 * `open_marker` es NULL cuando la sesion esta cerrada y 1 cuando esta abierta.
 * El indice UNIQUE `(cash_register_id, open_marker)` aprovecha que en MariaDB y
 * SQLite los NULL multiples no colisionan: permite N sesiones cerradas por caja y
 * exactamente UNA abierta por caja. Reemplaza la restriccion global historica
 * (una sola caja abierta en todo el sistema) por una del alcance correcto, SIN
 * borrar el lock: se conserva `unique(open_user_id)` para que un usuario no
 * mantenga dos sesiones abiertas a la vez.
 *
 * Fail-closed: si el backfill encontrara dos sesiones abiertas para la misma caja
 * (legacy ambiguo), la migracion aborta con mensaje claro en vez de elegir cual
 * sigue vigente. No se modifica dinero ni fechas, y no se borra ninguna columna.
 *
 * Idempotente: columnas, normalizacion de marcadores e indice estan guardados por
 * introspeccion; re-ejecutar tras corregir datos es seguro.
 */
return new class extends Migration
{
    private const UNIQUE_INDEX = 'cash_register_sessions_register_open_unique';

    public function up(): void
    {
        if (! $this->schemaReady()) {
            return;
        }

        if (! Schema::hasColumn('cash_register_sessions', 'open_marker')) {
            Schema::table('cash_register_sessions', function (Blueprint $table): void {
                $table->unsignedTinyInteger('open_marker')->nullable();
            });
        }

        $this->assertOpenSessionsAreScoped();
        $this->assertNoDuplicateOpenPerRegister();
        $this->alignOpenMarkers();

        if (! $this->uniqueIndexExists()) {
            Schema::table('cash_register_sessions', function (Blueprint $table): void {
                $table->unique(['cash_register_id', 'open_marker'], self::UNIQUE_INDEX);
            });
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable('cash_register_sessions')) {
            return;
        }

        if ($this->uniqueIndexExists()) {
            Schema::table('cash_register_sessions', function (Blueprint $table): void {
                $table->dropUnique(self::UNIQUE_INDEX);
            });
        }

        if (Schema::hasColumn('cash_register_sessions', 'open_marker')) {
            Schema::table('cash_register_sessions', function (Blueprint $table): void {
                $table->dropColumn('open_marker');
            });
        }
    }

    private function schemaReady(): bool
    {
        return Schema::hasTable('cash_register_sessions')
            && Schema::hasColumn('cash_register_sessions', 'cash_register_id');
    }

    /**
     * Un indice unico con `cash_register_id` NULL no protege nada: los NULL
     * multiples lo esquivan. El backfill de 2026_09_17_000002 debe haber asignado
     * todas las sesiones a una caja antes de crear el guard.
     */
    private function assertOpenSessionsAreScoped(): void
    {
        $unscoped = (int) DB::table('cash_register_sessions')
            ->where('status', 'open')
            ->whereNull('cash_register_id')
            ->count();

        if ($unscoped > 0) {
            throw new RuntimeException(
                'M-W2-DB-01 fail-closed: hay '.$unscoped.' sesion(es) de caja abiertas sin caja asignada. '.
                'No se crea el indice unico (cash_register_id, open_marker) porque no protegeria sesiones sin caja. '.
                'Asigne una caja a esas sesiones y re-ejecute la migracion.'
            );
        }
    }

    private function assertNoDuplicateOpenPerRegister(): void
    {
        $duplicates = DB::table('cash_register_sessions')
            ->selectRaw('cash_register_id, COUNT(*) AS open_count')
            ->where('status', 'open')
            ->whereNotNull('cash_register_id')
            ->groupBy('cash_register_id')
            ->havingRaw('COUNT(*) > 1')
            ->get();

        if ($duplicates->isNotEmpty()) {
            $detail = $duplicates
                ->map(fn (object $row): string => 'caja '.$row->cash_register_id.' con '.$row->open_count.' abiertas')
                ->implode('; ');

            throw new RuntimeException(
                'M-W2-DB-01 fail-closed: existe mas de una sesion de caja abierta para la misma caja ('.$detail.'). '.
                'El indice unico (cash_register_id, open_marker) requiere una sola abierta por caja. '.
                'Cierre o reconcilie las sesiones duplicadas y re-ejecute la migracion; no se altera historia automaticamente.'
            );
        }
    }

    private function alignOpenMarkers(): void
    {
        // Abierta => 1; cerrada => NULL. Solo escribe filas que lo necesitan, para
        // no tocar `updated_at` de sesiones ya alineadas. `opened_at` se asigna a
        // si mismo porque MariaDB con explicit_defaults_for_timestamp=0 aplica
        // ON UPDATE current_timestamp() al primer TIMESTAMP NOT NULL; sin esto un
        // backfill de esquema alteraria la hora de apertura historica.
        DB::table('cash_register_sessions')
            ->where('status', 'open')
            ->whereNull('open_marker')
            ->update([
                'open_marker' => 1,
                'opened_at' => DB::raw('opened_at'),
            ]);

        DB::table('cash_register_sessions')
            ->where('status', '!=', 'open')
            ->whereNotNull('open_marker')
            ->update([
                'open_marker' => null,
                'opened_at' => DB::raw('opened_at'),
            ]);
    }

    private function uniqueIndexExists(): bool
    {
        if (in_array(DB::connection()->getDriverName(), ['mysql', 'mariadb'], true)) {
            return DB::table('information_schema.STATISTICS')
                ->where('TABLE_SCHEMA', DB::connection()->getDatabaseName())
                ->where('TABLE_NAME', 'cash_register_sessions')
                ->where('INDEX_NAME', self::UNIQUE_INDEX)
                ->exists();
        }

        $indexes = DB::select(
            "SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'cash_register_sessions'"
        );

        foreach ($indexes as $index) {
            if (($index->name ?? null) === self::UNIQUE_INDEX) {
                return true;
            }
        }

        return false;
    }
};
