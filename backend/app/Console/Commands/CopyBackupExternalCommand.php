<?php

namespace App\Console\Commands;

use App\Actions\Backups\ExternalBackupCopyAction;
use App\Models\BackupLog;
use App\Support\OperationalMessageSanitizer;
use Illuminate\Console\Command;
use Throwable;

class CopyBackupExternalCommand extends Command
{
    protected $signature = 'hospital:backup-copy-external
        {backup? : ID del respaldo a copiar}
        {--latest : Copia el ultimo respaldo exitoso}
        {--json : Emitir un resultado JSON para automatizacion local}';

    protected $description = 'Copia cifrada y verificada a un destino externo configurado. Desactivada por defecto; sin destino real no declara copia desplegada.';

    public function handle(ExternalBackupCopyAction $copyBackup): int
    {
        if (! $copyBackup->enabled()) {
            return $this->outputResult(null, disabledByConfiguration: true);
        }

        $backupId = $this->argument('backup');
        $latest = (bool) $this->option('latest');

        if ($backupId !== null && $latest) {
            return $this->failure('Indique un ID de respaldo o --latest, no ambos.');
        }

        if ($backupId === null && ! $latest) {
            return $this->failure('Indique el ID del respaldo o use --latest.');
        }

        try {
            $backupLog = $latest
                ? BackupLog::query()
                    ->where('status', BackupLog::STATUS_SUCCESS)
                    ->orderByDesc('completed_at')
                    ->orderByDesc('id')
                    ->first()
                : $this->findBackup((string) $backupId);
        } catch (Throwable $exception) {
            return $this->failure($this->sanitized($exception->getMessage()));
        }

        if (! $backupLog instanceof BackupLog) {
            return $this->failure($latest
                ? 'No hay respaldos con estado success para copiar.'
                : 'Respaldo no encontrado.');
        }

        try {
            $result = $copyBackup->execute($backupLog);
        } catch (Throwable $exception) {
            return $this->failure($this->sanitized($exception->getMessage()));
        }

        return $this->outputResult($result, disabledByConfiguration: false);
    }

    /**
     * @param  array<string, mixed>|null  $result
     */
    private function outputResult(
        ?array $result,
        bool $disabledByConfiguration,
    ): int {
        if ($disabledByConfiguration) {
            $payload = [
                'status' => ExternalBackupCopyAction::STATUS_DISABLED,
                'external_configured' => false,
                'external_deployed' => false,
                'message' => 'La copia externa no esta activada (HOSPITAL_BACKUP_EXTERNAL_ENABLED=false).',
            ];

            if ($this->option('json')) {
                $this->line(json_encode($payload, JSON_THROW_ON_ERROR));
            } else {
                $this->line((string) $payload['message']);
            }

            return self::SUCCESS;
        }

        $result ??= ['status' => ExternalBackupCopyAction::STATUS_FAILED, 'message' => 'Sin resultado.'];

        if ($this->option('json')) {
            $this->line(json_encode($result, JSON_THROW_ON_ERROR));
        } else {
            $this->line($this->humanMessage($this->stringField($result, 'status', ''), $result));
        }

        return ($result['status'] ?? '') === ExternalBackupCopyAction::STATUS_FAILED
            ? self::FAILURE
            : self::SUCCESS;
    }

    /**
     * @param  array<string, mixed>  $result
     */
    private function humanMessage(string $status, array $result): string
    {
        return match ($status) {
            ExternalBackupCopyAction::STATUS_VERIFIED => 'Copia externa verificada en el destino configurado.',
            ExternalBackupCopyAction::STATUS_COPIED => 'Copia externa escrita; pendiente de verificacion.',
            ExternalBackupCopyAction::STATUS_DISABLED => 'La copia externa no esta activada.',
            default => 'Copia externa fallida: '.$this->stringField($result, 'message', 'revise el registro de copias.'),
        };
    }

    /**
     * @param  array<string, mixed>  $result
     */
    private function stringField(array $result, string $key, string $default): string
    {
        $value = $result[$key] ?? null;

        return is_string($value) && $value !== '' ? $value : $default;
    }

    private function findBackup(string $backupId): BackupLog
    {
        if (ctype_digit($backupId) === false) {
            throw new \RuntimeException('El ID del respaldo debe ser numerico.');
        }

        $backupLog = BackupLog::query()->find((int) $backupId);

        if (! $backupLog instanceof BackupLog) {
            throw new \RuntimeException('Respaldo no encontrado.');
        }

        return $backupLog;
    }

    private function failure(string $message): int
    {
        if ($this->option('json')) {
            $this->line(json_encode([
                'status' => 'failed',
                'external_configured' => true,
                'external_deployed' => false,
                'code' => 'BACKUP_EXTERNAL_COPY_FAILED',
                'message' => $message,
            ], JSON_THROW_ON_ERROR));
        } else {
            $this->error($message);
        }

        return self::FAILURE;
    }

    private function sanitized(string $message): string
    {
        return OperationalMessageSanitizer::message($message)
            ?? 'Error tecnico registrado. Revise el paquete de soporte.';
    }
}
