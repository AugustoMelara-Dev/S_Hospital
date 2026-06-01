<?php

namespace App\Actions\Backups;

use App\Models\AuditLog;
use App\Models\BackupLog;
use Illuminate\Support\Facades\Storage;

class PruneBackupsAction
{
    public function execute(?int $keepSuccessful = null): int
    {
        $keepSuccessful ??= (int) config('backups.retention.successful_count', 30);
        $keepSuccessful = max(1, $keepSuccessful);

        $prunableBackups = BackupLog::query()
            ->where('status', BackupLog::STATUS_SUCCESS)
            ->orderByDesc('completed_at')
            ->orderByDesc('id')
            ->get()
            ->skip($keepSuccessful);

        $pruned = 0;

        foreach ($prunableBackups as $backupLog) {
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
                'size_bytes' => $backupLog->size_bytes,
                'checksum_sha256' => $backupLog->checksum_sha256,
            ],
            'created_at' => now(),
        ]);
    }
}
