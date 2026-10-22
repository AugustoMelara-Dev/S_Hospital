<?php

use App\Support\AuditAdmin;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Corrige `audit_logs.result` en filas legacy donde la accion ya denotaba
 * fallo (`*.failed` / `*.error`) pero el resultado quedo en 'success'.
 *
 * Escenario de upgrade: el trigger append-only `trg_audit_logs_no_update`
 * (instalado por 2026_06_09_000001) ya existe y hay filas candidatas; sin
 * bypass, el UPDATE aborta con SQLSTATE 45000 (1644). Por eso el DML corre
 * dentro del bypass soportado `App\Support\AuditAdmin`, que fija
 * `@app_audit_admin_op = 1` solo durante el callback y lo resetea en `finally`
 * (mismo patron que 2026_09_13_210001_backfill_audit_logs_ip_from_ip_address).
 *
 * Fail-closed: no hay catch; si el bypass no puede aplicarse (el SET falla o el
 * UPDATE es rechazado por el trigger), la excepcion aborta la migracion y queda
 * visible. El backfill no puede quedar a medias porque es una sola sentencia
 * UPDATE: MariaDB/MySQL la ejecuta de forma atomica (todas las filas o
 * ninguna); no existe un segundo paso silencioso que completar.
 *
 * Instalacion limpia: con `audit_logs` vacia la sentencia no modifica filas,
 * por lo que el resultado es identico al de antes del fix (migracion aplicada,
 * cero cambios) y no requiere ningun dato legacy.
 *
 * Rollback: correccion de datos irreversible. Revertir a 'success' filas con
 * accion *.failed/*.error corromperia registros legitimos de fallo; `down()`
 * es un no-op documentado.
 */
return new class extends Migration
{
    public function up(): void
    {
        AuditAdmin::run(static function (): void {
            DB::table('audit_logs')
                ->where('result', 'success')
                ->where(static function ($query): void {
                    $query->where('action', 'like', '%.failed')
                        ->orWhere('action', 'like', '%.error');
                })
                ->update(['result' => 'failed']);
        });
    }

    public function down(): void
    {
        // Data correction is intentionally irreversible: reverting every
        // matching action to success would corrupt legitimate failure records.
    }
};
