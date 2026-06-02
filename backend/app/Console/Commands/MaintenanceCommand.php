<?php

declare(strict_types=1);

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Filesystem\Filesystem;

class MaintenanceCommand extends Command
{
    protected $signature = 'hospital:maintenance
        {action : on or off}
        {--message=Mantenimiento programado : Message shown on the maintenance page}';

    protected $description = 'Toggle Laravel maintenance mode for incident response. Shows a branded HTML page.';

    public function handle(Filesystem $files): int
    {
        $action = strtolower((string) $this->argument('action'));

        if (! in_array($action, ['on', 'off'], true)) {
            $this->error('Acción inválida. Use "on" o "off".');

            return self::INVALID;
        }

        $maintenanceFile = $this->laravel->storagePath('framework/down');

        if ($action === 'on') {
            $payload = [
                'time' => now()->timestamp,
                'message' => (string) $this->option('message'),
                'retry' => 60,
            ];
            $files->put($maintenanceFile, json_encode($payload, JSON_THROW_ON_ERROR));

            $this->info(sprintf('Modo mantenimiento ACTIVADO. Mensaje: %s', $payload['message']));

            return self::SUCCESS;
        }

        if ($files->exists($maintenanceFile)) {
            $files->delete($maintenanceFile);
        }

        $this->info('Modo mantenimiento DESACTIVADO. La aplicación vuelve a estar disponible.');

        return self::SUCCESS;
    }
}
