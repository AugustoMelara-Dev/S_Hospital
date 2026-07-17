<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Support\Testing\MigrationHash;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use PDO;
use Throwable;

class PrepareGoldenTestDatabaseCommand extends Command
{
    protected $signature = 'testing:prepare-golden-database
        {--database= : Disposable test database to prepare}
        {--golden-database= : Optional reusable golden database name}
        {--dry-run : Validate and print the plan without touching a database}';

    protected $description = 'Prepara una base golden segura para acelerar tests MySQL/MariaDB sin tocar produccion.';

    public function handle(): int
    {
        if (config('app.env') === 'production') {
            $this->error('Refusing to prepare a golden test database while APP_ENV=production.');

            return self::FAILURE;
        }

        $hash = MigrationHash::forLaravelBase(base_path());
        $targetDatabase = $this->databaseOption('database') ?: 's_hospital_test_'.$this->shortHash($hash);
        $goldenDatabase = $this->databaseOption('golden-database') ?: 's_hospital_golden_'.$this->shortHash($hash);

        foreach ([[$targetDatabase, 'test'], [$goldenDatabase, 'golden']] as [$database, $kind]) {
            if (! $this->isSafeTestingDatabaseName($database, $kind)) {
                $this->error('Refusing unsafe '.$kind.' database name: '.$database);

                return self::FAILURE;
            }
        }

        if ($this->option('dry-run')) {
            $this->line('GOLDEN_DATABASE_DRY_RUN: YES');
            $this->line('Target database: '.$targetDatabase);
            $this->line('Golden database: '.$goldenDatabase);
            $this->line('Migration hash: '.$hash);

            return self::SUCCESS;
        }

        $connection = $this->configString('database.default');
        if (! in_array($connection, ['mysql', 'mariadb'], true)) {
            $this->error('Golden database materialization requires DB_CONNECTION=mysql or mariadb.');

            return self::FAILURE;
        }

        if (! $this->databaseHostIsAllowedForGoldenTests($connection)) {
            $host = $this->configString("database.connections.{$connection}.host") ?: '[invalid]';
            $this->error("Refusing database host '{$host}' for golden tests. Use localhost/127.0.0.1, set HOSPITAL_TEST_DB_STRATEGY=golden_mysql for Docker test networks, or set HOSPITAL_CONFIRM_EXTERNAL_TEST_DB_HOST to the exact disposable test host.");

            return self::FAILURE;
        }

        try {
            $this->prepareGoldenDatabase($goldenDatabase, $hash, $connection);
            $this->cloneDatabase($goldenDatabase, $targetDatabase, $connection);
        } catch (Throwable $throwable) {
            $this->error('Golden database preparation failed: '.$throwable->getMessage());

            return self::FAILURE;
        }

        $this->info('Golden test database ready.');
        $this->line('Target database: '.$targetDatabase);
        $this->line('Golden database: '.$goldenDatabase);
        $this->line('Migration hash: '.$hash);

        return self::SUCCESS;
    }

    private function databaseOption(string $name): ?string
    {
        $value = $this->option($name);

        if (! is_string($value)) {
            return null;
        }

        $value = trim($value);

        return $value === '' ? null : $value;
    }

    private function isSafeTestingDatabaseName(string $database, string $kind): bool
    {
        if (! preg_match('/^[A-Za-z0-9_]+$/', $database)) {
            return false;
        }

        $expectedPrefix = match ($kind) {
            'test' => 's_hospital_test_',
            'golden' => 's_hospital_golden_',
            default => throw new \InvalidArgumentException('Unknown golden DB safety kind.'),
        };

        return str_starts_with($database, $expectedPrefix)
            && strlen($database) > strlen($expectedPrefix);
    }

    private function shortHash(string $hash): string
    {
        return substr($hash, 0, 12);
    }

    private function databaseHostIsAllowedForGoldenTests(string $connection): bool
    {
        $host = strtolower(trim($this->configString("database.connections.{$connection}.host")));

        if (in_array($host, ['localhost', '127.0.0.1', '::1'], true)) {
            return true;
        }

        if (in_array($host, ['mysql', 'mariadb', 'db'], true)) {
            return getenv('HOSPITAL_TEST_DB_STRATEGY') === 'golden_mysql';
        }

        $confirmedHostValue = getenv('HOSPITAL_CONFIRM_EXTERNAL_TEST_DB_HOST');
        $confirmedHost = is_string($confirmedHostValue) ? strtolower(trim($confirmedHostValue)) : '';

        return $confirmedHost !== '' && hash_equals($host, $confirmedHost);
    }

    private function prepareGoldenDatabase(string $database, string $hash, string $connection): void
    {
        $pdo = $this->serverPdo($connection);

        if ($this->goldenDatabaseMatchesHash($pdo, $database, $hash)) {
            $this->line('Golden database already matches migration hash.');

            return;
        }

        $this->line('Rebuilding golden database for current migration hash.');
        $pdo->exec('DROP DATABASE IF EXISTS '.$this->quoteIdentifier($database));
        $pdo->exec('CREATE DATABASE '.$this->quoteIdentifier($database).' CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');

        $originalDatabase = Config::get("database.connections.{$connection}.database");

        Config::set("database.connections.{$connection}.database", $database);
        DB::purge($connection);

        try {
            $exitCode = Artisan::call('migrate', [
                '--database' => $connection,
                '--force' => true,
            ]);

            if ($exitCode !== self::SUCCESS) {
                throw new \RuntimeException('artisan migrate failed for golden database.');
            }

            DB::connection($connection)->statement(
                'CREATE TABLE IF NOT EXISTS _test_golden_metadata (
                    migration_hash VARCHAR(64) NOT NULL PRIMARY KEY,
                    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                )'
            );
            DB::connection($connection)->table('_test_golden_metadata')->truncate();
            DB::connection($connection)->table('_test_golden_metadata')->insert([
                'migration_hash' => $hash,
                'created_at' => now(),
            ]);
        } finally {
            DB::disconnect($connection);
            Config::set("database.connections.{$connection}.database", $originalDatabase);
            DB::purge($connection);
        }
    }

    private function cloneDatabase(string $sourceDatabase, string $targetDatabase, string $connection): void
    {
        $pdo = $this->serverPdo($connection);

        $this->line('Cloning golden database into disposable test database.');
        $pdo->exec('DROP DATABASE IF EXISTS '.$this->quoteIdentifier($targetDatabase));
        $pdo->exec('CREATE DATABASE '.$this->quoteIdentifier($targetDatabase).' CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');

        $tablesStatement = $pdo->query('SHOW FULL TABLES FROM '.$this->quoteIdentifier($sourceDatabase).' WHERE Table_type = \'BASE TABLE\'');
        $tables = $tablesStatement === false ? [] : $tablesStatement->fetchAll(PDO::FETCH_NUM);

        try {
            $pdo->exec('SET FOREIGN_KEY_CHECKS=0');

            foreach ($tables as $table) {
                $tableName = $this->tableName($table);
                $createStatement = $pdo->query('SHOW CREATE TABLE '.$this->quoteIdentifier($sourceDatabase).'.'.$this->quoteIdentifier($tableName));
                $row = $createStatement === false ? false : $createStatement->fetch(PDO::FETCH_ASSOC);
                $createSql = is_array($row) && is_string($row['Create Table'] ?? null) ? $row['Create Table'] : '';

                if ($createSql === '') {
                    throw new \RuntimeException("Could not read CREATE TABLE for {$tableName}.");
                }

                $createSql = preg_replace(
                    '/^CREATE TABLE `'.preg_quote($tableName, '/').'`/i',
                    'CREATE TABLE '.$this->quoteIdentifier($targetDatabase).'.'.$this->quoteIdentifier($tableName),
                    $createSql,
                    1,
                );

                if (! is_string($createSql)) {
                    throw new \RuntimeException("Could not rewrite CREATE TABLE for {$tableName}.");
                }

                $pdo->exec($createSql);
            }

            foreach ($tables as $table) {
                $tableName = $this->tableName($table);
                $pdo->exec(
                    'INSERT INTO '.$this->quoteIdentifier($targetDatabase).'.'.$this->quoteIdentifier($tableName)
                    .' SELECT * FROM '.$this->quoteIdentifier($sourceDatabase).'.'.$this->quoteIdentifier($tableName)
                );
            }
        } finally {
            $pdo->exec('SET FOREIGN_KEY_CHECKS=1');
        }
    }

    private function goldenDatabaseMatchesHash(PDO $pdo, string $database, string $hash): bool
    {
        $statement = $pdo->prepare('SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = ?');
        $statement->execute([$database]);

        if ($statement->fetchColumn() === false) {
            return false;
        }

        $statement = $pdo->prepare(
            'SELECT COUNT(*)
             FROM INFORMATION_SCHEMA.TABLES
             WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?'
        );
        $statement->execute([$database, '_test_golden_metadata']);

        $tableCount = $statement->fetchColumn();
        if (! (is_int($tableCount) || (is_string($tableCount) && ctype_digit($tableCount))) || (int) $tableCount !== 1) {
            return false;
        }

        $statement = $pdo->query(
            'SELECT migration_hash FROM '.$this->quoteIdentifier($database).'.'.$this->quoteIdentifier('_test_golden_metadata').' LIMIT 1'
        );

        return $statement !== false && $statement->fetchColumn() === $hash;
    }

    private function serverPdo(string $connection): PDO
    {
        $config = config("database.connections.{$connection}");

        if (! is_array($config)) {
            throw new \RuntimeException('Missing database connection configuration.');
        }

        $host = $this->requiredString($config['host'] ?? '127.0.0.1', 'database host');
        $port = $this->portString($config['port'] ?? '3306');
        $username = $this->requiredString($config['username'] ?? '', 'database username', allowEmpty: true);
        $passwordValue = $config['password'] ?? '';
        $password = $this->requiredString($passwordValue, 'database password', allowEmpty: true);

        return new PDO(
            "mysql:host={$host};port={$port};charset=utf8mb4",
            $username,
            $password,
            [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            ],
        );
    }

    private function configString(string $key): string
    {
        $value = config($key);

        return is_string($value) ? $value : '';
    }

    private function requiredString(mixed $value, string $label, bool $allowEmpty = false): string
    {
        if (! is_string($value) || (! $allowEmpty && trim($value) === '')) {
            throw new \RuntimeException("Invalid {$label} configuration.");
        }

        return $value;
    }

    private function portString(mixed $value): string
    {
        if (is_int($value) && $value >= 1 && $value <= 65535) {
            return (string) $value;
        }

        if (is_string($value) && ctype_digit($value) && (int) $value >= 1 && (int) $value <= 65535) {
            return $value;
        }

        throw new \RuntimeException('Invalid database port configuration.');
    }

    private function tableName(mixed $table): string
    {
        if (! is_array($table) || ! is_string($table[0] ?? null)) {
            throw new \RuntimeException('Invalid table metadata returned by database server.');
        }

        return $table[0];
    }

    private function quoteIdentifier(string $identifier): string
    {
        if (! preg_match('/^[A-Za-z0-9_]+$/', $identifier)) {
            throw new \InvalidArgumentException('Unsafe SQL identifier.');
        }

        return '`'.$identifier.'`';
    }
}
