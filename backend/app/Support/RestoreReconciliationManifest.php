<?php

declare(strict_types=1);

namespace App\Support;

use DateTimeImmutable;
use JsonException;
use RuntimeException;

/**
 * Manifiesto externo de reconciliacion post-restore (HS-RESTORE-SEQUENCE).
 *
 * Este parser NO produce el manifiesto: lo producira el procedimiento externo
 * de copia/restore (handoff a hs-backups/hs-recovery) a partir de la custodia
 * externa. Aqui solo se valida de forma fail-closed.
 *
 * Esquema minimo (`schema_version` 1, JSON UTF-8):
 *
 * {
 *   "schema_version": 1,
 *   "generated_at": "2026-09-13T20:00:00Z",
 *   "backup": {
 *     "id": 12,                                              // backup_logs.id
 *     "sha256": "<64 hex minusculas del archivo de respaldo>",
 *     "verified_at": "2026-09-13T19:59:00Z",
 *     "destination_label": "USB-HOSPITAL-1",
 *     "relative_path": "copies/backup-20260913.sql.enc",     // opcional
 *     "external_copy_id": 7,                                 // opcional (backup_external_copies.id)
 *     "bytes": 123456                                        // opcional
 *   },
 *   "max_invoice_number": 1234,                              // ultimo numero de factura usado/impreso
 *   "max_receipt_number": 87,                                // ultimo numero de recibo institucional usado/impreso
 *   "hash": "<64 hex del JSON canonico sin el campo hash>"
 * }
 *
 * JSON canonico: claves de cada objeto ordenadas recursivamente (ksort,
 * comparacion de cadenas) y codificacion con JSON_UNESCAPED_SLASHES |
 * JSON_UNESCAPED_UNICODE. `hash` es el sha256 hex en minusculas de esa cadena.
 *
 * Fail-closed: claves desconocidas, tipos incorrectos, schema_version distinto,
 * hash que no coincide, sha256 malformado, fechas no ISO-8601 explicitas
 * (incluidas expresiones relativas) o `relative_path` que no sea una ruta
 * relativa POSIX se rechazan. Extender el esquema exige subir
 * `schema_version`, no agregar campos sueltos.
 */
final class RestoreReconciliationManifest
{
    public const SCHEMA_VERSION = 1;

    /** @var list<string> */
    private const TOP_LEVEL_KEYS = [
        'schema_version',
        'generated_at',
        'backup',
        'max_invoice_number',
        'max_receipt_number',
        'hash',
    ];

    /** @var list<string> */
    private const BACKUP_KEYS = [
        'id',
        'sha256',
        'verified_at',
        'destination_label',
        'relative_path',
        'external_copy_id',
        'bytes',
    ];

    /**
     * @param  array<array-key, mixed>  $payload
     */
    private function __construct(
        public readonly string $path,
        public readonly array $payload,
    ) {}

    public static function fromFile(string $path): self
    {
        if (! is_file($path)) {
            throw new RuntimeException(
                "No existe el manifiesto externo en '{$path}'. Sin evidencia externa verificable no se reanuda la emision."
            );
        }

        if (! is_readable($path)) {
            throw new RuntimeException(
                "El manifiesto externo en '{$path}' no es legible. Sin evidencia externa verificable no se reanuda la emision."
            );
        }

        $raw = file_get_contents($path);
        if ($raw === false || trim($raw) === '') {
            throw new RuntimeException('El manifiesto externo esta vacio o no se pudo leer.');
        }

        try {
            $decoded = json_decode($raw, true, 512, JSON_THROW_ON_ERROR);
        } catch (JsonException) {
            throw new RuntimeException('El manifiesto externo no es JSON valido.');
        }

        if (! is_array($decoded) || array_is_list($decoded)) {
            throw new RuntimeException('El manifiesto externo debe ser un objeto JSON.');
        }

        self::assertKnownKeys($decoded, self::TOP_LEVEL_KEYS, 'manifiesto');

        if (($decoded['schema_version'] ?? null) !== self::SCHEMA_VERSION) {
            throw new RuntimeException(sprintf(
                'schema_version del manifiesto no soportado (esperado %d). Actualice el procedimiento externo o este sistema, no ignore la evidencia.',
                self::SCHEMA_VERSION,
            ));
        }

        self::assertIso8601($decoded['generated_at'] ?? null, 'generated_at');

        $backup = $decoded['backup'] ?? null;
        if (! is_array($backup) || array_is_list($backup)) {
            throw new RuntimeException('El manifiesto externo no incluye el objeto backup.');
        }

        self::assertKnownKeys($backup, self::BACKUP_KEYS, 'backup');

        if (! is_int($backup['id'] ?? null) || $backup['id'] < 1) {
            throw new RuntimeException('backup.id del manifiesto debe ser un entero positivo.');
        }

        self::assertSha256($backup['sha256'] ?? null, 'backup.sha256');
        self::assertIso8601($backup['verified_at'] ?? null, 'backup.verified_at');

        $label = $backup['destination_label'] ?? null;
        if (! is_string($label) || trim($label) === '' || mb_strlen($label) > 100) {
            throw new RuntimeException('backup.destination_label del manifiesto es obligatorio (1 a 100 caracteres).');
        }

        if (array_key_exists('relative_path', $backup)) {
            $relativePath = $backup['relative_path'];

            // Ruta relativa POSIX: sin vacio, sin absolutas/unidad/UNC, sin
            // backslashes, sin '..' y sin caracteres de control.
            if (
                ! is_string($relativePath)
                || trim($relativePath) === ''
                || mb_strlen($relativePath) > 512
                || str_starts_with($relativePath, '/')
                || str_contains($relativePath, '\\')
                || preg_match('/^[A-Za-z]:/', $relativePath) === 1
                || str_contains($relativePath, '..')
                || preg_match('/[\x00-\x1F\x7F]/', $relativePath) === 1
            ) {
                throw new RuntimeException(
                    'backup.relative_path del manifiesto no es una ruta relativa valida (se espera una ruta relativa POSIX, sin "..", sin unidad y sin backslashes).'
                );
            }
        }

        if (array_key_exists('external_copy_id', $backup)) {
            if (! is_int($backup['external_copy_id']) || $backup['external_copy_id'] < 1) {
                throw new RuntimeException('backup.external_copy_id del manifiesto debe ser un entero positivo.');
            }
        }

        if (array_key_exists('bytes', $backup)) {
            if (! is_int($backup['bytes']) || $backup['bytes'] < 0) {
                throw new RuntimeException('backup.bytes del manifiesto debe ser un entero no negativo.');
            }
        }

        foreach (['max_invoice_number', 'max_receipt_number'] as $field) {
            if (! is_int($decoded[$field] ?? null) || $decoded[$field] < 0) {
                throw new RuntimeException("{$field} del manifiesto debe ser un entero no negativo.");
            }
        }

        $providedHash = self::assertSha256($decoded['hash'] ?? null, 'hash');

        $payloadWithoutHash = $decoded;
        unset($payloadWithoutHash['hash']);

        $expectedHash = hash('sha256', self::canonicalJson($payloadWithoutHash));
        if (! hash_equals($providedHash, $expectedHash)) {
            throw new RuntimeException(
                'El hash del manifiesto no coincide con su contenido canonico: evidencia alterada o incompleta.'
            );
        }

        return new self($path, $decoded);
    }

    /**
     * @param  array<array-key, mixed>  $payload
     */
    public static function canonicalJson(array $payload): string
    {
        self::sortKeys($payload);

        try {
            return json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
        } catch (JsonException) {
            throw new RuntimeException('No se pudo canonicalizar el manifiesto externo.');
        }
    }

    /**
     * @return array<array-key, mixed>
     */
    public function backup(): array
    {
        $backup = $this->payload['backup'] ?? null;

        if (! is_array($backup)) {
            throw new RuntimeException('El manifiesto no incluye el objeto backup.');
        }

        return $backup;
    }

    public function maxInvoiceNumber(): int
    {
        $value = $this->payload['max_invoice_number'] ?? null;

        if (! is_int($value)) {
            throw new RuntimeException('max_invoice_number del manifiesto debe ser un entero no negativo.');
        }

        return $value;
    }

    public function maxReceiptNumber(): int
    {
        $value = $this->payload['max_receipt_number'] ?? null;

        if (! is_int($value)) {
            throw new RuntimeException('max_receipt_number del manifiesto debe ser un entero no negativo.');
        }

        return $value;
    }

    public function hash(): string
    {
        return self::assertSha256($this->payload['hash'] ?? null, 'hash');
    }

    /**
     * Evidencia acotada para auditoria: nunca incluye la ruta local del
     * archivo ni rutas absolutas del servidor.
     *
     * @return array<string, mixed>
     */
    public function auditEvidence(): array
    {
        return [
            'schema_version' => self::SCHEMA_VERSION,
            'generated_at' => $this->payload['generated_at'],
            'backup' => $this->backup(),
            'max_invoice_number' => $this->maxInvoiceNumber(),
            'max_receipt_number' => $this->maxReceiptNumber(),
            'hash' => $this->hash(),
        ];
    }

    /**
     * @param  array<array-key, mixed>  $payload
     */
    private static function sortKeys(array &$payload): void
    {
        if (! array_is_list($payload)) {
            ksort($payload, SORT_STRING);
        }

        foreach ($payload as &$value) {
            if (is_array($value)) {
                self::sortKeys($value);
            }
        }
        unset($value);
    }

    /**
     * @param  array<array-key, mixed>  $payload
     * @param  list<string>  $allowed
     */
    private static function assertKnownKeys(array $payload, array $allowed, string $context): void
    {
        $unknown = array_values(array_diff(array_keys($payload), $allowed));

        if ($unknown !== []) {
            throw new RuntimeException(sprintf(
                'El manifiesto contiene campos desconocidos en %s (%s). Extienda el esquema con una nueva schema_version.',
                $context,
                implode(', ', $unknown),
            ));
        }
    }

    private static function assertSha256(mixed $value, string $field): string
    {
        if (! is_string($value) || preg_match('/^[0-9a-f]{64}$/', $value) !== 1) {
            throw new RuntimeException("{$field} del manifiesto debe ser un sha256 hexadecimal de 64 caracteres en minusculas.");
        }

        return $value;
    }

    private static function assertIso8601(mixed $value, string $field): void
    {
        if (! is_string($value) || trim($value) === '') {
            throw new RuntimeException("{$field} del manifiesto debe ser una fecha ISO-8601.");
        }

        $value = trim($value);

        // Solo fecha-hora calendario explicita con offset: YYYY-MM-DDThh:mm:ss[.frac](Z|±hh:mm).
        // DateTimeImmutable acepta expresiones relativas ("now", "+1 day") y
        // normaliza fechas invalidas (2026-02-30 -> marzo); aqui no pasan.
        if (preg_match('/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/', $value, $matches) !== 1) {
            throw new RuntimeException(
                "{$field} del manifiesto no es una fecha ISO-8601 explicita (formato YYYY-MM-DDThh:mm:ssZ); las expresiones relativas no son evidencia valida."
            );
        }

        if (
            ! checkdate((int) $matches[2], (int) $matches[3], (int) $matches[1])
            || (int) $matches[4] > 23
            || (int) $matches[5] > 59
            || (int) $matches[6] > 59
        ) {
            throw new RuntimeException("{$field} del manifiesto no es una fecha ISO-8601 valida.");
        }

        try {
            new DateTimeImmutable($value);
        } catch (\Exception) {
            throw new RuntimeException("{$field} del manifiesto no es una fecha ISO-8601 valida.");
        }
    }
}
