<?php

namespace Tests\Feature;

use App\Models\CashRegisterSession;
use App\Models\User;
use Closure;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * T2-014 (OLA 1, F017): constraints de dominio.
 * - singleton de fiscal_settings
 * - un assignment activo por scope en receipt_profile_assignments
 * - current_number <= max_number en institutional_receipt_series y fiscal_sequences
 * - metodos validos en payments y cash_movements
 * - invoices paid/partial exige cash_session_id
 *
 * Solo MariaDB/MySQL (SQLite no soporta ALTER TABLE ADD CONSTRAINT).
 */
class DomainConstraintsOla1Test extends TestCase
{
    use RefreshDatabase;

    protected static bool $resetSchemaAfterDdl = true;

    protected function setUp(): void
    {
        parent::setUp();

        if (! in_array(DB::connection()->getDriverName(), ['mysql', 'mariadb'], true)) {
            $this->markTestSkipped('Los CHECK de dominio OLA 1 solo aplican a MariaDB/MySQL; la suite SQLite rapida se conserva intacta.');
        }
    }

    public function test_fiscal_settings_singleton_blocks_second_row(): void
    {
        $this->insertFiscalSetting();

        $this->assertRejected('segunda fila con default', function (): void {
            $this->insertFiscalSetting(['hospital_name' => 'Otro Hospital']);
        });

        $this->assertRejected('bypass con singleton=2', function (): void {
            DB::table('fiscal_settings')->insert([
                'hospital_name' => 'Bypass',
                'rtn' => 'RTN-BYPASS',
                'default_tax_rate' => '15.00',
                'singleton' => 2,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        });

        $this->assertSame(1, (int) DB::table('fiscal_settings')->count());
        $this->assertTrue($this->constraintExists('fiscal_settings_singleton_valid'));
    }

    public function test_receipt_profile_assignment_unique_active_scope(): void
    {
        $profileId = $this->insertReceiptPrintProfile();

        $assignment = [
            'receipt_print_profile_id' => $profileId,
            'scope_type' => 'global',
            'scope_id' => null,
            'active' => 1,
            'created_at' => now(),
            'updated_at' => now(),
        ];

        DB::table('receipt_profile_assignments')->insert($assignment);

        $this->assertRejected('segundo assignment global activo', function () use ($assignment): void {
            DB::table('receipt_profile_assignments')->insert($assignment);
        });

        // Inactivos multiples siguen permitidos (historial) y otro scope activo tambien.
        DB::table('receipt_profile_assignments')->insert(array_merge($assignment, ['active' => 0]));
        DB::table('receipt_profile_assignments')->insert(array_merge($assignment, ['active' => 0]));
        DB::table('receipt_profile_assignments')->insert(array_merge($assignment, ['scope_type' => 'user', 'scope_id' => 7]));

        $this->assertSame(4, (int) DB::table('receipt_profile_assignments')->count());
        $this->assertTrue($this->indexExists('receipt_profile_assignments', 'uniq_receipt_profile_assignments_active_scope'));
    }

    public function test_institutional_receipt_series_current_cannot_exceed_max(): void
    {
        $seriesId = $this->insertReceiptSeries();

        $this->assertRejected('UPDATE current_number > max_number', function () use ($seriesId): void {
            DB::table('institutional_receipt_series')->where('id', $seriesId)->update(['current_number' => 1000]);
        });

        $this->assertRejected('INSERT current_number > max_number', function (): void {
            $this->insertReceiptSeries(['current_number' => 1000]);
        });

        DB::table('institutional_receipt_series')->where('id', $seriesId)->update(['current_number' => 99]);

        $this->assertSame(99, (int) DB::table('institutional_receipt_series')->where('id', $seriesId)->value('current_number'));
        $this->assertTrue($this->constraintExists('institutional_receipt_series_current_le_max'));
    }

    public function test_fiscal_sequences_range_check_is_present_and_enforced(): void
    {
        $sequenceId = $this->insertFiscalSequence();

        $this->assertTrue(
            $this->constraintExists('fiscal_sequences_range_valid'),
            'fiscal_sequences debe mantener el CHECK fiscal_sequences_range_valid de 2026_06_15_000004.'
        );

        $this->assertRejected('UPDATE current_number > max_number en fiscal_sequences', function () use ($sequenceId): void {
            DB::table('fiscal_sequences')->where('id', $sequenceId)->update(['current_number' => 100000000]);
        });
    }

    public function test_payment_method_check_rejects_unknown_values(): void
    {
        $invoiceId = $this->insertInvoice();
        $sessionId = $this->insertCashSession();
        $userId = (int) DB::table('cash_register_sessions')->where('id', $sessionId)->value('user_id');

        $this->assertRejected('payments.method desconocido', function () use ($invoiceId, $sessionId, $userId): void {
            DB::table('payments')->insert([
                'invoice_id' => $invoiceId,
                'cash_session_id' => $sessionId,
                'user_id' => $userId,
                'method' => 'sinpe',
                'amount' => '10.00',
                'amount_cents' => 1000,
                'status' => 'posted',
                'paid_at' => now(),
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        });

        DB::table('payments')->insert([
            'invoice_id' => $invoiceId,
            'cash_session_id' => $sessionId,
            'user_id' => $userId,
            'method' => 'card',
            'amount' => '10.00',
            'amount_cents' => 1000,
            'status' => 'posted',
            'paid_at' => now(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->assertTrue($this->constraintExists('payments_method_valid'));
    }

    public function test_cash_movement_method_check_allows_null_and_rejects_unknown(): void
    {
        $sessionId = $this->insertCashSession();
        $userId = (int) DB::table('cash_register_sessions')->where('id', $sessionId)->value('user_id');

        $base = [
            'cash_session_id' => $sessionId,
            'payment_id' => null,
            'user_id' => $userId,
            'type' => 'opening',
            'amount' => '0.00',
            'occurred_at' => now(),
            'created_at' => now(),
            'updated_at' => now(),
        ];

        DB::table('cash_movements')->insert(array_merge($base, ['method' => 'opening', 'type' => 'opening']));
        DB::table('cash_movements')->insert(array_merge($base, ['method' => null, 'type' => 'opening']));

        $this->assertRejected('cash_movements.method desconocido', function () use ($base): void {
            DB::table('cash_movements')->insert(array_merge($base, ['method' => 'refund']));
        });

        $this->assertSame(2, (int) DB::table('cash_movements')->count());
        $this->assertTrue($this->constraintExists('cash_movements_method_valid'));
    }

    public function test_paid_and_partial_invoices_require_cash_session(): void
    {
        $this->assertRejected('INSERT paid sin cash_session_id', function (): void {
            $this->insertInvoice(['status' => 'paid', 'paid_amount' => '115.00', 'paid_amount_cents' => 11500, 'balance_due' => '0.00', 'balance_due_cents' => 0]);
        });

        $this->assertRejected('INSERT partial sin cash_session_id', function (): void {
            $this->insertInvoice(['status' => 'partial']);
        });

        // issued/void sin caja siguen permitidos (historico/compatibilidad).
        $this->insertInvoice(['status' => 'issued']);
        $this->insertInvoice(['status' => 'void']);

        // paid con caja valida.
        $sessionId = $this->insertCashSession();
        $this->insertInvoice([
            'status' => 'paid',
            'cash_session_id' => $sessionId,
            'paid_amount' => '115.00',
            'paid_amount_cents' => 11500,
            'balance_due' => '0.00',
            'balance_due_cents' => 0,
        ]);

        $this->assertTrue($this->constraintExists('invoices_paid_requires_cash_session'));
    }

    public function test_migration_aborts_on_unknown_payment_method_without_rewriting(): void
    {
        $invoiceId = $this->insertInvoice();
        $sessionId = $this->insertCashSession();
        $userId = (int) DB::table('cash_register_sessions')->where('id', $sessionId)->value('user_id');

        DB::statement('ALTER TABLE payments DROP CONSTRAINT payments_method_valid');

        DB::table('payments')->insert([
            'invoice_id' => $invoiceId,
            'cash_session_id' => $sessionId,
            'user_id' => $userId,
            'method' => 'sinpe-legacy',
            'amount' => '10.00',
            'amount_cents' => 1000,
            'status' => 'posted',
            'paid_at' => now(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $migration = include base_path('database/migrations/2026_09_13_100005_add_payment_and_movement_method_check_constraints.php');

        try {
            $migration->up();
            $this->fail('La migracion debio abortar con un metodo fuera del dominio.');
        } catch (\RuntimeException $exception) {
            $this->assertStringContainsString('F017 fail-closed', $exception->getMessage());
            $this->assertStringContainsString('sinpe-legacy', $exception->getMessage());
        }

        // Fail-closed: el valor historico sigue intacto, no se reescribe.
        $this->assertSame(
            'sinpe-legacy',
            (string) DB::table('payments')->where('method', 'sinpe-legacy')->value('method')
        );

        DB::table('payments')->where('method', 'sinpe-legacy')->delete();
        $migration->up();

        $this->assertTrue($this->constraintExists('payments_method_valid'));
    }

    public function test_domain_migrations_down_and_up_roundtrip(): void
    {
        $this->insertFiscalSetting();
        $this->insertReceiptSeries();

        $migrations = [
            include base_path('database/migrations/2026_09_13_100002_enforce_fiscal_settings_singleton.php'),
            include base_path('database/migrations/2026_09_13_100003_enforce_active_receipt_profile_assignment_unique.php'),
            include base_path('database/migrations/2026_09_13_100004_add_sequence_range_check_constraints.php'),
            include base_path('database/migrations/2026_09_13_100005_add_payment_and_movement_method_check_constraints.php'),
            include base_path('database/migrations/2026_09_13_100006_add_paid_invoice_cash_session_check.php'),
        ];

        foreach ($migrations as $migration) {
            $migration->down();
        }

        $this->assertFalse($this->constraintExists('fiscal_settings_singleton_valid'));
        $this->assertFalse($this->indexExists('receipt_profile_assignments', 'uniq_receipt_profile_assignments_active_scope'));
        $this->assertFalse($this->constraintExists('institutional_receipt_series_current_le_max'));
        $this->assertFalse($this->constraintExists('payments_method_valid'));
        $this->assertFalse($this->constraintExists('invoices_paid_requires_cash_session'));
        // El CHECK de otra migracion no debe tocarse.
        $this->assertTrue($this->constraintExists('fiscal_sequences_range_valid'));

        foreach ($migrations as $migration) {
            $migration->up();
        }

        $this->assertTrue($this->constraintExists('fiscal_settings_singleton_valid'));
        $this->assertTrue($this->indexExists('receipt_profile_assignments', 'uniq_receipt_profile_assignments_active_scope'));
        $this->assertTrue($this->constraintExists('institutional_receipt_series_current_le_max'));
        $this->assertTrue($this->constraintExists('payments_method_valid'));
        $this->assertTrue($this->constraintExists('invoices_paid_requires_cash_session'));
    }

    private function assertRejected(string $label, Closure $callback): void
    {
        try {
            $callback();
            $this->fail("Se esperaba rechazo por constraint: {$label}");
        } catch (QueryException $exception) {
            $this->assertSame('23000', (string) $exception->getCode(), "{$label} :: ".$exception->getMessage());
        }
    }

    private function constraintExists(string $name): bool
    {
        return DB::table('information_schema.CHECK_CONSTRAINTS')
            ->where('CONSTRAINT_SCHEMA', DB::connection()->getDatabaseName())
            ->where('CONSTRAINT_NAME', $name)
            ->exists();
    }

    private function indexExists(string $table, string $name): bool
    {
        return DB::table('information_schema.STATISTICS')
            ->where('TABLE_SCHEMA', DB::connection()->getDatabaseName())
            ->where('TABLE_NAME', $table)
            ->where('INDEX_NAME', $name)
            ->exists();
    }

    private function makeUser(): User
    {
        return User::factory()->create();
    }

    /**
     * @param  array<string, mixed>  $overrides
     */
    private function insertFiscalSetting(array $overrides = []): int
    {
        return (int) DB::table('fiscal_settings')->insertGetId(array_merge([
            'hospital_name' => 'Hospital Sintetico T2014',
            'rtn' => 'RTN-T2014-'.uniqid(),
            'default_tax_rate' => '15.00',
            'receipt_width' => '80mm',
            'created_at' => now(),
            'updated_at' => now(),
        ], $overrides));
    }

    private function insertReceiptPrintProfile(): int
    {
        return (int) DB::table('receipt_print_profiles')->insertGetId([
            'code' => 't2014-'.uniqid(),
            'name' => 'Perfil Sintetico T2014',
            'paper_kind' => 'half_letter_landscape',
            'width_mm' => '215.90',
            'height_mm' => '139.70',
            'orientation' => 'landscape',
            'template_code' => 'institutional_classic',
            'font_scale' => '1.00',
            'copies_mode' => 'original_only',
            'active' => 1,
            'is_global_default' => 0,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    /**
     * @param  array<string, mixed>  $overrides
     */
    private function insertReceiptSeries(array $overrides = []): int
    {
        return (int) DB::table('institutional_receipt_series')->insertGetId(array_merge([
            'document_type' => 'institutional_receipt',
            'series' => 'T14-'.uniqid(),
            'prefix' => 'T',
            'number_format' => '{series}-{number:08}',
            'min_number' => 1,
            'max_number' => 99,
            'current_number' => 0,
            'receipt_number_color' => '#b91c1c',
            'active' => 0,
            'reprint_behavior' => 'audit_only',
            'void_behavior' => 'permission_reason_audit',
            'created_at' => now(),
            'updated_at' => now(),
        ], $overrides));
    }

    private function insertFiscalSequence(): int
    {
        return (int) DB::table('fiscal_sequences')->insertGetId([
            'document_type' => 'invoice',
            'prefix' => '000-001-01',
            'min_number' => 1,
            'max_number' => 99999999,
            'current_number' => 0,
            'cai' => 'TEST-T2014-'.uniqid(),
            'valid_until' => now()->addYear()->toDateString(),
            'active' => 0,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function insertCashSession(): int
    {
        $user = $this->makeUser();

        return (int) DB::table('cash_register_sessions')->insertGetId([
            'user_id' => $user->id,
            'open_user_id' => $user->id,
            'opening_amount' => '0.00',
            'status' => CashRegisterSession::STATUS_OPEN,
            'opened_at' => now(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    /**
     * @param  array<string, mixed>  $overrides
     */
    private function insertInvoice(array $overrides = []): int
    {
        $user = $this->makeUser();
        $sequence = $this->insertFiscalSequence();

        return (int) DB::table('invoices')->insertGetId(array_merge([
            'invoice_number' => 'T2014-'.uniqid(),
            'fiscal_sequence_id' => $sequence,
            'patient_name' => 'Paciente Sintetico',
            'subtotal' => '100.00',
            'subtotal_cents' => 10000,
            'tax_amount' => '15.00',
            'tax_amount_cents' => 1500,
            'discount_amount' => '0.00',
            'discount_amount_cents' => 0,
            'total' => '115.00',
            'total_cents' => 11500,
            'paid_amount' => '0.00',
            'paid_amount_cents' => 0,
            'balance_due' => '115.00',
            'balance_due_cents' => 11500,
            'status' => 'issued',
            'cash_session_id' => null,
            'issued_by' => $user->id,
            'issued_at' => now(),
            'created_at' => now(),
            'updated_at' => now(),
        ], $overrides));
    }
}
