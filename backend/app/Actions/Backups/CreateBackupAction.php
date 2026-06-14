<?php

namespace App\Actions\Backups;

use App\Models\AuditLog;
use App\Models\BackupLog;
use App\Models\User;
use App\Support\OperationalMessageSanitizer;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use RuntimeException;

class CreateBackupAction
{
    public function __construct(
        private readonly DatabaseDumpWriter $databaseDumpWriter,
        private readonly PruneBackupsAction $pruneBackups,
    ) {}

    public function execute(?User $user = null, string $type = BackupLog::TYPE_MANUAL): BackupLog
    {
        return $this->run($this->createPending($user, $type));
    }

    public function createPending(?User $user = null, string $type = BackupLog::TYPE_MANUAL): BackupLog
    {
        if (! in_array($type, [BackupLog::TYPE_MANUAL, BackupLog::TYPE_SCHEDULED], true)) {
            throw new RuntimeException('El tipo debe ser manual o scheduled.');
        }

        $filename = 'hospital-backup-'.now()->format('Ymd-His').'-'.Str::lower(Str::random(8)).'.sql.gz.enc';
        $path = 'backups/'.$filename;

        $backupLog = BackupLog::query()
            ->create([
                'filename' => $filename,
                'path' => $path,
                'disk' => 'local',
                'status' => BackupLog::STATUS_PENDING,
                'type' => $type,
                'format' => 'sql.gz.enc',
                'compression' => 'gzip',
                'encrypted' => true,
                'created_by' => $user?->id,
            ]);

        $this->audit($backupLog, $user?->id, 'backup.requested');

        return $backupLog->fresh(['creator:id,name,username']) ?? $backupLog;
    }

    public function run(BackupLog $backupLog): BackupLog
    {
        $lock = Cache::lock('hospital:backup:local', 600);

        if (! $lock->get()) {
            return $this->markFailed($backupLog, 'Ya hay un backup local en proceso.');
        }

        try {
            $backupLog->refresh();
            $backupLog->forceFill([
                'status' => BackupLog::STATUS_PENDING,
                'error_message' => null,
            ])->save();

            Storage::disk('local')->makeDirectory('backups');
            $absolutePath = Storage::disk('local')->path((string) $backupLog->path);
            $temporaryPath = $absolutePath.'.tmp';
            $plainTemporaryPath = $absolutePath.'.sql.tmp';

            $this->removeAbsoluteFile($temporaryPath);
            $this->removeAbsoluteFile($plainTemporaryPath);

            $this->databaseDumpWriter->dumpTo($plainTemporaryPath);
            $encryptionKey = $this->resolveEncryptionKey();
            $this->writeEncryptedBackup($plainTemporaryPath, $temporaryPath, $encryptionKey);
            $this->removeAbsoluteFile($plainTemporaryPath);

            if (! @rename($temporaryPath, $absolutePath)) {
                throw new RuntimeException('No se pudo publicar el archivo de respaldo local.');
            }

            clearstatcache(true, $absolutePath);

            if (! is_file($absolutePath)) {
                throw new RuntimeException('El respaldo no genero un archivo local.');
            }

            $backupLog->forceFill([
                'size_bytes' => filesize($absolutePath),
                'checksum_sha256' => hash_file('sha256', $absolutePath),
                'status' => BackupLog::STATUS_SUCCESS,
                'format' => 'sql.gz.enc',
                'compression' => 'gzip',
                'encrypted' => true,
                'encryption_key_id' => $encryptionKey['id'],
                'completed_at' => now(),
                'error_message' => null,
            ])->save();

            try {
                $this->pruneBackups->execute();
            } catch (\Throwable $pruneException) {
                report($pruneException);
            }
        } catch (\Throwable $exception) {
            $this->removePartialFile((string) $backupLog->path);
            $this->removePartialFile((string) $backupLog->path.'.tmp');
            $this->removePartialFile((string) $backupLog->path.'.sql.tmp');
            $this->removeAbsoluteFile(Storage::disk('local')->path((string) $backupLog->path).'.sql.tmp');

            $backupLog = $this->markFailed($backupLog, $this->safeErrorMessage($exception));
        } finally {
            $lock->release();
        }

        $this->audit(
            $backupLog,
            $backupLog->created_by,
            $backupLog->status === BackupLog::STATUS_SUCCESS ? 'backup.created' : 'backup.failed',
        );

        return $backupLog->fresh(['creator:id,name,username']) ?? $backupLog;
    }

    private function removePartialFile(string $path): void
    {
        if (Storage::disk('local')->exists($path)) {
            Storage::disk('local')->delete($path);
        }
    }

    private function removeAbsoluteFile(string $path): void
    {
        if (is_file($path)) {
            @unlink($path);
        }
    }

    private function markFailed(BackupLog $backupLog, string $message): BackupLog
    {
        $backupLog->forceFill([
            'status' => BackupLog::STATUS_FAILED,
            'completed_at' => now(),
            'error_message' => str($message)->limit(500)->toString(),
        ])->save();

        return $backupLog;
    }

    /**
     * @return array{id: string, key: string}
     */
    private function resolveEncryptionKey(): array
    {
        $configured = (string) config('backups.encryption.key', '');
        $rawKey = $configured !== '' ? $configured : (string) config('app.key', '');

        if ($configured === '' && app()->environment('production')) {
            throw new RuntimeException('Configure HOSPITAL_BACKUP_ENCRYPTION_KEY antes de crear backups en produccion.');
        }

        if (str_starts_with($rawKey, 'base64:')) {
            $decoded = base64_decode(substr($rawKey, 7), true);
            $rawKey = $decoded === false ? '' : $decoded;
        }

        if ($rawKey === '') {
            throw new RuntimeException('No hay clave local para cifrar el respaldo.');
        }

        return [
            'id' => substr(hash('sha256', $rawKey), 0, 16),
            'key' => hash('sha256', $rawKey, true),
        ];
    }

    /**
     * @param  array{id: string, key: string}  $encryptionKey
     */
    private function writeEncryptedBackup(string $plainPath, string $encryptedPath, array $encryptionKey): void
    {
        $plain = file_get_contents($plainPath);
        if ($plain === false) {
            throw new RuntimeException('No se pudo leer el dump temporal para protegerlo.');
        }

        $compressed = gzencode($plain, 6);
        if ($compressed === false) {
            throw new RuntimeException('No se pudo comprimir el respaldo local.');
        }

        $iv = random_bytes(12);
        $tag = '';
        $ciphertext = openssl_encrypt(
            $compressed,
            (string) config('backups.encryption.cipher', 'aes-256-gcm'),
            $encryptionKey['key'],
            OPENSSL_RAW_DATA,
            $iv,
            $tag,
        );

        if ($ciphertext === false) {
            throw new RuntimeException('No se pudo cifrar el respaldo local.');
        }

        $header = [
            'format' => 'sql.gz.enc',
            'compression' => 'gzip',
            'cipher' => (string) config('backups.encryption.cipher', 'aes-256-gcm'),
            'iv' => base64_encode($iv),
            'tag' => base64_encode($tag),
            'key_id' => $encryptionKey['id'],
        ];

        $payload = "SHOSPITAL-BACKUP-V1\n".json_encode($header, JSON_THROW_ON_ERROR)."\n".$ciphertext;
        if (file_put_contents($encryptedPath, $payload) === false) {
            throw new RuntimeException('No se pudo escribir el respaldo cifrado local.');
        }
    }

    private function safeErrorMessage(\Throwable $exception): string
    {
        $message = str($exception->getMessage());
        $password = (string) config('database.connections.'.config('database.default').'.password');

        if ($password !== '') {
            $message = $message->replace($password, '[redacted]');
        }

        return OperationalMessageSanitizer::message($message->toString())
            ?? 'Error tecnico registrado. Revise el paquete de soporte.';
    }

    private function audit(BackupLog $backupLog, ?int $userId, string $action): void
    {
        AuditLog::query()->create([
            'user_id' => $userId,
            'action' => $action,
            'entity_type' => BackupLog::class,
            'entity_id' => $backupLog->id,
            'old_values' => null,
            'new_values' => [
                'filename' => $backupLog->filename,
                'status' => $backupLog->status,
                'type' => $backupLog->type,
                'format' => $backupLog->format,
                'encrypted' => $backupLog->encrypted,
                'encryption_key_id' => $backupLog->encryption_key_id,
                'size_bytes' => $backupLog->size_bytes,
                'checksum_sha256' => $backupLog->checksum_sha256,
            ],
            'created_at' => now(),
        ]);
    }
}
