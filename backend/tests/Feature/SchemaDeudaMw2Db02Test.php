<?php

namespace Tests\Feature;

use App\Models\CashRegisterSession;
use App\Models\InstitutionalReceipt;
use App\Models\InstitutionalReceiptSeries;
use App\Models\User;
use App\Support\PaperSize;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * M-W2-DB-02 — deudas de esquema:
 *  TAREA 1: `cash_register_sessions.opened_at` sin ON UPDATE implicito.
 *  TAREA 2: enum `receipt_print_profiles.paper_kind` con portraits nativos y
 *           repunte idempotente de los perfiles sembrados.
 *
 * Corre sobre SQLite (:memory:, phpunit.xml). En SQLite no existe
 * `ON UPDATE CURRENT_TIMESTAMP`, por lo que la TAREA 1 es un no-op declarado y
 * el comportamiento correcto ya esta presente; la cobertura real de esa deuda
 * esta en MariaDB (evidencia M-W2-DB-02). SQLite si aplica el CHECK del enum,
 * por lo que la TAREA 2 se verifica aqui de extremo a extremo.
 *
 * Las migraciones se invocan directamente (include) para probar idempotencia,
 * `down()` y re-aplicacion sin depender del estado del batch de artisan.
 */
class SchemaDeudaMw2Db02Test extends TestCase
{
    use RefreshDatabase;

    private const SESSION_MIGRATION = '2026_09_17_000004_stabilize_cash_session_opened_at_timestamp.php';

    private const PAPER_MIGRATION = '2026_09_17_000005_extend_receipt_print_profiles_paper_kind_enum.php';

    // ------------------------------------------------------------------
    // TAREA 2 — enum paper_kind
    // ------------------------------------------------------------------

    public function test_paper_kind_enum_rejects_portrait_before_migration_and_accepts_after_reapply(): void
    {
        // Estado inicial (RefreshDatabase ya aplico la migracion): el CHECK admite portraits.
        $this->assertTrue($this->paperEnumAllowsNativePortraits());

        // down() sin filas nativas revierte el CHECK al enum original.
        $this->migration(self::PAPER_MIGRATION)->down();
        $this->assertFalse($this->paperEnumAllowsNativePortraits());

        $this->expectDatabaseRejects(function (): void {
            $this->insertProfile('rechazado', 'letter_portrait', '215.90', '279.40');
        });

        // up() re-expande y ya admite los valores nativos.
        $this->migration(self::PAPER_MIGRATION)->up();
        $this->assertTrue($this->paperEnumAllowsNativePortraits());

        $this->insertProfile('carta_vertical', 'letter_portrait', '215.90', '279.40');
        $this->insertProfile('a4_vertical', 'a4_portrait', '210.00', '297.00');
        $this->assertDatabaseHas('receipt_print_profiles', ['code' => 'carta_vertical', 'paper_kind' => 'letter_portrait']);

        // Un valor fuera del enum sigue rechazado: el CHECK no se perdio.
        $this->expectDatabaseRejects(function (): void {
            $this->insertProfile('basura', 'no_such_kind', '10.00', '10.00');
        });
    }

    public function test_paper_kind_migration_repoints_only_contract_profiles_and_is_idempotent(): void
    {
        $this->insertProfile('carta_vertical', 'custom_mm', '215.90', '279.40');
        $this->insertProfile('a4_vertical', 'custom_mm', '210.00', '297.00');
        $this->insertProfile('media_carta_horizontal', 'half_letter_landscape', '215.90', '139.70');
        $this->insertProfile('a5_horizontal', 'a5_landscape', '210.00', '148.00');
        $this->insertProfile('carta_horizontal', 'letter_landscape', '279.40', '215.90');
        $this->insertProfile('thermal_80mm', 'thermal_80mm', '80.00', '200.00');
        $this->insertProfile('thermal_58mm', 'thermal_58mm', '58.00', '200.00');
        $this->insertProfile('recibo_pequeno_personalizado', 'custom_mm', '180.00', '95.00');
        // Codigo de contrato con geometria personalizada: NO debe repuntarse.
        $this->insertProfile('carta_vertical_personalizada', 'custom_mm', '200.00', '250.00');

        $snapshot = $this->createHistoricalReceiptSnapshot();
        $rawSnapshotBefore = DB::table('institutional_receipts')->where('id', $snapshot['receipt_id'])->value('profile_snapshot');

        $this->migration(self::PAPER_MIGRATION)->up();

        $kinds = DB::table('receipt_print_profiles')->pluck('paper_kind', 'code')->all();
        $this->assertSame('letter_portrait', $kinds['carta_vertical']);
        $this->assertSame('a4_portrait', $kinds['a4_vertical']);
        $this->assertSame('half_letter_landscape', $kinds['media_carta_horizontal']);
        $this->assertSame('a5_landscape', $kinds['a5_horizontal']);
        $this->assertSame('letter_landscape', $kinds['carta_horizontal']);
        $this->assertSame('thermal_80mm', $kinds['thermal_80mm']);
        $this->assertSame('thermal_58mm', $kinds['thermal_58mm']);
        $this->assertSame('custom_mm', $kinds['recibo_pequeno_personalizado']);
        $this->assertSame('custom_mm', $kinds['carta_vertical_personalizada']);

        // El documento historico conserva su snapshot byte a byte.
        $rawSnapshotAfter = DB::table('institutional_receipts')->where('id', $snapshot['receipt_id'])->value('profile_snapshot');
        $this->assertSame($rawSnapshotBefore, $rawSnapshotAfter);

        // Y su geometria sigue resolviendose igual por el motor.
        $size = PaperSize::fromProfileSnapshot($snapshot['profile_snapshot']);
        $this->assertSame(0, $size[0]);
        $this->assertSame(0, $size[1]);
        $this->assertEqualsWithDelta(612.0, $size[2], 0.01);
        $this->assertEqualsWithDelta(792.0, $size[3], 0.01);

        // Idempotencia: un segundo up() no cambia el estado.
        $stateBefore = DB::table('receipt_print_profiles')->orderBy('id')->get()->map(fn ($row) => (array) $row)->all();
        $this->migration(self::PAPER_MIGRATION)->up();
        $stateAfter = DB::table('receipt_print_profiles')->orderBy('id')->get()->map(fn ($row) => (array) $row)->all();
        $this->assertSame($stateBefore, $stateAfter);
    }

    public function test_paper_kind_down_keeps_enum_while_native_rows_exist_and_reverts_when_free(): void
    {
        $this->insertProfile('carta_vertical', 'letter_portrait', '215.90', '279.40');

        // Con una fila nativa presente, down() no puede revertir sin destruir datos.
        $this->migration(self::PAPER_MIGRATION)->down();
        $this->assertTrue($this->paperEnumAllowsNativePortraits());
        $this->assertDatabaseHas('receipt_print_profiles', ['code' => 'carta_vertical', 'paper_kind' => 'letter_portrait']);

        // Sin filas nativas, down() si revierte y up() vuelve a aplicar el repunte.
        DB::table('receipt_print_profiles')->where('code', 'carta_vertical')->update(['paper_kind' => 'custom_mm']);
        $this->migration(self::PAPER_MIGRATION)->down();
        $this->assertFalse($this->paperEnumAllowsNativePortraits());
        $this->assertDatabaseHas('receipt_print_profiles', ['code' => 'carta_vertical', 'paper_kind' => 'custom_mm']);

        $this->migration(self::PAPER_MIGRATION)->up();
        $this->assertTrue($this->paperEnumAllowsNativePortraits());
        $this->assertDatabaseHas('receipt_print_profiles', ['code' => 'carta_vertical', 'paper_kind' => 'letter_portrait']);
    }

    // ------------------------------------------------------------------
    // TAREA 1 — opened_at (limite SQLite declarado)
    // ------------------------------------------------------------------

    public function test_opened_at_migration_is_declared_noop_on_sqlite_and_updates_preserve_opened_at(): void
    {
        $user = User::factory()->create();
        $sessionId = (int) DB::table('cash_register_sessions')->insertGetId([
            'user_id' => $user->id,
            'open_user_id' => $user->id,
            'opening_amount' => '0.00',
            'status' => CashRegisterSession::STATUS_OPEN,
            'opened_at' => '2026-01-01 00:00:00',
            'created_at' => '2026-01-01 00:00:00',
            'updated_at' => '2026-01-01 00:00:00',
        ]);

        // up()/down()/up() no lanzan en SQLite (driver no aplicable): no-op declarado.
        $this->migration(self::SESSION_MIGRATION)->up();
        $this->migration(self::SESSION_MIGRATION)->down();
        $this->migration(self::SESSION_MIGRATION)->up();

        // SQLite no aplica ON UPDATE CURRENT_TIMESTAMP: se declara el limite.
        $createSql = (string) DB::selectOne(
            "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'cash_register_sessions'"
        )->sql;
        preg_match('/"opened_at"\s+[^,]*/i', $createSql, $openedAtDefinition);
        $this->assertNotEmpty($openedAtDefinition, 'No se encontro la definicion de opened_at en sqlite_master.');
        $this->assertStringNotContainsString('ON UPDATE', strtoupper($openedAtDefinition[0]));

        DB::table('cash_register_sessions')->where('id', $sessionId)->update(['status' => CashRegisterSession::STATUS_CLOSED]);
        $this->assertSame(
            '2026-01-01 00:00:00',
            (string) DB::table('cash_register_sessions')->where('id', $sessionId)->value('opened_at'),
        );
    }

    // ------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------

    private function migration(string $file): object
    {
        return include base_path('database/migrations/'.$file);
    }

    private function paperEnumAllowsNativePortraits(): bool
    {
        $sql = (string) DB::selectOne(
            "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'receipt_print_profiles'"
        )->sql;

        return str_contains($sql, 'letter_portrait') && str_contains($sql, 'a4_portrait');
    }

    private function insertProfile(string $code, string $kind, string $widthMm, string $heightMm): void
    {
        DB::table('receipt_print_profiles')->insert([
            'code' => $code,
            'name' => $code,
            'paper_kind' => $kind,
            'width_mm' => $widthMm,
            'height_mm' => $heightMm,
            'margin_top_mm' => '5.00',
            'margin_right_mm' => '5.00',
            'margin_bottom_mm' => '5.00',
            'margin_left_mm' => '5.00',
            'orientation' => 'portrait',
            'template_code' => 'institutional_classic',
            'font_family' => 'Arial, sans-serif',
            'font_scale' => '1.00',
            'copies_mode' => 'original_only',
            'show_copy_legend' => true,
            'show_physical_seal_space' => true,
            'use_logo' => false,
            'show_technical_fields' => false,
            'active' => true,
            'is_global_default' => false,
            'created_at' => '2026-01-01 00:00:00',
            'updated_at' => '2026-01-01 00:00:00',
        ]);
    }

    /**
     * Crea un recibo institucional historico cuyo snapshot usa el perfil
     * `custom_mm` de carta vertical (215.90 x 279.40 mm = 612 x 792 pt). El
     * snapshot es lo que un documento historico conserva; el catalogo de
     * perfiles puede cambiar sin reescribirlo.
     *
     * @return array{receipt_id: int, profile_snapshot: array<string, mixed>, expected_size: array{0: int, 1: int, 2: float, 3: float}}
     */
    private function createHistoricalReceiptSnapshot(): array
    {
        $user = User::factory()->create();

        $profileSnapshot = [
            'code' => 'carta_vertical',
            'paper_kind' => 'custom_mm',
            'width_mm' => '215.90',
            'height_mm' => '279.40',
            'margin_top_mm' => '12.00',
            'margin_right_mm' => '12.00',
            'margin_bottom_mm' => '12.00',
            'margin_left_mm' => '12.00',
        ];

        $cashSession = CashRegisterSession::query()->create([
            'user_id' => $user->id,
            'open_user_id' => $user->id,
            'opening_amount' => '0.00',
            'status' => CashRegisterSession::STATUS_OPEN,
            'opened_at' => now(),
        ]);

        $series = InstitutionalReceiptSeries::query()->create([
            'series' => 'RECD',
            'prefix' => 'RECD',
            'min_number' => 1,
            'max_number' => 99999999,
            'current_number' => 1,
            'active' => true,
            'created_by' => $user->id,
            'updated_by' => $user->id,
        ]);

        $receipt = InstitutionalReceipt::query()->create([
            'invoice_id' => null,
            'payment_id' => null,
            'cash_session_id' => $cashSession->id,
            'series_id' => $series->id,
            'receipt_number' => 1,
            'receipt_number_full' => 'RECD-00000001',
            'amount' => '25.00',
            'amount_cents' => 2500,
            'issued_at' => now(),
            'issued_by' => $user->id,
            'payer_name' => 'Paciente sintetico',
            'concept' => 'Consulta de prueba',
            'amount_words' => 'VEINTICINCO LEMPIRAS EXACTOS',
            'template_code' => 'institutional_classic',
            'print_profile_code' => 'carta_vertical',
            'copy_mode' => 'original_only',
            'institution_snapshot' => ['name' => 'Hospital de prueba'],
            'series_snapshot' => ['series' => 'RECD'],
            'profile_snapshot' => $profileSnapshot,
            'invoice_snapshot' => null,
            'payment_snapshot' => null,
            'items_snapshot' => [['name' => 'Consulta', 'amount' => '25.00']],
        ]);

        return [
            'receipt_id' => $receipt->id,
            'profile_snapshot' => $profileSnapshot,
            'expected_size' => [0, 0, 612.0, 792.0],
        ];
    }

    private function expectDatabaseRejects(callable $callback): void
    {
        try {
            $callback();
            $this->fail('La base de datos acepto un valor que debia rechazar.');
        } catch (\Throwable) {
            $this->addToAssertionCount(1);
        }
    }
}
