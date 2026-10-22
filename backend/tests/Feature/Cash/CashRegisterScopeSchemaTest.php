<?php

namespace Tests\Feature\Cash;

use Database\Seeders\CashRegisterSeeder;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use RuntimeException;
use Tests\TestCase;

/**
 * M-W2-DB-01 (mandato §7 y §15): esquema de cajas simultaneas.
 *
 * Verifica, sobre una base migrada desde cero:
 * - dimension `cash_registers` y columnas nuevas en `cash_register_sessions`;
 * - guard real por caja: una sola sesion abierta por caja (indice unico
 *   `(cash_register_id, open_marker)` aprovechando los NULL multiples), varias
 *   cerradas y cajas distintas convivendo;
 * - se conserva `unique(open_user_id)` (un usuario no abre dos a la vez);
 * - backfill idempotente y por lotes hacia `principal`;
 * - seeder re-ejecutable sin sobrescribir configuracion.
 *
 * La suite rapida corre en SQLite (phpunit.xml). Los comportamientos de FK se
 * omiten alli porque SQLite no admite `ALTER TABLE ADD CONSTRAINT`; la cobertura
 * real de FK se ejecuta contra MariaDB en el arnes de evidencia M-W2-DB-01.
 */
class CashRegisterScopeSchemaTest extends TestCase
{
    use RefreshDatabase;

    private const UNIQUE_REGISTER_OPEN = 'cash_register_sessions_register_open_unique';

    public function test_cash_registers_table_and_new_session_columns_are_present(): void
    {
        $this->assertTrue(Schema::hasTable('cash_registers'));
        $this->assertTrue(Schema::hasColumns('cash_registers', [
            'id',
            'code',
            'name',
            'active',
            'created_at',
            'updated_at',
        ]));

        $this->assertTrue(Schema::hasColumns('cash_register_sessions', [
            'id',
            'user_id',
            'open_user_id',
            'cash_register_id',
            'open_marker',
            'opening_amount',
            'status',
            'opened_at',
            'closed_at',
            'created_at',
            'updated_at',
        ]));

        // Ninguna columna historica fue eliminada.
        $this->assertTrue(Schema::hasColumns('cash_register_sessions', [
            'closed_by_user_id',
            'closing_amount',
            'expected_amount',
            'difference_amount',
            'payments_count_snapshot',
            'payments_total_snapshot',
            'method_totals_snapshot',
            'pending_invoice_count_snapshot',
            'pending_amount_snapshot',
            'opening_notes',
            'closing_notes',
            'closing_breakdown',
        ]));
    }

    public function test_unique_scope_index_and_legacy_open_user_constraint_coexist(): void
    {
        $indexes = collect(Schema::getIndexes('cash_register_sessions'));

        $scope = $indexes->firstWhere('name', self::UNIQUE_REGISTER_OPEN);
        $this->assertNotNull($scope, 'Falta el indice unico por caja (cash_register_id, open_marker).');
        $this->assertTrue((bool) $scope['unique']);
        $this->assertSame(['cash_register_id', 'open_marker'], array_values($scope['columns']));

        $legacy = $indexes->firstWhere('name', 'cash_register_sessions_open_user_id_unique');
        $this->assertNotNull($legacy, 'Se perdio unique(open_user_id): un usuario podria abrir dos sesiones.');
        $this->assertTrue((bool) $legacy['unique']);
    }

    public function test_two_open_sessions_in_the_same_register_are_rejected(): void
    {
        $registerId = $this->registerId('principal');
        $first = $this->userId('cashier_a');
        $second = $this->userId('cashier_b');

        $this->insertSession($first, $registerId, 1, 'open', $first);

        $this->expectException(QueryException::class);

        try {
            $this->insertSession($second, $registerId, 1, 'open', $second);
        } finally {
            $this->assertSame(
                1,
                (int) DB::table('cash_register_sessions')->where('cash_register_id', $registerId)->where('open_marker', 1)->count()
            );
        }
    }

    public function test_open_sessions_in_distinct_registers_coexist(): void
    {
        $primary = $this->registerId('principal');
        $secondary = $this->registerId('ventanilla');
        $first = $this->userId('cashier_a');
        $second = $this->userId('cashier_b');

        $this->insertSession($first, $primary, 1, 'open', $first);
        $this->insertSession($second, $secondary, 1, 'open', $second);

        $this->assertSame(2, (int) DB::table('cash_register_sessions')->where('open_marker', 1)->count());
    }

    public function test_a_user_cannot_hold_two_open_sessions_even_in_distinct_registers(): void
    {
        $primary = $this->registerId('principal');
        $secondary = $this->registerId('ventanilla');
        $cashier = $this->userId('cashier_a');

        $this->insertSession($cashier, $primary, 1, 'open', $cashier);

        $this->expectException(QueryException::class);

        try {
            // Distinta caja => el indice por caja no lo detendria; quien debe
            // detenerlo es el unique(open_user_id) conservado.
            $this->insertSession($cashier, $secondary, 1, 'open', $cashier);
        } finally {
            $this->assertSame(1, (int) DB::table('cash_register_sessions')->where('open_user_id', $cashier)->count());
        }
    }

    public function test_many_closed_sessions_per_register_are_allowed(): void
    {
        $registerId = $this->registerId('principal');

        foreach (['cashier_a', 'cashier_b', 'cashier_c'] as $name) {
            $this->insertSession($this->userId($name), $registerId, null, 'closed', null, now());
        }

        $this->assertSame(
            3,
            (int) DB::table('cash_register_sessions')
                ->where('cash_register_id', $registerId)
                ->whereNull('open_marker')
                ->count()
        );
    }

    public function test_backfill_assigns_legacy_sessions_to_principal_and_marks_open(): void
    {
        $principalId = $this->principalRegisterId();

        $openId = $this->insertSession($this->userId('legacy_open'), null, null, 'open', null);
        $closedId = $this->insertSession($this->userId('legacy_closed'), null, null, 'closed', null, now());

        $this->runScopeMigrations();

        $open = (array) DB::table('cash_register_sessions')->where('id', $openId)->first();
        $closed = (array) DB::table('cash_register_sessions')->where('id', $closedId)->first();

        $this->assertSame($principalId, (int) $open['cash_register_id']);
        $this->assertSame(1, (int) $open['open_marker']);
        $this->assertSame($principalId, (int) $closed['cash_register_id']);
        $this->assertNull($closed['open_marker']);
    }

    public function test_backfill_is_idempotent_and_does_not_touch_other_registers(): void
    {
        $principalId = $this->principalRegisterId();
        $otherId = $this->registerId('ventanilla');

        $legacyId = $this->insertSession($this->userId('legacy'), null, null, 'closed', null, now());
        $otherUserId = $this->userId('other');
        $otherSessionId = $this->insertSession($otherUserId, $otherId, null, 'closed', null, now());

        $this->runScopeMigrations();
        $this->runScopeMigrations();

        $this->assertSame(1, (int) DB::table('cash_registers')->where('code', 'principal')->count());
        $this->assertSame($principalId, (int) DB::table('cash_register_sessions')->where('id', $legacyId)->value('cash_register_id'));
        $this->assertSame($otherId, (int) DB::table('cash_register_sessions')->where('id', $otherSessionId)->value('cash_register_id'));
        $this->assertSame(2, (int) DB::table('cash_register_sessions')->count());
    }

    public function test_backfill_fails_closed_when_two_open_sessions_share_a_register(): void
    {
        $principalId = $this->principalRegisterId();

        $this->insertSession($this->userId('dupe_a'), $principalId, null, 'open', null);
        $this->insertSession($this->userId('dupe_b'), $principalId, null, 'open', null);

        $migration = include base_path('database/migrations/2026_09_17_000003_add_open_marker_to_cash_register_sessions_table.php');

        try {
            $migration->up();
            $this->fail('La migracion debio abortar fail-closed ante dos sesiones abiertas en la misma caja.');
        } catch (RuntimeException $exception) {
            $this->assertStringContainsString('fail-closed', $exception->getMessage());
        }

        // No se eligio arbitrariamente una ganadora: los marcadores siguen sin tocar.
        $this->assertSame(
            2,
            (int) DB::table('cash_register_sessions')
                ->where('cash_register_id', $principalId)
                ->whereNull('open_marker')
                ->count()
        );
    }

    public function test_seeder_is_idempotent_and_does_not_overwrite_existing_configuration(): void
    {
        $this->seed(CashRegisterSeeder::class);
        $this->seed(CashRegisterSeeder::class);

        $this->assertSame(1, (int) DB::table('cash_registers')->where('code', 'principal')->count());

        DB::table('cash_registers')->where('code', 'principal')->update([
            'name' => 'Caja renombrada por administracion',
            'active' => false,
        ]);

        $this->seed(CashRegisterSeeder::class);

        $row = (array) DB::table('cash_registers')->where('code', 'principal')->first();
        $this->assertSame('Caja renombrada por administracion', $row['name']);
        $this->assertSame(0, (int) $row['active']);
    }

    public function test_register_delete_is_restricted_when_sessions_reference_it(): void
    {
        $this->requireMariaDb();

        $registerId = $this->registerId('principal');
        $this->insertSession($this->userId('cashier_a'), $registerId, null, 'closed', null, now());

        $this->expectException(QueryException::class);

        DB::table('cash_registers')->where('id', $registerId)->delete();
    }

    private function requireMariaDb(): void
    {
        if (! in_array(DB::connection()->getDriverName(), ['mysql', 'mariadb'], true)) {
            $this->markTestSkipped('FK restrictOnDelete: SQLite no admite ADD CONSTRAINT en ALTER TABLE (documentado en la migracion); la cobertura real corre en MariaDB.');
        }
    }

    private function runScopeMigrations(): void
    {
        foreach ([
            '2026_09_17_000002_add_cash_register_id_to_cash_register_sessions_table.php',
            '2026_09_17_000003_add_open_marker_to_cash_register_sessions_table.php',
        ] as $file) {
            $migration = include base_path('database/migrations/'.$file);
            $migration->up();
        }
    }

    private function principalRegisterId(): int
    {
        $id = DB::table('cash_registers')->where('code', 'principal')->value('id');

        if ($id === null) {
            $this->fail('La migracion no garantizo la caja principal.');
        }

        return (int) $id;
    }

    private function registerId(string $code): int
    {
        $existing = DB::table('cash_registers')->where('code', $code)->value('id');

        if ($existing !== null) {
            return (int) $existing;
        }

        return (int) DB::table('cash_registers')->insertGetId([
            'code' => $code,
            'name' => 'Caja '.$code,
            'active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function userId(string $username): int
    {
        return (int) DB::table('users')->insertGetId([
            'name' => $username,
            'email' => $username.'@example.test',
            'username' => $username,
            'password' => bcrypt('testing-only'),
            'active' => true,
            'must_change_password' => false,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function insertSession(
        int $userId,
        ?int $registerId,
        ?int $openMarker,
        string $status,
        ?int $openUserId,
        mixed $closedAt = null,
    ): int {
        return (int) DB::table('cash_register_sessions')->insertGetId([
            'user_id' => $userId,
            'open_user_id' => $openUserId,
            'cash_register_id' => $registerId,
            'open_marker' => $openMarker,
            'opening_amount' => '0.00',
            'status' => $status,
            'opened_at' => now(),
            'closed_at' => $closedAt,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }
}
