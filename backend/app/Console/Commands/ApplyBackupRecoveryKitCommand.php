<?php

namespace App\Console\Commands;

use App\Actions\Backups\BackupRecoveryKitService;
use Illuminate\Console\Command;

class ApplyBackupRecoveryKitCommand extends Command
{
    protected $signature = 'hospital:apply-backup-recovery-kit {kit} {environment} {output}';

    protected $description = 'Aplica un kit institucional a la configuracion nativa sin mostrar claves.';

    public function handle(BackupRecoveryKitService $service): int
    {
        $kitPath = (string) $this->argument('kit');
        $environmentPath = (string) $this->argument('environment');
        $outputPath = (string) $this->argument('output');
        try {
            if (! is_file($kitPath)
                || ! is_file($environmentPath)
                || basename($environmentPath) !== 'hospital.env'
                || $outputPath === ''
                || is_file($outputPath)
                || dirname(realpath($environmentPath) ?: '') !== dirname($outputPath)
                || ! preg_match('/^hospital\.env\.recovery-[a-f0-9]{24}$/', basename($outputPath))) {
                throw new \RuntimeException;
            }
            $kit = file_get_contents($kitPath);
            $input = stream_get_contents(STDIN, 8193);
            if (! is_string($kit) || ! is_string($input) || strlen($input) > 8192) {
                throw new \RuntimeException;
            }
            $request = json_decode($input, true, 3, JSON_THROW_ON_ERROR);
            if (! is_array($request) || ! is_string($request['passphrase'] ?? null)) {
                throw new \RuntimeException;
            }
            $keys = $service->open($kit, $request['passphrase']);
            $contents = file_get_contents($environmentPath);
            if (! is_string($contents)) {
                throw new \RuntimeException;
            }
            $contents = $this->replaceEnvironmentValue($contents, 'APP_KEY', $keys['app_key']);
            $contents = $this->replaceEnvironmentValue($contents, 'HOSPITAL_BACKUP_ENCRYPTION_KEY', $keys['backup_encryption_key']);
            $handle = @fopen($outputPath, 'x+b');
            if ($handle === false) {
                throw new \RuntimeException;
            }
            try {
                $offset = 0;
                while ($offset < strlen($contents)) {
                    $written = fwrite($handle, substr($contents, $offset));
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
                @unlink($outputPath);
                throw $exception;
            }
            fclose($handle);
        } catch (\Throwable) {
            $this->error('No se pudo aplicar el kit institucional.');

            return self::FAILURE;
        }
        $this->info('Candidato de configuracion institucional preparado.');

        return self::SUCCESS;
    }

    private function replaceEnvironmentValue(string $contents, string $name, string $value): string
    {
        $escaped = '"'.str_replace(['\\', '"', "\r", "\n"], ['\\\\', '\\"', '', '\\n'], $value).'"';
        $pattern = '/^'.preg_quote($name, '/').'=.*$/m';
        $updated = preg_replace($pattern, $name.'='.$escaped, $contents, 1, $count);
        if (! is_string($updated) || $count !== 1) {
            throw new \RuntimeException;
        }

        return $updated;
    }
}
