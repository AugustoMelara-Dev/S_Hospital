<?php

namespace Tests\Feature;

use App\Actions\Backups\CreateBackupAction;
use App\Jobs\RunBackupJob;
use App\Models\BackupLog;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
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

    public function test_manual_backup_endpoint_registers_pending_log_and_queues_local_backup(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $admin = $this->admin();
        Queue::fake();

        $response = $this->actingAs($admin)
            ->postJson('/api/backups')
            ->assertAccepted()
            ->assertJsonPath('data.status', BackupLog::STATUS_PENDING)
            ->assertJsonPath('data.type', BackupLog::TYPE_MANUAL);

        $backup = BackupLog::query()->findOrFail($response->json('data.id'));

        $this->assertSame(BackupLog::STATUS_PENDING, $backup->status);
        $this->assertNull($backup->completed_at);
        $this->assertNull($backup->checksum_sha256);
        $this->assertFalse(Storage::disk('local')->exists((string) $backup->path));

        Queue::assertPushed(RunBackupJob::class);

        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $admin->id,
            'action' => 'backup.requested',
            'entity_type' => BackupLog::class,
            'entity_id' => $backup->id,
        ]);
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

        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $admin->id,
            'action' => 'backup.created',
            'entity_type' => BackupLog::class,
            'entity_id' => $backup->id,
        ]);
    }

    public function test_failed_backup_is_recorded_without_leaking_database_password(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $admin = $this->admin();
        Config::set('database.connections.sqlite.database', '');
        Config::set('database.connections.sqlite.password', 'secret-db-password');

        $backup = app(CreateBackupAction::class)->execute($admin, BackupLog::TYPE_MANUAL);

        $this->assertSame(BackupLog::STATUS_FAILED, $backup->status);
        $this->assertNotNull($backup->completed_at);
        $this->assertNull($backup->checksum_sha256);
        $this->assertStringNotContainsString('secret-db-password', (string) $backup->error_message);
        $this->assertFalse(Storage::disk('local')->exists((string) $backup->path));
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
            ->assertHeader('X-Content-Type-Options', 'nosniff');

        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $admin->id,
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

    public function test_restore_endpoint_is_not_exposed(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);

        $this->actingAs($this->admin())
            ->postJson('/api/backups/1/restore')
            ->assertNotFound();
    }

    private function successfulBackupLog(?User $creator = null): BackupLog
    {
        Storage::disk('local')->put('backups/test-backup.sql', 'select 1;');

        return BackupLog::query()->create([
            'filename' => 'test-backup.sql',
            'path' => 'backups/test-backup.sql',
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

        return $admin;
    }

    private function supervisor(): User
    {
        $supervisor = User::factory()->create();
        $supervisor->assignRole('supervisor');

        return $supervisor;
    }

    private function cashier(): User
    {
        $cashier = User::factory()->create();
        $cashier->assignRole('cajero');

        return $cashier;
    }
}
