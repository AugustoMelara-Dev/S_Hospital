<?php

namespace App\Actions\Backups;

use Illuminate\Support\Facades\Crypt;
use RuntimeException;

class BackupFileCipher
{
    private const PAYLOAD_VERSION = 2;

    private const IV_BYTES = 12;

    public function encryptString(string $plainText): string
    {
        $iv = random_bytes(self::IV_BYTES);
        $tag = '';
        $cipherText = openssl_encrypt(
            $plainText,
            $this->cipher(),
            $this->key(),
            OPENSSL_RAW_DATA,
            $iv,
            $tag,
        );

        if ($cipherText === false || ! is_string($tag)) {
            throw new RuntimeException('No se pudo cifrar el backup local.');
        }

        $payload = json_encode([
            'v' => self::PAYLOAD_VERSION,
            'iv' => base64_encode($iv),
            'tag' => base64_encode($tag),
            'data' => base64_encode($cipherText),
        ], JSON_THROW_ON_ERROR);

        return base64_encode($payload);
    }

    public function decryptString(string $payload): string
    {
        $decoded = base64_decode($payload, true);
        $decodedPayload = is_string($decoded)
            ? json_decode($decoded, true)
            : null;

        if (! is_array($decodedPayload) || ($decodedPayload['v'] ?? null) !== self::PAYLOAD_VERSION) {
            return Crypt::decryptString($payload);
        }

        $iv = base64_decode((string) ($decodedPayload['iv'] ?? ''), true);
        $tag = base64_decode((string) ($decodedPayload['tag'] ?? ''), true);
        $cipherText = base64_decode((string) ($decodedPayload['data'] ?? ''), true);

        if ($iv === false || $tag === false || $cipherText === false) {
            throw new RuntimeException('El paquete cifrado de respaldo es invalido.');
        }

        $plainText = openssl_decrypt(
            $cipherText,
            $this->cipher(),
            $this->key(),
            OPENSSL_RAW_DATA,
            $iv,
            $tag,
        );

        if ($plainText === false) {
            throw new RuntimeException('No se pudo descifrar el backup con la clave configurada.');
        }

        return $plainText;
    }

    private function key(): string
    {
        $configuredKey = trim((string) config('backups.encryption.key', ''));

        if ($configuredKey === '') {
            throw new RuntimeException('Clave de cifrado de respaldos no configurada.');
        }

        if (str_starts_with($configuredKey, 'base64:')) {
            $decoded = base64_decode(substr($configuredKey, 7), true);
            if ($decoded === false || $decoded === '') {
                throw new RuntimeException('Clave de cifrado de respaldos invalida.');
            }

            return hash('sha256', $decoded, true);
        }

        return hash('sha256', $configuredKey, true);
    }

    private function cipher(): string
    {
        $cipher = strtolower((string) config('backups.encryption.cipher', 'aes-256-gcm'));

        if ($cipher !== 'aes-256-gcm') {
            throw new RuntimeException('Cifrado de respaldos no soportado.');
        }

        return $cipher;
    }
}
