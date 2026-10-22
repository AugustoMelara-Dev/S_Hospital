<?php

namespace App\Actions\Backups;

use App\Models\AuditLog;
use App\Models\BackupLog;
use App\Support\OperationalMessageSanitizer;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use RuntimeException;
use Throwable;

/**
 * Verificacion de recuperabilidad real de un respaldo (HS-BK-VERIFY).
 *
 * Comprueba, en este orden: ruta segura y archivo existente, tamano, checksum
 * SHA-256, identidad de la llave (contra `encryption_key_id` cuando existe) y
 * descifrado completo en streaming con la llave configurada, sin persistir el
 * SQL en claro en ningun lado.
 *
 * Persiste el resultado en `backup_logs` segun el contrato T2-025:
 *   - verified:      verify_status='verified', verified_at=now, key_identifier
 *   - key_mismatch:  verify_status='key_mismatch', key_identifier del intento
 *                    solo si hay fingerprint; si la llave no esta configurada
 *                    conserva el `key_identifier` previo (no lo pisa con null)
 *                    y no toca `verified_at`
 *   - failed:        verify_status='failed'; no toca `verified_at` ni
 *                    `key_identifier`
 */
class VerifyBackupAction
{
    public const SCOPE_ENCRYPTED_FILE_INTEGRITY = 'encrypted_file_integrity';

    public const STATUS_VERIFIED = 'verified';

    public const STATUS_KEY_MISMATCH = 'key_mismatch';

    public const STATUS_FAILED = 'failed';

    public function __construct(private readonly BackupFileCipher $cipher) {}

    /**
     * @return array{
     *     backup_log_id: int,
     *     filename: string,
     *     status: string,
     *     checks: array{file_exists: bool, size_matches: bool, checksum_matches: bool, key_matches: bool|null, decrypt_ok: bool},
     *     key_identifier: string|null,
     *     verified_at: string|null,
     *     error: string|null
     * }
     */
    public function execute(BackupLog $backupLog): array
    {
        $backupLog->refresh();

        if ($backupLog->status !== BackupLog::STATUS_SUCCESS) {
            throw new RuntimeException('Solo se pueden verificar respaldos con estado success.');
        }

        $result = $this->inspect($backupLog);

        $verifiedAt = $this->persistResult($backupLog, $result);
        $this->audit($backupLog, $result);

        return [
            'backup_log_id' => $backupLog->id,
            'filename' => (string) $backupLog->filename,
            'status' => $result['status'],
            'checks' => $result['checks'],
            'key_identifier' => $result['key_identifier'],
            'verified_at' => $verifiedAt,
            'error' => $result['error'],
            'verification_scope' => self::SCOPE_ENCRYPTED_FILE_INTEGRITY,
            'restore_tested' => false,
        ];
    }

    /**
     * @return array{
     *     status: string,
     *     checks: array{file_exists: bool, size_matches: bool, checksum_matches: bool, key_matches: bool|null, decrypt_ok: bool},
     *     key_identifier: string|null,
     *     error: string|null
     * }
     */
    private function inspect(BackupLog $backupLog): array
    {
        $checks = [
            'file_exists' => false,
            'size_matches' => false,
            'checksum_matches' => false,
            'key_matches' => null,
            'decrypt_ok' => false,
        ];

        try {
            $absolutePath = $this->resolveLocalBackupPath($backupLog);
        } catch (Throwable $exception) {
            return $this->failed($checks, $exception->getMessage());
        }

        $checks['file_exists'] = true;

        $actualSize = filesize($absolutePath);
        if (
            $backupLog->size_bytes === null
            || $actualSize === false
            || (int) $backupLog->size_bytes !== (int) $actualSize
        ) {
            return $this->failed($checks, 'El tamano del archivo no coincide con el registrado.');
        }

        $checks['size_matches'] = true;

        $actualChecksum = hash_file('sha256', $absolutePath);
        if (
            $backupLog->checksum_sha256 === null
            || ! is_string($actualChecksum)
            || ! hash_equals((string) $backupLog->checksum_sha256, $actualChecksum)
        ) {
            return $this->failed($checks, 'El checksum SHA-256 no coincide con el registrado.');
        }

        $checks['checksum_matches'] = true;

        try {
            $currentKeyIdentifier = $this->cipher->keyIdentifier();
        } catch (Throwable) {
            return $this->keyMismatch($checks, null, 'La llave de cifrado de respaldos no esta configurada.');
        }

        $creationKeyIdentifier = $backupLog->encryption_key_id;
        if (
            is_string($creationKeyIdentifier)
            && $creationKeyIdentifier !== ''
            && ! hash_equals($creationKeyIdentifier, $currentKeyIdentifier)
        ) {
            $checks['key_matches'] = false;

            return $this->keyMismatch(
                $checks,
                $currentKeyIdentifier,
                'El respaldo fue cifrado con una llave distinta a la configurada.',
            );
        }

        $checks['key_matches'] = true;

        try {
            $this->assertDecryptsWithConfiguredKey($absolutePath);
        } catch (Throwable) {
            return $this->keyMismatch(
                $checks,
                $currentKeyIdentifier,
                'No se pudo descifrar el respaldo con la llave configurada.',
            );
        }

        $checks['decrypt_ok'] = true;

        return [
            'status' => self::STATUS_VERIFIED,
            'checks' => $checks,
            'key_identifier' => $currentKeyIdentifier,
            'error' => null,
        ];
    }

    /**
     * Descifra el archivo completo descartando el contenido en claro. Soporta
     * el formato por chunks vigente y el payload legacy de un solo bloque.
     */
    private function assertDecryptsWithConfiguredKey(string $absolutePath): void
    {
        $handle = @fopen($absolutePath, 'rb');
        if ($handle === false) {
            throw new RuntimeException('No se pudo abrir el respaldo para verificar su cifrado.');
        }

        try {
            $firstLine = fgets($handle);
            if ($firstLine === false) {
                throw new RuntimeException('El respaldo cifrado esta vacio.');
            }

            if (rtrim($firstLine, "\r\n") !== EncryptBackupFileAction::CHUNK_MARKER) {
                rewind($handle);
                $payload = stream_get_contents($handle);
                if (! is_string($payload) || trim($payload) === '') {
                    throw new RuntimeException('El respaldo cifrado esta vacio.');
                }

                if ($this->cipher->decryptString($payload) === '') {
                    throw new RuntimeException('El respaldo cifrado no contiene datos.');
                }

                return;
            }

            $decryptedChunks = 0;
            while (($line = fgets($handle)) !== false) {
                $encryptedChunk = rtrim($line, "\r\n");
                if ($encryptedChunk === '') {
                    continue;
                }

                if ($this->cipher->decryptString($encryptedChunk) !== '') {
                    $decryptedChunks++;
                }
            }

            if ($decryptedChunks === 0) {
                throw new RuntimeException('El respaldo cifrado no contiene datos.');
            }
        } finally {
            @fclose($handle);
        }
    }

    private function resolveLocalBackupPath(BackupLog $backupLog): string
    {
        if ($backupLog->disk !== 'local') {
            throw new RuntimeException('El respaldo no esta en el disco local.');
        }

        $path = (string) $backupLog->path;
        if (! $this->isSafeBackupPath($path)) {
            throw new RuntimeException('La ruta registrada no es valida.');
        }

        $disk = Storage::disk('local');
        if (! $disk->exists($path)) {
            throw new RuntimeException('El archivo no existe en el almacenamiento local.');
        }

        $absolutePath = $disk->path($path);
        if (! is_file($absolutePath)) {
            throw new RuntimeException('El archivo no existe en el almacenamiento local.');
        }

        return $absolutePath;
    }

    private function isSafeBackupPath(string $path): bool
    {
        return str_starts_with($path, 'backups/')
            && ! str_contains($path, '..')
            && ! str_contains($path, '\\')
            && ! str_starts_with($path, '/');
    }

    /**
     * @param  array{file_exists: bool, size_matches: bool, checksum_matches: bool, key_matches: bool|null, decrypt_ok: bool}  $checks
     * @return array{status: string, checks: array{file_exists: bool, size_matches: bool, checksum_matches: bool, key_matches: bool|null, decrypt_ok: bool}, key_identifier: string|null, error: string|null}
     */
    private function failed(array $checks, string $message): array
    {
        return [
            'status' => self::STATUS_FAILED,
            'checks' => $checks,
            'key_identifier' => null,
            'error' => $this->sanitized($message),
        ];
    }

    /**
     * @param  array{file_exists: bool, size_matches: bool, checksum_matches: bool, key_matches: bool|null, decrypt_ok: bool}  $checks
     * @return array{status: string, checks: array{file_exists: bool, size_matches: bool, checksum_matches: bool, key_matches: bool|null, decrypt_ok: bool}, key_identifier: string|null, error: string|null}
     */
    private function keyMismatch(array $checks, ?string $keyIdentifier, string $message): array
    {
        return [
            'status' => self::STATUS_KEY_MISMATCH,
            'checks' => $checks,
            'key_identifier' => $keyIdentifier,
            'error' => $this->sanitized($message),
        ];
    }

    private function sanitized(string $message): string
    {
        return OperationalMessageSanitizer::message($message)
            ?? 'Error tecnico registrado. Revise el paquete de soporte.';
    }

    /**
     * @param  array{status: string, checks: array<string, bool|null>, key_identifier: string|null, error: string|null}  $result
     */
    private function persistResult(BackupLog $backupLog, array $result): ?string
    {
        $verifiedAt = null;
        $attributes = ['verify_status' => $result['status']];

        if ($result['status'] === self::STATUS_VERIFIED) {
            $verifiedAt = now()->toDateTimeString();
            $attributes['verified_at'] = $verifiedAt;
            $attributes['key_identifier'] = $result['key_identifier'];
        } elseif (
            $result['status'] === self::STATUS_KEY_MISMATCH
            && is_string($result['key_identifier'])
            && $result['key_identifier'] !== ''
        ) {
            // RV-T2-010: sin fingerprint del intento (llave ausente) se
            // conserva el `key_identifier` previo en lugar de pisarlo con null.
            $attributes['key_identifier'] = $result['key_identifier'];
        }

        DB::table('backup_logs')->where('id', $backupLog->id)->update($attributes);

        return $verifiedAt;
    }

    /**
     * @param  array{status: string, checks: array<string, bool|null>, key_identifier: string|null, error: string|null}  $result
     */
    private function audit(BackupLog $backupLog, array $result): void
    {
        $verified = $result['status'] === self::STATUS_VERIFIED;

        AuditLog::query()->create([
            'user_id' => null,
            'action' => $verified ? 'backup.verified' : 'backup.verify_failed',
            'result' => $verified ? 'success' : 'failed',
            'entity_type' => BackupLog::class,
            'entity_id' => $backupLog->id,
            'old_values' => null,
            'new_values' => [
                'filename' => $backupLog->filename,
                'verify_status' => $result['status'],
                'checks' => $result['checks'],
            ],
            'reason' => $result['error'],
            'created_at' => now(),
        ]);
    }
}
