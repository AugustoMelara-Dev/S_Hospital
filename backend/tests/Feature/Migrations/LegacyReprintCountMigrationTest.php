<?php

declare(strict_types=1);

namespace Tests\Feature\Migrations;

use App\Models\FiscalSequence;
use App\Models\Invoice;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

/**
 * T3-004 / F012: contador durable de reimpresion legacy
 * (`invoices.legacy_reprint_count`).
 *
 * Verifica el contrato de la migracion aditiva e idempotente:
 *   - la columna existe con default 0 y no toca filas existentes;
 *   - up() repetido es un no-op;
 *   - down() elimina SOLO esa columna (rollback real) conservando filas y
 *     demas columnas, y es idempotente;
 *   - un up() posterior tras el rollback recrea la columna con default 0.
 *
 * Corre en SQLite (suite rapida) y MariaDB real. Nota de aislamiento: el DDL
 * de down()/up() provoca commit implicito en MySQL/MariaDB, por lo que el test
 * de rollback limpia sus filas sinteticas en un finally (el rollback de
 * RefreshDatabase ya no puede hacerlo). La secuencia sintetica se crea
 * inactiva para no chocar con la unicidad de secuencia activa de otras
 * clases en la base desechable compartida.
 */
class LegacyReprintCountMigrationTest extends TestCase
{
    use RefreshDatabase;

    private const COLUMN = 'legacy_reprint_count';

    public function test_up_is_idempotent_and_preserves_existing_counter_values(): void
    {
        $this->assertTrue(Schema::hasColumn('invoices', self::COLUMN));

        $fixture = $this->createSyntheticInvoice();
        DB::table('invoices')->where('id', $fixture['invoice_id'])->update([self::COLUMN => 2]);

        $migration = $this->migration();
        $migration->up();
        $migration->up();

        $this->assertTrue(Schema::hasColumn('invoices', self::COLUMN));
        $this->assertSame(1, (int) DB::table('invoices')->where('id', $fixture['invoice_id'])->count());
        $this->assertSame(2, (int) DB::table('invoices')->where('id', $fixture['invoice_id'])->value(self::COLUMN));
        $this->assertSame('17.25', (string) DB::table('invoices')->where('id', $fixture['invoice_id'])->value('total'));
    }

    public function test_default_counter_is_zero_for_new_rows(): void
    {
        $fixture = $this->createSyntheticInvoice();

        $this->assertSame(0, (int) DB::table('invoices')->where('id', $fixture['invoice_id'])->value(self::COLUMN));
        $this->assertSame(0, (int) Invoice::query()->findOrFail($fixture['invoice_id'])->legacy_reprint_count);
    }

    public function test_down_removes_only_the_counter_column_and_up_restores_it(): void
    {
        $fixture = $this->createSyntheticInvoice();
        DB::table('invoices')->where('id', $fixture['invoice_id'])->update([self::COLUMN => 3]);

        try {
            $this->migration()->down();

            $this->assertFalse(Schema::hasColumn('invoices', self::COLUMN));
            $this->assertSame(1, (int) DB::table('invoices')->where('id', $fixture['invoice_id'])->count());
            $this->assertSame('17.25', (string) DB::table('invoices')->where('id', $fixture['invoice_id'])->value('total'));
            $this->assertSame('Maria Migracion', (string) DB::table('invoices')->where('id', $fixture['invoice_id'])->value('patient_name'));

            // down() repetido: no-op sin errores.
            $this->migration()->down();
            $this->assertFalse(Schema::hasColumn('invoices', self::COLUMN));

            $this->migration()->up();

            $this->assertTrue(Schema::hasColumn('invoices', self::COLUMN));
            // El rollback elimino la columna; al recrearla, las filas existentes
            // quedan con el default 0 (no se inventa un contador).
            $this->assertSame(0, (int) DB::table('invoices')->where('id', $fixture['invoice_id'])->value(self::COLUMN));
            $this->assertSame('17.25', (string) DB::table('invoices')->where('id', $fixture['invoice_id'])->value('total'));
        } finally {
            // DDL -> commit implicito en MySQL/MariaDB: borrar las filas
            // sinteticas explicitamente para no filtrarlas a otras clases.
            $this->deleteSyntheticInvoice($fixture);
        }
    }

    /**
     * @return array{invoice_id: int, sequence_id: int, user_id: int}
     */
    private function createSyntheticInvoice(): array
    {
        $user = User::factory()->create();

        $sequence = FiscalSequence::query()->create([
            'document_type' => 'invoice',
            'prefix' => 'MIG-T3004',
            'min_number' => 1,
            'max_number' => 99999999,
            'current_number' => 0,
            'cai' => 'MIG-T3-004-CAI',
            'valid_until' => now()->addYear()->toDateString(),
            'active' => false,
        ]);

        $invoice = Invoice::query()->create([
            'invoice_number' => 'MIG-T3004-00000001',
            'fiscal_sequence_id' => $sequence->id,
            'patient_name' => 'Maria Migracion',
            'subtotal' => '15.00',
            'subtotal_cents' => 1500,
            'tax_amount' => '2.25',
            'tax_amount_cents' => 225,
            'discount_amount' => '0.00',
            'discount_amount_cents' => 0,
            'total' => '17.25',
            'total_cents' => 1725,
            'paid_amount' => '0.00',
            'paid_amount_cents' => 0,
            'balance_due' => '17.25',
            'balance_due_cents' => 1725,
            'status' => Invoice::STATUS_ISSUED,
            'issued_by' => $user->id,
            'issued_at' => now(),
        ]);

        return [
            'invoice_id' => $invoice->id,
            'sequence_id' => $sequence->id,
            'user_id' => $user->id,
        ];
    }

    /**
     * @param  array{invoice_id: int, sequence_id: int, user_id: int}  $fixture
     */
    private function deleteSyntheticInvoice(array $fixture): void
    {
        DB::table('invoices')->where('id', $fixture['invoice_id'])->delete();
        DB::table('fiscal_sequences')->where('id', $fixture['sequence_id'])->delete();
        DB::table('users')->where('id', $fixture['user_id'])->delete();
    }

    private function migration(): object
    {
        return include base_path('database/migrations/2026_09_14_000001_add_legacy_reprint_count_to_invoices_table.php');
    }
}
