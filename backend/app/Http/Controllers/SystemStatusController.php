<?php

namespace App\Http\Controllers;

use App\Models\BackupLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\Process\ExecutableFinder;

class SystemStatusController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        $request->user()->can('backups.view') || abort(403);

        return response()->json([
            'data' => [
                'environment' => $this->environmentStatus(),
                'database' => $this->databaseStatus(),
                'backups' => $this->backupStatus(),
                'readiness' => $this->readinessStatus(),
                'preflight' => $this->preflightStatus(),
            ],
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function environmentStatus(): array
    {
        return [
            'app_env' => (string) Config::get('app.env'),
            'app_debug' => (bool) Config::get('app.debug'),
            'app_url' => (string) Config::get('app.url'),
            'queue_connection' => (string) Config::get('queue.default'),
            'filesystem_disk' => (string) Config::get('filesystems.default'),
            'php_version' => PHP_VERSION,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function databaseStatus(): array
    {
        $connection = (string) Config::get('database.default');
        $driver = (string) Config::get("database.connections.{$connection}.driver", $connection);

        return [
            'connection' => $connection,
            'driver' => $driver,
            'is_mysql_family' => in_array($driver, ['mysql', 'mariadb'], true),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function backupStatus(): array
    {
        $lastSuccess = BackupLog::query()
            ->where('status', BackupLog::STATUS_SUCCESS)
            ->latest('completed_at')
            ->latest('created_at')
            ->first();
        $lastFailure = BackupLog::query()
            ->where('status', BackupLog::STATUS_FAILED)
            ->latest('completed_at')
            ->latest('created_at')
            ->first();
        $pendingCount = BackupLog::query()
            ->where('status', BackupLog::STATUS_PENDING)
            ->count();

        return [
            'pending_count' => $pendingCount,
            'last_success_at' => $lastSuccess?->completed_at?->toJSON(),
            'last_success_filename' => $lastSuccess?->filename,
            'last_failure_at' => $lastFailure?->completed_at?->toJSON(),
            'last_failure_message' => $lastFailure?->error_message,
            'dump_binary' => $this->dumpBinaryStatus(),
            'storage' => $this->backupStorageStatus(),
            'queue' => $this->queueStatus(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function dumpBinaryStatus(): array
    {
        $configured = (string) env('HOSPITAL_DUMP_BINARY', '');
        $candidates = array_values(array_filter([
            $configured !== '' ? $configured : null,
            'mariadb-dump',
            'mysqldump',
            'C:\\xampp\\mysql\\bin\\mariadb-dump.exe',
            'C:\\xampp\\mysql\\bin\\mysqldump.exe',
            'C:\\laragon\\bin\\mysql\\mysql-8.0\\bin\\mysqldump.exe',
            '/usr/bin/mariadb-dump',
            '/usr/bin/mysqldump',
            '/usr/local/bin/mariadb-dump',
            '/usr/local/bin/mysqldump',
        ]));

        $finder = new ExecutableFinder;

        foreach ($candidates as $candidate) {
            $isPath = str_contains($candidate, '/') || str_contains($candidate, '\\');
            $resolved = $isPath
                ? (is_file($candidate) ? $candidate : null)
                : $finder->find($candidate);

            if ($resolved !== null) {
                return [
                    'configured' => $configured !== '',
                    'available' => true,
                    'name' => basename($resolved),
                ];
            }
        }

        return [
            'configured' => $configured !== '',
            'available' => false,
            'name' => null,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function backupStorageStatus(): array
    {
        $root = Storage::disk('local')->path('backups');
        $diskPath = is_dir($root) ? $root : dirname($root);

        return [
            'writable' => is_dir($root) ? is_writable($root) : is_writable(dirname($root)),
            'free_bytes' => disk_free_space($diskPath) ?: null,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function queueStatus(): array
    {
        $connection = (string) Config::get('queue.default');
        $pendingJobs = null;

        if ($connection === 'database' && Schema::hasTable('jobs')) {
            $pendingJobs = DB::table('jobs')->where('queue', 'backups')->count();
        }

        return [
            'connection' => $connection,
            'pending_backup_jobs' => $pendingJobs,
            'worker_command' => 'php artisan queue:work --queue=backups --tries=1 --timeout=600',
            'scheduler_command' => 'php artisan schedule:run',
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function readinessStatus(): array
    {
        $appEnv = (string) Config::get('app.env');
        $appDebug = (bool) Config::get('app.debug');

        return [
            'state' => 'PRODUCTION_CANDIDATE',
            'production_ready' => false,
            'blockers' => [
                [
                    'code' => 'PENDING_LAN_CLIENT_VALIDATION',
                    'label' => 'Validacion desde segunda PC LAN',
                    'status' => 'pending',
                ],
                [
                    'code' => 'PENDING_HARDWARE_VALIDATION',
                    'label' => 'Impresora termica fisica 80mm/58mm',
                    'status' => 'pending',
                ],
                [
                    'code' => 'PENDING_ENVIRONMENT_VALIDATION',
                    'label' => $appEnv === 'production' && ! $appDebug
                        ? 'Entorno production configurado; falta evidencia fisica final'
                        : 'Servidor final con APP_ENV=production y APP_DEBUG=false',
                    'status' => $appEnv === 'production' && ! $appDebug ? 'partial' : 'pending',
                ],
            ],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function preflightStatus(): array
    {
        $environment = $this->environmentStatus();
        $database = $this->databaseStatus();
        $backups = $this->backupStatus();

        return [
            'production_checks' => [
                [
                    'code' => 'APP_ENV_PRODUCTION',
                    'label' => 'APP_ENV=production',
                    'status' => $environment['app_env'] === 'production' ? 'validated' : 'pending',
                    'detail' => "Actual: {$environment['app_env']}",
                ],
                [
                    'code' => 'APP_DEBUG_FALSE',
                    'label' => 'APP_DEBUG=false',
                    'status' => $environment['app_debug'] === false ? 'validated' : 'pending',
                    'detail' => $environment['app_debug'] ? 'Debug activo' : 'Debug apagado',
                ],
                [
                    'code' => 'MYSQL_FAMILY_DATABASE',
                    'label' => 'MySQL/MariaDB local',
                    'status' => $database['is_mysql_family'] ? 'validated' : 'pending',
                    'detail' => "Driver: {$database['driver']}",
                ],
                [
                    'code' => 'DUMP_BINARY_AVAILABLE',
                    'label' => 'mysqldump/mariadb-dump disponible',
                    'status' => $backups['dump_binary']['available'] ? 'validated' : 'pending',
                    'detail' => $backups['dump_binary']['name'] ?? 'No detectado',
                ],
                [
                    'code' => 'BACKUP_STORAGE_WRITABLE',
                    'label' => 'Carpeta local de backups escribible',
                    'status' => $backups['storage']['writable'] ? 'validated' : 'pending',
                    'detail' => $backups['storage']['writable'] ? 'Disponible' : 'No escribible',
                ],
                [
                    'code' => 'BACKUP_WORKER_CONTINUOUS',
                    'label' => 'Worker de backups como tarea/servicio',
                    'status' => 'manual_required',
                    'detail' => $backups['queue']['worker_command'],
                ],
            ],
            'public_routes' => [
                [
                    'path' => '/up',
                    'expected' => 'HTTP 200',
                    'status' => 'manual_required',
                ],
                [
                    'path' => '/login',
                    'expected' => 'SPA cargada desde host LAN',
                    'status' => 'manual_required',
                ],
                [
                    'path' => '/verify-email',
                    'expected' => 'SPA o ruta esperada cargada desde host LAN',
                    'status' => 'manual_required',
                ],
            ],
            'physical_proofs' => [
                [
                    'code' => 'LAN_CLIENT_VALIDATION_PROOF',
                    'label' => 'Segunda PC en LAN',
                    'required_file' => 'qa/LAN_CLIENT_VALIDATION_PROOF.md',
                    'status' => 'pending',
                ],
                [
                    'code' => 'THERMAL_PRINTER_PROOF',
                    'label' => 'Impresora termica 80mm/58mm',
                    'required_file' => 'qa/THERMAL_PRINTER_PROOF.md',
                    'status' => 'pending',
                ],
            ],
            'commands' => [
                'preflight' => 'powershell.exe -ExecutionPolicy Bypass -File scripts\\production_readiness_preflight.ps1 -BaseUrl http://IP_DEL_SERVIDOR',
                'backup_worker' => $backups['queue']['worker_command'],
                'scheduler' => $backups['queue']['scheduler_command'],
            ],
        ];
    }
}
