<?php

namespace Tests\Feature;

use App\Actions\Backups\CreateBackupAction;
use App\Actions\Backups\DatabaseDumpWriter;
use App\Actions\Backups\EncryptBackupFileAction;
use App\Actions\Backups\PruneBackupsAction;
use App\Jobs\RunBackupJob;
use App\Models\AuditLog;
use App\Models\BackupLog;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Storage;
use RuntimeException;
use Tests\TestCase;

class BackupWorkflowTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_list_backups_without_exposing_internal_paths(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $admin = $this->admin();

        BackupLog::query()->create([
            'filename' => 'hospital-backup.sql',
            'path' => 'backups/hospital-backup.sql',
            'disk' => 'local',
            'status' => BackupLog::STATUS_SUCCESS,
            'type' => BackupLog::TYPE_MANUAL,
            'created_by' => $admin->id,
            'size_bytes' => 100,
            'checksum_sha256' => str_repeat('a', 64),
            'completed_at' => now(),
        ]);

        $this->actingAs($admin)
            ->getJson('/api/backups')
            ->assertOk()
            ->assertJsonPath('data.0.filename', 'hospital-backup.sql')
            ->assertJsonPath('data.0.creator.username', $admin->username)
            ->assertJsonMissingPath('data.0.path')
            ->assertJsonMissingPath('data.0.disk')
            ->assertJsonMissingPath('data.0.error_message');
    }

    public function test_backup_list_per_page_is_clamped_to_safe_range(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $admin = $this->admin();

        $this->actingAs($admin)
            ->getJson('/api/backups?per_page=-1')
            ->assertOk()
            ->assertJsonPath('meta.per_page', 1);

        $this->actingAs($admin)
            ->getJson('/api/backups?per_page=0')
            ->assertOk()
            ->assertJsonPath('meta.per_page', 1);

        $this->actingAs($admin)
            ->getJson('/api/backups?per_page=999')
            ->assertOk()
            ->assertJsonPath('meta.per_page', 50);
    }

    public function test_failed_backup_list_message_is_safe_for_operator_screen(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $admin = $this->admin();

        BackupLog::query()->create([
            'filename' => 'failed.sql',
            'path' => 'backups/failed.sql',
            'disk' => 'local',
            'status' => BackupLog::STATUS_FAILED,
            'type' => BackupLog::TYPE_MANUAL,
            'created_by' => $admin->id,
            'error_message' => 'SQLSTATE[HY000] DB_PASSWORD=secret-db-password failed at C:\Projects\S_Hospital\backend\.env',
            'completed_at' => now(),
        ]);

        $response = $this->actingAs($admin)
            ->getJson('/api/backups?status=failed')
            ->assertOk()
            ->assertJsonPath('data.0.status', BackupLog::STATUS_FAILED)
            ->assertJsonPath('data.0.error_message', 'Error tecnico registrado. Revise el paquete de soporte.')
            ->assertJsonMissingPath('data.0.path')
            ->assertJsonMissingPath('data.0.disk');

        $encoded = json_encode($response->json(), JSON_THROW_ON_ERROR);
        $this->assertStringNotContainsString('secret-db-password', $encoded);
        $this->assertStringNotContainsString('SQLSTATE', $encoded);
        $this->assertStringNotContainsString('C:\Projects\S_Hospital', $encoded);
    }

    public function test_admin_can_filter_backups_by_status_before_pagination(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $admin = $this->admin();

        BackupLog::query()->create([
            'filename' => 'pending.sql',
            'path' => 'backups/pending.sql',
            'disk' => 'local',
            'status' => BackupLog::STATUS_PENDING,
            'type' => BackupLog::TYPE_MANUAL,
            'created_by' => $admin->id,
        ]);
        BackupLog::query()->create([
            'filename' => 'failed.sql',
            'path' => 'backups/failed.sql',
            'disk' => 'local',
            'status' => BackupLog::STATUS_FAILED,
            'type' => BackupLog::TYPE_MANUAL,
            'created_by' => $admin->id,
        ]);

        $this->actingAs($admin)
            ->getJson('/api/backups?status=failed&per_page=1')
            ->assertOk()
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('data.0.filename', 'failed.sql')
            ->assertJsonPath('data.0.status', BackupLog::STATUS_FAILED);
    }

    public function test_backup_status_filter_rejects_unknown_values(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);

        $this->actingAs($this->admin())
            ->getJson('/api/backups?status=unknown')
            ->assertUnprocessable()
            ->assertJsonValidationErrors('status');
    }

    public function test_cashier_and_supervisor_cannot_list_create_or_download_backups(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $backup = $this->successfulBackupLog();

        foreach ([$this->cashier(), $this->supervisor()] as $user) {
            $this->actingAs($user)->getJson('/api/backups')->assertForbidden();
            $this->actingAs($user)->postJson('/api/backups')->assertForbidden();
            $this->actingAs($user)->get("/api/backups/{$backup->id}/download")->assertForbidden();
        }
    }

    public function test_backup_download_requires_view_and_download_permissions(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $backup = $this->successfulBackupLog();
        $misconfiguredUser = User::factory()->create();
        $misconfiguredUser->givePermissionTo('backups.download');

        $this->actingAs($misconfiguredUser)
            ->get("/api/backups/{$backup->id}/download")
            ->assertForbidden();
    }

    public function test_manual_backup_endpoint_queues_local_backup(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $admin = $this->admin();

        $response = $this->actingAs($admin)
            ->postJson('/api/backups')
            ->assertAccepted()
            ->assertJsonPath('data.status', BackupLog::STATUS_PENDING)
            ->assertJsonPath('data.type', BackupLog::TYPE_MANUAL);

        $backup = BackupLog::query()->findOrFail($response->json('data.id'));

        $this->assertContains($backup->status, [BackupLog::STATUS_PENDING, BackupLog::STATUS_SUCCESS]);

        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $admin->id,
            'action' => 'backup.requested',
            'entity_type' => BackupLog::class,
            'entity_id' => $backup->id,
        ]);
        if ($backup->status === BackupLog::STATUS_SUCCESS) {
            $this->assertNotNull($backup->completed_at);
            $this->assertNotNull($backup->checksum_sha256);
            $this->assertTrue(Storage::disk('local')->exists((string) $backup->path));
        }
    }

    public function test_manual_backup_endpoint_replays_duplicate_submit_with_idempotency_key(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $admin = $this->admin();

        $first = $this->actingAs($admin)
            ->withHeaders(['Idempotency-Key' => 'manual-backup-double-click'])
            ->postJson('/api/backups')
            ->assertAccepted()
            ->assertHeaderMissing('Idempotent-Replay');

        $second = $this->actingAs($admin)
            ->withHeaders(['Idempotency-Key' => 'manual-backup-double-click'])
            ->postJson('/api/backups')
            ->assertAccepted()
            ->assertHeader('Idempotent-Replay', 'true');

        $this->assertSame($first->json('data.id'), $second->json('data.id'));
        $this->assertSame(1, BackupLog::query()->where('type', BackupLog::TYPE_MANUAL)->count());
    }

    public function test_backup_runner_creates_success_log_checksum_and_audit_entry(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $admin = $this->admin();

        $backup = app(CreateBackupAction::class)->execute($admin, BackupLog::TYPE_MANUAL);

        $this->assertSame(BackupLog::STATUS_SUCCESS, $backup->status);
        $this->assertNotNull($backup->completed_at);
        $this->assertNotNull($backup->checksum_sha256);
        $this->assertSame(64, strlen((string) $backup->checksum_sha256));
        $this->assertGreaterThan(0, $backup->size_bytes);
        $this->assertTrue(Storage::disk('local')->exists((string) $backup->path));
        $this->assertStringEndsWith('.sql.enc', $backup->filename);

        $encrypted = Storage::disk('local')->get((string) $backup->path);
        $this->assertStringNotContainsString('CREATE TABLE', $encrypted);
        $this->assertStringNotContainsString('INSERT INTO', $encrypted);
        $decryptedPath = storage_path('framework/testing/decrypted-backup.sql');
        @unlink($decryptedPath);
        $this->artisan('hospital:decrypt-backup', [
            'input' => Storage::disk('local')->path((string) $backup->path),
            'output' => $decryptedPath,
        ])->assertExitCode(0);
        $this->assertNotEmpty(file_get_contents($decryptedPath));

        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $admin->id,
            'action' => 'backup.created',
            'entity_type' => BackupLog::class,
            'entity_id' => $backup->id,
        ]);
    }

    public function test_backup_prune_keeps_latest_successful_backups_and_never_prunes_failed_or_pending(): void
    {
        $oldest = $this->successfulBackupLog(filename: 'oldest.sql', path: 'backups/oldest.sql');
        $middle = $this->successfulBackupLog(filename: 'middle.sql', path: 'backups/middle.sql');
        $newest = $this->successfulBackupLog(filename: 'newest.sql', path: 'backups/newest.sql');
        $failed = BackupLog::query()->create([
            'filename' => 'failed.sql',
            'path' => 'backups/failed.sql',
            'disk' => 'local',
            'status' => BackupLog::STATUS_FAILED,
            'type' => BackupLog::TYPE_SCHEDULED,
            'completed_at' => now()->subDays(4),
        ]);
        $pending = BackupLog::query()->create([
            'filename' => 'pending.sql',
            'path' => 'backups/pending.sql',
            'disk' => 'local',
            'status' => BackupLog::STATUS_PENDING,
            'type' => BackupLog::TYPE_SCHEDULED,
        ]);

        $oldest->forceFill(['completed_at' => now()->subDays(3)])->save();
        $middle->forceFill(['completed_at' => now()->subDays(2)])->save();
        $newest->forceFill(['completed_at' => now()->subDay()])->save();

        $pruned = app(PruneBackupsAction::class)->execute(2);

        $this->assertSame(1, $pruned);
        $this->assertDatabaseMissing('backup_logs', ['id' => $oldest->id]);
        $this->assertDatabaseHas('backup_logs', ['id' => $middle->id]);
        $this->assertDatabaseHas('backup_logs', ['id' => $newest->id]);
        $this->assertDatabaseHas('backup_logs', ['id' => $failed->id]);
        $this->assertDatabaseHas('backup_logs', ['id' => $pending->id]);
        $this->assertFalse(Storage::disk('local')->exists('backups/oldest.sql'));
        $this->assertTrue(Storage::disk('local')->exists('backups/middle.sql'));
        $this->assertTrue(Storage::disk('local')->exists('backups/newest.sql'));
        $this->assertDatabaseHas('audit_logs', [
            'action' => 'backup.pruned',
            'entity_type' => BackupLog::class,
            'entity_id' => $oldest->id,
        ]);
    }

    public function test_backup_prune_preserves_unsafe_successful_records_for_review(): void
    {
        $newest = $this->successfulBackupLog(filename: 'newest.sql', path: 'backups/newest.sql');
        $safeOld = $this->successfulBackupLog(filename: 'safe-old.sql', path: 'backups/safe-old.sql');
        $unsafeOld = BackupLog::query()->create([
            'filename' => 'unsafe-old.sql',
            'path' => 'backups/../unsafe-old.sql',
            'disk' => 'local',
            'status' => BackupLog::STATUS_SUCCESS,
            'type' => BackupLog::TYPE_SCHEDULED,
            'size_bytes' => 9,
            'checksum_sha256' => hash('sha256', 'select 1;'),
            'completed_at' => now()->subDays(3),
        ]);

        $newest->forceFill(['completed_at' => now()->subDay()])->save();
        $safeOld->forceFill(['completed_at' => now()->subDays(2)])->save();

        $pruned = app(PruneBackupsAction::class)->execute(1);

        $this->assertSame(1, $pruned);
        $this->assertDatabaseHas('backup_logs', ['id' => $newest->id]);
        $this->assertDatabaseMissing('backup_logs', ['id' => $safeOld->id]);
        $this->assertDatabaseHas('backup_logs', ['id' => $unsafeOld->id]);
        $this->assertFalse(Storage::disk('local')->exists('backups/safe-old.sql'));
        $this->assertDatabaseHas('audit_logs', [
            'action' => 'backup.pruned',
            'entity_type' => BackupLog::class,
            'entity_id' => $safeOld->id,
        ]);
        $this->assertDatabaseHas('audit_logs', [
            'action' => 'backup.prune_skipped',
            'entity_type' => BackupLog::class,
            'entity_id' => $unsafeOld->id,
        ]);
    }

    public function test_successful_backup_runs_configured_retention_after_creation(): void
    {
        Config::set('backups.retention.scheduled.keep_successful', 1);
        Config::set('backups.retention.scheduled.keep_days', 0);
        $oldBackup = $this->successfulBackupLog(filename: 'old.sql', path: 'backups/old.sql');
        $oldBackup->forceFill([
            'type' => BackupLog::TYPE_SCHEDULED,
            'completed_at' => now()->subDay(),
        ])->save();

        $created = app(CreateBackupAction::class)->execute(type: BackupLog::TYPE_SCHEDULED);

        $this->assertSame(BackupLog::STATUS_SUCCESS, $created->status);
        $this->assertDatabaseMissing('backup_logs', ['id' => $oldBackup->id]);
        $this->assertFalse(Storage::disk('local')->exists('backups/old.sql'));
        $this->assertDatabaseHas('backup_logs', ['id' => $created->id]);
    }

    public function test_failed_backup_is_recorded_without_leaking_database_password(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $admin = $this->admin();
        $connection = Config::get('database.default');

        $originalDb = Config::get("database.connections.{$connection}.database");
        $originalPassword = Config::get("database.connections.{$connection}.password");

        try {
            Config::set("database.connections.{$connection}.database", 'invalid-db-name');
            Config::set("database.connections.{$connection}.password", 'secret-db-password');

            $backup = app(CreateBackupAction::class)->execute($admin, BackupLog::TYPE_MANUAL);

            $this->assertSame(BackupLog::STATUS_FAILED, $backup->status);
            $this->assertNotNull($backup->completed_at);
            $this->assertNull($backup->checksum_sha256);
            $this->assertStringNotContainsString('secret-db-password', (string) $backup->error_message);
            $this->assertFalse(Storage::disk('local')->exists((string) $backup->path));
        } finally {
            Config::set("database.connections.{$connection}.database", $originalDb);
            Config::set("database.connections.{$connection}.password", $originalPassword);
        }
    }

    public function test_failed_backup_persists_operator_safe_support_message(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $admin = $this->admin();

        $writer = new class extends DatabaseDumpWriter
        {
            public function dumpTo(string $absolutePath): void
            {
                throw new RuntimeException('SQLSTATE[HY000] DB_PASSWORD=secret-db-password failed at C:\Projects\S_Hospital\backend\.env');
            }
        };

        $backup = (new CreateBackupAction($writer, app(EncryptBackupFileAction::class), app(PruneBackupsAction::class)))
            ->execute($admin, BackupLog::TYPE_MANUAL);

        $this->assertSame(BackupLog::STATUS_FAILED, $backup->status);
        $this->assertSame('Error tecnico registrado. Revise el paquete de soporte.', $backup->error_message);
        $this->assertStringNotContainsString('secret-db-password', (string) $backup->error_message);
        $this->assertStringNotContainsString('SQLSTATE', (string) $backup->error_message);
        $this->assertStringNotContainsString('C:\Projects\S_Hospital', (string) $backup->error_message);
        $this->assertFalse(Storage::disk('local')->exists((string) $backup->path));
        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $admin->id,
            'action' => 'backup.failed',
            'entity_type' => BackupLog::class,
            'entity_id' => $backup->id,
        ]);
        $this->assertDatabaseMissing('audit_logs', [
            'user_id' => $admin->id,
            'action' => 'backup.created',
            'entity_type' => BackupLog::class,
            'entity_id' => $backup->id,
        ]);
    }

    public function test_backup_fails_before_dump_when_free_space_is_insufficient(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $admin = $this->admin();

        $writer = new class extends DatabaseDumpWriter
        {
            public bool $called = false;

            public function dumpTo(string $absolutePath): void
            {
                $this->called = true;
                file_put_contents($absolutePath, 'should-not-run');
            }
        };

        $backup = (new CreateBackupAction(
            $writer,
            app(EncryptBackupFileAction::class),
            app(PruneBackupsAction::class),
            freeSpaceResolver: fn (string $backupRoot): int => 1024,
        ))->execute($admin, BackupLog::TYPE_MANUAL);

        $this->assertFalse($writer->called);
        $this->assertSame(BackupLog::STATUS_FAILED, $backup->status);
        $this->assertSame('Espacio insuficiente para crear respaldo local.', $backup->error_message);
        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $admin->id,
            'action' => 'backup.failed',
            'entity_type' => BackupLog::class,
            'entity_id' => $backup->id,
        ]);
    }

    public function test_backup_job_failure_marks_pending_log_failed_with_safe_message(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $admin = $this->admin();
        $backup = BackupLog::query()->create([
            'filename' => 'pending-worker-failure.sql',
            'path' => 'backups/pending-worker-failure.sql',
            'disk' => 'local',
            'status' => BackupLog::STATUS_PENDING,
            'type' => BackupLog::TYPE_MANUAL,
            'created_by' => $admin->id,
        ]);

        (new RunBackupJob($backup->id))->failed(
            new RuntimeException('SQLSTATE[HY000] DB_PASSWORD=secret-db-password failed at C:\Projects\S_Hospital\backend\.env'),
        );

        $backup->refresh();

        $this->assertSame(BackupLog::STATUS_FAILED, $backup->status);
        $this->assertNotNull($backup->completed_at);
        $this->assertSame('Error tecnico registrado. Revise el paquete de soporte.', $backup->error_message);
        $this->assertStringNotContainsString('secret-db-password', (string) $backup->error_message);
        $this->assertStringNotContainsString('SQLSTATE', (string) $backup->error_message);
        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $admin->id,
            'action' => 'backup.failed',
            'entity_type' => BackupLog::class,
            'entity_id' => $backup->id,
        ]);
    }

    public function test_backup_runner_refuses_corrupt_pending_paths_before_dumping(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $admin = $this->admin();

        $backup = BackupLog::query()->create([
            'filename' => 'unsafe.sql.enc',
            'path' => 'backups/../unsafe.sql.enc',
            'disk' => 'local',
            'status' => BackupLog::STATUS_PENDING,
            'type' => BackupLog::TYPE_MANUAL,
            'created_by' => $admin->id,
        ]);

        $writer = new class extends DatabaseDumpWriter
        {
            public bool $called = false;

            public function dumpTo(string $absolutePath): void
            {
                $this->called = true;
                file_put_contents($absolutePath, 'should-not-run');
            }
        };

        $result = (new CreateBackupAction($writer, app(EncryptBackupFileAction::class), app(PruneBackupsAction::class)))
            ->run($backup);

        $this->assertFalse($writer->called);
        $this->assertSame(BackupLog::STATUS_FAILED, $result->status);
        $this->assertSame('Registro de respaldo local invalido.', $result->error_message);
        $this->assertFalse(Storage::disk('local')->exists('backups/unsafe.sql.enc'));
        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $admin->id,
            'action' => 'backup.failed',
            'entity_type' => BackupLog::class,
            'entity_id' => $backup->id,
        ]);
    }

    public function test_download_only_serves_registered_existing_backup_files_and_audits_downloads(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $admin = $this->admin();
        $backup = $this->successfulBackupLog($admin);

        Storage::disk('local')->put('backups/unregistered.sql', 'unregistered');

        $this->actingAs($admin)
            ->get('/api/backups/999/download')
            ->assertNotFound();

        $this->actingAs($admin)
            ->get("/api/backups/{$backup->id}/download")
            ->assertOk()
            ->assertHeader('Content-Type', 'application/octet-stream')
            ->assertHeader('X-Content-Type-Options', 'nosniff');

        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $admin->id,
            'action' => 'backup.downloaded',
            'entity_type' => BackupLog::class,
            'entity_id' => $backup->id,
        ]);
    }

    public function test_download_refuses_backup_when_file_integrity_no_longer_matches_log(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $admin = $this->admin();
        $backup = $this->successfulBackupLog($admin);

        Storage::disk('local')->put((string) $backup->path, 'tampered backup contents');

        $this->actingAs($admin)
            ->get("/api/backups/{$backup->id}/download")
            ->assertNotFound();

        $audit = AuditLog::query()
            ->where('action', 'backup.download_denied')
            ->where('entity_type', BackupLog::class)
            ->where('entity_id', $backup->id)
            ->firstOrFail();

        $this->assertSame('integrity_mismatch', $audit->new_values['reason'] ?? null);
        $this->assertSame(BackupLog::STATUS_SUCCESS, $audit->new_values['status'] ?? null);
        $this->assertDatabaseMissing('audit_logs', [
            'action' => 'backup.downloaded',
            'entity_type' => BackupLog::class,
            'entity_id' => $backup->id,
        ]);
    }

    public function test_backup_download_guest_receives_json_unauthenticated_for_download_accept_header(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $backup = $this->successfulBackupLog();

        $this
            ->withHeaders(['Accept' => 'application/json, application/octet-stream, text/csv'])
            ->get("/api/backups/{$backup->id}/download")
            ->assertUnauthorized()
            ->assertJsonPath('message', 'Unauthenticated.');
    }

    public function test_download_blocks_path_traversal_and_failed_logs(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $admin = $this->admin();
        $unsafe = BackupLog::query()->create([
            'filename' => 'unsafe.sql',
            'path' => 'backups/../.env',
            'disk' => 'local',
            'status' => BackupLog::STATUS_SUCCESS,
            'type' => BackupLog::TYPE_MANUAL,
        ]);
        $failed = BackupLog::query()->create([
            'filename' => 'failed.sql',
            'path' => 'backups/failed.sql',
            'disk' => 'local',
            'status' => BackupLog::STATUS_FAILED,
            'type' => BackupLog::TYPE_MANUAL,
        ]);

        $this->actingAs($admin)->get("/api/backups/{$unsafe->id}/download")->assertNotFound();
        $this->actingAs($admin)->get("/api/backups/{$failed->id}/download")->assertNotFound();

        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $admin->id,
            'action' => 'backup.download_denied',
            'entity_type' => BackupLog::class,
            'entity_id' => $unsafe->id,
        ]);
        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $admin->id,
            'action' => 'backup.download_denied',
            'entity_type' => BackupLog::class,
            'entity_id' => $failed->id,
        ]);
    }

    public function test_download_uses_safe_attachment_name_when_log_filename_is_tampered(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $admin = $this->admin();
        $backup = $this->successfulBackupLog($admin, filename: "../bad\r\nname.sql.enc");

        $response = $this->actingAs($admin)
            ->get("/api/backups/{$backup->id}/download")
            ->assertOk();

        $this->assertStringContainsString('filename=hospital-backup-download.sql.enc', $response->headers->get('Content-Disposition'));
        $this->assertStringNotContainsString('bad', $response->headers->get('Content-Disposition'));
    }

    public function test_artisan_backup_command_registers_success_log(): void
    {
        $this->artisan('hospital:backup --type=scheduled')
            ->assertSuccessful();

        $this->assertDatabaseHas('backup_logs', [
            'status' => BackupLog::STATUS_SUCCESS,
            'type' => BackupLog::TYPE_SCHEDULED,
            'created_by' => null,
        ]);
    }

    public function test_daily_scheduled_backup_is_registered_for_local_automation(): void
    {
        $this->artisan('schedule:list', ['--no-ansi' => true])
            ->expectsOutputToContain('hospital:backup --type=scheduled')
            ->assertSuccessful();
    }

    public function test_restore_endpoint_is_not_exposed(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);

        $this->actingAs($this->admin())
            ->postJson('/api/backups/1/restore')
            ->assertNotFound();
    }

    private function successfulBackupLog(?User $creator = null, string $filename = 'test-backup.sql', string $path = 'backups/test-backup.sql'): BackupLog
    {
        Storage::disk('local')->put($path, 'select 1;');

        return BackupLog::query()->create([
            'filename' => $filename,
            'path' => $path,
            'disk' => 'local',
            'status' => BackupLog::STATUS_SUCCESS,
            'type' => BackupLog::TYPE_MANUAL,
            'created_by' => $creator?->id,
            'size_bytes' => 9,
            'checksum_sha256' => hash('sha256', 'select 1;'),
            'completed_at' => now(),
        ]);
    }

    private function admin(): User
    {
        $admin = User::factory()->create();
        $admin->assignRole('admin');

        return $admin->refresh();
    }

    private function supervisor(): User
    {
        $supervisor = User::factory()->create();
        $supervisor->assignRole('supervisor');

        return $supervisor->refresh();
    }

    private function cashier(): User
    {
        $cashier = User::factory()->create();
        $cashier->assignRole('cajero');

        return $cashier->refresh();
    }
}
