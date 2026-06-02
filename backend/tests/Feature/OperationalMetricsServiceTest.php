<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Actions\Reports\OperationalMetricsService;
use App\Models\AuditLog;
use App\Models\BackupLog;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class OperationalMetricsServiceTest extends TestCase
{
    use RefreshDatabase;

    public function test_snapshot_returns_all_sections(): void
    {
        $service = app(OperationalMetricsService::class);

        $snapshot = $service->snapshot();

        $this->assertArrayHasKey('generated_at', $snapshot);
        $this->assertArrayHasKey('database', $snapshot);
        $this->assertArrayHasKey('queue', $snapshot);
        $this->assertArrayHasKey('backups', $snapshot);
        $this->assertArrayHasKey('storage', $snapshot);
        $this->assertArrayHasKey('recent_errors', $snapshot);

        $this->assertSame('sqlite', $snapshot['database']['driver']);
        $this->assertTrue($snapshot['database']['connected']);
        $this->assertArrayHasKey('pending', $snapshot['queue']);
        $this->assertArrayHasKey('failed', $snapshot['queue']);
        $this->assertGreaterThanOrEqual(0, $snapshot['queue']['pending']);
        $this->assertGreaterThanOrEqual(0, $snapshot['queue']['failed']);
        $this->assertArrayHasKey('pending', $snapshot['backups']);
        $this->assertArrayHasKey('backup_files', $snapshot['storage']);
    }

    public function test_health_endpoint_returns_snapshot(): void
    {
        $response = $this->getJson('/api/system/health');

        $response->assertOk()
            ->assertJsonPath('data.database.driver', 'sqlite')
            ->assertJsonPath('data.database.connected', true);
    }

    public function test_health_endpoint_hides_internal_recent_error_details(): void
    {
        AuditLog::query()->create([
            'user_id' => null,
            'action' => 'backup.failed',
            'entity_type' => BackupLog::class,
            'entity_id' => 123,
            'old_values' => null,
            'new_values' => ['path' => 'C:\\Projects\\S_Hospital\\backend\\.env'],
            'created_at' => now(),
        ]);

        $response = $this->getJson('/api/system/health');

        $response->assertOk()
            ->assertJsonPath('data.recent_errors.0.action', 'backup.failed')
            ->assertJsonMissingPath('data.recent_errors.0.id')
            ->assertJsonMissingPath('data.recent_errors.0.entity_type');

        $encoded = json_encode($response->json(), JSON_THROW_ON_ERROR);

        $this->assertStringNotContainsString('App\\\\Models', $encoded);
        $this->assertStringNotContainsString('BackupLog', $encoded);
        $this->assertStringNotContainsString('C:\\Projects\\S_Hospital', $encoded);
    }

    public function test_worker_heartbeat_flips_to_true_after_record(): void
    {
        $service = app(OperationalMetricsService::class);

        $this->assertFalse($service->snapshot()['backups']['worker_recently_active']);

        OperationalMetricsService::recordWorkerHeartbeat();

        $this->assertTrue($service->snapshot()['backups']['worker_recently_active']);
    }

    public function test_storage_section_reports_backup_files_and_bytes(): void
    {
        Storage::fake('local');

        BackupLog::query()->create([
            'filename' => 'hospital-backup-2026-06-02-120000-test.sql',
            'path' => 'backups/hospital-backup-2026-06-02-120000-test.sql',
            'disk' => 'local',
            'status' => BackupLog::STATUS_SUCCESS,
            'type' => BackupLog::TYPE_MANUAL,
            'size_bytes' => 4096,
            'checksum_sha256' => str_repeat('a', 64),
            'completed_at' => now(),
        ]);

        $snapshot = app(OperationalMetricsService::class)->snapshot();

        $this->assertArrayHasKey('storage', $snapshot);
        $this->assertSame(1, $snapshot['storage']['backup_files']);
        $this->assertSame(4096, $snapshot['storage']['backup_bytes']);
    }

    public function test_recent_errors_section_surfaces_failed_actions(): void
    {
        AuditLog::query()->create([
            'user_id' => null,
            'action' => 'backup.failed',
            'entity_type' => BackupLog::class,
            'entity_id' => 1,
            'old_values' => null,
            'new_values' => ['filename' => 'failed.sql', 'status' => 'failed'],
            'created_at' => now(),
        ]);

        $snapshot = app(OperationalMetricsService::class)->snapshot();

        $this->assertNotEmpty($snapshot['recent_errors']);
        $this->assertSame('backup.failed', $snapshot['recent_errors'][0]['action']);
    }
}
