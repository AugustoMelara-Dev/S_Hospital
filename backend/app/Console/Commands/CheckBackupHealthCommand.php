<?php

namespace App\Console\Commands;

use App\Actions\Backups\CheckBackupHealthAction;
use Illuminate\Console\Command;

class CheckBackupHealthCommand extends Command
{
    protected $signature = 'hospital:check-backup-health
        {--json : Emitir un resultado JSON para automatizacion local}
        {--fail-on-alert : Devuelve exit code 1 si hay alertas activas}';

    protected $description = 'Evalua salud de respaldos: atraso, fallos consecutivos, pendientes vencidos, copia verificada y estado externo.';

    public function handle(CheckBackupHealthAction $checkBackupHealth): int
    {
        $result = $checkBackupHealth->execute();

        if ($this->option('json')) {
            $this->line(json_encode($result, JSON_THROW_ON_ERROR));
        } else {
            $this->line($result['status'] === 'ok'
                ? 'Respaldo saludable: sin alertas activas.'
                : 'Respaldos con atencion pendiente:');

            foreach ($result['alerts'] as $alert) {
                $context = json_encode($alert['context'], JSON_THROW_ON_ERROR);
                $this->warn("- {$alert['code']}: {$context}");
            }
        }

        if ($this->option('fail-on-alert') && $result['status'] !== 'ok') {
            return self::FAILURE;
        }

        return self::SUCCESS;
    }
}
