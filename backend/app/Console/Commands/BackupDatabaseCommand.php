<?php

namespace App\Console\Commands;

use App\Actions\Backups\CreateBackupAction;
use App\Models\BackupLog;
use Illuminate\Console\Command;

class BackupDatabaseCommand extends Command
{
    protected $signature = 'hospital:backup {--type=scheduled : Tipo de backup: manual o scheduled}';

    protected $description = 'Crear un backup local de la base de datos y registrar backup_logs.';

    public function handle(CreateBackupAction $createBackup): int
    {
        $type = (string) $this->option('type');

        if (! in_array($type, [BackupLog::TYPE_MANUAL, BackupLog::TYPE_SCHEDULED], true)) {
            $this->error('El tipo debe ser manual o scheduled.');

            return self::FAILURE;
        }

        $backupLog = $createBackup->execute(type: $type);

        if ($backupLog->status === BackupLog::STATUS_SUCCESS) {
            $this->info("Backup local creado: {$backupLog->filename}");

            return self::SUCCESS;
        }

        $this->error("Backup local fallido: {$backupLog->filename}. Revise backup_logs para el detalle operativo.");

        return self::FAILURE;
    }
}
