<?php

declare(strict_types=1);

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

        $filename = 'hospital-backup-'.now()->format('Ymd-His').'-'.Str::lower(Str::random(8)).'.sql';
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
            $absolutePath = Storage::disk('local')->path((string) $backupLog->path);
            $temporaryPath = $absolutePath.'.tmp';

            $this->removeAbsoluteFile($temporaryPath);

            $this->databaseDumpWriter->dumpTo($temporaryPath);

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
                'size_bytes' => $backupLog->size_bytes,
                'checksum_sha256' => $backupLog->checksum_sha256,
            ],
            'created_at' => now(),
        ]);
    }
}
