<?php

declare(strict_types=1);

namespace App\Actions\Backups;

use Illuminate\Support\Facades\Config;
use RuntimeException;
use Throwable;

class BackupRecoveryKitService
{
    public const GENERIC_OPEN_ERROR = 'El kit es invalido, esta danado o la frase institucional no es correcta.';

    public const MAX_KIT_BYTES = 1024 * 1024;

    private const FORMAT = 's_hospital_backup_recovery_kit';

    private const VERSION = 1;

    public function __construct(private readonly BackupFileCipher $cipher) {}

    /** @return array<string, mixed> */
    public function create(string $passphrase): array
    {
        $this->assertSodiumAvailable();
        $this->assertPassphrase($passphrase);
        $backupKey = $this->requiredConfig('backups.encryption.key');
        $appKey = $this->requiredConfig('app.key');
        $keyIdentifier = $this->cipher->keyIdentifier();
        $salt = random_bytes(\SODIUM_CRYPTO_PWHASH_SALTBYTES);
        $derived = $this->derive($passphrase, $salt);
        $plain = json_encode([
            'backup_encryption_key' => $backupKey,
            'app_key' => $appKey,
            'key_identifier' => $keyIdentifier,
        ], JSON_THROW_ON_ERROR);

        try {
            $payload = $this->withCipherKey($derived, fn (): string => $this->cipher->encryptString($plain));
        } finally {
            $this->wipe($derived);
            $this->wipe($plain);
        }

        return [
            'format' => self::FORMAT,
            'version' => self::VERSION,
            'kdf' => [
                'algorithm' => 'argon2id13',
                'operations_limit' => \SODIUM_CRYPTO_PWHASH_OPSLIMIT_INTERACTIVE,
                'memory_limit' => \SODIUM_CRYPTO_PWHASH_MEMLIMIT_INTERACTIVE,
                'salt' => base64_encode($salt),
            ],
            'cipher' => 'aes-256-gcm',
            'key_identifier' => $keyIdentifier,
            'payload' => $payload,
        ];
    }

    /** @return array{backup_encryption_key: string, app_key: string} */
    public function open(string $encodedKit, string $passphrase): array
    {
        try {
            $this->assertSodiumAvailable();
            if (strlen($encodedKit) > self::MAX_KIT_BYTES) {
                throw new RuntimeException;
            }
            $this->assertPassphrase($passphrase);
            $kit = json_decode($encodedKit, true, 8, JSON_THROW_ON_ERROR);
            if (! is_array($kit) || ($kit['format'] ?? null) !== self::FORMAT || ($kit['version'] ?? null) !== self::VERSION) {
                throw new RuntimeException;
            }
            $kdf = $kit['kdf'] ?? null;
            if (! is_array($kdf)
                || ($kdf['algorithm'] ?? null) !== 'argon2id13'
                || ($kdf['operations_limit'] ?? null) !== \SODIUM_CRYPTO_PWHASH_OPSLIMIT_INTERACTIVE
                || ($kdf['memory_limit'] ?? null) !== \SODIUM_CRYPTO_PWHASH_MEMLIMIT_INTERACTIVE
                || ($kit['cipher'] ?? null) !== 'aes-256-gcm'
                || ! is_string($kit['payload'] ?? null)) {
                throw new RuntimeException;
            }
            $salt = is_string($kdf['salt'] ?? null) ? base64_decode($kdf['salt'], true) : false;
            if (! is_string($salt) || strlen($salt) !== \SODIUM_CRYPTO_PWHASH_SALTBYTES) {
                throw new RuntimeException;
            }

            $derived = $this->derive($passphrase, $salt);
            try {
                $plain = $this->withCipherKey($derived, fn (): string => $this->cipher->decryptString($kit['payload']));
            } finally {
                $this->wipe($derived);
            }

            try {
                $keys = json_decode($plain, true, 4, JSON_THROW_ON_ERROR);
            } finally {
                $this->wipe($plain);
            }
            if (! is_array($keys)) {
                throw new RuntimeException;
            }
            $backupKey = $this->validRecoveredKey($keys['backup_encryption_key'] ?? null);
            $appKey = $this->validRecoveredKey($keys['app_key'] ?? null);
            $innerKeyIdentifier = $keys['key_identifier'] ?? null;
            $outerKeyIdentifier = $kit['key_identifier'] ?? null;
            if (! is_string($innerKeyIdentifier)
                || ! is_string($outerKeyIdentifier)
                || ! preg_match('/^[a-f0-9]{64}$/', $outerKeyIdentifier)
                || ! hash_equals($innerKeyIdentifier, $outerKeyIdentifier)
                || ! hash_equals($outerKeyIdentifier, $this->identifierForConfiguredKey($backupKey))) {
                throw new RuntimeException;
            }

            return ['backup_encryption_key' => $backupKey, 'app_key' => $appKey];
        } catch (Throwable) {
            throw new RuntimeException(self::GENERIC_OPEN_ERROR);
        }
    }

    private function derive(string $passphrase, string $salt): string
    {
        return sodium_crypto_pwhash(
            32,
            $passphrase,
            $salt,
            \SODIUM_CRYPTO_PWHASH_OPSLIMIT_INTERACTIVE,
            \SODIUM_CRYPTO_PWHASH_MEMLIMIT_INTERACTIVE,
            \SODIUM_CRYPTO_PWHASH_ALG_ARGON2ID13,
        );
    }

    private function assertSodiumAvailable(): void
    {
        if (! function_exists('sodium_crypto_pwhash')
            || ! function_exists('sodium_memzero')
            || ! defined('SODIUM_CRYPTO_PWHASH_ALG_ARGON2ID13')
            || ! defined('SODIUM_CRYPTO_PWHASH_OPSLIMIT_INTERACTIVE')
            || ! defined('SODIUM_CRYPTO_PWHASH_MEMLIMIT_INTERACTIVE')) {
            throw new RuntimeException('El runtime no incluye Argon2id institucional.');
        }
    }

    private function wipe(string &$value): void
    {
        sodium_memzero($value);
    }

    private function assertPassphrase(string $passphrase): void
    {
        $length = strlen($passphrase);
        if ($length < 16 || $length > 1024) {
            throw new RuntimeException('La frase institucional debe tener entre 16 y 1024 bytes.');
        }
    }

    private function requiredConfig(string $key): string
    {
        $value = Config::get($key);
        if (! is_string($value) || trim($value) === '' || strlen($value) > 4096) {
            throw new RuntimeException('No estan configuradas todas las claves requeridas para el kit.');
        }

        return $value;
    }

    private function validRecoveredKey(mixed $value): string
    {
        if (! is_string($value) || trim($value) === '' || strlen($value) > 4096) {
            throw new RuntimeException;
        }

        return $value;
    }

    private function withCipherKey(string $derived, callable $operation): mixed
    {
        $original = Config::get('backups.encryption.key');
        Config::set('backups.encryption.key', 'base64:'.base64_encode($derived));
        try {
            return $operation();
        } finally {
            Config::set('backups.encryption.key', $original);
        }
    }

    private function identifierForConfiguredKey(string $configuredKey): string
    {
        $original = Config::get('backups.encryption.key');
        Config::set('backups.encryption.key', $configuredKey);
        try {
            return $this->cipher->keyIdentifier();
        } finally {
            Config::set('backups.encryption.key', $original);
        }
    }
}
