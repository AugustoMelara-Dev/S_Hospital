<?php

namespace App\Actions\Backups;

use App\Models\AuditLog;
use App\Models\BackupLog;
use App\Models\User;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use RuntimeException;
use Symfony\Component\Process\Process;

class CreateBackupAction
{
    public function execute(?User $user = null, string $type = BackupLog::TYPE_MANUAL): BackupLog
    {
        $filename = 'hospital-backup-'.now()->format('Ymd-His').'-'.Str::lower(Str::random(8)).'.sql';
        $path = 'backups/'.$filename;

        $backupLog = BackupLog::query()->create([
            'filename' => $filename,
            'path' => $path,
            'disk' => 'local',
            'status' => BackupLog::STATUS_PENDING,
            'type' => $type,
            'created_by' => $user?->id,
        ]);

        try {
            Storage::disk('local')->makeDirectory('backups');
            $absolutePath = Storage::disk('local')->path($path);

            $this->dumpDatabase($absolutePath);

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
        } catch (\Throwable $exception) {
            $this->removePartialFile($path);

            $backupLog->forceFill([
                'status' => BackupLog::STATUS_FAILED,
                'completed_at' => now(),
                'error_message' => $this->safeErrorMessage($exception),
            ])->save();
        }

        $this->audit($backupLog, $user, 'backup.created');

        return $backupLog->fresh(['creator:id,name,username']) ?? $backupLog;
    }

    private function dumpDatabase(string $absolutePath): void
    {
        $connection = Config::get('database.default');
        $config = Config::get("database.connections.{$connection}", []);
        $driver = (string) ($config['driver'] ?? '');

        if ($driver === 'sqlite') {
            $database = (string) ($config['database'] ?? '');

            if ($database === ':memory:') {
                $this->dumpSqliteDatabase($absolutePath);

                return;
            }

            if ($database === '' || ! is_file($database)) {
                throw new RuntimeException('SQLite no tiene archivo fisico para respaldar.');
            }

            if (! copy($database, $absolutePath)) {
                throw new RuntimeException('No se pudo copiar el archivo SQLite local.');
            }

            return;
        }

        if (! in_array($driver, ['mysql', 'mariadb'], true)) {
            throw new RuntimeException('Driver de base de datos no soportado para backup local.');
        }

        $binary = $this->findDumpBinary();

        if ($binary === null) {
            throw new RuntimeException('No se encontro mariadb-dump ni mysqldump. Instale una herramienta de dump local en el servidor.');
        }

        $command = [
            $binary,
            '--single-transaction',
            '--quick',
            '--skip-comments',
            '--host='.(string) ($config['host'] ?? '127.0.0.1'),
            '--port='.(string) ($config['port'] ?? '3306'),
            '--user='.(string) ($config['username'] ?? ''),
            (string) ($config['database'] ?? ''),
        ];

        $process = new Process($command);
        $process->setTimeout(300);
        $process->setEnv(['MYSQL_PWD' => (string) ($config['password'] ?? '')]);
        $process->run();

        if (! $process->isSuccessful()) {
            throw new RuntimeException($this->sanitizeDumpError($process->getErrorOutput() ?: $process->getOutput()));
        }

        if (file_put_contents($absolutePath, $process->getOutput()) === false) {
            throw new RuntimeException('No se pudo escribir el archivo de respaldo local.');
        }
    }

    private function dumpSqliteDatabase(string $absolutePath): void
    {
        $pdo = DB::connection()->getPdo();
        $tables = collect(DB::select(
            "select name, sql from sqlite_master where type = 'table' and name not like 'sqlite_%' order by name"
        ));
        $lines = [
            '-- Hospital Billing OS local SQLite test backup',
            'PRAGMA foreign_keys=OFF;',
            'BEGIN TRANSACTION;',
        ];

        foreach ($tables as $table) {
            $name = (string) $table->name;

            if (! empty($table->sql)) {
                $lines[] = $table->sql.';';
            }

            $columns = collect(DB::select("pragma table_info('".$name."')"))
                ->pluck('name')
                ->map(fn (string $column) => '"'.str_replace('"', '""', $column).'"')
                ->implode(', ');

            foreach (DB::table($name)->get() as $row) {
                $values = collect((array) $row)
                    ->map(fn ($value) => $value === null ? 'NULL' : $pdo->quote((string) $value))
                    ->implode(', ');

                $lines[] = 'INSERT INTO "'.str_replace('"', '""', $name).'" ('.$columns.') VALUES ('.$values.');';
            }
        }

        $lines[] = 'COMMIT;';

        if (file_put_contents($absolutePath, implode(PHP_EOL, $lines).PHP_EOL) === false) {
            throw new RuntimeException('No se pudo escribir el dump SQLite local de pruebas.');
        }
    }

    private function findDumpBinary(): ?string
    {
        foreach (['mariadb-dump', 'mysqldump'] as $binary) {
            $process = new Process([$binary, '--version']);
            $process->setTimeout(10);
            $process->run();

            if ($process->isSuccessful()) {
                return $binary;
            }
        }

        return null;
    }

    private function removePartialFile(string $path): void
    {
        if (Storage::disk('local')->exists($path)) {
            Storage::disk('local')->delete($path);
        }
    }

    private function safeErrorMessage(\Throwable $exception): string
    {
        $message = str($exception->getMessage());
        $password = (string) config('database.connections.'.config('database.default').'.password');

        if ($password !== '') {
            $message = $message->replace($password, '[redacted]');
        }

        return $message->limit(500)->toString();
    }

    private function sanitizeDumpError(string $error): string
    {
        return str($error)
            ->replaceMatches('/password[^\\s]*/i', 'password=[redacted]')
            ->squish()
            ->limit(500)
            ->toString() ?: 'La herramienta local de backup fallo.';
    }

    private function audit(BackupLog $backupLog, ?User $user, string $action): void
    {
        AuditLog::query()->create([
            'user_id' => $user?->id,
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
