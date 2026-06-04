<?php

declare(strict_types=1);

namespace App\Actions\Reports;

use Illuminate\Database\Connection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Snapshot of operational metrics exposed to /api/system/health.
 *
 * Designed to be cheap so it can be polled every minute by the
 * cashier dashboard without putting pressure on the LAN server.
 * Database and disk calls are wrapped in try/catch so a failing
 * subsystem never breaks the entire health response.
 */
class OperationalMetricsService
{
    /**
     * @return array<string, mixed>
     */
    public function snapshot(): array
    {
        return [
            'generated_at' => now()->toIso8601String(),
            'database' => $this->database(),
            'database_lag' => $this->databaseLag(),
            'queue' => $this->queue(),
            'queue_size' => $this->queueSize(),
            'backups' => $this->backups(),
            'storage' => $this->storage(),
            'disk_free_gb' => $this->diskFreeGb(),
            'app_uptime_s' => $this->appUptime(),
            'recent_errors' => $this->recentErrors(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function database(): array
    {
        try {
            $connection = DB::connection();
            $driver = $connection->getDriverName();
            $connected = $this->isConnected($connection);

            return [
                'driver' => $driver,
                'connected' => $connected,
            ];
        } catch (Throwable $exception) {
            Log::warning('OperationalMetricsService: database probe failed', ['message' => $exception->getMessage()]);

            return [
                'driver' => 'unknown',
                'connected' => false,
                'error' => 'probe_failed',
            ];
        }
    }

    /**
     * @return array<string, mixed>
     */
    private function queue(): array
    {
        $stats = [
            'connection' => (string) config('queue.default'),
        ];

        try {
            $pending = (int) DB::table('jobs')->count();
            $failed = (int) DB::table('failed_jobs')->count();

            $stats['pending'] = $pending;
            $stats['failed'] = $failed;
        } catch (Throwable $exception) {
            Log::warning('OperationalMetricsService: queue probe failed', ['message' => $exception->getMessage()]);
            $stats['error'] = 'probe_failed';
        }

        return $stats;
    }

    /**
     * @return array<string, mixed>
     */
    private function backups(): array
    {
        $stats = [
            'worker_recently_active' => $this->workerRecentlyActive(),
        ];

        try {
            $stats['pending'] = (int) DB::table('backup_logs')->where('status', 'pending')->count();
            $stats['success_last_24h'] = (int) DB::table('backup_logs')
                ->where('status', 'success')
                ->where('completed_at', '>=', now()->subDay())
                ->count();
            $stats['failed_last_24h'] = (int) DB::table('backup_logs')
                ->where('status', 'failed')
                ->where('completed_at', '>=', now()->subDay())
                ->count();
        } catch (Throwable $exception) {
            Log::warning('OperationalMetricsService: backup probe failed', ['message' => $exception->getMessage()]);
            $stats['error'] = 'probe_failed';
        }

        return $stats;
    }

    /**
     * @return array<string, mixed>
     */
    private function storage(): array
    {
        try {
            $summary = DB::table('backup_logs')
                ->where('status', 'success')
                ->selectRaw('COUNT(*) as backup_files, COALESCE(SUM(size_bytes), 0) as backup_bytes')
                ->first();

            return [
                'backup_files' => (int) ($summary?->backup_files ?? 0),
                'backup_bytes' => (int) ($summary?->backup_bytes ?? 0),
            ];
        } catch (Throwable $exception) {
            Log::warning('OperationalMetricsService: storage probe failed', ['message' => $exception->getMessage()]);

            return [
                'backup_files' => 0,
                'backup_bytes' => 0,
                'error' => 'probe_failed',
            ];
        }
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function recentErrors(): array
    {
        try {
            return DB::table('audit_logs')
                ->where(static function ($query): void {
                    $query->where('action', 'like', '%.failed')
                        ->orWhere('action', 'like', '%.error');
                })
                ->orderByDesc('created_at')
                ->limit(5)
                ->get(['action', 'created_at'])
                ->map(static fn ($row) => [
                    'action' => (string) $row->action,
                    'created_at' => (string) $row->created_at,
                ])
                ->all();
        } catch (Throwable) {
            return [];
        }
    }

    private function isConnected(Connection $connection): bool
    {
        try {
            $connection->getPdo();

            return true;
        } catch (Throwable) {
            return false;
        }
    }

    /**
     * @return array<string, mixed>
     */
    private function databaseLag(): array
    {
        $result = ['status' => 'unknown'];

        try {
            $connection = DB::connection();
            $driver = $connection->getDriverName();

            if ($driver === 'mysql' || $driver === 'mariadb') {
                $rows = $connection->select('SHOW STATUS LIKE "Seconds_Behind_Master"');
                $seconds = isset($rows[0]) ? (int) $rows[0]->Value : null;
                $result = [
                    'status' => $seconds === null ? 'standalone' : ($seconds > 30 ? 'lagging' : 'ok'),
                    'seconds' => $seconds,
                ];
            } else {
                $result = ['status' => 'not_applicable', 'driver' => $driver];
            }
        } catch (Throwable $exception) {
            Log::warning('OperationalMetricsService: db_lag probe failed', ['message' => $exception->getMessage()]);
            $result = ['status' => 'error', 'error' => 'probe_failed'];
        }

        return $result;
    }

    /**
     * @return array<string, mixed>
     */
    private function queueSize(): array
    {
        $sizes = ['backups' => 0, 'failed_last_hour' => 0];

        try {
            $sizes['backups'] = (int) DB::table('jobs')->where('queue', 'backups')->count();
            $sizes['failed_last_hour'] = (int) DB::table('failed_jobs')
                ->where('failed_at', '>=', now()->subHour())
                ->count();
        } catch (Throwable $exception) {
            Log::warning('OperationalMetricsService: queue_size probe failed', ['message' => $exception->getMessage()]);
            return ['error' => 'probe_failed'];
        }

        return $sizes;
    }

    /**
     * @return array<string, mixed>
     */
    private function diskFreeGb(): array
    {
        $result = ['path' => storage_path(), 'free_gb' => null];

        try {
            $path = storage_path();
            $total = @disk_total_space($path);
            $free = @disk_free_space($path);

            if (is_int($total) && is_int($free) && $total > 0) {
                $result['total_gb'] = round($total / 1_073_741_824, 2);
                $result['free_gb'] = round($free / 1_073_741_824, 2);
                $result['used_pct'] = round((($total - $free) / $total) * 100, 1);
            }
        } catch (Throwable $exception) {
            Log::warning('OperationalMetricsService: disk probe failed', ['message' => $exception->getMessage()]);
        }

        return $result;
    }

    /**
     * @return array<string, mixed>
     */
    private function appUptime(): array
    {
        $startedAt = defined('LARAVEL_START') ? LARAVEL_START : null;

        if (! is_numeric($startedAt)) {
            return ['seconds' => null];
        }

        $uptime = microtime(true) - (int) $startedAt;

        return [
            'seconds' => (int) $uptime,
            'started_at' => gmdate('c', (int) $startedAt),
        ];
    }

    private function workerRecentlyActive(): bool
    {
        $key = 'operational-metrics:worker-heartbeat';
        $heartbeat = Cache::get($key);

        if ($heartbeat === null) {
            return false;
        }

        return $heartbeat >= now()->subMinutes(5)->getTimestamp();
    }

    /**
     * Called by the backup worker after every successful job so the
     * health probe can flag a stopped worker.
     */
    public static function recordWorkerHeartbeat(): void
    {
        Cache::put('operational-metrics:worker-heartbeat', now()->getTimestamp(), now()->addHour());
    }

    /**
     * Convenience helper for the cashier dashboard that flattens
     * the snapshot into a single boolean + list of issues. The
     * frontend can then colour the worker badge without having to
     * re-interpret the full snapshot.
     *
     * @return array{healthy: bool, issues: list<string>, snapshot_generated_at: ?string}
     */
    public function overallHealthScore(): array
    {
        $snapshot = $this->snapshot();
        $issues = [];

        if (! ($snapshot['database']['connected'] ?? false)) {
            $issues[] = 'database_disconnected';
        }

        if (($snapshot['queue']['failed'] ?? 0) > 0) {
            $issues[] = 'queue_has_failures';
        }

        if (! ($snapshot['backups']['worker_recently_active'] ?? false)) {
            $issues[] = 'backup_worker_idle';
        }

        if (($snapshot['backups']['failed_last_24h'] ?? 0) > 0) {
            $issues[] = 'backup_failures_in_24h';
        }

        return [
            'healthy' => $issues === [],
            'issues' => $issues,
            'snapshot_generated_at' => $snapshot['generated_at'] ?? null,
        ];
    }
}
