<?php

namespace App\Console\Commands;

use App\Actions\Backups\EncryptBackupFileAction;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Crypt;

class DecryptBackupCommand extends Command
{
    protected $signature = 'hospital:decrypt-backup {input : Archivo .sql.enc} {output : Destino .sql temporal}';

    protected $description = 'Descifra un backup local cifrado para restore controlado.';

    public function handle(): int
    {
        $input = (string) $this->argument('input');
        $output = (string) $this->argument('output');

        if (! is_file($input)) {
            $this->error('Backup cifrado no encontrado.');

            return self::FAILURE;
        }

        try {
            $this->decryptToFile($input, $output);
        } catch (\Throwable) {
            $this->error('No se pudo descifrar el backup con APP_KEY actual.');

            return self::FAILURE;
        }

        @chmod($output, 0600);
        $this->info('Backup descifrado para restore controlado.');

        return self::SUCCESS;
    }

    private function decryptToFile(string $input, string $output): void
    {
        $inputHandle = @fopen($input, 'rb');
        if ($inputHandle === false) {
            throw new \RuntimeException('No se pudo leer el backup cifrado.');
        }

        $firstLine = fgets($inputHandle);
        if ($firstLine === false) {
            @fclose($inputHandle);
            throw new \RuntimeException('Backup cifrado vacio.');
        }

        if (rtrim($firstLine, "\r\n") !== EncryptBackupFileAction::CHUNK_MARKER) {
            @fclose($inputHandle);
            $encrypted = @file_get_contents($input);
            if ($encrypted === false) {
                throw new \RuntimeException('No se pudo leer el backup cifrado.');
            }

            $plain = Crypt::decryptString($encrypted);
            if (@file_put_contents($output, $plain, LOCK_EX) === false) {
                throw new \RuntimeException('No se pudo escribir el SQL temporal descifrado.');
            }

            return;
        }

        $outputHandle = @fopen($output, 'wb');
        if ($outputHandle === false) {
            @fclose($inputHandle);
            throw new \RuntimeException('No se pudo escribir el SQL temporal descifrado.');
        }

        try {
            while (($line = fgets($inputHandle)) !== false) {
                $encryptedChunk = rtrim($line, "\r\n");
                if ($encryptedChunk === '') {
                    continue;
                }

                $plainChunk = Crypt::decryptString($encryptedChunk);
                if (@fwrite($outputHandle, $plainChunk) === false) {
                    throw new \RuntimeException('No se pudo escribir el SQL temporal descifrado.');
                }
            }
        } finally {
            @fclose($inputHandle);
            @fclose($outputHandle);
        }
    }
}
