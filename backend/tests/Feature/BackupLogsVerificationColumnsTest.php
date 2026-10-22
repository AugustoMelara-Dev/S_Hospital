<?php

namespace Tests\Feature;

use Closure;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

/**
 * T2-025 (HS-BK-VERIFY): recuperabilidad verificada y key mismatch en
 * `backup_logs` (`verified_at`, `verify_status`, `key_identifier`).
 *
 * Contrato para T2-010:
 *   - `verify_status = NULL` significa "nunca verificado"; todos los registros
 *     historicos quedan asi (sin backfill).
 *   - `verified_at` solo se escribe tras una verificacion EXITOSA.
 *   - "ultima copia recuperable" =
 *       status='success' AND verify_status='verified' AND verified_at IS NOT NULL.
 *   - `key_identifier` es el fingerprint sha256 hex64 de la llave que verifico
 *     el archivo (nunca la llave).
 *
 * MariaDB/MySQL: CHECK de dominio. SQLite: las columnas se agregan igual
 * (ALTER TABLE ADD COLUMN portable) pero sin CHECK; los tests de constraint y
 * de rollback se saltan alli de forma explicita.
 */
class BackupLogsVerificationColumnsTest extends TestCase
{
    use RefreshDatabase;

    private const MIGRATION = 'database/migrations/2026_09_13_200002_add_verification_columns_to_backup_logs.php';

    public function test_columns_are_added_nullable_without_backfill(): void
    {
        $this->assertTrue(Schema::hasColumns('backup_logs', [
            'verified_at',
            'verify_status',
            'key_identifier',
        ]));

        $backupId = $this->insertBackupLog();

        $before = (array) DB::table('backup_logs')->where('id', $backupId)->first();
        $this->assertNull($before['verified_at']);
        $this->assertNull($before['verify_status']);
        $this->assertNull($before['key_identifier']);

        $migration = include base_path(self::MIGRATION);
        $migration->up();

        $after = (array) DB::table('backup_logs')->where('id', $backupId)->first();

        $this->assertSame($before['filename'], $after['filename']);
        $this->assertSame($before['status'], $after['status']);
        $this->assertSame($before['checksum_sha256'], $after['checksum_sha256']);
        $this->assertSame($before['encryption_key_id'], $after['encryption_key_id']);
        $this->assertNull($after['verified_at']);
        $this->assertNull($after['verify_status']);
        $this->assertNull($after['key_identifier']);
        $this->assertSame(1, (int) DB::table('backup_logs')->where('id', $backupId)->count());
    }

    public function test_up_is_idempotent_and_installs_domain_checks_once(): void
    {
        $this->requireMariaDb();

        $backupId = $this->insertBackupLog();

        $migration = include base_path(self::MIGRATION);
        $migration->up();
        $migration->up();

        $this->assertSame(1, $this->constraintCount('backup_logs_verify_status_valid'));
        $this->assertSame(1, $this->constraintCount('backup_logs_key_identifier_format'));
        $this->assertSame(1, (int) DB::table('backup_logs')->where('id', $backupId)->count());
    }

    public function test_verify_status_check_accepts_domain_and_rejects_unknown(): void
    {
        $this->requireMariaDb();

        $backupId = $this->insertBackupLog();

        foreach (['verified', 'key_mismatch', 'failed'] as $status) {
            DB::table('backup_logs')->where('id', $backupId)->update(['verify_status' => $status]);
            $this->assertSame($status, (string) DB::table('backup_logs')->where('id', $backupId)->value('verify_status'));
        }

        $this->assertRejected('verify_status fuera de dominio', function () use ($backupId): void {
            DB::table('backup_logs')->where('id', $backupId)->update(['verify_status' => 'unknown']);
        });

        $this->assertSame('failed', (string) DB::table('backup_logs')->where('id', $backupId)->value('verify_status'));

        DB::table('backup_logs')->where('id', $backupId)->update(['verify_status' => null]);
        $this->assertNull(DB::table('backup_logs')->where('id', $backupId)->value('verify_status'));
    }

    public function test_key_identifier_check_accepts_hex64_and_rejects_malformed(): void
    {
        $this->requireMariaDb();

        $backupId = $this->insertBackupLog();

        DB::table('backup_logs')->where('id', $backupId)->update([
            'key_identifier' => str_repeat('a', 64),
        ]);

        $this->assertSame(str_repeat('a', 64), (string) DB::table('backup_logs')->where('id', $backupId)->value('key_identifier'));

        $malformed = [
            'demasiado corto' => str_repeat('a', 63),
            'demasiado largo' => str_repeat('a', 65),
            'mayusculas no canonicas' => str_repeat('A', 64),
            'caracter no hexadecimal' => str_repeat('z', 64),
        ];

        foreach ($malformed as $label => $keyIdentifier) {
            // 23000 = CHECK de formato; 22001 = valor mas largo que VARCHAR(64),
            // rechazado por el tipo antes del CHECK. Ambos son fail-closed.
            $this->assertRejected($label, function () use ($backupId, $keyIdentifier): void {
                DB::table('backup_logs')->where('id', $backupId)->update(['key_identifier' => $keyIdentifier]);
            }, ['23000', '22001']);
        }

        $this->assertSame(str_repeat('a', 64), (string) DB::table('backup_logs')->where('id', $backupId)->value('key_identifier'));
    }

    public function test_recoverable_copy_contract_ignores_unverified_and_key_mismatch(): void
    {
        $this->requireMariaDb();

        $older = $this->insertBackupLog(['completed_at' => now()->subHours(2)]);
        DB::table('backup_logs')->where('id', $older)->update([
            'verified_at' => now()->subHours(2),
            'verify_status' => 'verified',
        ]);

        $newer = $this->insertBackupLog();
        DB::table('backup_logs')->where('id', $newer)->update([
            'verified_at' => now(),
            'verify_status' => 'verified',
        ]);

        $mismatch = $this->insertBackupLog();
        DB::table('backup_logs')->where('id', $mismatch)->update([
            'verified_at' => now()->addMinute(),
            'verify_status' => 'key_mismatch',
        ]);

        $never = $this->insertBackupLog();

        $recoverable = (int) DB::table('backup_logs')
            ->whereIn('id', [$older, $newer, $mismatch, $never])
            ->where('status', 'success')
            ->where('verify_status', 'verified')
            ->whereNotNull('verified_at')
            ->orderByDesc('verified_at')
            ->orderByDesc('id')
            ->value('id');

        $this->assertSame($newer, $recoverable);
    }

    public function test_down_drops_only_its_three_columns_and_preserves_rows_and_other_checks(): void
    {
        $this->requireMariaDb();

        $backupId = $this->insertBackupLog();
        DB::table('backup_logs')->where('id', $backupId)->update([
            'verified_at' => now(),
            'verify_status' => 'verified',
            'key_identifier' => str_repeat('b', 64),
        ]);

        $migration = include base_path(self::MIGRATION);
        $migration->down();

        $this->assertFalse(Schema::hasColumn('backup_logs', 'verified_at'));
        $this->assertFalse(Schema::hasColumn('backup_logs', 'verify_status'));
        $this->assertFalse(Schema::hasColumn('backup_logs', 'key_identifier'));

        $row = (array) DB::table('backup_logs')->where('id', $backupId)->first();
        $this->assertSame('success', $row['status']);
        $this->assertSame(str_repeat('e', 64), $row['checksum_sha256']);
        $this->assertSame(str_repeat('f', 64), $row['encryption_key_id']);

        // El down de esta migracion no toca la tabla de copias externas ni los
        // CHECK de T2-014.
        $this->assertTrue(Schema::hasTable('backup_external_copies'));
        $this->assertTrue($this->constraintExists('invoices_total_cents_coherence'));

        $migration->up();

        $this->assertTrue(Schema::hasColumns('backup_logs', ['verified_at', 'verify_status', 'key_identifier']));

        $restored = (array) DB::table('backup_logs')->where('id', $backupId)->first();
        $this->assertSame('success', $restored['status']);
        $this->assertNull($restored['verified_at']);
        $this->assertNull($restored['verify_status']);
        $this->assertNull($restored['key_identifier']);
    }

    private function requireMariaDb(): void
    {
        if (! in_array(DB::connection()->getDriverName(), ['mysql', 'mariadb'], true)) {
            $this->markTestSkipped('CHECK de verificacion: SQLite no soporta los CHECK de la migracion (por driver); la cobertura real corre en MariaDB.');
        }
    }

    /**
     * @param  list<string>  $allowedCodes
     */
    private function assertRejected(string $label, Closure $callback, array $allowedCodes = ['23000']): void
    {
        try {
            $callback();
        } catch (QueryException $exception) {
            $this->assertContains((string) $exception->getCode(), $allowedCodes, "{$label} :: ".$exception->getMessage());

            return;
        }

        $this->fail("Se esperaba rechazo de dominio: {$label}");
    }

    private function constraintExists(string $name): bool
    {
        return $this->constraintCount($name) > 0;
    }

    private function constraintCount(string $name): int
    {
        return (int) DB::table('information_schema.CHECK_CONSTRAINTS')
            ->where('CONSTRAINT_SCHEMA', DB::connection()->getDatabaseName())
            ->where('CONSTRAINT_NAME', $name)
            ->count();
    }

    /**
     * @param  array<string, mixed>  $overrides
     */
    private function insertBackupLog(array $overrides = []): int
    {
        return (int) DB::table('backup_logs')->insertGetId(array_merge([
            'filename' => 't2025-'.uniqid().'.sql.gz.enc',
            'path' => 'backups/t2025-'.uniqid().'.sql.gz.enc',
            'disk' => 'local',
            'status' => 'success',
            'type' => 'manual',
            'format' => 'sql',
            'compression' => 'gzip',
            'encrypted' => true,
            'size_bytes' => 1024,
            'checksum_sha256' => str_repeat('e', 64),
            'encryption_key_id' => str_repeat('f', 64),
            'completed_at' => now(),
            'created_at' => now(),
            'updated_at' => now(),
        ], $overrides));
    }
}
