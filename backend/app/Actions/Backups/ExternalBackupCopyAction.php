<?php

namespace App\Actions\Backups;

use App\Models\AuditLog;
use App\Models\BackupLog;
use App\Support\OperationalMessageSanitizer;
use Illuminate\Filesystem\FilesystemAdapter;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use RuntimeException;
use Throwable;

/**
 * Copia cifrada a un destino externo configurado (F019 / HS-BK-EXT).
 *
 * Copia el `.sql.gz.enc` local a un disco de filesystem configurado por env,
 * vuelve a leer el destino y verifica SHA-256/tamano antes de marcarlo como
 * `verified` en `backup_external_copies` (contrato T2-025).
 *
 * La activacion es explicita (`backups.external.enabled`). Sin un destino real
 * configurado y probado por el operador, el resultado siempre declara
 * `external_deployed=false`: este codigo no afirma que exista una copia
 * externa desplegada.
 *
 * Guard fail-closed (RV-T2-010 / T3-009): se considera destino externo valido
 * solo un disco con driver remoto o, para `local`, un root explicito, absoluto
 * y fuera del `storage/` de Laravel, del directorio de la app y de la raiz del
 * proyecto. Las rutas se canonicalizan antes de comparar (se resuelven '.'/'..'
 * y, sobre el prefijo existente, se aplica `realpath()`), de modo que un root
 * con `..` que resuelva dentro del arbol o el placeholder mismo-host
 * `<repo>/backup-external` tambien fallan cerrados. Un root vacio (default),
 * relativo o interno falla cerrado con mensaje claro, no escribe archivos ni
 * filas y declara `external_configured=false`/`external_deployed=false`.
 */
class ExternalBackupCopyAction
{
    public const STATUS_DISABLED = 'disabled';

    public const STATUS_PENDING = 'pending';

    public const STATUS_COPIED = 'copied';

    public const STATUS_VERIFIED = 'verified';

    public const STATUS_FAILED = 'failed';

    public function enabled(): bool
    {
        return (bool) config('backups.external.enabled', false);
    }

    public function diskName(): string
    {
        $disk = config('backups.external.disk', 'backup_external');

        return is_string($disk) && trim($disk) !== '' ? trim($disk) : 'backup_external';
    }

    /**
     * Diagnostico del destino externo. Devuelve null solo cuando el destino es
     * explicitamente externo; cualquier otro caso describe el problema para
     * fallar cerrado sin escribir nada.
     *
     * Las rutas se comparan canonicalizadas (T3-009): se resuelven '.'/'..' de
     * forma lexica y, sobre el prefijo existente, se aplica `realpath()`
     * (symlinks/junctions incluidos). Recien despues se contrasta contra el
     * almacenamiento, el directorio de la app y la raiz del proyecto: un root
     * con '..' que resuelva dentro del arbol, o el placeholder mismo-host
     * `<repo>/backup-external` (T2-036), quedan rechazados. Un root realmente
     * externo (USB/NAS/montaje como /external-backups en Docker) o un driver
     * remoto (s3/sftp/ftp) siguen siendo validos.
     */
    public function destinationProblem(): ?string
    {
        $diskName = $this->diskName();
        $driver = config("filesystems.disks.{$diskName}.driver");

        if (! is_string($driver) || $driver === '') {
            return "el disco '{$diskName}' no esta definido en config/filesystems.php";
        }

        if ($driver !== 'local') {
            // Un driver remoto (s3/sftp/ftp) es un destino explicito del operador.
            return null;
        }

        $root = config("filesystems.disks.{$diskName}.root");

        if (! is_string($root) || trim($root) === '') {
            return 'el root externo esta vacio (defina HOSPITAL_BACKUP_EXTERNAL_ROOT)';
        }

        if (! $this->isAbsolutePath($root)) {
            return 'el root externo no es una ruta absoluta';
        }

        $canonicalRoot = $this->canonicalPath($root);

        if ($this->pathIsInside($canonicalRoot, $this->canonicalPath(storage_path()))) {
            return 'el root externo apunta dentro del almacenamiento de la aplicacion';
        }

        if ($this->pathIsInside($canonicalRoot, $this->canonicalPath(base_path()))) {
            return 'el root externo apunta dentro del directorio del proyecto';
        }

        if ($this->pathIsInside($canonicalRoot, $this->canonicalPath(dirname(base_path())))) {
            return 'el root externo apunta dentro del arbol del proyecto (raiz del repositorio)';
        }

        return null;
    }

    private function destinationProblemMessage(string $problem): string
    {
        return 'Destino externo no valido: '.$problem
            .'. Configure HOSPITAL_BACKUP_EXTERNAL_ROOT con una ruta absoluta fuera del servidor; '
            .'sin destino externo real la copia no se declara desplegada.';
    }

    private function normalizePath(string $path): string
    {
        $normalized = str_replace(['/', '\\'], DIRECTORY_SEPARATOR, trim($path));
        $normalized = rtrim($normalized, DIRECTORY_SEPARATOR);

        return DIRECTORY_SEPARATOR === '\\' ? strtolower($normalized) : $normalized;
    }

    /**
     * Canonicaliza una ruta antes de compararla:
     *
     *  - normaliza separadores (y mayusculas en Windows);
     *  - resuelve '.'/'..' de forma lexica, sin tocar el disco;
     *  - sobre el resultado aplica `realpath()` al prefijo existente mas largo
     *    y recompone el sufijo aun no creado: un symlink/junction hacia
     *    storage/ o el proyecto tampoco evade el guard.
     *
     * El root externo puede no existir todavia (se crea en la primera copia),
     * por eso el fallback textual es obligatorio y nunca se escribe con esta
     * funcion.
     */
    private function canonicalPath(string $path): string
    {
        $normalized = $this->normalizePath($path);

        if ($normalized === '') {
            return '';
        }

        return $this->normalizePath($this->resolveExistingPrefix($this->collapseDotSegments($normalized)));
    }

    /**
     * Resuelve '.' y '..' de forma lexica conservando la raiz del path
     * (`C:\`, UNC `\\servidor\recurso` o `/` POSIX).
     */
    private function collapseDotSegments(string $path): string
    {
        $separator = DIRECTORY_SEPARATOR;
        $prefix = '';

        if ($separator === '\\') {
            if (preg_match('/\A[A-Za-z]:[\\\\\/]/', $path, $matches) === 1) {
                $prefix = substr($path, 0, 2).$separator;
                $path = substr($path, 2);
            } elseif (str_starts_with($path, '\\\\')) {
                $prefix = '\\\\';
                $path = substr($path, 2);
            }
        } else {
            $prefix = $separator;
            $path = ltrim($path, $separator);
        }

        $segments = [];

        foreach (explode($separator, $path) as $segment) {
            if ($segment === '' || $segment === '.') {
                continue;
            }

            if ($segment === '..') {
                array_pop($segments);

                continue;
            }

            $segments[] = $segment;
        }

        if ($segments === []) {
            return $prefix === '' ? '' : rtrim($prefix, $separator).$separator;
        }

        return $prefix.implode($separator, $segments);
    }

    /**
     * Aplica `realpath()` al prefijo existente mas largo y recompone el resto
     * (partes del root que aun no existen).
     */
    private function resolveExistingPrefix(string $path): string
    {
        $existing = $path;
        $suffix = [];

        while ($existing !== '' && ! file_exists($existing)) {
            $parent = dirname($existing);

            if ($parent === $existing) {
                break;
            }

            $suffix[] = basename($existing);
            $existing = $parent;
        }

        $resolved = file_exists($existing) ? realpath($existing) : false;

        if ($resolved === false) {
            return $path;
        }

        foreach (array_reverse($suffix) as $segment) {
            $resolved .= DIRECTORY_SEPARATOR.$segment;
        }

        return $resolved;
    }

    private function isAbsolutePath(string $path): bool
    {
        if (DIRECTORY_SEPARATOR === '\\') {
            return preg_match('/\A[A-Za-z]:[\\\\\/]/', $path) === 1
                || str_starts_with($path, '\\\\');
        }

        return str_starts_with($path, '/');
    }

    private function pathIsInside(string $candidate, string $container): bool
    {
        $separator = DIRECTORY_SEPARATOR;

        return $candidate === $container
            || str_starts_with($candidate.$separator, $container.$separator);
    }

    /**
     * @return array<string, mixed>
     */
    public function execute(BackupLog $backupLog): array
    {
        $backupLog->refresh();

        if (! $this->enabled()) {
            return $this->result(
                status: self::STATUS_DISABLED,
                backupLog: $backupLog,
                copyId: null,
                message: 'La copia externa no esta activada (HOSPITAL_BACKUP_EXTERNAL_ENABLED=false).',
                deployed: false,
                configured: false,
            );
        }

        if ($backupLog->status !== BackupLog::STATUS_SUCCESS) {
            throw new RuntimeException('Solo se pueden copiar respaldos con estado success.');
        }

        $destinationProblem = $this->destinationProblem();

        if ($destinationProblem !== null) {
            return $this->result(
                status: self::STATUS_FAILED,
                backupLog: $backupLog,
                copyId: null,
                message: $this->destinationProblemMessage($destinationProblem),
                deployed: false,
                configured: false,
                extra: ['destination_problem' => $destinationProblem],
            );
        }

        if (! Schema::hasTable('backup_external_copies')) {
            return $this->result(
                status: self::STATUS_FAILED,
                backupLog: $backupLog,
                copyId: null,
                message: 'El registro de copias externas no existe; aplique las migraciones pendientes.',
                deployed: false,
                configured: true,
            );
        }

        $label = $this->destinationLabel();

        $existing = DB::table('backup_external_copies')
            ->where('backup_log_id', $backupLog->id)
            ->where('destination_label', $label)
            ->whereIn('status', [self::STATUS_PENDING, self::STATUS_COPIED, self::STATUS_VERIFIED])
            ->orderByDesc('id')
            ->first();

        if ($existing !== null && in_array((string) $existing->status, [self::STATUS_COPIED, self::STATUS_VERIFIED], true)) {
            return $this->verifyCopy((int) $existing->id);
        }

        $copyId = $existing !== null
            ? (int) $existing->id
            : $this->createPendingRow($backupLog, $label);

        try {
            $relativePath = $this->destinationPath($backupLog);

            [$absoluteSourcePath, $sourceSha, $sourceBytes] = $this->assertSourceIntegrity($backupLog);
            $this->copyToDestination($absoluteSourcePath, $relativePath);
            [$destinationSha, $destinationBytes] = $this->hashExternalFile($relativePath);

            if ($destinationBytes !== $sourceBytes || ! hash_equals($sourceSha, $destinationSha)) {
                throw new RuntimeException('La copia externa no coincide con el archivo de origen.');
            }

            DB::table('backup_external_copies')->where('id', $copyId)->update([
                'relative_path' => $relativePath,
                'sha256' => $destinationSha,
                'bytes' => $destinationBytes,
                'status' => self::STATUS_COPIED,
                'copied_at' => now(),
                'failed_at' => null,
                'error_message' => null,
                'updated_at' => now(),
            ]);

            $this->audit($backupLog, 'backup.external_copied', 'success', [
                'copy_id' => $copyId,
                'destination_label' => $label,
                'sha256' => $destinationSha,
                'bytes' => $destinationBytes,
            ]);

            if (! (bool) config('backups.external.verify', true)) {
                return $this->result(
                    status: self::STATUS_COPIED,
                    backupLog: $backupLog,
                    copyId: $copyId,
                    message: 'Copia externa escrita; verificacion desactivada por configuracion.',
                    deployed: false,
                    configured: true,
                    extra: ['sha256' => $destinationSha, 'bytes' => $destinationBytes],
                );
            }

            return $this->verifyCopy($copyId);
        } catch (Throwable $exception) {
            $message = $this->sanitized($exception->getMessage());

            $this->markFailed($copyId, $message);
            $this->audit($backupLog, 'backup.external_copy_failed', 'failed', [
                'copy_id' => $copyId,
                'destination_label' => $label,
                'error' => $message,
            ]);

            return $this->result(
                status: self::STATUS_FAILED,
                backupLog: $backupLog,
                copyId: $copyId,
                message: $message,
                deployed: false,
                configured: true,
            );
        }
    }

    /**
     * Relee el destino y confirma que la copia sigue siendo recuperable.
     *
     * Regla de degradacion (T3-009): si el destino ya no pasa el guard, la
     * verificacion falla de forma visible aunque la fila estuviera `verified`:
     * el estado pasa a `failed` con `failed_at`/`error_message`, se conservan
     * `verified_at`, `sha256` y `bytes` como evidencia historica de la
     * verificacion anterior y no se finge una verificacion nueva. Mientras el
     * guard siga fallando, el health no cuenta esa copia como verificada.
     *
     * @return array<string, mixed>
     */
    public function verifyCopy(int $copyId): array
    {
        $row = DB::table('backup_external_copies')->where('id', $copyId)->first();

        if ($row === null) {
            throw new RuntimeException('La copia externa registrada no existe.');
        }

        $backupLog = BackupLog::query()->find((int) $row->backup_log_id);
        $relativePath = $row->relative_path;

        if (! $backupLog instanceof BackupLog || ! is_string($relativePath) || $relativePath === '') {
            $this->markFailed($copyId, 'La copia externa no tiene ruta registrada.');

            return $this->result(
                status: self::STATUS_FAILED,
                backupLog: $backupLog,
                copyId: $copyId,
                message: 'La copia externa no tiene ruta registrada.',
                deployed: false,
                configured: $this->enabled(),
            );
        }

        $destinationProblem = $this->destinationProblem();

        if ($destinationProblem !== null) {
            // Fail-closed (T3-009): no dejar la fila como `verified` si HOY el
            // destino no pasa el guard. Se conserva verified_at/sha256/bytes
            // como evidencia historica; no se finge una verificacion nueva.
            $message = $this->destinationProblemMessage($destinationProblem);
            $this->markFailed($copyId, $message);

            $this->audit($backupLog, 'backup.external_copy_failed', 'failed', [
                'copy_id' => $copyId,
                'destination_label' => is_string($row->destination_label) ? $row->destination_label : '',
                'error' => $message,
                'destination_problem' => $destinationProblem,
            ]);

            return $this->result(
                status: self::STATUS_FAILED,
                backupLog: $backupLog,
                copyId: $copyId,
                message: $message,
                deployed: false,
                configured: false,
                extra: ['destination_problem' => $destinationProblem],
            );
        }

        try {
            $disk = $this->externalDisk();
            $rowLabel = is_string($row->destination_label) ? $row->destination_label : '';
            $recordedBytes = is_numeric($row->bytes) ? (int) $row->bytes : null;

            if (! $disk->exists($relativePath)) {
                throw new RuntimeException('La copia externa ya no existe en el destino configurado.');
            }

            [$destinationSha, $destinationBytes] = $this->hashExternalFile($relativePath);
            $recordedSha = $row->sha256;

            if (
                is_string($recordedSha)
                && $recordedSha !== ''
                && ! hash_equals($recordedSha, $destinationSha)
            ) {
                throw new RuntimeException('La copia externa no coincide con el hash registrado.');
            }

            if ($recordedBytes !== null && $recordedBytes !== $destinationBytes) {
                throw new RuntimeException('La copia externa no coincide con el tamano registrado.');
            }

            DB::table('backup_external_copies')->where('id', $copyId)->update([
                'sha256' => $destinationSha,
                'bytes' => $destinationBytes,
                'status' => self::STATUS_VERIFIED,
                'verified_at' => now(),
                'failed_at' => null,
                'error_message' => null,
                'updated_at' => now(),
            ]);

            $this->audit($backupLog, 'backup.external_verified', 'success', [
                'copy_id' => $copyId,
                'destination_label' => $rowLabel,
                'sha256' => $destinationSha,
                'bytes' => $destinationBytes,
            ]);

            return $this->result(
                status: self::STATUS_VERIFIED,
                backupLog: $backupLog,
                copyId: $copyId,
                message: 'Copia externa verificada contra el destino configurado.',
                deployed: true,
                configured: true,
                extra: [
                    'sha256' => $destinationSha,
                    'bytes' => $destinationBytes,
                    'relative_path' => $relativePath,
                    'destination_label' => $rowLabel,
                ],
            );
        } catch (Throwable $exception) {
            $message = $this->sanitized($exception->getMessage());
            $this->markFailed($copyId, $message);
            $this->audit($backupLog, 'backup.external_copy_failed', 'failed', [
                'copy_id' => $copyId,
                'destination_label' => is_string($row->destination_label) ? $row->destination_label : '',
                'error' => $message,
            ]);

            return $this->result(
                status: self::STATUS_FAILED,
                backupLog: $backupLog,
                copyId: $copyId,
                message: $message,
                deployed: false,
                configured: true,
            );
        }
    }

    private function createPendingRow(BackupLog $backupLog, string $label): int
    {
        return (int) DB::table('backup_external_copies')->insertGetId([
            'backup_log_id' => $backupLog->id,
            'destination_label' => $label,
            'relative_path' => null,
            'sha256' => null,
            'bytes' => null,
            'status' => self::STATUS_PENDING,
            'copied_at' => null,
            'verified_at' => null,
            'failed_at' => null,
            'error_message' => null,
            'metadata' => json_encode(['manifest_version' => 1, 'source' => 'backup_log:'.$backupLog->id], JSON_THROW_ON_ERROR),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    /**
     * @return array{0: string, 1: string, 2: int}
     */
    private function assertSourceIntegrity(BackupLog $backupLog): array
    {
        if ($backupLog->disk !== 'local') {
            throw new RuntimeException('El respaldo no esta en el disco local.');
        }

        $path = (string) $backupLog->path;
        if (
            ! str_starts_with($path, 'backups/')
            || str_contains($path, '..')
            || str_contains($path, '\\')
            || str_starts_with($path, '/')
        ) {
            throw new RuntimeException('La ruta registrada del respaldo no es valida.');
        }

        $disk = Storage::disk('local');
        if (! $disk->exists($path)) {
            throw new RuntimeException('El archivo de respaldo no existe en el almacenamiento local.');
        }

        $absolutePath = $disk->path($path);
        $actualSize = filesize($absolutePath);
        $actualChecksum = hash_file('sha256', $absolutePath);

        if (
            $backupLog->size_bytes === null
            || $actualSize === false
            || (int) $backupLog->size_bytes !== (int) $actualSize
        ) {
            throw new RuntimeException('El archivo de respaldo no coincide con el tamano registrado.');
        }

        if (
            $backupLog->checksum_sha256 === null
            || ! is_string($actualChecksum)
            || ! hash_equals((string) $backupLog->checksum_sha256, $actualChecksum)
        ) {
            throw new RuntimeException('El archivo de respaldo no coincide con el checksum registrado.');
        }

        return [$absolutePath, $actualChecksum, (int) $actualSize];
    }

    private function copyToDestination(string $sourceAbsolutePath, string $relativePath): void
    {
        $disk = $this->externalDisk();
        $directory = dirname($relativePath);

        if ($directory !== '.' && ! $disk->exists($directory)) {
            $disk->makeDirectory($directory);
        }

        $source = @fopen($sourceAbsolutePath, 'rb');
        if ($source === false) {
            throw new RuntimeException('No se pudo leer el respaldo local para copiarlo.');
        }

        try {
            $written = $disk->writeStream($relativePath, $source);
        } finally {
            @fclose($source);
        }

        if ($written === false) {
            throw new RuntimeException('No se pudo escribir la copia en el destino configurado.');
        }
    }

    private function externalDisk(): FilesystemAdapter
    {
        return Storage::disk($this->diskName());
    }

    /**
     * @return array{0: string, 1: int}
     */
    private function hashExternalFile(string $relativePath): array
    {
        $stream = $this->externalDisk()->readStream($relativePath);
        if (! is_resource($stream)) {
            throw new RuntimeException('No se pudo leer la copia externa para verificarla.');
        }

        try {
            $context = hash_init('sha256');
            $bytes = 0;

            while (! feof($stream)) {
                $chunk = fread($stream, 1024 * 1024);
                if ($chunk === false) {
                    throw new RuntimeException('No se pudo leer la copia externa para verificarla.');
                }

                if ($chunk === '') {
                    continue;
                }

                hash_update($context, $chunk);
                $bytes += strlen($chunk);
            }
        } finally {
            @fclose($stream);
        }

        return [hash_final($context), $bytes];
    }

    private function destinationLabel(): string
    {
        $configured = config('backups.external.label', '');
        $configured = is_string($configured) ? $configured : '';
        $label = preg_replace('/[^A-Za-z0-9._ -]/', '', $configured) ?? '';
        $label = trim($label);

        if ($label === '') {
            $label = preg_replace('/[^A-Za-z0-9._-]/', '', $this->diskName()) ?? '';
            $label = trim($label);
        }

        return substr($label !== '' ? $label : 'externo', 0, 100);
    }

    private function destinationPath(BackupLog $backupLog): string
    {
        $filename = (string) $backupLog->filename;

        if (
            basename($filename) !== $filename
            || preg_match('/\A[A-Za-z0-9][A-Za-z0-9._-]{0,160}\.sql(\.gz)?\.enc\z/', $filename) !== 1
        ) {
            throw new RuntimeException('El nombre del respaldo no es valido para copia externa.');
        }

        $base = config('backups.external.path', '');
        $base = is_string($base) ? trim($base, " \t\n\r\0\x0B/\\") : '';

        return ($base === '' ? '' : $base.'/').$filename;
    }

    private function markFailed(int $copyId, string $message): void
    {
        DB::table('backup_external_copies')->where('id', $copyId)->update([
            'status' => self::STATUS_FAILED,
            'failed_at' => now(),
            'error_message' => $message,
            'updated_at' => now(),
        ]);
    }

    private function sanitized(string $message): string
    {
        return OperationalMessageSanitizer::message($message)
            ?? 'Error tecnico registrado. Revise el paquete de soporte.';
    }

    /**
     * @param  array<string, mixed>  $extra
     */
    private function audit(BackupLog $backupLog, string $action, string $result, array $extra): void
    {
        AuditLog::query()->create([
            'user_id' => null,
            'action' => $action,
            'result' => $result,
            'entity_type' => BackupLog::class,
            'entity_id' => $backupLog->id,
            'old_values' => null,
            'new_values' => $extra,
            'created_at' => now(),
        ]);
    }

    /**
     * @param  array<string, mixed>  $extra
     * @return array<string, mixed>
     */
    private function result(
        string $status,
        ?BackupLog $backupLog,
        ?int $copyId,
        string $message,
        bool $deployed,
        bool $configured,
        array $extra = [],
    ): array {
        return array_merge([
            'status' => $status,
            'external_configured' => $configured,
            'external_deployed' => $deployed,
            'backup_log_id' => $backupLog?->id,
            'filename' => $backupLog?->filename,
            'copy_id' => $copyId,
            'destination_label' => $this->destinationLabel(),
            'message' => $message,
        ], $extra);
    }
}
