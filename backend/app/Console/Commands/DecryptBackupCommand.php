<?php

namespace App\Console\Commands;

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

        $encrypted = @file_get_contents($input);
        if ($encrypted === false) {
            $this->error('No se pudo leer el backup cifrado.');

            return self::FAILURE;
        }

        try {
            $plain = Crypt::decryptString($encrypted);
        } catch (\Throwable) {
            $this->error('No se pudo descifrar el backup con APP_KEY actual.');

            return self::FAILURE;
        }

        if (@file_put_contents($output, $plain, LOCK_EX) === false) {
            $this->error('No se pudo escribir el SQL temporal descifrado.');

            return self::FAILURE;
        }

        @chmod($output, 0600);
        $this->info('Backup descifrado para restore controlado.');

        return self::SUCCESS;
    }
}
