<?php

namespace App\Console\Commands;

use App\Actions\Backups\CreateBackupAction;
use App\Models\BackupLog;
use Illuminate\Console\Command;

class BackupDatabaseCommand extends Command
{
    protected $signature = 'hospital:backup
        {--type=scheduled : Tipo de backup: manual o scheduled}
        {--json : Emitir un resultado JSON para automatizacion local}';

    protected $description = 'Crear un respaldo local de la base de datos y registrarlo en backup_logs.';

    public function handle(CreateBackupAction $createBackup): int
    {
        $type = (string) $this->option('type');

        if (! in_array($type, [BackupLog::TYPE_MANUAL, BackupLog::TYPE_SCHEDULED], true)) {
            if ($this->option('json')) {
                $this->line(json_encode([
                    'status' => 'failed',
                    'code' => 'INVALID_BACKUP_TYPE',
                ], JSON_THROW_ON_ERROR));
            } else {
                $this->error('El tipo debe ser manual o scheduled.');
            }

            return self::FAILURE;
        }

        $backupLog = $createBackup->execute(type: $type);

        if ($backupLog->status === BackupLog::STATUS_SUCCESS) {
            if ($this->option('json')) {
                $this->line(json_encode([
                    'status' => 'success',
                    'backup_log_id' => $backupLog->id,
                    'filename' => $backupLog->filename,
                    'checksum_sha256' => $backupLog->checksum_sha256,
                ], JSON_THROW_ON_ERROR));
            } else {
                $this->info("Respaldo local creado: {$backupLog->filename}");
            }

            return self::SUCCESS;
        }

        if ($this->option('json')) {
            $this->line(json_encode([
                'status' => 'failed',
                'code' => 'BACKUP_FAILED',
                'backup_log_id' => $backupLog->id,
                'filename' => $backupLog->filename,
            ], JSON_THROW_ON_ERROR));
        } else {
            $this->error("Respaldo local fallido: {$backupLog->filename}. Revise backup_logs para el detalle operativo.");
        }

        return self::FAILURE;
    }
}
