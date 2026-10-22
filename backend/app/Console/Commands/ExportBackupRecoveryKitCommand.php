<?php

namespace App\Console\Commands;

use App\Actions\Backups\BackupRecoveryKitService;
use Illuminate\Console\Command;

class ExportBackupRecoveryKitCommand extends Command
{
    protected $signature = 'hospital:export-backup-recovery-kit {output} {--json}';

    protected $description = 'Exporta un kit institucional cifrado sin mostrar las claves.';

    public function handle(BackupRecoveryKitService $service): int
    {
        $output = (string) $this->argument('output');
        try {
            $passphrase = $this->readPassphrase();
            $kit = $service->create($passphrase);
            $encoded = json_encode($kit, JSON_THROW_ON_ERROR | JSON_PRETTY_PRINT);
            if (is_file($output)) {
                throw new \RuntimeException;
            }
            $temporary = $output.'.tmp-'.bin2hex(random_bytes(6));
            $handle = @fopen($temporary, 'x+b');
            if ($handle === false) {
                throw new \RuntimeException;
            }
            try {
                $offset = 0;
                while ($offset < strlen($encoded)) {
                    $written = fwrite($handle, substr($encoded, $offset));
                    if ($written === false || $written === 0) {
                        throw new \RuntimeException;
                    }
                    $offset += $written;
                }
                if (! fflush($handle)) {
                    throw new \RuntimeException;
                }
            } catch (\Throwable $exception) {
                fclose($handle);
                @unlink($temporary);
                throw $exception;
            }
            fclose($handle);
            if (! @rename($temporary, $output)) {
                @unlink($temporary);
                throw new \RuntimeException;
            }
            @chmod($output, 0600);
        } catch (\Throwable) {
            $this->error('No se pudo exportar el kit institucional.');

            return self::FAILURE;
        }

        if ($this->option('json')) {
            $this->line(json_encode([
                'status' => 'success',
                'key_identifier' => $kit['key_identifier'],
            ], JSON_THROW_ON_ERROR));
        } else {
            $this->info('Kit institucional cifrado exportado.');
        }

        return self::SUCCESS;
    }

    private function readPassphrase(): string
    {
        $input = stream_get_contents(STDIN, 8193);
        if (! is_string($input) || strlen($input) > 8192) {
            throw new \RuntimeException;
        }
        $payload = json_decode($input, true, 3, JSON_THROW_ON_ERROR);
        if (! is_array($payload) || ! is_string($payload['passphrase'] ?? null)) {
            throw new \RuntimeException;
        }

        return $payload['passphrase'];
    }
}
