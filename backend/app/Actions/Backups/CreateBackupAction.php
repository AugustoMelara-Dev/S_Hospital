<?php

namespace App\Actions\Backups;

use App\Models\AuditLog;
use App\Models\BackupLog;
use App\Models\User;
use App\Support\OperationalMessageSanitizer;
use Closure;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use RuntimeException;

class CreateBackupAction
{
    public function __construct(
        private readonly DatabaseDumpWriter $databaseDumpWriter,
        private readonly EncryptBackupFileAction $encryptBackupFile,
        private readonly PruneBackupsAction $pruneBackups,
        private readonly ?Closure $freeSpaceResolver = null,
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
            $this->assertSafeBackupTarget($backupLog);
            $this->assertSufficientFreeSpace();

            $absolutePath = Storage::disk('local')->path((string) $backupLog->path);
            $temporaryDumpPath = $absolutePath.'.dump.tmp';
            $temporaryCompressedPath = $absolutePath.'.gz.tmp';
            $temporaryEncryptedPath = $absolutePath.'.tmp';

            $this->removeAbsoluteFile($temporaryDumpPath);
            $this->removeAbsoluteFile($temporaryCompressedPath);
            $this->removeAbsoluteFile($temporaryEncryptedPath);

            $this->databaseDumpWriter->dumpTo($temporaryDumpPath);
            @chmod($temporaryDumpPath, 0600);
            $this->compressDumpFile($temporaryDumpPath, $temporaryCompressedPath);
            $this->removeAbsoluteFile($temporaryDumpPath);
            $this->encryptBackupFile->execute($temporaryCompressedPath, $temporaryEncryptedPath);
            $this->removeAbsoluteFile($temporaryCompressedPath);

            if (! @rename($temporaryEncryptedPath, $absolutePath)) {
                throw new RuntimeException('No se pudo publicar el archivo de respaldo local.');
            }
            @chmod($absolutePath, 0600);

            clearstatcache(true, $absolutePath);

            if (! is_file($absolutePath)) {
                throw new RuntimeException('El respaldo no genero un archivo local.');
            }

            $backupLog->forceFill([
                'size_bytes' => filesize($absolutePath),
                'checksum_sha256' => hash_file('sha256', $absolutePath),
                'status' => BackupLog::STATUS_SUCCESS,
                'completed_at' => now(),
                'error_message' => null,
            ])->save();

            try {
                $this->pruneBackups->execute();
            } catch (\Throwable $pruneException) {
                report($pruneException);
            }
        } catch (\Throwable $exception) {
            $this->removePartialFileIfSafe((string) $backupLog->path);
            $this->removePartialFileIfSafe((string) $backupLog->path.'.tmp');
            $this->removePartialFileIfSafe((string) $backupLog->path.'.gz.tmp');
            $this->removePartialFileIfSafe((string) $backupLog->path.'.dump.tmp');

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

    private function assertSafeBackupTarget(BackupLog $backupLog): void
    {
        $path = (string) $backupLog->path;

        if (
            $backupLog->disk !== 'local' ||
            ! $this->isSafeStoragePath($path) ||
            ! preg_match('/\Abackups\/[A-Za-z0-9][A-Za-z0-9._-]{0,160}\.sql\.gz\.enc\z/', $path)
        ) {
            throw new RuntimeException('Registro de respaldo local invalido.');
        }
    }

    private function compressDumpFile(string $dumpPath, string $compressedPath): void
    {
        if (! function_exists('gzopen')) {
            throw new RuntimeException('La extension zlib de PHP es requerida para comprimir backups locales.');
        }

        $input = @fopen($dumpPath, 'rb');
        if ($input === false) {
            throw new RuntimeException('No se pudo leer el dump temporal para comprimir el backup.');
        }

        $output = @gzopen($compressedPath, 'wb6');
        if ($output === false) {
            @fclose($input);

            throw new RuntimeException('No se pudo escribir el backup comprimido.');
        }

        try {
            while (! feof($input)) {
                $chunk = fread($input, 1024 * 1024);
                if ($chunk === false) {
                    throw new RuntimeException('No se pudo leer el dump temporal para comprimir el backup.');
                }

                if ($chunk === '') {
                    continue;
                }

                if (gzwrite($output, $chunk) === false) {
                    throw new RuntimeException('No se pudo escribir el backup comprimido.');
                }
            }
        } finally {
            @fclose($input);
            @gzclose($output);
        }

        @chmod($compressedPath, 0600);
        if (@filesize($compressedPath) === 0) {
            throw new RuntimeException('El backup comprimido quedo vacio.');
        }
    }

    /**
     * Ensure the disk has at least 50 MB of free space before
     * attempting a backup. Returns silently on hosts where the
     * available space cannot be read (e.g. shared storage without
     * a statvfs syscall); the inner try/catch in {@see run()}
     * will still catch any IO error from the actual dump.
     */
    private function assertSufficientFreeSpace(): void
    {
        $requiredBytes = 50 * 1024 * 1024;
        $backupRoot = Storage::disk('local')->path('backups');

        try {
            $freeBytes = $this->freeSpaceResolver instanceof Closure
                ? ($this->freeSpaceResolver)($backupRoot)
                : @disk_free_space($backupRoot);
        } catch (\Throwable) {
            $freeBytes = false;
        }

        if (! is_int($freeBytes) && ! is_float($freeBytes)) {
            return;
        }

        if ($freeBytes < $requiredBytes) {
            throw new RuntimeException('Espacio insuficiente para crear respaldo local.');
        }
    }

    private function isSafeStoragePath(string $path): bool
    {
        return str_starts_with($path, 'backups/')
            && ! str_contains($path, '..')
            && ! str_contains($path, '\\')
            && ! str_starts_with($path, '/');
    }

    private function removePartialFileIfSafe(string $path): void
    {
        if ($this->isSafeStoragePath($path)) {
            $this->removePartialFile($path);
        }
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

    private function safeErrorMessage(\Throwable $exception): string
    {
        $message = str($exception->getMessage());
        $defaultConnection = config('database.default');
        $password = is_string($defaultConnection)
            ? config("database.connections.{$defaultConnection}.password")
            : null;

        if (is_string($password) && $password !== '') {
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
            'result' => $backupLog->status === BackupLog::STATUS_SUCCESS ? 'success' : 'failed',
            'entity_type' => BackupLog::class,
            'entity_id' => $backupLog->id,
            'old_values' => null,
            'new_values' => [
                'filename' => $backupLog->filename,
                'status' => $backupLog->status,
                'type' => $backupLog->type,
                'size_bytes' => $backupLog->size_bytes,
                'checksum_sha256' => $backupLog->checksum_sha256,
            ],
            'created_at' => now(),
        ]);
    }
}
