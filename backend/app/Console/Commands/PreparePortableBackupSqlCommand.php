<?php

namespace App\Console\Commands;

use App\Actions\Backups\PortableMysqlDumpSanitizer;
use Illuminate\Console\Command;

class PreparePortableBackupSqlCommand extends Command
{
    protected $signature = 'hospital:prepare-portable-sql {input} {output}';

    protected $description = 'Normaliza definidores de un SQL de respaldo para restauracion controlada.';

    public function handle(PortableMysqlDumpSanitizer $sanitizer): int
    {
        $input = (string) $this->argument('input');
        $output = (string) $this->argument('output');
        if (! is_file($input) || $input === $output) {
            $this->error('No se pudo preparar el SQL de restauracion.');
            return self::FAILURE;
        }
        try {
            $sanitizer->sanitizeFile($input, $output);
            @chmod($output, 0600);
        } catch (\Throwable) {
            @unlink($output);
            $this->error('No se pudo preparar el SQL de restauracion.');
            return self::FAILURE;
        }
        $this->info('SQL preparado para restauracion controlada.');
        return self::SUCCESS;
    }
}
