<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Actions\Backups\CreateBackupAction;
use App\Actions\Reports\OperationalMetricsService;
use App\Models\BackupLog;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

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
}
