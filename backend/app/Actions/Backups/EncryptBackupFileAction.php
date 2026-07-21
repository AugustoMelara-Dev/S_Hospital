<?php

namespace App\Actions\Backups;

use RuntimeException;

class EncryptBackupFileAction
{
    public const CHUNK_MARKER = 'SHOSPITAL_BACKUP_CHUNKS_V1';

    private const CHUNK_BYTES = 1024 * 1024;

    public function __construct(private readonly BackupFileCipher $cipher) {}

    public function keyIdentifier(): string
    {
        return $this->cipher->keyIdentifier();
    }

    public function execute(string $plainPath, string $encryptedPath): void
    {
        $input = @fopen($plainPath, 'rb');
        if ($input === false) {
            throw new RuntimeException('No se pudo leer el dump temporal para cifrar el backup.');
        }

        $output = @fopen($encryptedPath, 'wb');
        if ($output === false) {
            @fclose($input);

            throw new RuntimeException('No se pudo escribir el backup cifrado.');
        }

        try {
            if (@fwrite($output, self::CHUNK_MARKER."\n") === false) {
                throw new RuntimeException('No se pudo escribir el backup cifrado.');
            }

            while (! feof($input)) {
                $plainChunk = fread($input, self::CHUNK_BYTES);
                if ($plainChunk === false) {
                    throw new RuntimeException('No se pudo leer el dump temporal para cifrar el backup.');
                }

                if ($plainChunk === '') {
                    continue;
                }

                $encryptedChunk = $this->cipher->encryptString($plainChunk);
                if (@fwrite($output, $encryptedChunk."\n") === false) {
                    throw new RuntimeException('No se pudo escribir el backup cifrado.');
                }
            }
        } finally {
            @fclose($input);
            @fclose($output);
        }

        @chmod($encryptedPath, 0600);
        if (@filesize($encryptedPath) === 0) {
            throw new RuntimeException('El backup cifrado quedo vacio.');
        }
    }
}
