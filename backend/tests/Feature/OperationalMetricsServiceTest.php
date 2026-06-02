<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Actions\Reports\OperationalMetricsService;
use Illuminate\Foundation\Testing\RefreshDatabase;
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

    public function test_worker_heartbeat_flips_to_true_after_record(): void
    {
        $service = app(OperationalMetricsService::class);

        $this->assertFalse($service->snapshot()['backups']['worker_recently_active']);

        OperationalMetricsService::recordWorkerHeartbeat();

        $this->assertTrue($service->snapshot()['backups']['worker_recently_active']);
    }
}
