<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

/**
 * F014 (T2-040): migracion 220002 que marca la deprecacion de
 * `operation_idempotency_keys` con COMMENT de tabla (metadata), sin tocar
 * filas. SQLite no soporta comentarios de tabla: se omite por driver, pero el
 * guard de consumidores (OperationIdempotencyKeysLegacyConsumerGuardTest) si
 * corre en la suite rapida.
 */
class LegacyIdempotencyTableDeprecationMigrationTest extends TestCase
{
    use RefreshDatabase {
        beginDatabaseTransaction as private beginRefreshTransaction;
    }

    protected static bool $resetSchemaAfterDdl = true;

    public function beginDatabaseTransaction(): void
    {
        // The target COMMENT DDL must run outside a transaction. Tests leave
        // its marker restored; TestCase rebuilds the disposable schema once
        // after this class, including its two synthetic legacy rows.
        if (! in_array(DB::connection()->getDriverName(), ['mysql', 'mariadb'], true)) {
            $this->beginRefreshTransaction();
        }
    }

    protected function setUp(): void
    {
        parent::setUp();

        if (! in_array(DB::connection()->getDriverName(), ['mysql', 'mariadb'], true)) {
            $this->markTestSkipped('El COMMENT de tabla solo aplica a MariaDB/MySQL; la suite SQLite se conserva intacta.');
        }

        if (! Schema::hasTable('operation_idempotency_keys')) {
            $this->markTestSkipped('La tabla legacy no esta presente en este esquema.');
        }
    }

    public function test_table_comment_contains_the_deprecation_marker(): void
    {
        $comment = $this->tableComment();

        $this->assertStringContainsString('DEPRECATED T2-040', $comment);
        $this->assertStringContainsString('idempotency_keys', $comment);
    }

    public function test_deprecation_migration_is_idempotent(): void
    {
        $migration = $this->migration();

        $before = $this->tableComment();
        $migration->up();
        $migration->up();

        $this->assertSame($before, $this->tableComment());
    }

    public function test_down_restores_empty_comment_and_up_reapplies(): void
    {
        $migration = $this->migration();

        $migration->down();
        $this->assertSame('', $this->tableComment());

        $migration->up();
        $this->assertStringContainsString('DEPRECATED T2-040', $this->tableComment());
    }

    public function test_deprecation_does_not_modify_legacy_rows(): void
    {
        $this->migration()->down();

        DB::table('operation_idempotency_keys')->insert([
            [
                'key' => 'legacy-t2040-a',
                'user_id' => null,
                'operation' => 'invoice.create',
                'resource_type' => null,
                'resource_id' => null,
                'request_hash' => str_repeat('a', 64),
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'key' => 'legacy-t2040-b',
                'user_id' => null,
                'operation' => 'payment.register',
                'resource_type' => null,
                'resource_id' => null,
                'request_hash' => str_repeat('b', 64),
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);

        $rowsBefore = DB::table('operation_idempotency_keys')->orderBy('id')->get()->toJson();

        $this->migration()->up();

        $this->assertSame($rowsBefore, DB::table('operation_idempotency_keys')->orderBy('id')->get()->toJson());
        $this->assertStringContainsString('DEPRECATED T2-040', $this->tableComment());
        $this->assertSame(2, (int) DB::table('operation_idempotency_keys')->count());
        $this->assertDatabaseHas('operation_idempotency_keys', ['key' => 'legacy-t2040-a', 'operation' => 'invoice.create']);
        $this->assertDatabaseHas('operation_idempotency_keys', ['key' => 'legacy-t2040-b', 'operation' => 'payment.register']);
    }

    private function tableComment(): string
    {
        return (string) DB::table('information_schema.TABLES')
            ->where('TABLE_SCHEMA', DB::connection()->getDatabaseName())
            ->where('TABLE_NAME', 'operation_idempotency_keys')
            ->value('TABLE_COMMENT');
    }

    private function migration(): object
    {
        return include base_path('database/migrations/2026_09_13_220002_mark_operation_idempotency_keys_deprecated.php');
    }
}
