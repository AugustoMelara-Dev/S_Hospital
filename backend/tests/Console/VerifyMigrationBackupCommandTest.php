<?php

namespace Tests\Console;

use App\Actions\Backups\BackupFileCipher;
use App\Actions\Backups\EncryptBackupFileAction;
use App\Models\BackupLog;
use Carbon\CarbonInterface;
use Illuminate\Foundation\Testing\RefreshDatabaseState;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class VerifyMigrationBackupCommandTest extends TestCase
{
    private const BACKUP_MIGRATIONS = [
        'database/migrations/0001_01_01_000000_create_users_table.php',
        'database/migrations/2026_05_17_000018_create_backup_logs_table.php',
        'database/migrations/2026_06_14_000001_add_backup_protection_metadata_to_backup_logs.php',
    ];

    /**
     * This suite simulates an empty/partial install by creating the ledgers by
     * hand. SQLite :memory: starts clean for each case, while MariaDB keeps
     * DDL across cases. Empty only the disposable schema validated by
     * TestCase's s_hospital_test_ guard before each case; helpers then create
     * exactly the partial schema needed by that case.
     */
    protected function setUp(): void
    {
        parent::setUp();

        if (DB::connection()->getDriverName() !== 'sqlite') {
            Schema::disableForeignKeyConstraints();
            try {
                Schema::dropAllTables();
            } finally {
                Schema::enableForeignKeyConstraints();
            }
        }
    }

    public static function tearDownAfterClass(): void
    {
        parent::tearDownAfterClass();

        RefreshDatabaseState::$migrated = false;
    }

    public function test_empty_database_allows_migration_without_backup(): void
    {
        $exitCode = $this->runGuardCommand();
        $output = Artisan::output();

        $this->assertSame(0, $exitCode);
        $this->assertStringContainsString('Instalacion nueva', $output);
    }

    public function test_empty_partial_install_allows_migration_without_backup(): void
    {
        $this->createEmptyMigrationsLedger();

        $exitCode = $this->runGuardCommand();

        $this->assertSame(0, $exitCode);
        $this->assertStringContainsString('sin migraciones aplicadas', Artisan::output());
    }

    public function test_partial_install_with_empty_domain_tables_allows_migration(): void
    {
        $this->createEmptyMigrationsLedger();
        Schema::dropIfExists('users');
        Schema::create('users', function ($table): void {
            $table->increments('id');
        });

        $exitCode = $this->runGuardCommand();
        $output = Artisan::output();

        $this->assertSame(0, $exitCode);
        $this->assertStringContainsString('sin migraciones aplicadas', $output);
        $this->assertStringContainsString('sin datos de dominio', $output);
    }

    public function test_migrations_empty_but_domain_data_present_blocks_migration(): void
    {
        $this->createEmptyMigrationsLedger();
        Schema::dropIfExists('users');
        Schema::create('users', function ($table): void {
            $table->increments('id');
        });
        DB::table('users')->insert(['id' => 1]);

        $exitCode = $this->runGuardCommand();
        $output = Artisan::output();

        $this->assertNotSame(0, $exitCode);
        $this->assertStringContainsString('existen datos', $output);
        $this->assertStringContainsString('users', $output);
    }

    public function test_existing_install_without_backup_logs_blocks_migration_even_with_confirmation_flag(): void
    {
        $this->createMigrationsLedger();

        putenv('HOSPITAL_MIGRATION_BACKUP_CONFIRMED=true');
        $_ENV['HOSPITAL_MIGRATION_BACKUP_CONFIRMED'] = 'true';
        $_SERVER['HOSPITAL_MIGRATION_BACKUP_CONFIRMED'] = 'true';

        try {
            $exitCode = $this->runGuardCommand();

            $this->assertNotSame(0, $exitCode);
            $this->assertStringContainsString('Actualizacion bloqueada', Artisan::output());
        } finally {
            putenv('HOSPITAL_MIGRATION_BACKUP_CONFIRMED');
            unset($_ENV['HOSPITAL_MIGRATION_BACKUP_CONFIRMED'], $_SERVER['HOSPITAL_MIGRATION_BACKUP_CONFIRMED']);
        }
    }

    public function test_existing_install_without_successful_backup_blocks_migration(): void
    {
        $this->runBackupMigrations();

        BackupLog::query()->create([
            'filename' => 'hospital-backup-failed.sql.gz.enc',
            'path' => 'backups/hospital-backup-failed.sql.gz.enc',
            'disk' => 'local',
            'status' => BackupLog::STATUS_FAILED,
            'type' => BackupLog::TYPE_MANUAL,
        ]);

        $exitCode = $this->runGuardCommand();

        $this->assertNotSame(0, $exitCode);
        $this->assertStringContainsString('No existe ningun respaldo con estado success', Artisan::output());
    }

    public function test_encrypted_verified_backup_allows_migration_and_is_not_modified(): void
    {
        $this->runBackupMigrations();

        $path = 'backups/hospital-backup-verified.sql.gz.enc';
        Storage::fake('local');
        $this->writeEncryptedBackupFile($path);
        $absolutePath = Storage::disk('local')->path($path);
        $contentsBefore = (string) file_get_contents($absolutePath);

        $this->createSuccessfulBackupLog($path);

        $exitCode = $this->runGuardCommand();

        $this->assertSame(0, $exitCode);
        $this->assertStringContainsString('Respaldo verificado', Artisan::output());
        $this->assertSame($contentsBefore, (string) file_get_contents($absolutePath), 'El guard no debe reescribir la unica copia de recuperacion.');
    }

    public function test_backup_within_configured_window_passes_and_exposes_window_and_timestamp(): void
    {
        $this->runBackupMigrations();

        $path = 'backups/hospital-backup-within-window.sql.gz.enc';
        Storage::fake('local');
        $this->writeEncryptedBackupFile($path);
        $backup = $this->createSuccessfulBackupLog($path, 'auto', now()->subHours(2));

        $stored = $backup->fresh();
        $this->assertNotNull($stored);
        $this->assertNotNull($stored->completed_at);
        $storedIso = $stored->completed_at->toIso8601String();

        $exitCode = $this->runGuardCommand(['--max-age-hours' => '24', '--json' => true]);
        $output = Artisan::output();

        $this->assertSame(0, $exitCode);
        $this->assertStringContainsString('"status":"verified"', $output);
        $this->assertStringContainsString('"max_age_hours":24', $output);
        $this->assertStringContainsString('"age_hours":', $output);
        $this->assertStringContainsString('"completed_at":"'.$storedIso.'"', $output);
    }

    public function test_backup_outside_configured_window_blocks_migration(): void
    {
        $this->runBackupMigrations();

        $path = 'backups/hospital-backup-outside-window.sql.gz.enc';
        Storage::fake('local');
        $this->writeEncryptedBackupFile($path);
        $backup = $this->createSuccessfulBackupLog($path, 'auto', now()->subHours(72));

        $stored = $backup->fresh();
        $this->assertNotNull($stored);
        $this->assertNotNull($stored->completed_at);
        $storedIso = $stored->completed_at->toIso8601String();

        $exitCode = $this->runGuardCommand(['--max-age-hours' => '24']);
        $output = Artisan::output();

        $this->assertNotSame(0, $exitCode);
        $this->assertStringContainsString('fuera de la ventana', $output);
        $this->assertStringContainsString('superan el maximo de 24h', $output);
        $this->assertStringContainsString($storedIso, $output);
    }

    public function test_window_defaults_to_72_hours_with_missing_or_invalid_value(): void
    {
        $this->runBackupMigrations();

        $path = 'backups/hospital-backup-default-window.sql.gz.enc';
        Storage::fake('local');
        $this->writeEncryptedBackupFile($path);
        $this->createSuccessfulBackupLog($path);

        foreach ([null, 'abc', '0', '-5'] as $configured) {
            $options = ['--json' => true];

            if ($configured !== null) {
                $options['--max-age-hours'] = $configured;
            }

            $exitCode = $this->runGuardCommand($options);
            $output = Artisan::output();

            $this->assertSame(0, $exitCode, "La ventana configurada como {$configured} debe caer al default.");
            $this->assertStringContainsString('"max_age_hours":72', $output);
            $this->assertStringContainsString('"status":"verified"', $output);
        }
    }

    public function test_tampered_backup_file_blocks_migration(): void
    {
        $this->runBackupMigrations();

        $path = 'backups/hospital-backup-tampered.sql.gz.enc';
        Storage::fake('local');
        $this->writeEncryptedBackupFile($path);
        $this->createSuccessfulBackupLog($path);

        file_put_contents(Storage::disk('local')->path($path), 'alterado', FILE_APPEND);

        $exitCode = $this->runGuardCommand();

        $this->assertNotSame(0, $exitCode);
        $this->assertStringContainsString('Actualizacion bloqueada', Artisan::output());
    }

    public function test_file_that_cannot_be_decrypted_blocks_migration(): void
    {
        $this->runBackupMigrations();

        $path = 'backups/hospital-backup-not-recoverable.sql.gz.enc';
        Storage::fake('local');
        Storage::disk('local')->put($path, 'este-archivo-no-tiene-el-formato-cifrado-esperado');
        $this->createSuccessfulBackupLog($path, null);

        $exitCode = $this->runGuardCommand();

        $this->assertNotSame(0, $exitCode);
        $this->assertStringContainsString('no es recuperable con la clave configurada', Artisan::output());
    }

    public function test_json_output_reports_blocked_status(): void
    {
        $this->createMigrationsLedger();

        $exitCode = $this->runGuardCommand(['--json' => true]);

        $this->assertNotSame(0, $exitCode);
        $this->assertStringContainsString('"status":"blocked"', Artisan::output());
    }

    /**
     * @param  array<string, mixed>  $options
     */
    private function runGuardCommand(array $options = []): int
    {
        $this->withoutMockingConsoleOutput();

        return (int) $this->artisan('hospital:verify-migration-backup', $options);
    }

    private function createEmptyMigrationsLedger(): void
    {
        Schema::dropIfExists('migrations');
        Schema::create('migrations', function ($table): void {
            $table->increments('id');
            $table->string('migration');
            $table->integer('batch');
        });
    }

    private function createMigrationsLedger(): void
    {
        $this->createEmptyMigrationsLedger();

        DB::table('migrations')->insert([
            'migration' => '2026_01_01_000000_existing_install',
            'batch' => 1,
        ]);
    }

    private function runBackupMigrations(): void
    {
        Schema::dropIfExists('backup_logs');
        $paths = array_map(
            static fn (string $relative): string => base_path($relative),
            self::BACKUP_MIGRATIONS,
        );

        $this->artisan('migrate', [
            '--path' => $paths,
            '--realpath' => true,
        ])->assertSuccessful();
    }

    private function writeEncryptedBackupFile(string $path): void
    {
        $plainPath = tempnam(sys_get_temp_dir(), 's-hospital-test-plain-');
        $encryptedPath = tempnam(sys_get_temp_dir(), 's-hospital-test-enc-');

        if ($plainPath === false || $encryptedPath === false) {
            $this->fail('No se pudieron crear fixtures temporales para el respaldo de prueba.');
        }

        try {
            file_put_contents($plainPath, 'dump sql sintetico de prueba');
            app(EncryptBackupFileAction::class)->execute($plainPath, $encryptedPath);
            Storage::disk('local')->put($path, (string) file_get_contents($encryptedPath));
        } finally {
            @unlink($plainPath);
            @unlink($encryptedPath);
        }
    }

    private function createSuccessfulBackupLog(string $path, ?string $keyIdentifier = 'auto', ?CarbonInterface $completedAt = null): BackupLog
    {
        $absolutePath = Storage::disk('local')->path($path);

        return BackupLog::query()->create([
            'filename' => basename($path),
            'path' => $path,
            'disk' => 'local',
            'size_bytes' => filesize($absolutePath),
            'checksum_sha256' => hash_file('sha256', $absolutePath),
            'status' => BackupLog::STATUS_SUCCESS,
            'type' => BackupLog::TYPE_MANUAL,
            'format' => 'sql',
            'compression' => 'gzip',
            'encrypted' => true,
            'encryption_key_id' => $keyIdentifier === 'auto' ? app(BackupFileCipher::class)->keyIdentifier() : $keyIdentifier,
            'completed_at' => $completedAt ?? now(),
        ]);
    }
}
