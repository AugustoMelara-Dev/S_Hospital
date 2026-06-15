<?php

namespace App\Actions\Backups;

use Illuminate\Support\Facades\Crypt;
use RuntimeException;

class EncryptBackupFileAction
{
    public function execute(string $plainPath, string $encryptedPath): void
    {
        $plain = @file_get_contents($plainPath);
        if ($plain === false) {
            throw new RuntimeException('No se pudo leer el dump temporal para cifrar el backup.');
        }

        $encrypted = Crypt::encryptString($plain);
        if (@file_put_contents($encryptedPath, $encrypted, LOCK_EX) === false) {
            throw new RuntimeException('No se pudo escribir el backup cifrado.');
        }

        @chmod($encryptedPath, 0600);

        if (@filesize($encryptedPath) === 0) {
            throw new RuntimeException('El backup cifrado quedo vacio.');
        }
    }
}
