<?php

namespace App\Actions\Backups;

use Illuminate\Support\Facades\Crypt;
use RuntimeException;

class BackupFileCipher
{
    private const PAYLOAD_VERSION = 2;

    private const IV_BYTES = 12;

    /**
     * Non-reversible fingerprint used to identify which configured key
     * protected a backup without persisting the key itself.
     */
    public function keyIdentifier(): string
    {
        return hash('sha256', $this->key());
    }

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

        $encodedIv = $decodedPayload['iv'] ?? null;
        $encodedTag = $decodedPayload['tag'] ?? null;
        $encodedCipherText = $decodedPayload['data'] ?? null;

        if (! is_string($encodedIv) || ! is_string($encodedTag) || ! is_string($encodedCipherText)) {
            throw new RuntimeException('El paquete cifrado de respaldo es invalido.');
        }

        $iv = base64_decode($encodedIv, true);
        $tag = base64_decode($encodedTag, true);
        $cipherText = base64_decode($encodedCipherText, true);

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
        $configuredKey = config('backups.encryption.key', '');

        if ($configuredKey === null || $configuredKey === '') {
            throw new RuntimeException('Clave de cifrado de respaldos no configurada.');
        }

        if (! is_string($configuredKey)) {
            throw new RuntimeException('Clave de cifrado de respaldos invalida.');
        }

        $configuredKey = trim($configuredKey);

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
        $configuredCipher = config('backups.encryption.cipher', 'aes-256-gcm');

        if (! is_string($configuredCipher)) {
            throw new RuntimeException('Cifrado de respaldos no soportado.');
        }

        $cipher = strtolower($configuredCipher);

        if ($cipher !== 'aes-256-gcm') {
            throw new RuntimeException('Cifrado de respaldos no soportado.');
        }

        return $cipher;
    }
}
