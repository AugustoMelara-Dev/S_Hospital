<?php

namespace App\Actions\Backups;

use App\Models\AuditLog;
use App\Models\BackupLog;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;

class PruneBackupsAction
{
    public function execute(?int $keepSuccessful = null): int
    {
        if ($keepSuccessful !== null) {
            return $this->pruneType(null, max(1, $keepSuccessful), 0);
        }

        $pruned = 0;

        foreach ([BackupLog::TYPE_MANUAL, BackupLog::TYPE_SCHEDULED] as $type) {
            $policy = config("backups.retention.{$type}", []);
            $pruned += $this->pruneType(
                $type,
                max(1, (int) ($policy['keep_successful'] ?? config('backups.retention.successful_count', 30))),
                max(0, (int) ($policy['keep_days'] ?? 0)),
            );
        }

        return $pruned;
    }

    private function pruneType(?string $type, int $keepSuccessful, int $keepDays): int
    {
        $query = BackupLog::query()->where('status', BackupLog::STATUS_SUCCESS);

        if ($type !== null) {
            $query->where('type', $type);
        }

        $prunableBackups = $query
            ->orderByDesc('completed_at')
            ->orderByDesc('id')
            ->offset($keepSuccessful)
            ->limit(PHP_INT_MAX)
            ->cursor();

        $cutoff = now()->subDays($keepDays);

        $pruned = 0;

        foreach ($prunableBackups as $backupLog) {
            if (! $this->isOldEnough($backupLog, $cutoff)) {
                continue;
            }

            if (! $this->deleteFileIfSafe($backupLog)) {
                $this->audit($backupLog, 'backup.prune_skipped');

                continue;
            }

            $this->audit($backupLog, 'backup.pruned');
            $backupLog->delete();
            $pruned++;
        }

        return $pruned;
    }

    private function isOldEnough(BackupLog $backupLog, Carbon $cutoff): bool
    {
        $completedAt = $backupLog->completed_at ?? $backupLog->created_at;

        return $completedAt === null || $completedAt->lessThanOrEqualTo($cutoff);
    }

    private function deleteFileIfSafe(BackupLog $backupLog): bool
    {
        $path = (string) $backupLog->path;

        if (
            $backupLog->disk !== 'local' ||
            ! str_starts_with($path, 'backups/') ||
            str_contains($path, '..')
        ) {
            return false;
        }

        if (Storage::disk('local')->exists($path) && ! Storage::disk('local')->delete($path)) {
            return false;
        }

        return true;
    }

    private function audit(BackupLog $backupLog, string $action): void
    {
        AuditLog::query()->create([
            'user_id' => null,
            'action' => $action,
            'entity_type' => BackupLog::class,
            'entity_id' => $backupLog->id,
            'old_values' => null,
            'new_values' => [
                'filename' => $backupLog->filename,
                'status' => $backupLog->status,
                'type' => $backupLog->type,
                'format' => $backupLog->format,
                'encrypted' => $backupLog->encrypted,
                'size_bytes' => $backupLog->size_bytes,
                'checksum_sha256' => $backupLog->checksum_sha256,
            ],
            'created_at' => now(),
        ]);
    }
}
