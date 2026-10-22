<?php

namespace Tests\Feature;

use App\Models\CashRegisterSession;
use App\Models\FiscalSequence;
use App\Models\User;
use Closure;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * T2-014 (OLA 1, F013): los CHECK de coherencia monetaria
 * ROUND(decimal * 100, 0) = cents deben rechazar SQL directo incoherente,
 * aceptar filas coherentes y no reparar historicos.
 *
 * Solo MariaDB/MySQL: SQLite no soporta ALTER TABLE ADD CONSTRAINT y la suite
 * rapida se mantiene intacta (skip explicito).
 */
class MonetaryCoherenceConstraintsTest extends TestCase
{
    use RefreshDatabase;

    protected static bool $resetSchemaAfterDdl = true;

    protected function setUp(): void
    {
        parent::setUp();

        if (! in_array(DB::connection()->getDriverName(), ['mysql', 'mariadb'], true)) {
            $this->markTestSkipped('Los CHECK de coherencia monetaria solo aplican a MariaDB/MySQL; la suite SQLite rapida se conserva intacta.');
        }
    }

    public function test_all_money_pairs_have_coherence_constraints_installed(): void
    {
        $expected = [
            'invoices' => [
                'subtotal_cents',
                'tax_amount_cents',
                'discount_amount_cents',
                'total_cents',
                'paid_amount_cents',
                'balance_due_cents',
            ],
            'invoice_items' => [
                'quantity_cents',
                'unit_price_cents',
                'tax_amount_cents',
                'line_subtotal_cents',
                'line_total_cents',
            ],
            'payments' => ['amount_cents'],
            'institutional_receipts' => ['amount_cents'],
        ];

        foreach ($expected as $table => $columns) {
            foreach ($columns as $centsColumn) {
                $name = "{$table}_{$centsColumn}_coherence";
                $this->assertTrue(
                    $this->constraintExists($name),
                    "Falta el CHECK {$name} en {$table}."
                );
            }
        }
    }

    public function test_accepts_coherent_rows_and_rejects_incoherent_invoice_update(): void
    {
        $invoiceId = $this->insertInvoice();

        $before = (array) DB::table('invoices')->where('id', $invoiceId)->first();

        $this->assertRejected('UPDATE invoices.total_cents sin tocar total', function () use ($invoiceId): void {
            DB::table('invoices')->where('id', $invoiceId)->update(['total_cents' => 11501]);
        });

        $after = (array) DB::table('invoices')->where('id', $invoiceId)->first();

        $this->assertSame($before['total'], $after['total'], 'El UPDATE rechazado no debe tocar la columna decimal.');
        $this->assertSame($before['total_cents'], $after['total_cents'], 'El UPDATE rechazado no debe tocar los cents.');
    }

    public function test_rejects_incoherent_invoice_insert(): void
    {
        $this->assertRejected('INSERT invoices con cents descuadrados', function (): void {
            $this->insertInvoice(['total' => '10.00', 'total_cents' => 1001]);
        });
    }

    public function test_rejects_incoherent_invoice_item_insert_and_update(): void
    {
        $invoiceId = $this->insertInvoice();

        $this->assertRejected('INSERT invoice_items descuadrado', function () use ($invoiceId): void {
            $this->insertInvoiceItem($invoiceId, ['line_total' => '10.00', 'line_total_cents' => 1001]);
        });

        $itemId = $this->insertInvoiceItem($invoiceId);

        $this->assertRejected('UPDATE invoice_items.line_total_cents sin tocar line_total', function () use ($itemId): void {
            DB::table('invoice_items')->where('id', $itemId)->update(['line_total_cents' => 99999]);
        });
    }

    public function test_rejects_incoherent_payment_insert_and_update(): void
    {
        $invoiceId = $this->insertInvoice();
        $sessionId = $this->insertCashSession();
        $userId = (int) DB::table('cash_register_sessions')->where('id', $sessionId)->value('user_id');

        $this->assertRejected('INSERT payments descuadrado', function () use ($invoiceId, $sessionId, $userId): void {
            $this->insertPayment($invoiceId, $sessionId, $userId, ['amount' => '10.00', 'amount_cents' => 1001]);
        });

        $paymentId = $this->insertPayment($invoiceId, $sessionId, $userId);

        $this->assertRejected('UPDATE payments.amount_cents sin tocar amount', function () use ($paymentId): void {
            DB::table('payments')->where('id', $paymentId)->update(['amount_cents' => 99999]);
        });
    }

    public function test_rejects_incoherent_institutional_receipt_and_accepts_coherent(): void
    {
        $sessionId = $this->insertCashSession();
        $userId = (int) DB::table('cash_register_sessions')->where('id', $sessionId)->value('user_id');
        $seriesId = $this->insertReceiptSeries();

        $this->assertRejected('INSERT institutional_receipts descuadrado', function () use ($sessionId, $userId, $seriesId): void {
            $this->insertInstitutionalReceipt($sessionId, $userId, $seriesId, ['amount' => '10.00', 'amount_cents' => 1001]);
        });

        $receiptId = $this->insertInstitutionalReceipt($sessionId, $userId, $seriesId);
        $this->assertGreaterThan(0, $receiptId);

        $this->assertRejected('UPDATE institutional_receipts.amount_cents sin tocar amount', function () use ($receiptId): void {
            DB::table('institutional_receipts')->where('id', $receiptId)->update(['amount_cents' => 99999]);
        });
    }

    public function test_migration_aborts_on_incoherent_history_without_repairing(): void
    {
        $invoiceId = $this->insertInvoice();

        DB::statement('ALTER TABLE invoices DROP CONSTRAINT invoices_total_cents_coherence');

        // Historico incoherente simulado: antes del CHECK esto era posible.
        DB::table('invoices')->where('id', $invoiceId)->update(['total_cents' => 11501]);

        $migration = include base_path('database/migrations/2026_09_13_100001_add_monetary_coherence_check_constraints.php');

        try {
            $migration->up();
            $this->fail('La migracion debio abortar con historico incoherente.');
        } catch (\RuntimeException $exception) {
            $this->assertStringContainsString('F013 fail-closed', $exception->getMessage());
            $this->assertStringContainsString('invoices', $exception->getMessage());
        }

        // Fail-closed: no se repara ni normaliza el valor.
        $this->assertSame(11501, (int) DB::table('invoices')->where('id', $invoiceId)->value('total_cents'));

        // Restaurar coherencia y re-aplicar para dejar el esquema completo.
        DB::table('invoices')->where('id', $invoiceId)->update(['total_cents' => 11500]);
        $migration->up();

        $this->assertTrue($this->constraintExists('invoices_total_cents_coherence'));
    }

    public function test_migration_up_is_idempotent_when_partially_applied(): void
    {
        $migration = include base_path('database/migrations/2026_09_13_100001_add_monetary_coherence_check_constraints.php');

        $migration->up();
        $migration->up();

        $this->assertTrue($this->constraintExists('invoices_total_cents_coherence'));
        $this->assertTrue($this->constraintExists('payments_amount_cents_coherence'));
    }

    public function test_migration_down_removes_only_its_checks_and_up_restores_them(): void
    {
        $migration = include base_path('database/migrations/2026_09_13_100001_add_monetary_coherence_check_constraints.php');

        $migration->down();

        $this->assertFalse($this->constraintExists('invoices_total_cents_coherence'));
        $this->assertFalse($this->constraintExists('payments_amount_cents_coherence'));
        $this->assertFalse($this->constraintExists('institutional_receipts_amount_cents_coherence'));

        $migration->up();

        $this->assertTrue($this->constraintExists('invoices_total_cents_coherence'));
        $this->assertTrue($this->constraintExists('payments_amount_cents_coherence'));
        $this->assertTrue($this->constraintExists('institutional_receipts_amount_cents_coherence'));
    }

    private function assertRejected(string $label, Closure $callback): void
    {
        try {
            $callback();
            $this->fail("Se esperaba rechazo por CHECK: {$label}");
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

    private function makeUser(): User
    {
        return User::factory()->create();
    }

    private function makeFiscalSequence(): FiscalSequence
    {
        return FiscalSequence::query()->create([
            'document_type' => 'invoice',
            'prefix' => '000-001-01',
            'min_number' => 1,
            'max_number' => 99999999,
            'current_number' => 0,
            'cai' => 'TEST-T2014-'.uniqid(),
            'valid_until' => now()->addYear()->toDateString(),
            'active' => false,
        ]);
    }

    /**
     * @param  array<string, mixed>  $overrides
     */
    private function insertInvoice(array $overrides = []): int
    {
        $user = $this->makeUser();
        $sequence = $this->makeFiscalSequence();

        return (int) DB::table('invoices')->insertGetId(array_merge([
            'invoice_number' => 'T2014-'.uniqid(),
            'fiscal_sequence_id' => $sequence->id,
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
            'issued_by' => $user->id,
            'issued_at' => now(),
            'created_at' => now(),
            'updated_at' => now(),
        ], $overrides));
    }

    /**
     * @param  array<string, mixed>  $overrides
     */
    private function insertInvoiceItem(int $invoiceId, array $overrides = []): int
    {
        return (int) DB::table('invoice_items')->insertGetId(array_merge([
            'invoice_id' => $invoiceId,
            'service_id' => null,
            'service_name' => 'Servicio Sintetico',
            'category_id' => null,
            'category_name' => 'Categoria Sintetica',
            'quantity' => '1.00',
            'quantity_cents' => 100,
            'unit_price' => '100.00',
            'unit_price_cents' => 10000,
            'tax_rate' => '15.00',
            'tax_amount' => '15.00',
            'tax_amount_cents' => 1500,
            'line_subtotal' => '100.00',
            'line_subtotal_cents' => 10000,
            'line_total' => '115.00',
            'line_total_cents' => 11500,
            'created_at' => now(),
            'updated_at' => now(),
        ], $overrides));
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
    private function insertPayment(int $invoiceId, int $sessionId, int $userId, array $overrides = []): int
    {
        return (int) DB::table('payments')->insertGetId(array_merge([
            'invoice_id' => $invoiceId,
            'cash_session_id' => $sessionId,
            'user_id' => $userId,
            'method' => 'cash',
            'amount' => '10.00',
            'amount_cents' => 1000,
            'reference' => null,
            'status' => 'posted',
            'paid_at' => now(),
            'created_at' => now(),
            'updated_at' => now(),
        ], $overrides));
    }

    private function insertReceiptSeries(): int
    {
        return (int) DB::table('institutional_receipt_series')->insertGetId([
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
        ]);
    }

    /**
     * @param  array<string, mixed>  $overrides
     */
    private function insertInstitutionalReceipt(int $sessionId, int $userId, int $seriesId, array $overrides = []): int
    {
        return (int) DB::table('institutional_receipts')->insertGetId(array_merge([
            'invoice_id' => null,
            'payment_id' => null,
            'cash_session_id' => $sessionId,
            'series_id' => $seriesId,
            'receipt_number' => random_int(1, 99),
            'receipt_number_full' => 'T14-'.uniqid(),
            'status' => 'issued',
            'amount' => '10.00',
            'amount_cents' => 1000,
            'issued_at' => now(),
            'issued_by' => $userId,
            'payer_name' => 'Paciente Sintetico',
            'concept' => 'Servicios sinteticos',
            'amount_words' => 'DIEZ LEMPIRAS',
            'template_code' => 'institutional_classic',
            'print_profile_code' => 'half-letter-default',
            'copy_mode' => 'original_only',
            'institution_snapshot' => json_encode(['name' => 'Hospital Sintetico']),
            'series_snapshot' => json_encode(['series' => 'T14']),
            'profile_snapshot' => json_encode(['code' => 'half-letter-default']),
            'invoice_snapshot' => null,
            'payment_snapshot' => null,
            'items_snapshot' => json_encode([]),
            'created_at' => now(),
            'updated_at' => now(),
        ], $overrides));
    }
}
