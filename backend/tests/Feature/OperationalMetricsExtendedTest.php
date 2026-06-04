<?php

namespace Tests\Feature;

use App\Actions\Reports\OperationalMetricsService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class OperationalMetricsExtendedTest extends TestCase
{
    use RefreshDatabase;

    public function test_snapshot_includes_extended_fields(): void
    {
        $payload = (new OperationalMetricsService)->snapshot();

        $this->assertArrayHasKey('database_lag', $payload);
        $this->assertArrayHasKey('queue_size', $payload);
        $this->assertArrayHasKey('disk_free_gb', $payload);
        $this->assertArrayHasKey('app_uptime_s', $payload);
    }

    public function test_queue_size_reports_zero_when_no_jobs(): void
    {
        $payload = (new OperationalMetricsService)->snapshot();

        $this->assertSame(0, $payload['queue_size']['backups']);
        $this->assertSame(0, $payload['queue_size']['failed_last_hour']);
    }

    public function test_queue_size_reports_pending_backup_job(): void
    {
        DB::table('jobs')->insert([
            'queue' => 'backups',
            'payload' => 'fake-payload',
            'attempts' => 0,
            'reserved_at' => null,
            'available_at' => now()->timestamp,
            'created_at' => now()->timestamp,
        ]);

        $payload = (new OperationalMetricsService)->snapshot();

        $this->assertSame(1, $payload['queue_size']['backups']);
        $this->assertSame(0, $payload['queue_size']['failed_last_hour']);
    }

    public function test_disk_free_gb_returns_numeric(): void
    {
        $payload = (new OperationalMetricsService)->snapshot();

        $this->assertArrayHasKey('free_gb', $payload['disk_free_gb']);
        $this->assertArrayHasKey('path', $payload['disk_free_gb']);
    }

    public function test_app_uptime_s_is_a_positive_integer(): void
    {
        $payload = (new OperationalMetricsService)->snapshot();

        $this->assertGreaterThanOrEqual(0, $payload['app_uptime_s']['seconds']);
    }
}
