<?php

namespace App\Jobs;

use App\Actions\Backups\CreateBackupAction;
use App\Actions\Reports\OperationalMetricsService;
use App\Models\AuditLog;
use App\Models\BackupLog;
use App\Support\OperationalMessageSanitizer;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Throwable;

class RunBackupJob implements ShouldQueue
{
    use Queueable;

    public int $tries = 1;

    public int $timeout = 600;

    public function __construct(
        private readonly int $backupLogId,
    ) {
        $this->onQueue('backups');
    }

    public function handle(CreateBackupAction $createBackup): void
    {
        $backupLog = BackupLog::query()->findOrFail($this->backupLogId);

        $createBackup->run($backupLog);

        OperationalMetricsService::recordWorkerHeartbeat();
    }

    public function failed(?Throwable $exception): void
    {
        $backupLog = BackupLog::query()->find($this->backupLogId);

        if (! $backupLog instanceof BackupLog || $backupLog->status !== BackupLog::STATUS_PENDING) {
            return;
        }

        $message = OperationalMessageSanitizer::message($exception?->getMessage())
            ?? 'El worker de respaldos se detuvo antes de completar el respaldo. Revise el servicio de backups.';

        $backupLog->forceFill([
            'status' => BackupLog::STATUS_FAILED,
            'completed_at' => now(),
            'error_message' => $message,
        ])->save();

        AuditLog::query()->create([
            'user_id' => $backupLog->created_by,
            'action' => 'backup.failed',
            'result' => 'failed',
            'entity_type' => BackupLog::class,
            'entity_id' => $backupLog->id,
            'old_values' => null,
            'new_values' => [
                'filename' => $backupLog->filename,
                'status' => $backupLog->status,
                'type' => $backupLog->type,
                'failure_source' => 'queue_worker',
            ],
            'created_at' => now(),
        ]);
    }
}
