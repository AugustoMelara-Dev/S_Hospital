<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * F015 / T2-032:
 * - backfill de `audit_logs.ip` desde `ip_address` (solo relleno, con bypass
 *   scoped del trigger append-only; el trigger sigue activo al terminar);
 * - FK `audit_logs.user_id` ON DELETE RESTRICT;
 * - lectura de la API unificada a `ip` con fallback a `ip_address`.
 *
 * Solo MariaDB/MySQL para las partes de trigger/FK; la suite SQLite se
 * conserva intacta (sus migraciones de FK son no-op por driver).
 */
class AuditLogIpBackfillAndUserFkTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        if (! in_array(DB::connection()->getDriverName(), ['mysql', 'mariadb'], true)) {
            $this->markTestSkipped('Los guards de trigger/FK de auditoria solo aplican a MariaDB/MySQL; la suite SQLite rapida se conserva intacta.');
        }

        $this->seed(RolesAndPermissionsSeeder::class);
    }

    public function test_backfill_fills_ip_only_where_null(): void
    {
        $user = User::factory()->create();

        $candidateId = $this->insertAuditRow(['user_id' => $user->id, 'ip' => null, 'ip_address' => '10.0.0.1']);
        $bothId = $this->insertAuditRow(['user_id' => $user->id, 'ip' => '10.0.0.2', 'ip_address' => '10.0.0.3']);
        $noSourceId = $this->insertAuditRow(['user_id' => $user->id, 'ip' => null, 'ip_address' => null]);
        $ipOnlyId = $this->insertAuditRow(['user_id' => $user->id, 'ip' => '10.0.0.4', 'ip_address' => null]);

        $this->assertSame(1, $this->pendingCount());

        $migration = $this->backfillMigration();
        $migration->up();

        $this->assertSame('10.0.0.1', $this->ipOf($candidateId));
        $this->assertSame('10.0.0.2', $this->ipOf($bothId), 'No debe pisar un `ip` ya poblado.');
        $this->assertNull($this->ipOf($noSourceId), 'Sin `ip_address` no hay relleno.');
        $this->assertSame('10.0.0.4', $this->ipOf($ipOnlyId), 'Un `ip` ya poblado no se toca.');
        $this->assertSame(0, $this->pendingCount());
    }

    public function test_backfill_uses_scoped_bypass_and_keeps_append_only_trigger_active(): void
    {
        $candidateId = $this->insertAuditRow(['ip' => null, 'ip_address' => '10.1.1.1']);

        $this->backfillMigration()->up();

        $this->assertSame('10.1.1.1', $this->ipOf($candidateId));
        $this->assertNull($this->auditAdminFlag(), 'El bypass @app_audit_admin_op debe quedar reseteado.');

        try {
            DB::table('audit_logs')->where('id', $candidateId)->update(['reason' => 'intento de modificacion']);
            $this->fail('El trigger append-only debe seguir bloqueando UPDATE directo despues del backfill.');
        } catch (QueryException $exception) {
            $this->assertStringContainsString('append-only', $exception->getMessage());
        }

        // Idempotencia: una segunda corrida no reescribe nada.
        $this->backfillMigration()->up();

        $this->assertSame('10.1.1.1', $this->ipOf($candidateId));
        $this->assertNull(DB::table('audit_logs')->where('id', $candidateId)->value('reason'));
    }

    public function test_backfill_down_is_a_documented_noop(): void
    {
        $candidateId = $this->insertAuditRow(['ip' => null, 'ip_address' => '10.2.2.2']);
        $rowsBefore = (int) DB::table('audit_logs')->count();

        $migration = $this->backfillMigration();
        $migration->up();
        $migration->down();

        $this->assertSame('10.2.2.2', $this->ipOf($candidateId), 'Revertir el relleno borraria datos de auditoria; down() es no-op documentado.');
        $this->assertSame($rowsBefore, (int) DB::table('audit_logs')->count());
    }

    public function test_audit_user_fk_is_restrict_and_blocks_user_deletion(): void
    {
        $user = User::factory()->create();
        $this->insertAuditRow(['user_id' => $user->id, 'ip' => '10.3.3.3', 'ip_address' => '10.3.3.3']);

        $this->assertSame('RESTRICT', $this->auditUserDeleteRule());

        try {
            DB::table('users')->where('id', $user->id)->delete();
            $this->fail('La FK RESTRICT debe impedir borrar un usuario con auditoria.');
        } catch (QueryException $exception) {
            $this->assertSame('23000', (string) $exception->getCode());
            $this->assertStringContainsString('audit_logs_user_id_foreign', $exception->getMessage());
        }

        $this->assertDatabaseHas('users', ['id' => $user->id]);
    }

    public function test_audit_user_fk_down_restores_set_null_and_up_reapplies_restrict(): void
    {
        $this->assertSame('RESTRICT', $this->auditUserDeleteRule());

        $migration = $this->fkMigration();
        $migration->down();

        $this->assertSame('SET NULL', $this->auditUserDeleteRule());

        $migration->up();

        $this->assertSame('RESTRICT', $this->auditUserDeleteRule());
    }

    public function test_audit_api_exposes_ip_for_ip_only_and_legacy_ip_address_only_rows(): void
    {
        $auditor = User::factory()->create([
            'username' => 'auditor-ip-'.uniqid(),
            'email' => 'auditor-ip-'.uniqid().'@hospital.local',
            'active' => true,
        ]);
        $auditor->assignRole('auditor');

        $this->insertAuditRow([
            'user_id' => $auditor->id,
            'action' => 'audit.ip_only',
            'ip' => '192.168.7.10',
            'ip_address' => null,
        ]);
        $this->insertAuditRow([
            'user_id' => $auditor->id,
            'action' => 'audit.ip_address_only',
            'ip' => null,
            'ip_address' => '192.168.7.11',
        ]);

        $response = $this->actingAs($auditor)
            ->getJson('/api/system/audit-logs?action=audit.&per_page=10')
            ->assertOk();

        $rows = collect($response->json('data'))->keyBy('action');

        $this->assertSame('192.168.7.10', $rows['audit.ip_only']['ip']);
        $this->assertSame('192.168.7.11', $rows['audit.ip_address_only']['ip'], 'Fallback legacy debe seguir exponiendose como `ip`.');
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
            'created_at' => now(),
        ], $overrides));
    }

    private function pendingCount(): int
    {
        return (int) DB::table('audit_logs')->whereNull('ip')->whereNotNull('ip_address')->count();
    }

    private function ipOf(int $id): ?string
    {
        $value = DB::table('audit_logs')->where('id', $id)->value('ip');

        return $value === null ? null : (string) $value;
    }

    private function auditAdminFlag(): mixed
    {
        return DB::selectOne('SELECT @app_audit_admin_op AS flag')->flag;
    }

    private function auditUserDeleteRule(): string
    {
        $rule = DB::table('information_schema.REFERENTIAL_CONSTRAINTS')
            ->where('CONSTRAINT_SCHEMA', DB::connection()->getDatabaseName())
            ->where('TABLE_NAME', 'audit_logs')
            ->where('CONSTRAINT_NAME', 'audit_logs_user_id_foreign')
            ->value('DELETE_RULE');

        return strtoupper((string) $rule);
    }

    private function backfillMigration(): object
    {
        return include base_path('database/migrations/2026_09_13_210001_backfill_audit_logs_ip_from_ip_address.php');
    }

    private function fkMigration(): object
    {
        return include base_path('database/migrations/2026_09_13_210002_restrict_audit_logs_user_foreign_key.php');
    }
}
