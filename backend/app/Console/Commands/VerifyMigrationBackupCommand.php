<?php

namespace App\Console\Commands;

use App\Actions\Backups\BackupFileCipher;
use App\Actions\Backups\EncryptBackupFileAction;
use App\Models\BackupLog;
use App\Support\OperationalMessageSanitizer;
use Carbon\CarbonInterface;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use RuntimeException;
use Throwable;

class VerifyMigrationBackupCommand extends Command
{
    private const DEFAULT_BACKUP_MAX_AGE_HOURS = 72;

    protected $signature = 'hospital:verify-migration-backup
        {--max-age-hours= : Ventana maxima en horas para aceptar el respaldo antes de migrar (default 72)}
        {--json : Emitir un resultado JSON para automatizacion local}';

    protected $description = 'Bloquea migraciones sobre una instalacion con datos si no existe un respaldo cifrado, integro y recuperable dentro de la ventana configurada.';

    protected $help = <<<'HELP'
Verifica que una instalacion con datos tenga un respaldo cifrado, integro y
recuperable antes de migrar.

La ventana de aplicabilidad se define con la opcion --max-age-hours (horas;
default 72). El instalador y el entrypoint traducen la variable de entorno
HOSPITAL_MIGRATION_BACKUP_MAX_AGE_HOURS a esta opcion. Valores no numericos o
menores a 1 usan el default. El resultado muestra la ventana efectiva, la fecha
de finalizacion del respaldo y su antiguedad.

Sin un respaldo verificado dentro de la ventana, la migracion se bloquea con
exit code distinto de cero. Una instalacion genuinamente vacia (sin tablas,
sin migraciones aplicadas y sin datos de dominio) puede migrar sin respaldo.
HELP;

    public function handle(BackupFileCipher $cipher): int
    {
        $maxAgeHours = $this->maxBackupAgeHours();
        $context = ['max_age_hours' => $maxAgeHours];

        try {
            $tables = $this->listTableNames();
        } catch (Throwable $exception) {
            return $this->blocked(
                'No se pudo inspeccionar la base de datos para verificar el respaldo.',
                OperationalMessageSanitizer::message($exception->getMessage()),
                $context,
            );
        }

        if ($tables === []) {
            return $this->approved('empty', 'Instalacion nueva (base de datos sin tablas). Migracion permitida sin respaldo previo.', $context);
        }

        $migrationsApplied = null;

        if (in_array('migrations', $tables, true)) {
            try {
                $migrationsApplied = (int) DB::table('migrations')->count();
            } catch (Throwable $exception) {
                return $this->blocked(
                    'No se pudo leer el historial de migraciones para clasificar la instalacion.',
                    OperationalMessageSanitizer::message($exception->getMessage()),
                    $context,
                );
            }
        }

        if ($migrationsApplied === 0) {
            $domainData = $this->findDomainData($tables);

            if ($domainData !== null) {
                return $this->blocked(
                    "La tabla de migraciones esta vacia pero existen datos ({$domainData}). No se puede tratar como instalacion nueva: cree un respaldo cifrado verificado o reconcilie el estado antes de migrar.",
                    null,
                    $context,
                );
            }

            return $this->approved('empty', 'Instalacion nueva (sin migraciones aplicadas y sin datos de dominio). Migracion permitida sin respaldo previo.', $context);
        }

        if (! in_array('backup_logs', $tables, true)) {
            return $this->blocked('La base de datos tiene datos pero no existe la tabla backup_logs; no se puede verificar un respaldo recuperable.', null, $context);
        }

        $backups = BackupLog::query()
            ->where('status', BackupLog::STATUS_SUCCESS)
            ->orderByDesc('id')
            ->get();

        if ($backups->isEmpty()) {
            return $this->blocked("No existe ningun respaldo con estado success registrado en backup_logs (ventana maxima {$maxAgeHours}h).", null, $context);
        }

        $rejections = [];

        foreach ($backups as $backup) {
            $completedAt = $this->backupCompletedAt($backup);

            if ($completedAt === null) {
                $rejections[] = "id {$backup->id}: no tiene fecha de finalizacion registrada";

                continue;
            }

            try {
                $problem = $this->verifyBackup($backup, $cipher, $maxAgeHours, $completedAt);
            } catch (Throwable $exception) {
                $problem = 'no se pudo verificar: '.(OperationalMessageSanitizer::message($exception->getMessage()) ?? 'error tecnico');
            }

            if ($problem === null) {
                $ageHours = $this->backupAgeHours($completedAt);
                $ageLabel = $this->formatHours($ageHours);
                $message = "Respaldo verificado: {$backup->filename} (id {$backup->id}, completado {$completedAt->toIso8601String()}, antiguedad {$ageLabel}h; ventana maxima {$maxAgeHours}h).";

                return $this->approved('verified', $message, array_merge($context, [
                    'backup_log_id' => $backup->id,
                    'filename' => $backup->filename,
                    'completed_at' => $completedAt->toIso8601String(),
                    'age_hours' => $ageHours,
                ]));
            }

            $rejections[] = "id {$backup->id}: {$problem}";
        }

        return $this->blocked(
            'Ningun respaldo exitoso es recuperable o esta dentro de la ventana: '.implode(' | ', array_slice($rejections, 0, 5)),
            null,
            $context,
        );
    }

    private function verifyBackup(
        BackupLog $backup,
        BackupFileCipher $cipher,
        int $maxAgeHours,
        CarbonInterface $completedAt,
    ): ?string {
        if ($backup->encrypted !== true) {
            return 'no esta cifrado';
        }

        if ($backup->disk !== 'local') {
            return "usa el disco '{$backup->disk}' y no el disco local";
        }

        $ageHours = $this->backupAgeHours($completedAt);

        if ($ageHours > $maxAgeHours) {
            return "esta fuera de la ventana: {$this->formatHours($ageHours)}h de antiguedad (completado {$completedAt->toIso8601String()}) superan el maximo de {$maxAgeHours}h";
        }

        $path = (string) $backup->path;
        if ($path === '' || ! $this->isSafeBackupPath($path)) {
            return 'la ruta registrada no es una ruta de respaldo valida';
        }

        $storage = Storage::disk('local');
        if (! $storage->exists($path)) {
            return 'el archivo no existe en el almacenamiento local';
        }

        $absolutePath = $storage->path($path);
        if (! is_file($absolutePath)) {
            return 'el archivo no existe en el almacenamiento local';
        }

        $actualSize = filesize($absolutePath);
        if ($backup->size_bytes === null || (int) $backup->size_bytes !== (int) $actualSize) {
            return 'el tamano registrado no coincide con el archivo';
        }

        $actualChecksum = hash_file('sha256', $absolutePath);
        if (
            ! is_string($actualChecksum)
            || $backup->checksum_sha256 === null
            || ! hash_equals((string) $backup->checksum_sha256, $actualChecksum)
        ) {
            return 'el checksum SHA-256 no coincide';
        }

        if ($backup->encryption_key_id !== null && $backup->encryption_key_id !== '') {
            if (! hash_equals((string) $backup->encryption_key_id, $cipher->keyIdentifier())) {
                return 'fue cifrado con una clave distinta a la configurada';
            }
        }

        if (! $this->firstChunkDecrypts($absolutePath, $cipher)) {
            return 'el archivo cifrado no es recuperable con la clave configurada';
        }

        return null;
    }

    private function backupCompletedAt(BackupLog $backup): ?CarbonInterface
    {
        return $backup->completed_at ?? $backup->created_at;
    }

    private function backupAgeHours(CarbonInterface $completedAt): float
    {
        return (float) $completedAt->diffInHours(now(), true);
    }

    private function formatHours(float $hours): string
    {
        $formatted = number_format($hours, 1, '.', '');

        return rtrim(rtrim($formatted, '0'), '.');
    }

    private function maxBackupAgeHours(): int
    {
        $configured = $this->option('max-age-hours');

        if (! is_numeric($configured)) {
            return self::DEFAULT_BACKUP_MAX_AGE_HOURS;
        }

        $hours = (int) $configured;

        return $hours >= 1 ? $hours : self::DEFAULT_BACKUP_MAX_AGE_HOURS;
    }

    private function firstChunkDecrypts(string $absolutePath, BackupFileCipher $cipher): bool
    {
        $handle = @fopen($absolutePath, 'rb');
        if ($handle === false) {
            throw new RuntimeException('No se pudo abrir el respaldo para verificar su cifrado.');
        }

        try {
            $markerLine = fgets($handle);
            if ($markerLine === false || trim($markerLine) !== EncryptBackupFileAction::CHUNK_MARKER) {
                return false;
            }

            $firstChunk = fgets($handle);
            if ($firstChunk === false || trim($firstChunk) === '') {
                return false;
            }

            return $cipher->decryptString(trim($firstChunk)) !== '';
        } finally {
            fclose($handle);
        }
    }

    private function isSafeBackupPath(string $path): bool
    {
        return str_starts_with($path, 'backups/')
            && ! str_contains($path, '..')
            && ! str_contains($path, '\\')
            && ! str_starts_with($path, '/');
    }

    /**
     * @param  list<string>  $tables
     */
    private function findDomainData(array $tables): ?string
    {
        foreach ($tables as $table) {
            if ($table === 'migrations') {
                continue;
            }

            try {
                if (DB::table($table)->limit(1)->exists()) {
                    return "la tabla {$table} contiene registros";
                }
            } catch (Throwable) {
                return "no se pudo comprobar si la tabla {$table} contiene datos";
            }
        }

        return null;
    }

    /**
     * @return list<string>
     */
    private function listTableNames(): array
    {
        $connection = DB::connection();
        $driver = $connection->getDriverName();

        if (in_array($driver, ['mysql', 'mariadb'], true)) {
            $rows = $connection->select(
                'select table_name as name from information_schema.tables where table_schema = database() and table_type = ?',
                ['BASE TABLE'],
            );

            return $this->normalizeTableNames($this->extractNameColumn($rows));
        }

        if ($driver === 'sqlite') {
            $rows = $connection->select("select name from sqlite_master where type = 'table' and name not like 'sqlite_%'");

            return $this->normalizeTableNames($this->extractNameColumn($rows));
        }

        $schema = $connection->getSchemaBuilder();
        if (method_exists($schema, 'getTableListing')) {
            return $this->normalizeTableNames($schema->getTableListing());
        }

        throw new RuntimeException("El driver de base de datos '{$driver}' no permite verificar el estado de la instalacion.");
    }

    /**
     * @param  array<int, mixed>  $rows
     * @return list<string>
     */
    private function extractNameColumn(array $rows): array
    {
        $names = [];

        foreach ($rows as $row) {
            if (! is_object($row) || ! property_exists($row, 'name')) {
                continue;
            }

            $name = $row->name;

            if (is_string($name) && $name !== '') {
                $names[] = $name;
            }
        }

        return $names;
    }

    /**
     * @param  iterable<mixed>  $names
     * @return list<string>
     */
    private function normalizeTableNames(iterable $names): array
    {
        $normalized = [];

        foreach ($names as $name) {
            if (! is_string($name) || $name === '') {
                continue;
            }

            $lower = strtolower($name);
            $separator = strrpos($lower, '.');
            if ($separator !== false) {
                $lower = substr($lower, $separator + 1);
            }

            $normalized[] = $lower;
        }

        return array_values(array_unique($normalized));
    }

    /**
     * @param  array<string, mixed>  $context
     */
    private function approved(string $code, string $message, array $context = []): int
    {
        if ($this->option('json')) {
            $this->line(json_encode(array_merge([
                'status' => $code === 'empty' ? 'empty' : 'verified',
                'code' => $code,
                'message' => $message,
            ], $context), JSON_THROW_ON_ERROR));
        } else {
            $this->info($message);
        }

        return self::SUCCESS;
    }

    /**
     * @param  array<string, mixed>  $context
     */
    private function blocked(string $message, ?string $detail, array $context = []): int
    {
        $fullMessage = $detail === null || $detail === ''
            ? $message
            : $message.' Detalle: '.$detail;

        if ($this->option('json')) {
            $this->line(json_encode(array_merge([
                'status' => 'blocked',
                'code' => 'MIGRATION_BACKUP_UNVERIFIED',
                'message' => $fullMessage,
            ], $context), JSON_THROW_ON_ERROR));
        } else {
            $this->error('Actualizacion bloqueada: '.$fullMessage);
            $this->line('Cree un respaldo cifrado (php artisan hospital:backup --type=manual --json), espere estado success y vuelva a intentar.');
        }

        return self::FAILURE;
    }
}
