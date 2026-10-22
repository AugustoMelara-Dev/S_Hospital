<?php

namespace App\Console\Commands;

use App\Actions\Backups\VerifyBackupAction;
use App\Models\BackupLog;
use App\Support\OperationalMessageSanitizer;
use Illuminate\Console\Command;
use Throwable;

class VerifyBackupCommand extends Command
{
    protected $signature = 'hospital:verify-backup
        {backup? : ID del respaldo a verificar}
        {--latest : Verifica el ultimo respaldo exitoso}
        {--json : Emitir un resultado JSON para automatizacion local}';

    protected $description = 'Verifica que un respaldo sea recuperable: archivo, tamano, SHA-256, identidad de llave y descifrado completo.';

    public function handle(VerifyBackupAction $verifyBackup): int
    {
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
                ? 'No hay respaldos con estado success para verificar.'
                : 'Respaldo no encontrado.');
        }

        try {
            $result = $verifyBackup->execute($backupLog);
        } catch (Throwable $exception) {
            return $this->failure($this->sanitized($exception->getMessage()));
        }

        if ($this->option('json')) {
            $this->line(json_encode($result, JSON_THROW_ON_ERROR));
        } else {
            $this->line($this->humanMessage($result));
        }

        return $result['status'] === VerifyBackupAction::STATUS_VERIFIED
            ? self::SUCCESS
            : self::FAILURE;
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

    /**
     * @param  array<string, mixed>  $result
     */
    private function humanMessage(array $result): string
    {
        return match ($result['status'] ?? '') {
            VerifyBackupAction::STATUS_VERIFIED => 'Respaldo recuperable verificado (archivo, SHA-256, llave y descifrado completos).',
            VerifyBackupAction::STATUS_KEY_MISMATCH => 'Llave incorrecta: '.$this->stringField($result, 'error', 'el respaldo no se descifra con la llave configurada.'),
            default => 'Respaldo no recuperable: '.$this->stringField($result, 'error', 'verificacion fallida.'),
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

    private function failure(string $message): int
    {
        if ($this->option('json')) {
            $this->line(json_encode([
                'status' => 'failed',
                'code' => 'BACKUP_VERIFY_FAILED',
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
