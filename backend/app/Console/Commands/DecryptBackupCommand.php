<?php

namespace App\Console\Commands;

use App\Actions\Backups\BackupFileCipher;
use App\Actions\Backups\BackupRecoveryKitService;
use App\Actions\Backups\EncryptBackupFileAction;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Config;

class DecryptBackupCommand extends Command
{
    protected $signature = 'hospital:decrypt-backup {input : Archivo .sql.gz.enc} {output : Destino .sql temporal} {--recovery-kit= : Kit institucional cifrado}';

    protected $description = 'Descifra un backup local cifrado para restore controlado.';

    public function __construct(
        private readonly BackupFileCipher $cipher,
        private readonly BackupRecoveryKitService $recoveryKit,
    )
    {
        parent::__construct();
    }

    public function handle(): int
    {
        $input = (string) $this->argument('input');
        $output = (string) $this->argument('output');

        if (! is_file($input)) {
            $this->error('Backup cifrado no encontrado.');

            return self::FAILURE;
        }

        try {
            $kitPath = $this->option('recovery-kit');
            if (is_string($kitPath) && $kitPath !== '') {
                $this->decryptWithRecoveryKit($input, $output, $kitPath);
            } else {
                $this->decryptToFile($input, $output);
            }
        } catch (\Throwable) {
            $this->error('No se pudo descifrar el backup con la clave de respaldos configurada.');

            return self::FAILURE;
        }

        @chmod($output, 0600);
        $this->info('Backup descifrado para restore controlado.');

        return self::SUCCESS;
    }

    private function decryptWithRecoveryKit(string $input, string $output, string $kitPath): void
    {
        if (! is_file($kitPath)) {
            throw new \RuntimeException;
        }
        $kit = file_get_contents($kitPath);
        $stdin = stream_get_contents(STDIN, 8193);
        if (! is_string($kit) || ! is_string($stdin) || strlen($stdin) > 8192) {
            throw new \RuntimeException;
        }
        $payload = json_decode($stdin, true, 3, JSON_THROW_ON_ERROR);
        if (! is_array($payload) || ! is_string($payload['passphrase'] ?? null)) {
            throw new \RuntimeException;
        }
        $keys = $this->recoveryKit->open($kit, $payload['passphrase']);
        $originalBackupKey = Config::get('backups.encryption.key');
        $originalAppKey = Config::get('app.key');
        Config::set('backups.encryption.key', $keys['backup_encryption_key']);
        Config::set('app.key', $keys['app_key']);
        try {
            $this->decryptToFile($input, $output);
        } finally {
            Config::set('backups.encryption.key', $originalBackupKey);
            Config::set('app.key', $originalAppKey);
        }
    }

    private function decryptToFile(string $input, string $output): void
    {
        $temporaryPlain = tempnam(sys_get_temp_dir(), 'hospital-backup-decrypted-');
        if ($temporaryPlain === false) {
            throw new \RuntimeException('No se pudo crear archivo temporal de restore.');
        }

        try {
            $this->decryptPayloadToFile($input, $temporaryPlain);

            if ($this->isGzipFile($temporaryPlain)) {
                $this->decompressGzipFile($temporaryPlain, $output);

                return;
            }

            if (! @rename($temporaryPlain, $output)) {
                if (! @copy($temporaryPlain, $output)) {
                    throw new \RuntimeException('No se pudo escribir el SQL temporal descifrado.');
                }
            }
        } finally {
            if (is_file($temporaryPlain)) {
                @unlink($temporaryPlain);
            }
        }
    }

    private function decryptPayloadToFile(string $input, string $output): void
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

            $plain = $this->cipher->decryptString($encrypted);
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

                $plainChunk = $this->cipher->decryptString($encryptedChunk);
                if (@fwrite($outputHandle, $plainChunk) === false) {
                    throw new \RuntimeException('No se pudo escribir el SQL temporal descifrado.');
                }
            }
        } finally {
            @fclose($inputHandle);
            @fclose($outputHandle);
        }
    }

    private function isGzipFile(string $path): bool
    {
        $handle = @fopen($path, 'rb');
        if ($handle === false) {
            throw new \RuntimeException('No se pudo leer el backup descifrado.');
        }

        try {
            return fread($handle, 2) === "\x1f\x8b";
        } finally {
            @fclose($handle);
        }
    }

    private function decompressGzipFile(string $input, string $output): void
    {
        if (! function_exists('gzopen')) {
            throw new \RuntimeException('La extension zlib de PHP es requerida para descomprimir backups locales.');
        }

        $inputHandle = @gzopen($input, 'rb');
        if ($inputHandle === false) {
            throw new \RuntimeException('No se pudo leer el backup comprimido.');
        }

        $outputHandle = @fopen($output, 'wb');
        if ($outputHandle === false) {
            @gzclose($inputHandle);

            throw new \RuntimeException('No se pudo escribir el SQL temporal descifrado.');
        }

        try {
            while (! gzeof($inputHandle)) {
                $chunk = gzread($inputHandle, 1024 * 1024);
                if ($chunk === false) {
                    throw new \RuntimeException('No se pudo descomprimir el backup local.');
                }

                if ($chunk === '') {
                    continue;
                }

                if (@fwrite($outputHandle, $chunk) === false) {
                    throw new \RuntimeException('No se pudo escribir el SQL temporal descifrado.');
                }
            }
        } finally {
            @gzclose($inputHandle);
            @fclose($outputHandle);
        }
    }
}
