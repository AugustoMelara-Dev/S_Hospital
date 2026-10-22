<?php

namespace Tests\Feature;

use App\Actions\Backups\CreateBackupAction;
use App\Actions\Backups\ExternalBackupCopyAction;
use App\Models\BackupLog;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class BackupExternalCopyTest extends TestCase
{
    use RefreshDatabase;

    /** @var list<string> */
    private array $temporaryPaths = [];

    protected function tearDown(): void
    {
        foreach ($this->temporaryPaths as $path) {
            if (is_dir($path)) {
                File::deleteDirectory($path);
            } elseif (is_file($path)) {
                @unlink($path);
            }
        }

        $this->temporaryPaths = [];

        parent::tearDown();
    }

    public function test_external_copy_is_disabled_by_default_and_declares_not_deployed(): void
    {
        $this->createBackup();

        $exitCode = Artisan::call('hospital:backup-copy-external', ['--latest' => true, '--json' => true]);
        $output = Artisan::output();

        $this->assertSame(0, $exitCode);
        $this->assertStringContainsString('"status":"disabled"', $output);
        $this->assertStringContainsString('"external_configured":false', $output);
        $this->assertStringContainsString('"external_deployed":false', $output);
        $this->assertSame(0, DB::table('backup_external_copies')->count());
    }

    public function test_external_copy_writes_and_verifies_destination_hash(): void
    {
        $backup = $this->createBackup();
        $this->enableExternalCopyWithTempRoot();

        $exitCode = Artisan::call('hospital:backup-copy-external', ['--latest' => true, '--json' => true]);
        $output = Artisan::output();

        $this->assertSame(0, $exitCode);
        $this->assertStringContainsString('"status":"verified"', $output);
        $this->assertStringContainsString('"external_configured":true', $output);
        $this->assertStringContainsString('"external_deployed":true', $output);

        $row = DB::table('backup_external_copies')->first();
        $this->assertNotNull($row);
        $this->assertSame(ExternalBackupCopyAction::STATUS_VERIFIED, $row->status);
        $this->assertNotNull($row->verified_at);
        $this->assertSame('hospital-backups/'.$backup->filename, $row->relative_path);
        $this->assertSame((int) $backup->size_bytes, (int) $row->bytes);
        $this->assertSame(
            hash('sha256', (string) Storage::disk('local')->get((string) $backup->path)),
            (string) $row->sha256,
        );
        $this->assertTrue(Storage::disk('backup_external')->exists((string) $row->relative_path));

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'backup.external_verified',
            'result' => 'success',
            'entity_id' => $backup->id,
        ]);
    }

    public function test_external_copy_is_idempotent_for_the_same_backup(): void
    {
        $this->createBackup();
        $this->enableExternalCopyWithTempRoot();

        Artisan::call('hospital:backup-copy-external', ['--latest' => true, '--json' => true]);
        Artisan::call('hospital:backup-copy-external', ['--latest' => true, '--json' => true]);

        $this->assertSame(1, DB::table('backup_external_copies')->count());
        $this->assertSame(
            ExternalBackupCopyAction::STATUS_VERIFIED,
            (string) DB::table('backup_external_copies')->first()->status,
        );
    }

    public function test_external_copy_fails_closed_when_root_is_empty(): void
    {
        $this->createBackup();
        $this->enableExternalCopyWithRoot('');

        $exitCode = Artisan::call('hospital:backup-copy-external', ['--latest' => true, '--json' => true]);
        $output = Artisan::output();

        $this->assertSame(1, $exitCode);
        $this->assertStringContainsString('"status":"failed"', $output);
        $this->assertStringContainsString('"external_configured":false', $output);
        $this->assertStringContainsString('"external_deployed":false', $output);
        $this->assertStringContainsString('HOSPITAL_BACKUP_EXTERNAL_ROOT', $output);
        $this->assertSame(0, DB::table('backup_external_copies')->count());
    }

    public function test_external_copy_does_not_declare_when_root_is_inside_storage(): void
    {
        $this->createBackup();
        $insideStorage = storage_path('app/backup-external-guard-test');
        $this->enableExternalCopyWithRoot($insideStorage);

        $exitCode = Artisan::call('hospital:backup-copy-external', ['--latest' => true, '--json' => true]);
        $output = Artisan::output();

        $this->assertSame(1, $exitCode);
        $this->assertStringContainsString('"status":"failed"', $output);
        $this->assertStringContainsString('"external_deployed":false', $output);
        $this->assertStringContainsString('almacenamiento', $output);
        $this->assertSame(0, DB::table('backup_external_copies')->count());
        $this->assertFalse(is_dir($insideStorage));
    }

    public function test_external_copy_fails_closed_when_root_is_not_absolute(): void
    {
        $this->createBackup();
        $this->enableExternalCopyWithRoot('relative-backups');

        $exitCode = Artisan::call('hospital:backup-copy-external', ['--latest' => true, '--json' => true]);
        $output = Artisan::output();

        $this->assertSame(1, $exitCode);
        $this->assertStringContainsString('"status":"failed"', $output);
        $this->assertStringContainsString('"external_deployed":false', $output);
        $this->assertStringContainsString('absoluta', $output);
        $this->assertSame(0, DB::table('backup_external_copies')->count());
    }

    public function test_external_copy_reports_visible_failure_when_destination_unavailable(): void
    {
        $backup = $this->createBackup();

        $rootFile = sys_get_temp_dir().DIRECTORY_SEPARATOR.'s_hospital_external_root_file_'.bin2hex(random_bytes(6));
        @unlink($rootFile);
        file_put_contents($rootFile, 'not-a-directory');
        $this->temporaryPaths[] = $rootFile;

        $this->enableExternalCopyWithRoot($rootFile);

        $exitCode = Artisan::call('hospital:backup-copy-external', ['--latest' => true, '--json' => true]);
        $output = Artisan::output();

        $this->assertSame(1, $exitCode);
        $this->assertStringContainsString('"status":"failed"', $output);
        $this->assertStringContainsString('"external_deployed":false', $output);
        $this->assertStringNotContainsString('s_hospital_external_root_file', $output);

        $row = DB::table('backup_external_copies')->first();
        $this->assertNotNull($row);
        $this->assertSame(ExternalBackupCopyAction::STATUS_FAILED, $row->status);
        $this->assertNotNull($row->failed_at);
        $this->assertStringNotContainsString('s_hospital_external_root_file', (string) $row->error_message);

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'backup.external_copy_failed',
            'result' => 'failed',
            'entity_id' => $backup->id,
        ]);
    }

    public function test_verify_copy_detects_tampered_destination(): void
    {
        $this->createBackup();
        $this->enableExternalCopyWithTempRoot();

        Artisan::call('hospital:backup-copy-external', ['--latest' => true, '--json' => true]);
        $row = DB::table('backup_external_copies')->first();
        $this->assertNotNull($row);

        $destinationPath = Storage::disk('backup_external')->path((string) $row->relative_path);
        file_put_contents($destinationPath, 'tampered-copy');

        $result = app(ExternalBackupCopyAction::class)->verifyCopy((int) $row->id);

        $this->assertSame(ExternalBackupCopyAction::STATUS_FAILED, $result['status']);
        $this->assertFalse($result['external_deployed']);

        $row = DB::table('backup_external_copies')->where('id', $row->id)->first();
        $this->assertSame(ExternalBackupCopyAction::STATUS_FAILED, $row->status);
        $this->assertNotNull($row->failed_at);
    }

    public function test_external_copy_rejects_dotted_root_that_resolves_inside_storage(): void
    {
        $this->createBackup();

        // El prefijo textual no esta dentro de storage/, pero '..' resuelve ahi.
        $dottedSegment = 'dotted-guard-'.bin2hex(random_bytes(4));
        $resolvedInsideStorage = storage_path('app/dotted-external-guard-test');
        $dottedRoot = dirname(base_path()).DIRECTORY_SEPARATOR.$dottedSegment
            .DIRECTORY_SEPARATOR.'..'.DIRECTORY_SEPARATOR.'backend'
            .DIRECTORY_SEPARATOR.'storage'.DIRECTORY_SEPARATOR.'app'
            .DIRECTORY_SEPARATOR.'dotted-external-guard-test';

        $this->temporaryPaths[] = $resolvedInsideStorage;
        $this->temporaryPaths[] = dirname(base_path()).DIRECTORY_SEPARATOR.$dottedSegment;

        $this->enableExternalCopyWithRoot($dottedRoot);

        $exitCode = Artisan::call('hospital:backup-copy-external', ['--latest' => true, '--json' => true]);
        $output = Artisan::output();

        $this->assertSame(1, $exitCode, $output);
        $this->assertStringContainsString('"status":"failed"', $output);
        $this->assertStringContainsString('"external_deployed":false', $output);
        $this->assertStringContainsString('almacenamiento', $output);
        $this->assertSame(0, DB::table('backup_external_copies')->count());
        $this->assertFalse(is_dir($resolvedInsideStorage));
    }

    public function test_external_copy_rejects_repo_level_backup_external_placeholder(): void
    {
        $this->createBackup();

        // Placeholder mismo-host documentado (T2-036): <repo>\backup-external no es externo.
        $repoLevelRoot = dirname(base_path()).DIRECTORY_SEPARATOR.'backup-external';
        $this->temporaryPaths[] = $repoLevelRoot;

        $this->enableExternalCopyWithRoot($repoLevelRoot);

        $exitCode = Artisan::call('hospital:backup-copy-external', ['--latest' => true, '--json' => true]);
        $output = Artisan::output();

        $this->assertSame(1, $exitCode, $output);
        $this->assertStringContainsString('"status":"failed"', $output);
        $this->assertStringContainsString('"external_deployed":false', $output);
        $this->assertStringContainsString('arbol del proyecto', $output);
        $this->assertSame(0, DB::table('backup_external_copies')->count());
        $this->assertFalse(is_dir($repoLevelRoot));
    }

    public function test_external_copy_rejects_root_inside_backend_outside_storage(): void
    {
        $this->createBackup();

        $insideBackend = base_path().DIRECTORY_SEPARATOR.'external-guard-test-outside-storage';
        $this->temporaryPaths[] = $insideBackend;

        $this->enableExternalCopyWithRoot($insideBackend);

        $exitCode = Artisan::call('hospital:backup-copy-external', ['--latest' => true, '--json' => true]);
        $output = Artisan::output();

        $this->assertSame(1, $exitCode, $output);
        $this->assertStringContainsString('"status":"failed"', $output);
        $this->assertStringContainsString('"external_deployed":false', $output);
        $this->assertStringContainsString('directorio del proyecto', $output);
        $this->assertSame(0, DB::table('backup_external_copies')->count());
        $this->assertFalse(is_dir($insideBackend));
    }

    public function test_verify_copy_degrades_verified_row_when_destination_guard_fails(): void
    {
        $backup = $this->createBackup();
        $this->enableExternalCopyWithTempRoot();

        Artisan::call('hospital:backup-copy-external', ['--latest' => true, '--json' => true]);
        $row = DB::table('backup_external_copies')->first();
        $this->assertNotNull($row);
        $this->assertSame(ExternalBackupCopyAction::STATUS_VERIFIED, $row->status);
        $verifiedAt = $row->verified_at;
        $sha256 = $row->sha256;

        // El operador vacia el root despues de verificar: la copia ya no es re-verificable.
        $this->enableExternalCopyWithRoot('');

        $result = app(ExternalBackupCopyAction::class)->verifyCopy((int) $row->id);

        $this->assertSame(ExternalBackupCopyAction::STATUS_FAILED, $result['status']);
        $this->assertFalse($result['external_deployed']);
        $this->assertFalse($result['external_configured']);
        $this->assertSame(
            'el root externo esta vacio (defina HOSPITAL_BACKUP_EXTERNAL_ROOT)',
            $result['destination_problem'] ?? null,
        );

        $degraded = DB::table('backup_external_copies')->where('id', $row->id)->first();
        $this->assertNotNull($degraded);
        $this->assertSame(ExternalBackupCopyAction::STATUS_FAILED, $degraded->status);
        $this->assertNotNull($degraded->failed_at);
        $this->assertNotNull($degraded->error_message);
        // Evidencia historica intacta: no se toca verified_at ni el sha256 registrado.
        $this->assertSame($verifiedAt, $degraded->verified_at);
        $this->assertSame($sha256, $degraded->sha256);

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'backup.external_copy_failed',
            'result' => 'failed',
            'entity_id' => $backup->id,
        ]);
    }

    public function test_external_copy_accepts_docker_container_root_on_posix_runtimes(): void
    {
        if (DIRECTORY_SEPARATOR !== '/') {
            $this->markTestSkipped(
                'El root /external-backups solo es absoluto en runtime POSIX (Docker/Linux); '
                .'en Windows no es un root local valido y el guard lo rechaza por diseno.'
            );
        }

        $this->enableExternalCopyWithRoot('/external-backups');

        $this->assertNull(app(ExternalBackupCopyAction::class)->destinationProblem());
    }

    public function test_external_copy_accepts_remote_driver_without_local_root_guard(): void
    {
        // Un driver remoto explicito (s3/sftp/ftp) sigue siendo valido aunque
        // el root local este vacio: el guard de rutas solo aplica a `local`.
        Config::set('backups.external.enabled', true);
        Config::set('backups.external.disk', 'backup_external');
        Config::set('filesystems.disks.backup_external', [
            'driver' => 's3',
            'root' => '',
            'throw' => false,
            'report' => false,
        ]);

        $this->assertNull(app(ExternalBackupCopyAction::class)->destinationProblem());
    }

    public function test_external_copy_accepts_dotted_root_that_resolves_outside_the_project(): void
    {
        $backup = $this->createBackup();

        $ignoreSegment = 's_hospital_external_ignore_'.bin2hex(random_bytes(4));
        $resolvedRoot = sys_get_temp_dir().DIRECTORY_SEPARATOR.'s_hospital_external_dotted_'.bin2hex(random_bytes(6));
        $dottedRoot = sys_get_temp_dir().DIRECTORY_SEPARATOR.$ignoreSegment
            .DIRECTORY_SEPARATOR.'..'.DIRECTORY_SEPARATOR.basename($resolvedRoot);

        $this->temporaryPaths[] = $resolvedRoot;
        $this->temporaryPaths[] = sys_get_temp_dir().DIRECTORY_SEPARATOR.$ignoreSegment;

        $this->enableExternalCopyWithRoot($dottedRoot);

        $exitCode = Artisan::call('hospital:backup-copy-external', ['--latest' => true, '--json' => true]);
        $output = Artisan::output();

        $this->assertSame(0, $exitCode, $output);
        $this->assertStringContainsString('"status":"verified"', $output);
        $this->assertStringContainsString('"external_deployed":true', $output);
        $this->assertTrue(is_dir($resolvedRoot));

        $row = DB::table('backup_external_copies')->first();
        $this->assertNotNull($row);
        $this->assertSame('verified', (string) $row->status);
        $this->assertTrue(Storage::disk('backup_external')->exists('hospital-backups/'.$backup->filename));
    }

    private function createBackup(): BackupLog
    {
        Storage::fake('local');

        $backup = app(CreateBackupAction::class)->execute(null, BackupLog::TYPE_MANUAL);

        $this->assertSame(BackupLog::STATUS_SUCCESS, $backup->status);

        return $backup;
    }

    /**
     * Destino externo sintetico en %TEMP% (fuera del storage y del proyecto).
     */
    private function enableExternalCopyWithTempRoot(): string
    {
        $root = sys_get_temp_dir().DIRECTORY_SEPARATOR.'s_hospital_external_'.bin2hex(random_bytes(6));
        $this->temporaryPaths[] = $root;

        $this->enableExternalCopyWithRoot($root);

        return $root;
    }

    private function enableExternalCopyWithRoot(string $root): void
    {
        Config::set('backups.external.enabled', true);
        Config::set('backups.external.disk', 'backup_external');
        Config::set('backups.external.path', 'hospital-backups');
        Config::set('backups.external.label', 'externo');

        Config::set('filesystems.disks.backup_external', [
            'driver' => 'local',
            'root' => $root,
            'throw' => false,
            'report' => false,
        ]);
    }
}
