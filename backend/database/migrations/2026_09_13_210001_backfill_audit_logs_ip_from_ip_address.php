<?php

use App\Support\AuditAdmin;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * F015 / T2-032: relleno de `audit_logs.ip` desde `audit_logs.ip_address`.
 *
 * Contexto (T2-004): entre 2026-05-31 y 2026-06-09 solo existia `ip_address`;
 * despues se agrego `ip` y los escritores llenan ambas. Las filas historicas
 * pueden tener `ip = NULL` con `ip_address` presente. La lectura de la API se
 * unifico a `ip` con fallback, y este backfill deja `ip` como fuente primaria
 * sin retirar `ip_address` (fase destructiva futura).
 *
 * Solo DML de relleno: no cambia filas que ya tienen `ip`, no toca `ip_address`
 * y no elimina nada. El UPDATE corre dentro del bypass soportado
 * `@app_audit_admin_op` (App\Support\AuditAdmin) porque el trigger
 * `trg_audit_logs_no_update` es append-only; el helper restaura la variable al
 * terminar, incluso si el callback lanza.
 *
 * Fail-closed: si tras el UPDATE quedara alguna fila candidata sin rellenar, la
 * migracion aborta (no hay segundo intento silencioso).
 *
 * Rollback: irreversible por diseno. Revertir el relleno exigiria poner `ip`
 * en NULL en filas que pueden haber sido escritas legitimamente por la app;
 * perder datos de auditoria no es aceptable. `down()` es un no-op documentado.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('audit_logs')
            || ! Schema::hasColumn('audit_logs', 'ip')
            || ! Schema::hasColumn('audit_logs', 'ip_address')
        ) {
            return;
        }

        $pending = $this->pendingCount();

        if ($pending === 0) {
            return;
        }

        AuditAdmin::run(function (): void {
            DB::table('audit_logs')
                ->whereNull('ip')
                ->whereNotNull('ip_address')
                ->update(['ip' => DB::raw('`ip_address`')]);
        });

        $remaining = $this->pendingCount();

        if ($remaining > 0) {
            throw new RuntimeException(sprintf(
                'F015 fail-closed: %d fila(s) de audit_logs siguen con `ip` NULL y `ip_address` presente tras el backfill. '.
                'No se reintenta silenciosamente; investigue el estado de la tabla antes de continuar.',
                $remaining,
            ));
        }
    }

    public function down(): void
    {
        // No-op documentado: el relleno de auditoria no se revierte para no
        // borrar datos historicos. Ver docblock de la clase.
    }

    private function pendingCount(): int
    {
        return (int) DB::table('audit_logs')
            ->whereNull('ip')
            ->whereNotNull('ip_address')
            ->count();
    }
};
