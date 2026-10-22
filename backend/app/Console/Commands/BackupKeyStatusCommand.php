<?php

namespace App\Console\Commands;

use App\Actions\Backups\BackupFileCipher;
use App\Actions\Backups\LastRecoverableBackupAction;
use App\Models\BackupLog;
use Illuminate\Console\Command;
use Throwable;

class BackupKeyStatusCommand extends Command
{
    protected $signature = 'hospital:backup-key-status
        {--json : Emitir un resultado JSON para automatizacion local}';

    protected $description = 'Muestra el estado de la llave de respaldos (fingerprint, nunca la clave) y su coincidencia con los respaldos registrados.';

    public function handle(BackupFileCipher $cipher, LastRecoverableBackupAction $lastRecoverable): int
    {
        $configuredKey = config('backups.encryption.key');
        $configured = is_string($configuredKey) && trim($configuredKey) !== '';
        $fingerprint = null;

        if ($configured) {
            try {
                $fingerprint = $cipher->keyIdentifier();
            } catch (Throwable) {
                $configured = false;
            }
        }

        $latestCreationKeyMatches = null;
        $backupsWithOtherKey = 0;

        if ($fingerprint !== null) {
            $latestSuccess = BackupLog::query()
                ->where('status', BackupLog::STATUS_SUCCESS)
                ->orderByDesc('completed_at')
                ->orderByDesc('id')
                ->first(['id', 'encryption_key_id']);

            if (
                $latestSuccess !== null
                && is_string($latestSuccess->encryption_key_id)
                && $latestSuccess->encryption_key_id !== ''
            ) {
                $latestCreationKeyMatches = hash_equals($latestSuccess->encryption_key_id, $fingerprint);
            }

            $backupsWithOtherKey = BackupLog::query()
                ->where('status', BackupLog::STATUS_SUCCESS)
                ->whereNotNull('encryption_key_id')
                ->where('encryption_key_id', '!=', $fingerprint)
                ->count();
        }

        $recoverable = $lastRecoverable->execute();
        $configuredCipher = config('backups.encryption.cipher', 'aes-256-gcm');

        $payload = [
            'status' => $configured ? 'configured' : 'missing',
            'configured' => $configured,
            'cipher' => is_string($configuredCipher) && $configuredCipher !== '' ? $configuredCipher : 'aes-256-gcm',
            'fingerprint' => $fingerprint,
            'latest_creation_key_matches' => $latestCreationKeyMatches,
            'backups_with_other_key' => $backupsWithOtherKey,
            'last_recoverable_verified_at' => $recoverable['verified_at'] ?? null,
            'last_recoverable_backup_id' => $recoverable['id'] ?? null,
            'message' => $configured
                ? 'Llave de respaldos configurada. Conserve el fingerprint fuera del servidor para detectar rotaciones o perdidas.'
                : 'Llave de respaldos ausente: los respaldos nuevos fallaran y los existentes no se podran descifrar.',
        ];

        if ($this->option('json')) {
            $this->line(json_encode($payload, JSON_THROW_ON_ERROR));
        } else {
            $this->line($configured
                ? "Llave de respaldos configurada. Fingerprint: {$fingerprint}"
                : 'Llave de respaldos ausente (HOSPITAL_BACKUP_ENCRYPTION_KEY).');
        }

        return $configured ? self::SUCCESS : self::FAILURE;
    }
}
