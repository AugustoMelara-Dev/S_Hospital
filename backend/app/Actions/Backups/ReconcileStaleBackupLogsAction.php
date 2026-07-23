<?php

namespace App\Actions\Backups;

use App\Models\AuditLog;
use App\Models\BackupLog;
use Illuminate\Support\Facades\DB;

class ReconcileStaleBackupLogsAction
{
    public const STALE_AFTER_MINUTES = 15;

    public function execute(): int
    {
        $candidateIds = BackupLog::query()
            ->where('status', BackupLog::STATUS_PENDING)
            ->where('created_at', '<=', now()->subMinutes(self::STALE_AFTER_MINUTES))
            ->pluck('id');

        $reconciled = 0;

        foreach ($candidateIds as $candidateId) {
            $changed = DB::transaction(function () use ($candidateId): bool {
                $backupLog = BackupLog::query()->lockForUpdate()->find($candidateId);

                if (
                    ! $backupLog instanceof BackupLog
                    || $backupLog->status !== BackupLog::STATUS_PENDING
                    || $backupLog->created_at === null
                    || $backupLog->created_at->isAfter(now()->subMinutes(self::STALE_AFTER_MINUTES))
                ) {
                    return false;
                }

                $backupLog->forceFill([
                    'status' => BackupLog::STATUS_FAILED,
                    'completed_at' => now(),
                    'error_message' => 'El respaldo no terminó dentro del tiempo esperado. Puede crear uno nuevo.',
                ])->save();

                AuditLog::query()->create([
                    'user_id' => $backupLog->created_by,
                    'action' => 'backup.failed',
                    'result' => 'failed',
                    'entity_type' => BackupLog::class,
                    'entity_id' => $backupLog->id,
                    'old_values' => ['status' => BackupLog::STATUS_PENDING],
                    'new_values' => [
                        'status' => BackupLog::STATUS_FAILED,
                        'failure_source' => 'stale_pending_reconciliation',
                    ],
                    'reason' => 'El respaldo superó el tiempo máximo de ejecución.',
                    'created_at' => now(),
                ]);

                return true;
            });

            if ($changed) {
                $reconciled++;
            }
        }

        return $reconciled;
    }
}
