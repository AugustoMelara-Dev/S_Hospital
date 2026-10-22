<?php

declare(strict_types=1);

namespace Tests\Feature\Migrations;

use App\Support\AuditAdmin;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use ReflectionMethod;
use RuntimeException;
use Tests\TestCase;

/**
 * T3-015 / HS-DB-MIG-1644: auto-suficiencia de
 * `2026_07_16_000001_backfill_audit_failure_results`.
 *
 * El escenario de upgrade real es: el trigger append-only
 * `trg_audit_logs_no_update` (instalado por 2026_06_09_000001) ya existe y
 * `audit_logs` contiene filas legacy con `result = 'success'` pero `action`
 * con sufijo `*.failed` / `*.error`. En ese estado, `up()` debe aplicar el
 * bypass soportado `App\Support\AuditAdmin` por si misma.
 *
 * El test principal llama `$migration->up()` DIRECTO, sin envolverlo en
 * `AuditAdmin::run`: si la migracion dependiera de que el llamador aplique el
 * bypass (patron anterior), fallaria con SQLSTATE 45000 (1644) como en la fase
 * roja documentada de T3-015.
 *
 * SQLite (suite rapida) no instala triggers: las comprobaciones de trigger y
 * flag de sesion son driver-aware y no agregan skips en MariaDB.
 */
class AuditFailureBackfillMigrationTest extends TestCase
{
    use RefreshDatabase;

    public function test_up_backfills_candidates_directly_with_append_only_trigger_installed(): void
    {
        if ($this->usesAppendOnlyTrigger()) {
            $this->assertSame(
                1,
                $this->updateTriggerCount(),
                'Escenario de upgrade: trg_audit_logs_no_update debe existir para probar la auto-suficiencia bajo el trigger append-only.',
            );
        }

        $failed = $this->insertAuditRow([
            'action' => 'backup.failed',
            'created_at' => '2026-07-01 08:15:30',
        ]);
        $error = $this->insertAuditRow([
            'action' => 'invoice.error',
            'created_at' => '2026-07-01 08:16:00',
        ]);
        $created = $this->insertAuditRow([
            'action' => 'backup.created',
            'created_at' => '2026-07-01 08:17:00',
        ]);
        $alreadyFailed = $this->insertAuditRow([
            'action' => 'backup.failed',
            'result' => 'failed',
            'created_at' => '2026-07-01 08:18:00',
        ]);
        $suffixMismatch = $this->insertAuditRow([
            'action' => 'backup.failed.extra',
            'created_at' => '2026-07-01 08:19:00',
        ]);
        $prefixMismatch = $this->insertAuditRow([
            'action' => 'error.backup',
            'created_at' => '2026-07-01 08:20:00',
        ]);

        $rowsBefore = (int) DB::table('audit_logs')->count();

        // Llamada directa, sin `AuditAdmin::run` externo: el objeto del test es
        // que la migracion sea auto-suficiente en un upgrade.
        $this->runUp($this->migration());

        $this->assertSame('failed', $this->resultOf($failed));
        $this->assertSame('failed', $this->resultOf($error));
        $this->assertSame('success', $this->resultOf($created), 'Solo los sufijos *.failed/*.error con result=success son candidatos.');
        $this->assertSame('failed', $this->resultOf($alreadyFailed), 'Una fila ya corregida no cambia.');
        $this->assertSame('success', $this->resultOf($suffixMismatch), 'La coincidencia de sufijo debe ser exacta (LIKE %.failed), no prefijos.');
        $this->assertSame('success', $this->resultOf($prefixMismatch), 'La coincidencia de sufijo debe ser exacta (LIKE %.error), no prefijos.');

        $this->assertSame('2026-07-01 08:15:30', $this->createdAtOf($failed), 'El backfill no reescribe timestamps historicos.');
        $this->assertSame('2026-07-01 08:16:00', $this->createdAtOf($error));
        $this->assertSame($rowsBefore, (int) DB::table('audit_logs')->count(), 'El backfill no crea ni borra filas.');

        // Re-ejecucion del upgrade: segunda corrida no-op y sin errores.
        $this->runUp($this->migration());

        $this->assertSame('failed', $this->resultOf($failed));
        $this->assertSame('success', $this->resultOf($created));
        $this->assertSame('success', $this->resultOf($suffixMismatch));

        if ($this->usesAppendOnlyTrigger()) {
            $this->assertNull($this->auditAdminFlag(), 'El bypass @app_audit_admin_op debe quedar reseteado tras la migracion.');
        }
    }

    public function test_up_on_clean_install_is_a_noop(): void
    {
        $this->assertSame(0, (int) DB::table('audit_logs')->count(), 'Instalacion limpia: audit_logs vacia.');

        $this->runUp($this->migration());

        $this->assertSame(0, (int) DB::table('audit_logs')->count(), 'Sin filas legacy el resultado debe ser identico: cero cambios.');

        if ($this->usesAppendOnlyTrigger()) {
            $this->assertNull($this->auditAdminFlag());
        }
    }

    public function test_up_remains_compatible_with_a_caller_that_wraps_it_in_audit_admin_run(): void
    {
        $failed = $this->insertAuditRow(['action' => 'backup.failed']);
        $migration = $this->migration();

        // Reproduce el patron del test existente (RV-T3-002): wrapper externo +
        // bypass interno de la migracion. La interaccion anidada debe seguir
        // funcionando y no debe filtrar el flag al terminar.
        AuditAdmin::run(function () use ($migration): void {
            $this->runUp($migration);
        });

        $this->assertSame('failed', $this->resultOf($failed));

        if ($this->usesAppendOnlyTrigger()) {
            $this->assertNull($this->auditAdminFlag());
        }
    }

    public function test_append_only_trigger_keeps_blocking_direct_update_after_up(): void
    {
        if (! $this->usesAppendOnlyTrigger()) {
            $this->markTestSkipped('El trigger append-only solo existe en MariaDB/MySQL; la suite SQLite no instala triggers.');
        }

        $failed = $this->insertAuditRow(['action' => 'backup.failed']);

        $this->runUp($this->migration());

        $this->assertSame('failed', $this->resultOf($failed));
        $this->assertNull($this->auditAdminFlag());

        try {
            DB::table('audit_logs')->where('id', $failed)->update(['reason' => 'mutacion no autorizada']);
            $this->fail('El trigger append-only debe seguir bloqueando UPDATE directo fuera del bypass.');
        } catch (QueryException $exception) {
            $this->assertSame('45000', (string) $exception->getCode());
            $this->assertStringContainsString('append-only', $exception->getMessage());
        }
    }

    /**
     * @param  array<string, mixed>  $overrides
     */
    private function insertAuditRow(array $overrides = []): int
    {
        return (int) DB::table('audit_logs')->insertGetId(array_merge([
            'user_id' => null,
            'action' => 'audit.synthetic',
            'result' => 'success',
            'entity_type' => 'system',
            'entity_id' => null,
            'old_values' => null,
            'new_values' => null,
            'reason' => null,
            'ip_address' => null,
            'ip' => null,
            'user_agent' => null,
            'url' => null,
            'http_method' => null,
            'created_at' => '2026-07-01 08:00:00',
        ], $overrides));
    }

    private function resultOf(int $id): string
    {
        return $this->requireString(DB::table('audit_logs')->where('id', $id)->value('result'));
    }

    private function createdAtOf(int $id): string
    {
        return $this->requireString(DB::table('audit_logs')->where('id', $id)->value('created_at'));
    }

    private function auditAdminFlag(): mixed
    {
        $rows = DB::select('SELECT @app_audit_admin_op AS flag');

        return $rows === [] ? null : ($rows[0]->flag ?? null);
    }

    private function updateTriggerCount(): int
    {
        return (int) DB::table('information_schema.TRIGGERS')
            ->where('TRIGGER_SCHEMA', DB::connection()->getDatabaseName())
            ->where('TRIGGER_NAME', 'trg_audit_logs_no_update')
            ->count();
    }

    private function usesAppendOnlyTrigger(): bool
    {
        return in_array(DB::connection()->getDriverName(), ['mysql', 'mariadb'], true);
    }

    private function requireString(mixed $value): string
    {
        if (! is_string($value)) {
            throw new RuntimeException('Valor escalar inesperado al leer audit_logs en el test de migracion.');
        }

        return $value;
    }

    private function migration(): Migration
    {
        $migration = include base_path('database/migrations/2026_07_16_000001_backfill_audit_failure_results.php');

        if (! $migration instanceof Migration) {
            throw new RuntimeException('La migracion 2026_07_16_000001 no devolvio una instancia de Migration.');
        }

        return $migration;
    }

    /**
     * Invoca `up()` de la clase anonima de la migracion. La clase anonima no
     * expone `up()` en el tipo base `Migration`, por lo que se usa reflexion
     * para que el analisis estatico no reporte un metodo inexistente en el
     * tipo base; en runtime la llamada es identica a `$migration->up()`.
     */
    private function runUp(Migration $migration): void
    {
        (new ReflectionMethod($migration, 'up'))->invoke($migration);
    }
}
