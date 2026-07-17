<?php

namespace App\Actions\Backups;

use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use RuntimeException;
use Symfony\Component\Process\Process;

class DatabaseDumpWriter
{
    public function dumpTo(string $absolutePath): void
    {
        $connection = Config::get('database.default');
        $config = Config::get("database.connections.{$connection}", []);
        $driver = (string) ($config['driver'] ?? '');

        if ($driver === 'sqlite') {
            $this->dumpSqlite($absolutePath, $config);

            return;
        }

        if (! in_array($driver, ['mysql', 'mariadb'], true)) {
            throw new RuntimeException('Driver de base de datos no soportado para backup local.');
        }

        $this->dumpMysql($absolutePath, $config);
    }

    /**
     * @param  array<string, mixed>  $config
     */
    private function dumpSqlite(string $absolutePath, array $config): void
    {
        $database = (string) ($config['database'] ?? '');

        if ($database === ':memory:') {
            $this->dumpSqliteMemoryDatabase($absolutePath);

            return;
        }

        if ($database === '' || ! is_file($database)) {
            throw new RuntimeException('SQLite no tiene archivo fisico para respaldar.');
        }

        if (! copy($database, $absolutePath)) {
            throw new RuntimeException('No se pudo copiar el archivo SQLite local.');
        }
    }

    /**
     * @param  array<string, mixed>  $config
     */
    private function dumpMysql(string $absolutePath, array $config): void
    {
        $binary = $this->findDumpBinary();

        if ($binary === null) {
            throw new RuntimeException('No se encontro mariadb-dump ni mysqldump. Instale una herramienta de dump local en el servidor.');
        }

        $defaultsFile = $this->createMysqlDefaultsFile((string) ($config['password'] ?? ''));

        try {
            $command = [
                $binary,
                '--defaults-extra-file='.$defaultsFile,
                '--single-transaction',
                '--quick',
                '--skip-comments',
                '--result-file='.$absolutePath,
                '--host='.(string) ($config['host'] ?? '127.0.0.1'),
                '--port='.(string) ($config['port'] ?? '3306'),
                '--user='.(string) ($config['username'] ?? ''),
                (string) ($config['database'] ?? ''),
            ];

            $process = new Process($command);
            $process->setTimeout(300);
            $process->run();

            if (! $process->isSuccessful()) {
                throw new RuntimeException($this->sanitizeDumpError($process->getErrorOutput() ?: $process->getOutput()));
            }
        } finally {
            $this->removeDefaultsFile($defaultsFile);
        }
    }

    private function createMysqlDefaultsFile(string $password): string
    {
        $path = tempnam(sys_get_temp_dir(), 'hospital-mysql-');
        if ($path === false) {
            throw new RuntimeException('No se pudo crear archivo temporal seguro para credenciales de backup.');
        }

        $escapedPassword = addcslashes($password, "\\\"\n\r");
        if (file_put_contents($path, "[client]\npassword=\"{$escapedPassword}\"\n") === false) {
            @unlink($path);
            throw new RuntimeException('No se pudo escribir archivo temporal seguro para credenciales de backup.');
        }

        @chmod($path, 0600);

        return $path;
    }

    private function removeDefaultsFile(string $path): void
    {
        if ($path !== '' && is_file($path)) {
            @unlink($path);
        }
    }

    private function dumpSqliteMemoryDatabase(string $absolutePath): void
    {
        $pdo = DB::connection()->getPdo();
        $tables = collect(DB::select(
            "select name, sql from sqlite_master where type = 'table' and name not like 'sqlite_%' order by name"
        ));
        $handle = fopen($absolutePath, 'wb');

        if ($handle === false) {
            throw new RuntimeException('No se pudo escribir el dump SQLite local de pruebas.');
        }

        try {
            foreach ([
                '-- Sistema de Caja Hospitalaria local SQLite test backup',
                'PRAGMA foreign_keys=OFF;',
                'BEGIN TRANSACTION;',
            ] as $line) {
                $this->writeDumpLine($handle, $line);
            }

            foreach ($tables as $table) {
                $name = (string) $table->name;

                if (! empty($table->sql)) {
                    $this->writeDumpLine($handle, $table->sql.';');
                }

                $columns = collect(DB::select("pragma table_info('".$name."')"))
                    ->pluck('name')
                    ->map(fn (string $column) => '"'.str_replace('"', '""', $column).'"')
                    ->implode(', ');

                foreach (DB::table($name)->cursor() as $row) {
                    $values = collect((array) $row)
                        ->map(function ($value) use ($pdo): string {
                            if ($value === null) {
                                return 'NULL';
                            }

                            $quoted = $pdo->quote((string) $value);
                            if ($quoted === false) {
                                throw new RuntimeException('No se pudo serializar un valor del dump SQLite local.');
                            }

                            return $quoted;
                        })
                        ->implode(', ');

                    $this->writeDumpLine(
                        $handle,
                        'INSERT INTO "'.str_replace('"', '""', $name).'" ('.$columns.') VALUES ('.$values.');',
                    );
                }
            }

            $this->writeDumpLine($handle, 'COMMIT;');
        } finally {
            fclose($handle);
        }
    }

    /** @param resource $handle */
    private function writeDumpLine($handle, string $line): void
    {
        $data = $line.PHP_EOL;
        $length = strlen($data);
        $offset = 0;

        while ($offset < $length) {
            $written = fwrite($handle, substr($data, $offset));
            if ($written === false || $written === 0) {
                throw new RuntimeException('No se pudo escribir el dump SQLite local de pruebas.');
            }

            $offset += $written;
        }
    }

    private function findDumpBinary(): ?string
    {
        $configuredBinary = (string) env('HOSPITAL_DUMP_BINARY', '');
        $candidates = array_values(array_filter([
            $configuredBinary !== '' ? $configuredBinary : null,
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

        foreach ($candidates as $binary) {
            $isPath = str_contains($binary, '/') || str_contains($binary, '\\');
            if ($isPath && ! is_file($binary)) {
                continue;
            }

            $process = new Process([$binary, '--version']);
            $process->setTimeout(10);
            $process->run();

            if ($process->isSuccessful()) {
                return $binary;
            }
        }

        return null;
    }

    private function sanitizeDumpError(string $error): string
    {
        return str($error)
            ->replaceMatches('/password[^\\s]*/i', 'password=[redacted]')
            ->squish()
            ->limit(500)
            ->toString() ?: 'La herramienta local de backup fallo.';
    }
}
