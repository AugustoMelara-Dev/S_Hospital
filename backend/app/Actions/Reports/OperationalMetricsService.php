<?php

declare(strict_types=1);

namespace App\Actions\Reports;

use App\Jobs\RunBackupJob;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
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
            'queue' => $this->queue(),
            'backups' => $this->backups(),
            'storage' => $this->storage(),
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
            $disk = Storage::disk('local');
            $backupPath = 'backups';

            $total = 0;
            $count = 0;

            foreach ($disk->files($backupPath) as $file) {
                $size = $disk->size($file);
                if ($size !== false) {
                    $total += $size;
                    $count++;
                }
            }

            return [
                'backup_files' => $count,
                'backup_bytes' => $total,
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
                ->where('action', 'like', '%.failed')
                ->orWhere('action', 'like', '%.error')
                ->orderByDesc('created_at')
                ->limit(5)
                ->get(['id', 'action', 'entity_type', 'created_at'])
                ->map(static fn ($row) => [
                    'id' => (int) $row->id,
                    'action' => (string) $row->action,
                    'entity_type' => (string) $row->entity_type,
                    'created_at' => (string) $row->created_at,
                ])
                ->all();
        } catch (Throwable) {
            return [];
        }
    }

    private function isConnected($connection): bool
    {
        try {
            return $connection->getPdo() !== null;
        } catch (Throwable) {
            return false;
        }
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
}
