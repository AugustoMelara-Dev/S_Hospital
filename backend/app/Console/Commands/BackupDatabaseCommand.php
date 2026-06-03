<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Actions\Backups\CreateBackupAction;
use App\Models\BackupLog;
use Illuminate\Console\Command;

class BackupDatabaseCommand extends Command
{
    protected $signature = 'hospital:backup {--type=scheduled : Tipo de backup: manual o scheduled}';

    protected $description = 'Crear un respaldo local de la base de datos y registrarlo en backup_logs.';

    public function handle(CreateBackupAction $createBackup): int
    {
        $type = (string) $this->option('type');

        if (! in_array($type, [BackupLog::TYPE_MANUAL, BackupLog::TYPE_SCHEDULED], true)) {
            $this->error('El tipo debe ser manual o scheduled.');

            return self::FAILURE;
        }

        $backupLog = $createBackup->execute(type: $type);

        if ($backupLog->status === BackupLog::STATUS_SUCCESS) {
            $this->info("Respaldo local creado: {$backupLog->filename}");

            return self::SUCCESS;
        }

        $this->error("Respaldo local fallido: {$backupLog->filename}. Revise backup_logs para el detalle operativo.");

        return self::FAILURE;
    }
}
