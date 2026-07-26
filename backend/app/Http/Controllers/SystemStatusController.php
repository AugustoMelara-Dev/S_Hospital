<?php

namespace App\Http\Controllers;

use App\Actions\Backups\ReconcileStaleBackupLogsAction;
use App\Actions\Reports\OperationalMetricsService;
use App\Actions\System\BuildOperationalStatusAction;
use App\Http\Requests\System\ShowSystemStatusRequest;
use App\Models\BackupLog;
use App\Models\FiscalSequence;
use App\Models\FiscalSetting;
use App\Models\Service;
use App\Models\User;
use App\Support\OperationalMessageSanitizer;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\Process\ExecutableFinder;
use Throwable;

/**
 * @phpstan-type StatusSection array<string, mixed>
 * @phpstan-type EnvironmentStatus array{app_env: string, app_debug: bool, app_url: string, queue_connection: string, filesystem_disk: string, app_version: string, php_version: string, server_time: string, timezone: string}
 * @phpstan-type DatabaseStatus array{connection: string, driver: string, connected: bool, is_mysql_family: bool}
 * @phpstan-type FrontendStatus array{dist_index_exists: bool, assets_present: bool, assets_count: int, entry_label: string}
 * @phpstan-type NetworkStatus array{configured_host: string|null, host_type: string, lan_ready: bool, client_url: string|null, guidance: string}
 * @phpstan-type DumpBinaryStatus array{configured: bool, available: bool, name: string|null}
 * @phpstan-type BackupStorageStatus array{writable: bool, free_bytes: float|null}
 * @phpstan-type SchedulerHeartbeatStatus array{status: string, last_tick_at: string|null, last_result: mixed, last_message: mixed, age_seconds: float|int|null, ticks_in_db: int, ticks_last_24h: int, expected: string}
 * @phpstan-type QueueStatus array{connection: string, jobs_table_available: bool, failed_jobs_table_available: bool, failed_jobs_count: int|null, pending_backup_jobs: int|null, scheduler_heartbeat: SchedulerHeartbeatStatus}
 * @phpstan-type BackupStatus array{pending_count: int, failed_count: int, worker_recently_active: bool, oldest_pending_at: string|null, stale_pending_count: int, stale_pending_threshold_minutes: int, last_success_at: string|null, last_success_file_exists: bool, last_success_checksum_matches: bool, last_failure_at: string|null, last_failure_message: string|null, dump_binary: DumpBinaryStatus, storage: BackupStorageStatus, queue: QueueStatus}
 * @phpstan-type RuntimeStatus array{logs_writable: bool, cache_writable: bool, laravel_log: array{exists: bool, size_bytes: int|null, modified_at: string|null}, backup_automation_log: array{exists: bool, size_bytes: int|null, modified_at: string|null}, frontend_build: array{available: bool, modified_at: string|null}, installed_version: string, latest_migration: string|null, migration_count: int|null, pending_migration_count: int, pending_migrations: list<string>}
 */
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
        'LOCAL_SERVER_VALIDATION_PROOF' => [
            'label' => 'Navegador local del servidor',
            'required_file' => 'qa/LOCAL_SERVER_VALIDATION_PROOF.md',
            'fields' => [
                'Date/time',
                'Responsible person',
                'Server computer name',
                'Local app URL',
                'Browser/version',
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
            'label' => 'Impresora institucional media carta/carta/A5',
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

    public function show(ShowSystemStatusRequest $request, BuildOperationalStatusAction $statusBuilder): JsonResponse
    {
        return response()->json([
            'data' => $statusBuilder->addCatalogRuleReadiness($this->baseStatus()),
        ]);
    }

    public function summary(BuildOperationalStatusAction $statusBuilder): JsonResponse
    {
        $status = $statusBuilder->addCatalogRuleReadiness($this->baseStatus());

        return response()->json([
            'data' => $statusBuilder->publicSummary($status),
        ]);
    }

    public function setupStatus(): JsonResponse
    {
        $fiscalSettings = FiscalSetting::query()->exists();
        $adminExists = User::query()
            ->where('active', true)
            ->whereHas('roles', fn ($query) => $query
                ->where('name', 'admin')
                ->where('guard_name', 'web'))
            ->exists();
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

    /** @return EnvironmentStatus */
    private function environmentStatus(): array
    {
        return [
            'app_env' => $this->configString('app.env'),
            'app_debug' => (bool) Config::get('app.debug'),
            'app_url' => OperationalMessageSanitizer::url($this->configString('app.url')),
            'queue_connection' => $this->configString('queue.default'),
            'filesystem_disk' => $this->configString('filesystems.default'),
            'app_version' => $this->configString('app.version', 'local'),
            'php_version' => PHP_VERSION,
            'server_time' => now()->toJSON(),
            'timezone' => $this->configString('app.timezone'),
        ];
    }

    /** @return DatabaseStatus */
    private function databaseStatus(): array
    {
        $connection = $this->configString('database.default');
        $driver = $this->configString("database.connections.{$connection}.driver", $connection);
        $connected = true;

        try {
            DB::connection($connection)->getPdo();
        } catch (Throwable) {
            $connected = false;
        }

        return [
            'connection' => $connection,
            'driver' => $driver,
            'connected' => $connected,
            'is_mysql_family' => in_array($driver, ['mysql', 'mariadb'], true),
        ];
    }

    /**
     * @return FrontendStatus
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
     * @return NetworkStatus
     */
    private function networkStatus(): array
    {
        $appUrl = $this->configString('app.url');
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
            'client_url' => in_array($hostType, ['lan', 'loopback'], true) ? "{$scheme}://{$host}{$port}" : null,
            'guidance' => match ($hostType) {
                'lan' => 'Clientes deben entrar por esta direccion LAN.',
                'loopback' => 'Operacion local en este equipo. Use esta direccion solo en la computadora servidor.',
                default => 'Configure APP_URL con la IP o nombre LAN del servidor antes de validar clientes.',
            },
        ];
    }

    /**
     * @return BackupStatus
     */
    private function backupStatus(): array
    {
        app(ReconcileStaleBackupLogsAction::class)->execute();

        $staleThresholdMinutes = 15;
        $staleBefore = now()->subMinutes($staleThresholdMinutes);
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
        $lastSuccessCompletedAt = $lastSuccess?->completed_at;
        $lastSuccessId = $lastSuccess?->id;
        $failedCount = BackupLog::query()
            ->where('status', BackupLog::STATUS_FAILED)
            ->when(
                $lastSuccessCompletedAt !== null,
                fn ($query) => $query->where(function ($query) use ($lastSuccessCompletedAt, $lastSuccessId): void {
                    $query
                        ->where('completed_at', '>', $lastSuccessCompletedAt)
                        ->orWhere(function ($query) use ($lastSuccessCompletedAt, $lastSuccessId): void {
                            $query
                                ->where('completed_at', $lastSuccessCompletedAt)
                                ->where('id', '>', $lastSuccessId);
                        });
                }),
            )
            ->count();
        $oldestPending = BackupLog::query()
            ->where('status', BackupLog::STATUS_PENDING)
            ->oldest('created_at')
            ->first();
        $stalePendingCount = BackupLog::query()
            ->where('status', BackupLog::STATUS_PENDING)
            ->where('created_at', '<=', $staleBefore)
            ->count();
        $operationalMetrics = app(OperationalMetricsService::class)->snapshot();
        $metricBackups = $this->statusSection($operationalMetrics['backups'] ?? null);
        $queueStatus = $this->queueStatus();
        $workerRecentlyActive = ($metricBackups['worker_recently_active'] ?? false) === true;
        $lastSuccessFile = [
            'exists' => ($metricBackups['latest_success_file_exists'] ?? null) === true,
            'checksum_matches' => ($metricBackups['latest_success_checksum_matches'] ?? null) === true,
        ];
        $lastSuccessFileIsUsable = $lastSuccessFile['exists'] && $lastSuccessFile['checksum_matches'];
        $workerRecentlyActive = $workerRecentlyActive && $lastSuccessFileIsUsable;
        $lastFailureAt = $lastFailure?->created_at;
        $lastSuccessAt = $lastSuccess?->created_at;
        $lastFailureIsUnresolved = $lastFailureAt !== null
            && ($lastSuccessAt === null || $lastFailureAt->greaterThan($lastSuccessAt));
        if (! $workerRecentlyActive && $lastSuccess?->completed_at !== null) {
            $schedulerHeartbeat = $queueStatus['scheduler_heartbeat']['status'];
            $workerRecentlyActive =
                $lastSuccess->completed_at->greaterThanOrEqualTo(now()->subDay())
                && $lastSuccessFileIsUsable
                && $pendingCount === 0
                && $stalePendingCount === 0
                && ! $lastFailureIsUnresolved
                && ($queueStatus['pending_backup_jobs'] ?? 0) === 0
                && ($queueStatus['failed_jobs_count'] ?? 0) === 0
                && in_array($schedulerHeartbeat, ['ok', 'stale'], true);
        }

        return [
            'pending_count' => $pendingCount,
            'failed_count' => $failedCount,
            'worker_recently_active' => $workerRecentlyActive,
            'oldest_pending_at' => $oldestPending?->created_at?->toJSON(),
            'stale_pending_count' => $stalePendingCount,
            'stale_pending_threshold_minutes' => $staleThresholdMinutes,
            'last_success_at' => $lastSuccess?->completed_at?->toJSON(),
            'last_success_file_exists' => $lastSuccessFile['exists'],
            'last_success_checksum_matches' => $lastSuccessFile['checksum_matches'],
            'last_failure_at' => $lastFailure?->completed_at?->toJSON(),
            'last_failure_message' => OperationalMessageSanitizer::message($lastFailure?->error_message),
            'dump_binary' => $this->dumpBinaryStatus(),
            'storage' => $this->backupStorageStatus(),
            'queue' => $queueStatus,
        ];
    }

    /**
     * @return RuntimeStatus
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
                ->filter(fn (mixed $migration): bool => is_string($migration))
                ->values()
                ->all();

            $latestMigration = $ranMigrations === [] ? null : max($ranMigrations);
            $migrationCount = count($ranMigrations);
            $pendingMigrations = array_values(array_diff($this->migrationFileNames(), $ranMigrations));
        }

        return [
            'logs_writable' => $this->directoryIsWritable($logsPath),
            'cache_writable' => is_dir($cachePath) && is_writable($cachePath),
            'laravel_log' => $this->fileStatus(storage_path('logs/laravel.log')),
            'backup_automation_log' => $this->fileStatus(base_path('scripts/backup-automation.log')),
            'frontend_build' => $this->frontendBuildStatus(),
            'installed_version' => $this->installedVersion(),
            'latest_migration' => $latestMigration,
            'migration_count' => $migrationCount,
            'pending_migration_count' => count($pendingMigrations),
            'pending_migrations' => array_slice($pendingMigrations, 0, 5),
        ];
    }

    private function directoryIsWritable(string $path): bool
    {
        if (! is_dir($path) && ! @mkdir($path, 0775, true) && ! is_dir($path)) {
            return false;
        }

        $probe = rtrim($path, DIRECTORY_SEPARATOR).DIRECTORY_SEPARATOR.'.write-test-'.bin2hex(random_bytes(4));
        try {
            if (@file_put_contents($probe, 'ok') === false) {
                return false;
            }

            @unlink($probe);

            return true;
        } catch (Throwable) {
            @unlink($probe);

            return false;
        }
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

        return $migrations;
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
     * @return array{available: bool, modified_at: string|null}
     */
    private function frontendBuildStatus(): array
    {
        $indexPath = $this->projectPath('frontend/dist/index.html');

        if (! is_file($indexPath)) {
            return [
                'available' => false,
                'modified_at' => null,
            ];
        }

        $modifiedAt = filemtime($indexPath);

        return [
            'available' => true,
            'modified_at' => $modifiedAt === false ? null : now()->setTimestamp($modifiedAt)->toJSON(),
        ];
    }

    private function installedVersion(): string
    {
        $configured = trim($this->configString('hospital.installed_version'));
        if ($configured !== '') {
            return $configured;
        }

        $packagePath = $this->projectPath('frontend/package.json');
        if (! is_file($packagePath)) {
            return '';
        }

        $content = file_get_contents($packagePath);
        if ($content === false) {
            return '';
        }

        $package = json_decode($content, true);
        if (! is_array($package)) {
            return '';
        }

        return trim($this->statusString($package['version'] ?? null));
    }

    /**
     * @return DumpBinaryStatus
     */
    private function dumpBinaryStatus(): array
    {
        $configured = $this->configString('backups.dump_binary');
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
     * @return BackupStorageStatus
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
     * @return QueueStatus
     */
    private function queueStatus(): array
    {
        $connection = $this->configString('queue.default');
        $pendingJobs = null;

        if ($connection === 'database' && Schema::hasTable('jobs')) {
            $pendingJobs = DB::table('jobs')->where('queue', 'backups')->count();
        }

        $heartbeat = $this->schedulerHeartbeat();

        return [
            'connection' => $connection,
            'jobs_table_available' => Schema::hasTable('jobs'),
            'failed_jobs_table_available' => Schema::hasTable('failed_jobs'),
            'failed_jobs_count' => Schema::hasTable('failed_jobs') ? DB::table('failed_jobs')->count() : null,
            'pending_backup_jobs' => $pendingJobs,
            'scheduler_heartbeat' => $heartbeat,
        ];
    }

    /**
     * @return SchedulerHeartbeatStatus
     */
    private function schedulerHeartbeat(): array
    {
        $lastTick = Cache::get('hospital:scheduler:last_tick');
        $lastResult = Cache::get('hospital:scheduler:last_result', 'unknown');
        $lastMessage = Cache::get('hospital:scheduler:last_message', '');

        $lastTickCarbon = null;
        $ageSeconds = null;
        $status = 'never_run';
        if (is_string($lastTick) && $lastTick !== '') {
            try {
                $lastTickCarbon = Carbon::parse($lastTick);
                $ageSeconds = max(0, now()->diffInSeconds($lastTickCarbon, absolute: true));
                $status = $ageSeconds <= 180 ? 'ok' : ($ageSeconds <= 600 ? 'stale' : 'stuck');
            } catch (Throwable) {
                $lastTickCarbon = null;
                $status = 'invalid';
            }
        }

        $historyCount = 0;
        $ticksLast24h = 0;
        if (Schema::hasTable('scheduler_ticks')) {
            $historyCount = (int) DB::table('scheduler_ticks')->count();
            $ticksLast24h = (int) DB::table('scheduler_ticks')
                ->where('at', '>=', now()->subDay())
                ->count();
        }

        return [
            'status' => $status,
            'last_tick_at' => $lastTickCarbon?->toIso8601String(),
            'last_result' => $lastResult,
            'last_message' => $lastMessage,
            'age_seconds' => $ageSeconds,
            'ticks_in_db' => $historyCount,
            'ticks_last_24h' => $ticksLast24h,
            'expected' => 'ticks_last_24h >= 1400',
        ];
    }

    /**
     * @param  RuntimeStatus  $runtime
     * @param  NetworkStatus  $network
     * @return array<string, mixed>
     */
    private function readinessStatus(array $runtime, array $network): array
    {
        $appEnv = $this->configString('app.env');
        $appDebug = (bool) Config::get('app.debug');
        $localMode = $network['host_type'] === 'loopback';
        $proofs = $this->physicalProofStatuses($localMode);
        $lanProof = $proofs[0];
        $printerProof = $proofs[1];

        $blockers = [
            $localMode ? [
                'code' => 'LOCAL_ACCESS_CONFIGURED',
                'label' => 'Acceso local configurado en este equipo',
                'status' => 'validated',
            ] : [
                'code' => 'PENDING_LAN_CLIENT_VALIDATION',
                'label' => 'Validacion desde segunda PC LAN',
                'status' => $lanProof['status'] === 'validated' ? 'validated' : 'pending',
            ],
            [
                'code' => 'PENDING_HARDWARE_VALIDATION',
                'label' => 'Impresora institucional fisica media carta/carta/A5',
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

        if ($runtime['pending_migration_count'] > 0) {
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
     * @param  EnvironmentStatus  $environment
     * @param  DatabaseStatus  $database
     * @param  FrontendStatus  $frontend
     * @param  NetworkStatus  $network
     * @param  BackupStatus  $backups
     * @param  RuntimeStatus  $runtime
     * @return array<string, mixed>
     */
    private function preflightStatus(
        array $environment,
        array $database,
        array $frontend,
        array $network,
        array $backups,
        array $runtime,
    ): array {
        $localMode = $network['host_type'] === 'loopback';
        $physicalProofs = $this->physicalProofStatuses($localMode);

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
                    'code' => $localMode ? 'LOCAL_APP_URL_CONFIGURED' : 'LAN_APP_URL_CONFIGURED',
                    'label' => $localMode ? 'Direccion local configurada' : 'Direccion LAN configurada',
                    'status' => $localMode || $network['lan_ready'] ? 'validated' : 'manual_required',
                    'detail' => $network['guidance'],
                ],
                [
                    'code' => 'DATABASE_MIGRATIONS_CURRENT',
                    'label' => 'Base de datos actualizada',
                    'status' => $runtime['pending_migration_count'] === 0 ? 'validated' : 'pending',
                    'detail' => $runtime['pending_migration_count'] === 0
                        ? 'No hay actualizaciones pendientes de base de datos'
                        : 'Requiere respaldo y actualizacion segura antes de operar reportes',
                ],
                [
                    'code' => 'BACKUP_WORKER_CONTINUOUS',
                    'label' => 'Worker de backups como tarea/servicio',
                    'status' => $backups['worker_recently_active'] ? 'validated' : 'manual_required',
                    'detail' => $backups['worker_recently_active']
                        ? 'Worker activo; respaldos automaticos completan desde la cola.'
                        : 'Debe estar activo para completar respaldos automaticos.',
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
                    'expected' => $localMode
                        ? 'Pantalla de ingreso abre en este equipo'
                        : 'Pantalla de ingreso abre desde otra computadora',
                    'status' => 'manual_required',
                ],
                [
                    'path' => '/verify-email',
                    'expected' => $localMode
                        ? 'Pantalla esperada abre localmente'
                        : 'Pantalla esperada abre desde la red local',
                    'status' => 'manual_required',
                ],
            ],
            'physical_proofs' => $physicalProofs,
        ];
    }

    /**
     * @return array<int, array{code: string, label: string, required_file: string, status: string, detail: string}>
     */
    private function physicalProofStatuses(bool $localMode = false): array
    {
        $codes = array_values(array_filter(
            array_keys(self::PHYSICAL_PROOFS),
            fn (string $code): bool => $localMode
                ? $code !== 'LAN_CLIENT_VALIDATION_PROOF'
                : $code !== 'LOCAL_SERVER_VALIDATION_PROOF',
        ));

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
        }, $codes);
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
        $pattern = '/^\s*-\s*'.preg_quote($fieldLabel, '/').'\s*:[ \t]*(?<value>[^\r\n]*)\r?$/im';

        if (preg_match($pattern, $content, $matches) !== 1) {
            return null;
        }

        return trim($matches['value']);
    }

    private function proofHasCompletedCheckedItem(string $content, string $labelPattern): bool
    {
        $linePattern = '/^\s*-\s*\[[xX]\]\s*.*'.preg_quote($labelPattern, '/').'.*\r?$/im';

        if (preg_match($linePattern, $content, $matches) !== 1) {
            return false;
        }

        $matchedLine = $matches[0] ?? null;
        if (! is_string($matchedLine) || preg_match('/:[ \t]*(?<value>[^\r\n]*)\r?$/', $matchedLine, $result) !== 1) {
            return false;
        }

        return ! $this->proofValueIsIncomplete($result['value']);
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
        if ($reference === null || $this->proofValueIsIncomplete($reference)) {
            return null;
        }

        $reference = trim($reference);
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
        $projectRoot = $this->configString('hospital.project_root', dirname(base_path()));

        return $projectRoot.DIRECTORY_SEPARATOR.str_replace(['/', '\\'], DIRECTORY_SEPARATOR, $relativePath);
    }

    /**
     * @return array<string, mixed>
     */
    private function baseStatus(): array
    {
        $environment = $this->environmentStatus();
        $database = $this->databaseStatus();
        $frontend = $this->frontendStatus();
        $network = $this->networkStatus();
        $backups = $this->backupStatus();
        $runtime = $this->runtimeStatus();

        return [
            'environment' => $environment,
            'database' => $database,
            'frontend' => $frontend,
            'network' => $network,
            'backups' => $backups,
            'runtime' => $runtime,
            'readiness' => $this->readinessStatus($runtime, $network),
            'preflight' => $this->preflightStatus(
                $environment,
                $database,
                $frontend,
                $network,
                $backups,
                $runtime,
            ),
        ];
    }

    /** @return array<string, mixed> */
    private function statusSection(mixed $section): array
    {
        if (! is_array($section)) {
            return [];
        }

        $normalized = [];
        foreach ($section as $key => $value) {
            if (is_string($key)) {
                $normalized[$key] = $value;
            }
        }

        return $normalized;
    }

    private function statusString(mixed $value): string
    {
        return is_string($value) ? $value : '';
    }

    private function configString(string $key, string $default = ''): string
    {
        return $this->statusString(Config::get($key, $default));
    }
}
