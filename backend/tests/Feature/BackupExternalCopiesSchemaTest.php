<?php

namespace Tests\Feature;

use Closure;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

/**
 * T2-025 (HS-BK-EXT / F019): tabla `backup_external_copies`.
 *
 * Cobertura MariaDB (phpunit.mysql.xml): CHECK de status/sha256/bytes,
 * validacion JSON, FK RESTRICT y ciclo de vida pending -> copied -> verified.
 * La migracion es portable: en SQLite la tabla y sus columnas se crean igual,
 * pero los CHECK de dominio se omiten alli porque SQLite no soporta
 * `ALTER TABLE ADD CONSTRAINT` (documentado en el docblock de la migracion).
 * Por eso cada test de constraint declara el skip explicito en SQLite.
 */
class BackupExternalCopiesSchemaTest extends TestCase
{
    use RefreshDatabase;

    private const TABLE = 'backup_external_copies';

    public function test_table_and_columns_are_present_with_pending_default(): void
    {
        $this->assertTrue(Schema::hasTable(self::TABLE));
        $this->assertTrue(Schema::hasColumns(self::TABLE, [
            'id',
            'backup_log_id',
            'destination_label',
            'relative_path',
            'sha256',
            'bytes',
            'status',
            'copied_at',
            'verified_at',
            'failed_at',
            'error_message',
            'metadata',
            'created_at',
            'updated_at',
        ]));

        $copyId = $this->insertCopy($this->insertBackupLog());

        $row = (array) DB::table(self::TABLE)->where('id', $copyId)->first();

        $this->assertSame('pending', $row['status']);
        $this->assertNull($row['relative_path']);
        $this->assertNull($row['sha256']);
        $this->assertNull($row['bytes']);
        $this->assertNull($row['copied_at']);
        $this->assertNull($row['verified_at']);
        $this->assertNull($row['failed_at']);
        $this->assertNull($row['error_message']);
        $this->assertNull($row['metadata']);
    }

    public function test_status_check_rejects_unknown_value_fail_closed(): void
    {
        $this->requireMariaDb();

        $copyId = $this->insertCopy($this->insertBackupLog());

        $this->assertTrue($this->constraintExists('backup_external_copies_status_valid'));

        $this->assertRejected('status fuera de dominio', function () use ($copyId): void {
            DB::table(self::TABLE)->where('id', $copyId)->update(['status' => 'uploaded']);
        });

        $this->assertSame('pending', (string) DB::table(self::TABLE)->where('id', $copyId)->value('status'));
    }

    public function test_sha256_check_accepts_canonical_lowercase_and_rejects_malformed(): void
    {
        $this->requireMariaDb();

        $backupId = $this->insertBackupLog();

        $this->assertTrue($this->constraintExists('backup_external_copies_sha256_format'));

        $validId = $this->insertCopy($backupId, [
            'status' => 'copied',
            'sha256' => str_repeat('a', 64),
            'bytes' => 2048,
            'copied_at' => now(),
        ]);
        $this->assertSame(str_repeat('a', 64), (string) DB::table(self::TABLE)->where('id', $validId)->value('sha256'));

        $malformed = [
            'demasiado corto' => str_repeat('a', 63),
            'demasiado largo' => str_repeat('a', 65),
            'mayusculas no canonicas' => str_repeat('A', 64),
            'caracter no hexadecimal' => str_repeat('z', 64),
        ];

        foreach ($malformed as $label => $sha256) {
            // 23000 = CHECK de formato; 22001 = valor mas largo que CHAR(64),
            // rechazado por el tipo antes del CHECK. Ambos son fail-closed.
            $this->assertRejected($label, function () use ($backupId, $sha256): void {
                $this->insertCopy($backupId, ['status' => 'copied', 'sha256' => $sha256]);
            }, ['23000', '22001']);
        }

        $this->assertSame(1, (int) DB::table(self::TABLE)->where('backup_log_id', $backupId)->count());
    }

    public function test_bytes_are_never_negative_and_valid_values_are_accepted(): void
    {
        $this->requireMariaDb();

        $backupId = $this->insertBackupLog();

        $this->assertTrue($this->constraintExists('backup_external_copies_bytes_nonnegative'));

        // En sesion estricta (Laravel `strict=true`) el INSERT -1 se rechaza;
        // en un servidor no estricto MariaDB lo satura a 0. En ambos casos el
        // invariante que verificamos es el mismo: nunca queda un bytes < 0.
        try {
            $this->insertCopy($backupId, ['status' => 'copied', 'bytes' => -1]);
        } catch (QueryException) {
            // Rechazo esperado en modo estricto.
        }

        $this->assertSame(0, (int) DB::table(self::TABLE)->where('bytes', '<', 0)->count());

        foreach ([0, 12345] as $bytes) {
            $id = $this->insertCopy($backupId, ['status' => 'copied', 'bytes' => $bytes]);
            $this->assertSame($bytes, (int) DB::table(self::TABLE)->where('id', $id)->value('bytes'));
        }
    }

    public function test_metadata_accepts_valid_json_and_rejects_invalid_json(): void
    {
        $this->requireMariaDb();

        $copyId = $this->insertCopy($this->insertBackupLog());

        $metadata = [
            'manifest_sha256' => str_repeat('b', 64),
            'manifest_version' => 1,
            'reconciliation_pending' => false,
        ];

        DB::table(self::TABLE)->where('id', $copyId)->update([
            'metadata' => json_encode($metadata, JSON_THROW_ON_ERROR),
        ]);

        $stored = DB::table(self::TABLE)->where('id', $copyId)->value('metadata');
        $this->assertSame($metadata, json_decode((string) $stored, true));

        try {
            DB::table(self::TABLE)->where('id', $copyId)->update(['metadata' => 'no-es-json']);
            $this->fail('MariaDB debe rechazar metadata JSON invalida.');
        } catch (QueryException $exception) {
            $this->assertSame('23000', (string) $exception->getCode(), $exception->getMessage());
        }

        $after = DB::table(self::TABLE)->where('id', $copyId)->value('metadata');
        $this->assertSame($metadata, json_decode((string) $after, true));
    }

    public function test_fk_rejects_orphan_copy_and_restricts_backup_log_delete(): void
    {
        $this->requireMariaDb();

        $backupId = $this->insertBackupLog();
        $copyId = $this->insertCopy($backupId);

        $this->assertRejected('copia huerfana sin backup_log', function (): void {
            $this->insertCopy(999999999);
        });

        $this->assertRejected('borrar backup_log con copia externa registrada', function () use ($backupId): void {
            DB::table('backup_logs')->where('id', $backupId)->delete();
        });

        $this->assertSame(1, (int) DB::table('backup_logs')->where('id', $backupId)->count());

        // Sin copias asociadas el backup_log vuelve a ser podable (la
        // restriccion es la copia, no un bloqueo permanente del registro).
        DB::table(self::TABLE)->where('id', $copyId)->delete();

        $this->assertSame(1, (int) DB::table('backup_logs')->where('id', $backupId)->delete());
    }

    public function test_lifecycle_states_and_timestamps_are_persisted(): void
    {
        $this->requireMariaDb();

        $copyId = $this->insertCopy($this->insertBackupLog());

        DB::table(self::TABLE)->where('id', $copyId)->update([
            'status' => 'copied',
            'relative_path' => '2026/09/hospital-backup-test.sql.gz.enc',
            'sha256' => str_repeat('c', 64),
            'bytes' => 4096,
            'copied_at' => now()->subMinute(),
            'updated_at' => now(),
        ]);

        DB::table(self::TABLE)->where('id', $copyId)->update([
            'status' => 'verified',
            'verified_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table(self::TABLE)->where('id', $copyId)->update([
            'status' => 'failed',
            'failed_at' => now(),
            'error_message' => 'Destino no accesible: error sanitizado.',
            'updated_at' => now(),
        ]);

        $row = (array) DB::table(self::TABLE)->where('id', $copyId)->first();

        $this->assertSame('failed', $row['status']);
        $this->assertSame('2026/09/hospital-backup-test.sql.gz.enc', $row['relative_path']);
        $this->assertSame(str_repeat('c', 64), $row['sha256']);
        $this->assertSame(4096, (int) $row['bytes']);
        $this->assertSame('Destino no accesible: error sanitizado.', $row['error_message']);
        $this->assertNotNull($row['copied_at']);
        $this->assertNotNull($row['verified_at']);
        $this->assertNotNull($row['failed_at']);
    }

    public function test_migration_up_is_idempotent_and_down_only_drops_its_own_table(): void
    {
        $backupId = $this->insertBackupLog();

        $migration = include base_path('database/migrations/2026_09_13_200001_create_backup_external_copies_table.php');

        $migration->up();
        $migration->up();

        $this->assertTrue(Schema::hasTable(self::TABLE));
        $this->assertSame(1, (int) DB::table('backup_logs')->where('id', $backupId)->count());

        $migration->down();

        $this->assertFalse(Schema::hasTable(self::TABLE));
        $this->assertTrue(Schema::hasTable('backup_logs'));
        $this->assertSame(1, (int) DB::table('backup_logs')->where('id', $backupId)->count());

        $migration->up();

        $this->assertTrue(Schema::hasTable(self::TABLE));
        $this->assertSame(0, (int) DB::table(self::TABLE)->count());
    }

    private function requireMariaDb(): void
    {
        if (! in_array(DB::connection()->getDriverName(), ['mysql', 'mariadb'], true)) {
            $this->markTestSkipped('CHECK/FK de `backup_external_copies`: SQLite omite los CHECK por driver (documentado en la migracion); la cobertura real corre en MariaDB.');
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
        return DB::table('information_schema.CHECK_CONSTRAINTS')
            ->where('CONSTRAINT_SCHEMA', DB::connection()->getDatabaseName())
            ->where('CONSTRAINT_NAME', $name)
            ->exists();
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

    /**
     * @param  array<string, mixed>  $overrides
     */
    private function insertCopy(int $backupLogId, array $overrides = []): int
    {
        return (int) DB::table(self::TABLE)->insertGetId(array_merge([
            'backup_log_id' => $backupLogId,
            'destination_label' => 'offsite-test-01',
            'status' => 'pending',
            'created_at' => now(),
            'updated_at' => now(),
        ], $overrides));
    }
}
