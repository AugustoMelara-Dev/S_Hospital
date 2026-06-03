<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Actions\Backups\DatabaseDumpWriter;
use Illuminate\Support\Env;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use RuntimeException;
use Tests\TestCase;

class DatabaseDumpWriterTest extends TestCase
{
    private string $tempDir;

    private string $originalDefaultDriver;

    private string $originalDefaultDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->tempDir = sys_get_temp_dir().DIRECTORY_SEPARATOR.'hospital-dump-test-'.uniqid('', true);
        if (! mkdir($this->tempDir, 0700, true) && ! is_dir($this->tempDir)) {
            $this->markTestSkipped('Cannot create temp dir for DatabaseDumpWriter tests.');
        }

        $connection = Config::get('database.default');
        $this->originalDefaultDriver = (string) Config::get("database.connections.{$connection}.driver", 'sqlite');
        $this->originalDefaultDatabase = (string) Config::get("database.connections.{$connection}.database", ':memory:');
    }

    protected function tearDown(): void
    {
        $this->removeDirectory($this->tempDir);
        putenv('HOSPITAL_DUMP_BINARY');
        Env::getRepository()->clear('HOSPITAL_DUMP_BINARY');

        $connection = Config::get('database.default');
        Config::set("database.connections.{$connection}.driver", $this->originalDefaultDriver);
        Config::set("database.connections.{$connection}.database", $this->originalDefaultDatabase);

        parent::tearDown();
    }

    public function test_throws_for_unsupported_driver(): void
    {
        $this->swapDefaultConnection(['driver' => 'pgsql', 'database' => 'hospital']);

        $writer = new DatabaseDumpWriter;

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('Driver de base de datos no soportado para backup local.');

        $writer->dumpTo($this->tempDir.DIRECTORY_SEPARATOR.'out.sql');
    }

    public function test_throws_when_sqlite_database_path_does_not_exist(): void
    {
        $missing = $this->tempDir.DIRECTORY_SEPARATOR.'missing.sqlite';
        $this->swapDefaultConnection(['driver' => 'sqlite', 'database' => $missing]);

        $writer = new DatabaseDumpWriter;

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('SQLite no tiene archivo fisico para respaldar.');

        $writer->dumpTo($this->tempDir.DIRECTORY_SEPARATOR.'out.sql');
    }

    public function test_throws_when_sqlite_copy_fails(): void
    {
        $source = $this->tempDir.DIRECTORY_SEPARATOR.'source.sqlite';
        file_put_contents($source, "create table x(id int);\n");
        $this->swapDefaultConnection(['driver' => 'sqlite', 'database' => $source]);

        // copy() fails when the destination is an existing directory.
        $target = $this->tempDir.DIRECTORY_SEPARATOR.'copy-target';
        mkdir($target, 0700, true);

        $writer = new DatabaseDumpWriter;

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('No se pudo copiar el archivo SQLite local.');

        $writer->dumpTo($target);
    }

    public function test_mysql_dump_surfaces_failure_with_sanitized_message(): void
    {
        $this->swapDefaultConnection($this->mysqlConfig());

        // Use a small PHP wrapper as the "dump binary". It accepts --version
        // and exits 0 so it is selected, but fails on the actual dump call
        // with an error message that includes a password the sanitizer
        // must redact.
        $wrapper = $this->createFakeDumpBinary();
        $this->setDumpBinary($wrapper);

        $writer = new DatabaseDumpWriter;
        $output = $this->tempDir.DIRECTORY_SEPARATOR.'out.sql';

        try {
            $writer->dumpTo($output);
            $this->fail('Expected RuntimeException was not thrown.');
        } catch (RuntimeException $exception) {
            $message = $exception->getMessage();
            $this->assertStringNotContainsString('secret-password-123', $message);
            $this->assertStringContainsString('password=[redacted]', $message);
        } finally {
            @unlink($wrapper);
        }
    }

    public function test_mysql_dump_throws_when_no_binary_is_found(): void
    {
        $this->swapDefaultConnection($this->mysqlConfig());
        $this->setDumpBinary('C:\\nonexistent\\definitely-not-a-binary-'.uniqid());

        $writer = new DatabaseDumpWriter;

        try {
            $writer->dumpTo($this->tempDir.DIRECTORY_SEPARATOR.'out.sql');
            $this->fail('Expected RuntimeException was not thrown.');
        } catch (RuntimeException $exception) {
            $this->assertStringContainsString('No se encontro mariadb-dump ni mysqldump', $exception->getMessage());
        }
    }

    public function test_sanitize_dump_error_redacts_password_and_handles_empty(): void
    {
        $writer = new DatabaseDumpWriter;
        $method = (new \ReflectionClass($writer))->getMethod('sanitizeDumpError');
        $method->setAccessible(true);

        $sanitized = $method->invoke(
            $writer,
            "mysqldump: Got error 1045: Access denied for user 'root'@'localhost' (using password: hunter2-secret) --password=hunter2-secret --host=127.0.0.1",
        );
        $this->assertStringContainsString('password=[redacted]', $sanitized);
        $this->assertStringNotContainsString('hunter2-secret', $sanitized);

        $long = str_repeat('A', 1500);
        $truncated = $method->invoke($writer, "long=$long --password=hunter2-secret trail short");
        $this->assertStringContainsString('password=[redacted]', $truncated);
        $this->assertStringNotContainsString('hunter2-secret', $truncated);

        $fallback = $method->invoke($writer, '');
        $this->assertSame('La herramienta local de backup fallo.', $fallback);
    }

    public function test_sqlite_memory_dump_writes_to_absolute_path(): void
    {
        DB::statement('CREATE TABLE sample (id INTEGER, name TEXT)');
        DB::table('sample')->insert([
            ['id' => 1, 'name' => "O'Brien"],
            ['id' => 2, 'name' => null],
        ]);

        $writer = new DatabaseDumpWriter;
        $output = $this->tempDir.DIRECTORY_SEPARATOR.'mem-dump.sql';
        $writer->dumpTo($output);

        $contents = file_get_contents($output);
        $this->assertStringContainsString('BEGIN TRANSACTION;', $contents);
        $this->assertStringContainsString('COMMIT;', $contents);
        $this->assertStringContainsString('INSERT INTO "sample"', $contents);
        $this->assertStringContainsString("'O''Brien'", $contents);
        $this->assertStringContainsString('NULL', $contents);
    }

    public function test_sqlite_dump_copies_existing_file(): void
    {
        $source = $this->tempDir.DIRECTORY_SEPARATOR.'copy-source.sqlite';
        file_put_contents($source, "create table copy_demo(id int);\n");
        $this->swapDefaultConnection(['driver' => 'sqlite', 'database' => $source]);

        $writer = new DatabaseDumpWriter;
        $output = $this->tempDir.DIRECTORY_SEPARATOR.'copy-target.sql';
        $writer->dumpTo($output);

        $this->assertFileExists($output);
        $this->assertSame(file_get_contents($source), file_get_contents($output));
    }

    /**
     * @return array<string, mixed>
     */
    private function mysqlConfig(): array
    {
        return [
            'driver' => 'mysql',
            'host' => '127.0.0.1',
            'port' => '3306',
            'database' => 'hospital',
            'username' => 'root',
            'password' => 'test-pw',
        ];
    }

    /**
     * @param  array<string, mixed>  $config
     */
    private function swapDefaultConnection(array $config): void
    {
        $connection = Config::get('database.default');
        $existing = Config::get("database.connections.{$connection}", []);
        Config::set("database.connections.{$connection}", array_merge($existing, $config));
    }

    private function setDumpBinary(string $path): void
    {
        putenv('HOSPITAL_DUMP_BINARY='.$path);
        Env::getRepository()->set('HOSPITAL_DUMP_BINARY', $path);
    }

    private function createFakeDumpBinary(): string
    {
        $isWindows = DIRECTORY_SEPARATOR === '\\';
        $path = $this->tempDir.DIRECTORY_SEPARATOR.($isWindows ? 'fake-dump.bat' : 'fake-dump.sh');

        if ($isWindows) {
            $script = "@echo off\r\n"
                ."if \"%1\"==\"--version\" (\r\n"
                ."  echo fake-dump 1.0\r\n"
                ."  exit /b 0\r\n"
                .")\r\n"
                ."1>&2 echo mysqldump: Got error 1045: Access denied for user 'root'@'localhost' (using password: secret-password-123) --password=secret-password-123 --host=127.0.0.1\r\n"
                ."exit /b 1\r\n";
        } else {
            $script = "#!/usr/bin/env bash\n"
                ."if [ \"$1\" = \"--version\" ]; then\n"
                ."  echo \"fake-dump 1.0\"\n"
                ."  exit 0\n"
                ."fi\n"
                ."echo \"mysqldump: Got error 1045: Access denied (using password: secret-password-123) --password=secret-password-123\" 1>&2\n"
                ."exit 1\n";
        }

        file_put_contents($path, $script);
        @chmod($path, 0755);

        return $path;
    }

    private function removeDirectory(string $path): void
    {
        if (! is_dir($path)) {
            return;
        }
        $entries = scandir($path);
        if ($entries === false) {
            return;
        }
        foreach ($entries as $entry) {
            if ($entry === '.' || $entry === '..') {
                continue;
            }
            $full = $path.DIRECTORY_SEPARATOR.$entry;
            if (is_dir($full)) {
                $this->removeDirectory($full);
            } else {
                @unlink($full);
            }
        }
        @rmdir($path);
    }
}
