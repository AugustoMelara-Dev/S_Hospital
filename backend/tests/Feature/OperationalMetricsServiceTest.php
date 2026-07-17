<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Actions\Reports\OperationalMetricsService;
use App\Models\AuditLog;
use App\Models\BackupLog;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use RuntimeException;
use Tests\TestCase;

class OperationalMetricsServiceTest extends TestCase
{
    use RefreshDatabase;

    public function test_backup_health_queries_have_a_status_completed_at_index(): void
    {
        $index = collect(Schema::getIndexes('backup_logs'))
            ->firstWhere('name', 'backup_logs_status_completed_at_id_index');

        $this->assertIsArray($index);
        $this->assertSame(['status', 'completed_at', 'id'], $index['columns']);
    }

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

    public function test_snapshot_degrades_safely_when_the_cache_store_fails(): void
    {
        Cache::shouldReceive('get')
            ->andThrow(new RuntimeException('cache unavailable'));

        $snapshot = app(OperationalMetricsService::class)->snapshot();

        $this->assertFalse($snapshot['backups']['worker_recently_active']);
        $this->assertNull($snapshot['audit']['permission_audit_observer']['last_failure']);
        $this->assertTrue($snapshot['database']['connected']);
    }

    public function test_health_endpoint_builds_data_and_score_from_one_snapshot(): void
    {
        $metrics = new class extends OperationalMetricsService
        {
            public int $snapshotCalls = 0;

            public function snapshot(): array
            {
                $this->snapshotCalls++;

                return [
                    'generated_at' => now()->toIso8601String(),
                    'database' => ['connected' => true],
                    'queue' => ['failed' => 0],
                    'backups' => [
                        'worker_recently_active' => true,
                        'failed_last_24h' => 0,
                        'latest_success_file_exists' => true,
                        'latest_success_checksum_matches' => true,
                    ],
                    'audit' => [
                        'permission_audit_observer' => ['last_failure' => null],
                    ],
                ];
            }
        };
        $this->app->instance(OperationalMetricsService::class, $metrics);

        $this->getJson('/api/system/health')
            ->assertOk()
            ->assertJsonPath('score.healthy', true);

        $this->assertSame(1, $metrics->snapshotCalls);
    }

    public function test_health_endpoint_hides_internal_recent_error_details(): void
    {
        AuditLog::query()->create([
            'user_id' => null,
            'action' => 'backup.failed',
            'result' => 'failed',
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

    public function test_health_score_flags_latest_successful_backup_checksum_mismatch(): void
    {
        Storage::fake('local');
        OperationalMetricsService::recordWorkerHeartbeat();

        $path = 'backups/hospital-backup-integrity.sql.gz.enc';
        Storage::disk('local')->put($path, 'tampered-payload');

        BackupLog::query()->create([
            'filename' => 'hospital-backup-integrity.sql.gz.enc',
            'path' => $path,
            'disk' => 'local',
            'status' => BackupLog::STATUS_SUCCESS,
            'type' => BackupLog::TYPE_SCHEDULED,
            'size_bytes' => strlen('expected-payload'),
            'checksum_sha256' => hash('sha256', 'expected-payload'),
            'completed_at' => now(),
        ]);

        $snapshot = app(OperationalMetricsService::class)->snapshot();

        $this->assertSame(1, $snapshot['backups']['success_last_24h']);
        $this->assertTrue($snapshot['backups']['latest_success_file_exists']);
        $this->assertFalse($snapshot['backups']['latest_success_checksum_matches']);

        $score = app(OperationalMetricsService::class)->overallHealthScore();

        $this->assertFalse($score['healthy']);
        $this->assertContains('backup_latest_integrity_mismatch', $score['issues']);
    }

    public function test_health_integrity_probe_rejects_paths_outside_the_backup_directory(): void
    {
        Storage::fake('local');
        Storage::disk('local')->put('outside.sql', 'sensitive-payload');

        BackupLog::query()->create([
            'filename' => 'outside.sql',
            'path' => 'backups/../outside.sql',
            'disk' => 'local',
            'status' => BackupLog::STATUS_SUCCESS,
            'type' => BackupLog::TYPE_MANUAL,
            'size_bytes' => strlen('sensitive-payload'),
            'checksum_sha256' => hash('sha256', 'sensitive-payload'),
            'completed_at' => now(),
        ]);

        $snapshot = app(OperationalMetricsService::class)->snapshot();

        $this->assertFalse($snapshot['backups']['latest_success_file_exists']);
        $this->assertFalse($snapshot['backups']['latest_success_checksum_matches']);
    }

    public function test_health_integrity_probe_caches_by_file_metadata_and_invalidates_on_change(): void
    {
        Storage::fake('local');
        $path = 'backups/cached-integrity.sql.gz.enc';
        $contents = 'stable-backup-payload';
        Storage::disk('local')->put($path, $contents);

        $backup = BackupLog::query()->create([
            'filename' => 'cached-integrity.sql.gz.enc',
            'path' => $path,
            'disk' => 'local',
            'status' => BackupLog::STATUS_SUCCESS,
            'type' => BackupLog::TYPE_SCHEDULED,
            'size_bytes' => strlen($contents),
            'checksum_sha256' => hash('sha256', $contents),
            'completed_at' => now(),
        ]);

        $firstSnapshot = app(OperationalMetricsService::class)->snapshot();
        $disk = Storage::disk('local');
        $fingerprint = implode('|', [
            (string) $backup->id,
            'local',
            $path,
            $backup->checksum_sha256,
            (string) $disk->size($path),
            (string) $disk->lastModified($path),
        ]);
        $cacheKey = 'operational-metrics:backup-integrity:'.hash('sha256', $fingerprint);

        $this->assertTrue($firstSnapshot['backups']['latest_success_checksum_matches']);
        $this->assertSame([
            'exists' => true,
            'checksum_matches' => true,
        ], Cache::get($cacheKey));

        Storage::disk('local')->put($path, 'changed-backup-payload-with-a-different-size');
        $changedSnapshot = app(OperationalMetricsService::class)->snapshot();

        $this->assertFalse($changedSnapshot['backups']['latest_success_checksum_matches']);
    }

    public function test_recent_errors_section_surfaces_failed_actions(): void
    {
        AuditLog::query()->create([
            'user_id' => null,
            'action' => 'backup.failed',
            'result' => 'failed',
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

    public function test_recent_errors_uses_the_indexed_result_instead_of_action_suffixes(): void
    {
        AuditLog::query()->create([
            'user_id' => null,
            'action' => 'system.operational_alert',
            'result' => 'failed',
            'entity_type' => BackupLog::class,
            'entity_id' => 10,
            'created_at' => now(),
        ]);
        AuditLog::query()->create([
            'user_id' => null,
            'action' => 'legacy.backup.failed',
            'result' => 'success',
            'entity_type' => BackupLog::class,
            'entity_id' => 11,
            'created_at' => now()->addSecond(),
        ]);

        $errors = app(OperationalMetricsService::class)->snapshot()['recent_errors'];

        $this->assertCount(1, $errors);
        $this->assertSame('system.operational_alert', $errors[0]['action']);
    }

    public function test_failure_result_migration_backfills_legacy_action_suffixes(): void
    {
        $legacy = AuditLog::query()->create([
            'user_id' => null,
            'action' => 'backup.failed',
            'result' => 'success',
            'entity_type' => BackupLog::class,
            'entity_id' => 12,
            'created_at' => now(),
        ]);
        $successful = AuditLog::query()->create([
            'user_id' => null,
            'action' => 'backup.created',
            'result' => 'success',
            'entity_type' => BackupLog::class,
            'entity_id' => 13,
            'created_at' => now(),
        ]);
        $migrationPath = database_path('migrations/2026_07_16_000001_backfill_audit_failure_results.php');

        $this->assertFileExists($migrationPath);
        $migration = require $migrationPath;
        $migration->up();

        $this->assertSame('failed', $legacy->fresh()->result);
        $this->assertSame('success', $successful->fresh()->result);
    }

    public function test_overall_health_score_reports_a_worker_idle_issue(): void
    {
        $score = app(OperationalMetricsService::class)->overallHealthScore();

        $this->assertFalse($score['healthy']);
        $this->assertContains('backup_worker_idle', $score['issues']);
        $this->assertNotEmpty($score['snapshot_generated_at']);
    }

    public function test_health_endpoint_returns_the_score_alongside_the_snapshot(): void
    {
        $response = $this->getJson('/api/system/health');

        $response->assertOk()
            ->assertJsonStructure([
                'data' => [
                    'database',
                    'queue',
                    'backups',
                    'storage',
                    'recent_errors',
                ],
                'score' => [
                    'healthy',
                    'issues',
                    'snapshot_generated_at',
                ],
            ]);
    }
}
