<?php

declare(strict_types=1);

namespace App\Actions\Reports;

use App\Models\BackupLog;
use Illuminate\Database\Connection;
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
            'audit' => $this->audit(),
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
            'connection' => $this->stringValue(config('queue.default')),
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
            $since = now()->subDay();
            $summary = DB::table('backup_logs')
                ->selectRaw(
                    'COALESCE(SUM(CASE WHEN status = ? THEN 1 ELSE 0 END), 0) as pending,
                    COALESCE(SUM(CASE WHEN status = ? AND completed_at >= ? THEN 1 ELSE 0 END), 0) as success_last_24h,
                    COALESCE(SUM(CASE WHEN status = ? AND completed_at >= ? THEN 1 ELSE 0 END), 0) as failed_last_24h',
                    ['pending', 'success', $since, 'failed', $since],
                )
                ->first();

            $stats['pending'] = (int) ($summary->pending ?? 0);
            $stats['success_last_24h'] = (int) ($summary->success_last_24h ?? 0);
            $stats['failed_last_24h'] = (int) ($summary->failed_last_24h ?? 0);

            $latestSuccessfulBackup = BackupLog::query()
                ->where('status', BackupLog::STATUS_SUCCESS)
                ->orderByDesc('completed_at')
                ->orderByDesc('id')
                ->first(['id', 'path', 'disk', 'checksum_sha256']);

            $latestIntegrity = $this->latestSuccessfulBackupIntegrity($latestSuccessfulBackup);

            $stats['latest_success_file_exists'] = $latestIntegrity['exists'];
            $stats['latest_success_checksum_matches'] = $latestIntegrity['checksum_matches'];
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
                'backup_files' => (int) ($summary->backup_files ?? 0),
                'backup_bytes' => (int) ($summary->backup_bytes ?? 0),
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
     * @return array<string, mixed>
     */
    private function audit(): array
    {
        try {
            $lastPermissionAuditFailure = Cache::get('permission_audit_observer:last_failure');
        } catch (Throwable $exception) {
            Log::warning('OperationalMetricsService: audit cache probe failed', ['message' => $exception->getMessage()]);
            $lastPermissionAuditFailure = null;
        }

        return [
            'permission_audit_observer' => [
                'last_failure' => is_array($lastPermissionAuditFailure) ? $lastPermissionAuditFailure : null,
            ],
        ];
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function recentErrors(): array
    {
        try {
            return DB::table('audit_logs')
                ->where('result', 'failed')
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

    private function workerRecentlyActive(): bool
    {
        $key = 'operational-metrics:worker-heartbeat';

        try {
            $heartbeat = Cache::get($key);
        } catch (Throwable $exception) {
            Log::warning('OperationalMetricsService: worker cache probe failed', ['message' => $exception->getMessage()]);

            return false;
        }

        if ($heartbeat === null) {
            return false;
        }

        return $heartbeat >= now()->subMinutes(5)->getTimestamp();
    }

    /**
     * @return array{exists: bool|null, checksum_matches: bool|null}
     */
    private function latestSuccessfulBackupIntegrity(?BackupLog $backupLog): array
    {
        if ($backupLog === null) {
            return [
                'exists' => null,
                'checksum_matches' => null,
            ];
        }

        if (
            $backupLog->disk !== 'local'
            || $backupLog->path === null
            || $backupLog->checksum_sha256 === null
            || ! $this->isSafeBackupPath($backupLog->path)
        ) {
            return [
                'exists' => false,
                'checksum_matches' => false,
            ];
        }

        try {
            $disk = Storage::disk($backupLog->disk);

            if (! $disk->exists($backupLog->path)) {
                return [
                    'exists' => false,
                    'checksum_matches' => false,
                ];
            }

            $fingerprint = implode('|', [
                (string) $backupLog->id,
                $backupLog->disk,
                $backupLog->path,
                $backupLog->checksum_sha256,
                (string) $disk->size($backupLog->path),
                (string) $disk->lastModified($backupLog->path),
            ]);
            $cacheKey = 'operational-metrics:backup-integrity:'.hash('sha256', $fingerprint);

            return Cache::remember($cacheKey, now()->addMinutes(5), function () use ($backupLog, $disk): array {
                $absolutePath = $disk->path($backupLog->path);
                if (is_file($absolutePath)) {
                    $checksum = hash_file('sha256', $absolutePath);
                } else {
                    $contents = $disk->get($backupLog->path);
                    $checksum = is_string($contents) ? hash('sha256', $contents) : false;
                }

                return [
                    'exists' => true,
                    'checksum_matches' => is_string($checksum)
                        && hash_equals($backupLog->checksum_sha256, $checksum),
                ];
            });
        } catch (Throwable $exception) {
            Log::warning('OperationalMetricsService: backup integrity probe failed', [
                'backup_log_id' => $backupLog->id,
                'message' => $exception->getMessage(),
            ]);

            return [
                'exists' => false,
                'checksum_matches' => false,
            ];
        }
    }

    private function isSafeBackupPath(string $path): bool
    {
        return str_starts_with($path, 'backups/')
            && ! str_contains($path, '..')
            && ! str_starts_with($path, '/')
            && preg_match('/^[A-Za-z]:[\\\\\/]/', $path) !== 1;
    }

    /**
     * Called by the backup worker after every successful job so the
     * health probe can flag a stopped worker.
     */
    public static function recordWorkerHeartbeat(): void
    {
        Cache::put('operational-metrics:worker-heartbeat', now()->getTimestamp(), now()->addHour());
        Cache::forget('operational-metrics:http-snapshot');
    }

    /**
     * Convenience helper for the cashier dashboard that flattens
     * the snapshot into a single boolean + list of issues. The
     * frontend can then colour the worker badge without having to
     * re-interpret the full snapshot.
     *
     * @param  array<string, mixed>|null  $snapshot
     * @return array{healthy: bool, issues: list<string>, snapshot_generated_at: ?string}
     */
    public function overallHealthScore(?array $snapshot = null): array
    {
        $snapshot ??= $this->snapshot();
        $database = $this->section($snapshot['database'] ?? null);
        $queue = $this->section($snapshot['queue'] ?? null);
        $backups = $this->section($snapshot['backups'] ?? null);
        $audit = $this->section($snapshot['audit'] ?? null);
        $permissionObserver = $this->section($audit['permission_audit_observer'] ?? null);
        $issues = [];

        if (($database['connected'] ?? false) !== true) {
            $issues[] = 'database_disconnected';
        }

        if ($this->countValue($queue['failed'] ?? null) > 0) {
            $issues[] = 'queue_has_failures';
        }

        if (($backups['worker_recently_active'] ?? false) !== true) {
            $issues[] = 'backup_worker_idle';
        }

        if ($this->countValue($backups['failed_last_24h'] ?? null) > 0) {
            $issues[] = 'backup_failures_in_24h';
        }

        if (($backups['latest_success_file_exists'] ?? null) === false) {
            $issues[] = 'backup_latest_file_missing';
        } elseif (($backups['latest_success_checksum_matches'] ?? null) === false) {
            $issues[] = 'backup_latest_integrity_mismatch';
        }

        if (($permissionObserver['last_failure'] ?? null) !== null) {
            $issues[] = 'permission_audit_observer_failed';
        }

        return [
            'healthy' => $issues === [],
            'issues' => $issues,
            'snapshot_generated_at' => $this->nullableString($snapshot['generated_at'] ?? null),
        ];
    }

    /** @return array<string, mixed> */
    private function section(mixed $value): array
    {
        if (! is_array($value)) {
            return [];
        }

        $section = [];
        foreach ($value as $key => $item) {
            if (is_string($key)) {
                $section[$key] = $item;
            }
        }

        return $section;
    }

    private function countValue(mixed $value): int
    {
        return is_int($value) && $value >= 0 ? $value : 0;
    }

    private function nullableString(mixed $value): ?string
    {
        return is_string($value) ? $value : null;
    }

    private function stringValue(mixed $value): string
    {
        return $this->nullableString($value) ?? '';
    }
}
