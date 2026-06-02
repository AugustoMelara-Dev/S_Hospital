<?php

namespace App\Http\Controllers;

use App\Http\Requests\System\ShowSystemStatusRequest;
use App\Models\BackupLog;
use App\Models\FiscalSequence;
use App\Models\FiscalSetting;
use App\Models\Service;
use App\Models\User;
use App\Support\OperationalMessageSanitizer;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\Process\ExecutableFinder;

class SystemStatusController extends Controller
{
    /**
     * @var array<string, array{label: string, required_file: string, fields: array<int, string>, checks: array<int, string>}>
     */
    private const PHYSICAL_PROOFS = [
        'LAN_CLIENT_VALIDATION_PROOF' => [
            'label' => 'Segunda PC en LAN',
            'required_file' => 'qa/LAN_CLIENT_VALIDATION_PROOF.md',
            'fields' => [
                'Date/time',
                'Responsible person',
                'Client computer name',
                'Server IP or LAN name',
                'Server LAN URL',
                'Client browser/version',
                'User/role used',
                'Evidence/capture reference',
                'Final conclusion',
            ],
            'checks' => [
                '/up',
                '/login',
                '/verify-email',
                'assets',
                'Login',
                'Cashbox',
                'Invoice',
                'Payment',
                'Receipt',
                'history',
                'Reports',
                'Backup',
            ],
        ],
        'INSTITUTIONAL_RECEIPT_PRINT_PROOF' => [
            'label' => 'Impresora institucional media carta/carta/A5/80mm/58mm',
            'required_file' => 'qa/INSTITUTIONAL_RECEIPT_PRINT_PROOF.md',
            'fields' => [
                'Date/time',
                'Responsible person',
                'Printer brand/model',
                'Printer driver',
                'Connection type',
                'Browser/version',
                'Cashier computer',
                'Invoice used',
                'Media carta result',
                'Carta result',
                'A5 result',
                '80mm result',
                '58mm result',
                'Reprint result',
                'Margins result',
                'Browser headers/footers result',
                'Problems found',
                'Evidence/photo reference',
                'Final conclusion',
            ],
            'checks' => [
                'media carta',
                'carta',
                'A5',
                '80mm',
                '58mm',
                'white background',
                'Reprint',
                'headers/footers',
                'historical',
            ],
        ],
        'FINAL_RESTORE_PROOF' => [
            'label' => 'Restore MySQL/MariaDB final',
            'required_file' => 'qa/FINAL_RESTORE_PROOF.md',
            'fields' => [
                'Date/time',
                'Responsible person',
                'Source database',
                'Disposable restore database',
                'Backup file',
                'Backup SHA256',
                'Backup size bytes',
                'Evidence/capture reference',
                'Final conclusion',
            ],
            'checks' => [
                'Disposable restore database',
                'Backup file',
                'Restore imports',
                'Migration table',
                'Services table',
                'Core counts',
            ],
        ],
        'FINAL_CONCURRENCY_PROOF' => [
            'label' => 'Concurrencia transaccional final',
            'required_file' => 'qa/FINAL_CONCURRENCY_PROOF.md',
            'fields' => [
                'Date/time',
                'Responsible person',
                'Server LAN URL',
                'Target environment',
                'Run ID',
                'Evidence/capture reference',
                'Final conclusion',
            ],
            'checks' => [
                'Double cash-session open',
                'Concurrent invoice emission',
                'Double payment',
            ],
        ],
    ];

    public function show(ShowSystemStatusRequest $request): JsonResponse
    {
        return response()->json([
            'data' => [
                'environment' => $this->environmentStatus(),
                'database' => $this->databaseStatus(),
                'frontend' => $this->frontendStatus(),
                'network' => $this->networkStatus(),
                'backups' => $this->backupStatus(),
                'runtime' => $this->runtimeStatus(),
                'readiness' => $this->readinessStatus(),
                'preflight' => $this->preflightStatus(),
            ],
        ]);
    }

    public function setupStatus(): JsonResponse
    {
        $fiscalSettings = FiscalSetting::query()->exists();
        $adminExists = User::role('admin')->exists();
        $catalogHasServices = Service::query()->exists();
        $fiscalSequenceExists = FiscalSequence::query()->exists();

        $needsSetup = ! ($fiscalSettings && $adminExists && $catalogHasServices && $fiscalSequenceExists);

        return response()->json([
            'needs_setup' => $needsSetup,
            'steps' => [
                'fiscal_settings' => $fiscalSettings,
                'admin_exists' => $adminExists,
                'catalog_has_services' => $catalogHasServices,
                'fiscal_sequence_exists' => $fiscalSequenceExists,
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
            'app_url' => OperationalMessageSanitizer::url((string) Config::get('app.url')),
            'queue_connection' => (string) Config::get('queue.default'),
            'filesystem_disk' => (string) Config::get('filesystems.default'),
            'app_version' => (string) Config::get('app.version', 'local'),
            'php_version' => PHP_VERSION,
            'server_time' => now()->toJSON(),
            'timezone' => (string) Config::get('app.timezone'),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function databaseStatus(): array
    {
        $connection = (string) Config::get('database.default');
        $driver = (string) Config::get("database.connections.{$connection}.driver", $connection);
        $connected = true;

        try {
            DB::connection($connection)->getPdo();
        } catch (\Throwable) {
            $connected = false;
        }

        return [
            'connection' => $connection,
            'driver' => $driver,
            'is_mysql_family' => in_array($driver, ['mysql', 'mariadb'], true),
            'connected' => $connected,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function frontendStatus(): array
    {
        $indexPath = $this->projectPath('frontend/dist/index.html');
        $assetsPath = $this->projectPath('frontend/dist/assets');
        $assetsCount = is_dir($assetsPath)
            ? count(glob($assetsPath.DIRECTORY_SEPARATOR.'*') ?: [])
            : 0;

        return [
            'dist_index_exists' => is_file($indexPath),
            'assets_present' => $assetsCount > 0,
            'assets_count' => $assetsCount,
            'entry_label' => 'frontend/dist/index.html',
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function networkStatus(): array
    {
        $appUrl = (string) Config::get('app.url');
        $parts = parse_url($appUrl) ?: [];
        $host = isset($parts['host']) ? (string) $parts['host'] : null;
        $scheme = isset($parts['scheme']) ? (string) $parts['scheme'] : 'http';
        $port = isset($parts['port']) ? ':'.(string) $parts['port'] : '';
        $loopbackHosts = ['localhost', '127.0.0.1', '::1'];
        $hostType = $host === null || $host === ''
            ? 'unknown'
            : (in_array($host, $loopbackHosts, true) ? 'loopback' : 'lan');

        return [
            'configured_host' => $host,
            'host_type' => $hostType,
            'lan_ready' => $hostType === 'lan',
            'client_url' => $hostType === 'lan' ? "{$scheme}://{$host}{$port}" : null,
            'guidance' => $hostType === 'lan'
                ? 'Clientes deben entrar por esta direccion LAN.'
                : 'Configure APP_URL con la IP o nombre LAN del servidor antes de validar clientes.',
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
            'last_failure_message' => OperationalMessageSanitizer::message($lastFailure?->error_message),
            'dump_binary' => $this->dumpBinaryStatus(),
            'storage' => $this->backupStorageStatus(),
            'queue' => $this->queueStatus(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function runtimeStatus(): array
    {
        $logsPath = storage_path('logs');
        $cachePath = base_path('bootstrap/cache');
        $latestMigration = null;
        $migrationCount = null;
        $pendingMigrations = [];

        if (Schema::hasTable('migrations')) {
            $ranMigrations = DB::table('migrations')
                ->pluck('migration')
                ->map(fn ($migration): string => (string) $migration)
                ->all();

            $latestMigration = $ranMigrations === [] ? null : max($ranMigrations);
            $migrationCount = count($ranMigrations);
            $pendingMigrations = array_values(array_diff($this->migrationFileNames(), $ranMigrations));
        }

        return [
            'logs_writable' => is_dir($logsPath) && is_writable($logsPath),
            'cache_writable' => is_dir($cachePath) && is_writable($cachePath),
            'laravel_log' => $this->fileStatus(storage_path('logs/laravel.log')),
            'backup_automation_log' => $this->fileStatus(base_path('scripts/backup-automation.log')),
            'latest_migration' => $latestMigration,
            'migration_count' => $migrationCount,
            'pending_migration_count' => count($pendingMigrations),
            'pending_migrations' => array_slice($pendingMigrations, 0, 5),
        ];
    }

    /**
     * @return list<string>
     */
    private function migrationFileNames(): array
    {
        $files = glob(database_path('migrations/*.php')) ?: [];
        $migrations = array_map(
            fn (string $file): string => pathinfo($file, PATHINFO_FILENAME),
            $files,
        );
        sort($migrations);

        return array_values($migrations);
    }

    /**
     * @return array{exists: bool, size_bytes: int|null, modified_at: string|null}
     */
    private function fileStatus(string $path): array
    {
        if (! is_file($path)) {
            return [
                'exists' => false,
                'size_bytes' => null,
                'modified_at' => null,
            ];
        }

        $modifiedAt = filemtime($path);

        return [
            'exists' => true,
            'size_bytes' => filesize($path) ?: 0,
            'modified_at' => $modifiedAt === false ? null : now()->setTimestamp($modifiedAt)->toJSON(),
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
            'jobs_table_available' => Schema::hasTable('jobs'),
            'failed_jobs_table_available' => Schema::hasTable('failed_jobs'),
            'failed_jobs_count' => Schema::hasTable('failed_jobs') ? DB::table('failed_jobs')->count() : null,
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
        $runtime = $this->runtimeStatus();
        $proofs = $this->physicalProofStatuses();
        $lanProof = $proofs[0];
        $printerProof = $proofs[1];

        $blockers = [
            [
                'code' => 'PENDING_LAN_CLIENT_VALIDATION',
                'label' => 'Validacion desde segunda PC LAN',
                'status' => $lanProof['status'] === 'validated' ? 'validated' : 'pending',
            ],
            [
                'code' => 'PENDING_HARDWARE_VALIDATION',
                'label' => 'Impresora institucional fisica media carta/carta/A5/80mm/58mm',
                'status' => $printerProof['status'] === 'validated' ? 'validated' : 'pending',
            ],
            [
                'code' => 'PENDING_ENVIRONMENT_VALIDATION',
                'label' => $appEnv === 'production' && ! $appDebug
                    ? 'Entorno production configurado; falta evidencia fisica final'
                    : 'Servidor final pendiente de configuracion operativa',
                'status' => $appEnv === 'production' && ! $appDebug ? 'partial' : 'pending',
            ],
        ];

        if (($runtime['pending_migration_count'] ?? 0) > 0) {
            $blockers[] = [
                'code' => 'PENDING_DATABASE_MIGRATIONS',
                'label' => 'Base de datos requiere actualizacion segura',
                'status' => 'pending',
            ];
        }

        return [
            'state' => 'PRODUCTION_CANDIDATE',
            'production_ready' => false,
            'blockers' => $blockers,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function preflightStatus(): array
    {
        $environment = $this->environmentStatus();
        $database = $this->databaseStatus();
        $frontend = $this->frontendStatus();
        $network = $this->networkStatus();
        $backups = $this->backupStatus();
        $runtime = $this->runtimeStatus();
        $physicalProofs = $this->physicalProofStatuses();

        return [
            'production_checks' => [
                [
                    'code' => 'APP_ENV_PRODUCTION',
                    'label' => 'Modo final de operacion',
                    'status' => $environment['app_env'] === 'production' ? 'validated' : 'pending',
                    'detail' => $environment['app_env'] === 'production'
                        ? 'Configurado para instalacion final'
                        : 'Pendiente para instalacion final',
                ],
                [
                    'code' => 'APP_DEBUG_FALSE',
                    'label' => 'Mensajes internos ocultos',
                    'status' => $environment['app_debug'] === false ? 'validated' : 'pending',
                    'detail' => $environment['app_debug']
                        ? 'Requiere ocultar mensajes internos antes de produccion'
                        : 'Listo para operacion normal',
                ],
                [
                    'code' => 'MYSQL_FAMILY_DATABASE',
                    'label' => 'MySQL/MariaDB local',
                    'status' => $database['is_mysql_family'] ? 'validated' : 'pending',
                    'detail' => $database['is_mysql_family'] ? 'Base de datos local detectada' : 'Base de datos local pendiente',
                ],
                [
                    'code' => 'DUMP_BINARY_AVAILABLE',
                    'label' => 'Creacion de respaldos disponible',
                    'status' => $backups['dump_binary']['available'] ? 'validated' : 'pending',
                    'detail' => $backups['dump_binary']['available'] ? 'Disponible' : 'No detectado',
                ],
                [
                    'code' => 'BACKUP_STORAGE_WRITABLE',
                    'label' => 'Carpeta local de backups escribible',
                    'status' => $backups['storage']['writable'] ? 'validated' : 'pending',
                    'detail' => $backups['storage']['writable'] ? 'Disponible' : 'No escribible',
                ],
                [
                    'code' => 'FRONTEND_BUILD_PRESENT',
                    'label' => 'Interfaz web compilada',
                    'status' => $frontend['dist_index_exists'] && $frontend['assets_present'] ? 'validated' : 'pending',
                    'detail' => $frontend['dist_index_exists'] && $frontend['assets_present']
                        ? 'Interfaz lista para abrir en navegador'
                        : 'Falta ejecutar build de frontend antes de instalar',
                ],
                [
                    'code' => 'LAN_APP_URL_CONFIGURED',
                    'label' => 'Direccion LAN configurada',
                    'status' => $network['lan_ready'] ? 'validated' : 'manual_required',
                    'detail' => $network['guidance'],
                ],
                [
                    'code' => 'DATABASE_MIGRATIONS_CURRENT',
                    'label' => 'Base de datos actualizada',
                    'status' => ($runtime['pending_migration_count'] ?? 0) === 0 ? 'validated' : 'pending',
                    'detail' => ($runtime['pending_migration_count'] ?? 0) === 0
                        ? 'No hay actualizaciones pendientes de base de datos'
                        : 'Requiere respaldo y actualizacion segura antes de operar reportes',
                ],
                [
                    'code' => 'BACKUP_WORKER_CONTINUOUS',
                    'label' => 'Worker de backups como tarea/servicio',
                    'status' => 'manual_required',
                    'detail' => 'Debe estar activo para completar respaldos automaticos.',
                ],
                [
                    'code' => 'SERVER_LOGS_WRITABLE',
                    'label' => 'Logs locales escribibles',
                    'status' => $runtime['logs_writable'] ? 'validated' : 'pending',
                    'detail' => $runtime['logs_writable'] ? 'storage/logs disponible' : 'storage/logs no escribible',
                ],
                [
                    'code' => 'APP_CACHE_WRITABLE',
                    'label' => 'Cache de Laravel escribible',
                    'status' => $runtime['cache_writable'] ? 'validated' : 'pending',
                    'detail' => $runtime['cache_writable'] ? 'bootstrap/cache disponible' : 'bootstrap/cache no escribible',
                ],
            ],
            'public_routes' => [
                [
                    'path' => '/up',
                    'expected' => 'Servidor responde',
                    'status' => 'manual_required',
                ],
                [
                    'path' => '/login',
                    'expected' => 'Pantalla de ingreso abre desde otra computadora',
                    'status' => 'manual_required',
                ],
                [
                    'path' => '/verify-email',
                    'expected' => 'Pantalla esperada abre desde la red local',
                    'status' => 'manual_required',
                ],
            ],
            'physical_proofs' => $physicalProofs,
            'commands' => [
                'preflight' => 'powershell.exe -ExecutionPolicy Bypass -File scripts\\production_readiness_preflight.ps1 -BaseUrl http://IP_DEL_SERVIDOR',
                'backup_worker' => $backups['queue']['worker_command'],
                'scheduler' => $backups['queue']['scheduler_command'],
            ],
        ];
    }

    /**
     * @return array<int, array{code: string, label: string, required_file: string, status: string, detail: string}>
     */
    private function physicalProofStatuses(): array
    {
        return array_map(function (string $code): array {
            $proof = self::PHYSICAL_PROOFS[$code];
            $result = $this->evaluateProofFile(
                $proof['required_file'],
                $proof['fields'],
                $proof['checks'],
            );

            return [
                'code' => $code,
                'label' => $proof['label'],
                'required_file' => $proof['required_file'],
                'status' => $result['status'],
                'detail' => $result['detail'],
            ];
        }, array_keys(self::PHYSICAL_PROOFS));
    }

    /**
     * @param  array<int, string>  $requiredFields
     * @param  array<int, string>  $requiredChecks
     * @return array{status: string, detail: string}
     */
    private function evaluateProofFile(string $relativePath, array $requiredFields, array $requiredChecks): array
    {
        $path = $this->projectPath($relativePath);

        if (! is_file($path)) {
            return [
                'status' => 'pending',
                'detail' => 'Archivo de evidencia no existe todavia.',
            ];
        }

        $content = (string) file_get_contents($path);
        $normalized = preg_replace('/\s+/', ' ', str_replace("\r", '', $content)) ?? '';

        if (trim($normalized) === '' || strlen(trim($normalized)) < 300) {
            return [
                'status' => 'partial',
                'detail' => 'Archivo demasiado corto para evidencia real.',
            ];
        }

        $missingFields = array_values(array_filter(
            $requiredFields,
            fn (string $field): bool => ! $this->proofHasCompletedField($content, $field),
        ));

        if ($missingFields !== []) {
            return [
                'status' => 'partial',
                'detail' => 'Faltan campos: '.implode(', ', array_slice($missingFields, 0, 3)),
            ];
        }

        $missingChecks = array_values(array_filter(
            $requiredChecks,
            fn (string $check): bool => ! $this->proofHasCompletedCheckedItem($content, $check),
        ));

        if ($missingChecks !== []) {
            return [
                'status' => 'partial',
                'detail' => 'Faltan checks con evidencia: '.implode(', ', array_slice($missingChecks, 0, 3)),
            ];
        }

        if (preg_match('/\b(TODO|PENDING_[A-Z_]+|REPLACE|N\/A|TBD)\b|\[ \]|example|template|use this file/i', $content) === 1) {
            return [
                'status' => 'partial',
                'detail' => 'Quedan placeholders o instrucciones de plantilla.',
            ];
        }

        foreach (['Evidence/photo reference', 'Evidence/capture reference'] as $field) {
            $missingReference = $this->missingReferencedLocalEvidence($content, $field);
            if ($missingReference !== null) {
                return [
                    'status' => 'partial',
                    'detail' => "La evidencia local referenciada no existe: {$missingReference}",
                ];
            }
        }

        return [
            'status' => 'validated',
            'detail' => 'Evidencia completada; el preflight final debe confirmarla sin bypass.',
        ];
    }

    private function proofHasCompletedField(string $content, string $fieldLabel): bool
    {
        $value = $this->proofFieldValue($content, $fieldLabel);

        return ! $this->proofValueIsIncomplete($value);
    }

    private function proofFieldValue(string $content, string $fieldLabel): ?string
    {
        $pattern = '/^\s*-\s*'.preg_quote($fieldLabel, '/').'\s*:[ \t]*(?<value>[^\r\n]*)$/im';

        if (preg_match($pattern, $content, $matches) !== 1) {
            return null;
        }

        return trim((string) $matches['value']);
    }

    private function proofHasCompletedCheckedItem(string $content, string $labelPattern): bool
    {
        $linePattern = '/^\s*-\s*\[[xX]\]\s*.*'.preg_quote($labelPattern, '/').'.*$/im';

        if (preg_match($linePattern, $content, $matches) !== 1) {
            return false;
        }

        if (preg_match('/:[ \t]*(?<value>[^\r\n]*)$/', (string) $matches[0], $result) !== 1) {
            return false;
        }

        return ! $this->proofValueIsIncomplete((string) $result['value']);
    }

    private function proofValueIsIncomplete(?string $value): bool
    {
        $trimmed = trim((string) $value);

        return $trimmed === ''
            || preg_match('/^(TODO|PENDING|PENDING_[A-Z_]+|REPLACE|N\/A|NA|NONE|TBD|-|\[ \])$/i', $trimmed) === 1;
    }

    private function missingReferencedLocalEvidence(string $content, string $fieldLabel): ?string
    {
        $reference = $this->proofFieldValue($content, $fieldLabel);
        if ($this->proofValueIsIncomplete($reference)) {
            return null;
        }

        $reference = trim((string) $reference);
        $isRootedPath = preg_match('/^[A-Za-z]:[\/\\\\]/', $reference) === 1
            || str_starts_with($reference, '/')
            || str_starts_with($reference, '\\');
        $looksLikeLocalPath = preg_match('/^(qa|docs|scripts|frontend|backend)[\/\\\\]/i', $reference) === 1
            || $isRootedPath;

        if (! $looksLikeLocalPath) {
            return null;
        }

        $candidate = $isRootedPath ? $reference : $this->projectPath($reference);

        return file_exists($candidate) ? null : $reference;
    }

    private function projectPath(string $relativePath): string
    {
        $projectRoot = (string) Config::get('hospital.project_root', dirname(base_path()));

        return $projectRoot.DIRECTORY_SEPARATOR.str_replace(['/', '\\'], DIRECTORY_SEPARATOR, $relativePath);
    }
}
