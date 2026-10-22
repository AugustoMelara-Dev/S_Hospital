<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * F013 (T2-004/T2-014): coherencia entre las columnas decimal(12,2) y sus
 * columnas enteras *_cents en el dominio de dinero.
 *
 * Las rutas de escritura actuales (CalculateInvoiceTotalsAction,
 * CreateInvoiceAction, RegisterPaymentAction, VoidPaymentAction,
 * IssueInstitutionalReceiptAction) derivan ambos lados del mismo entero en
 * centavos, pero la base no lo garantizaba. Esta migracion agrega un CHECK
 * por par: ROUND(decimal * 100, 0) = cents.
 *
 * Fail-closed: antes de tocar el esquema se cuentan las filas incoherentes de
 * TODOS los pares. Si existe una sola, la migracion aborta con mensaje claro
 * y NO repara, normaliza ni convierte datos historicos.
 *
 * SQLite: no soporta ALTER TABLE ADD CONSTRAINT; la suite rapida conserva su
 * esquema y la cobertura de estos CHECK corre en MariaDB (phpunit.mysql.xml).
 *
 * Rollback: elimina exactamente los CHECK creados por esta migracion.
 */
return new class extends Migration
{
    /** @var array<string, array<string, string>> tabla => decimal => cents */
    private const PAIRS = [
        'invoices' => [
            'subtotal' => 'subtotal_cents',
            'tax_amount' => 'tax_amount_cents',
            'discount_amount' => 'discount_amount_cents',
            'total' => 'total_cents',
            'paid_amount' => 'paid_amount_cents',
            'balance_due' => 'balance_due_cents',
        ],
        'invoice_items' => [
            'quantity' => 'quantity_cents',
            'unit_price' => 'unit_price_cents',
            'tax_amount' => 'tax_amount_cents',
            'line_subtotal' => 'line_subtotal_cents',
            'line_total' => 'line_total_cents',
        ],
        'payments' => [
            'amount' => 'amount_cents',
        ],
        'institutional_receipts' => [
            'amount' => 'amount_cents',
        ],
    ];

    public function up(): void
    {
        if (! in_array(DB::connection()->getDriverName(), ['mysql', 'mariadb'], true)) {
            return;
        }

        // Preflight completo antes de cualquier ALTER: fail-closed.
        foreach (self::PAIRS as $table => $pairs) {
            if (! Schema::hasTable($table)) {
                continue;
            }

            foreach ($pairs as $decimal => $cents) {
                if (! Schema::hasColumn($table, $decimal) || ! Schema::hasColumn($table, $cents)) {
                    continue;
                }

                $this->assertCoherent($table, $decimal, $cents);
            }
        }

        foreach (self::PAIRS as $table => $pairs) {
            if (! Schema::hasTable($table)) {
                continue;
            }

            foreach ($pairs as $decimal => $cents) {
                if (! Schema::hasColumn($table, $decimal) || ! Schema::hasColumn($table, $cents)) {
                    continue;
                }

                $name = $this->constraintName($table, $cents);

                if ($this->checkExists($table, $name)) {
                    continue;
                }

                DB::statement(
                    "ALTER TABLE `{$table}` ADD CONSTRAINT `{$name}` CHECK (ROUND(`{$decimal}` * 100, 0) = `{$cents}`)"
                );
            }
        }
    }

    public function down(): void
    {
        if (! in_array(DB::connection()->getDriverName(), ['mysql', 'mariadb'], true)) {
            return;
        }

        foreach (self::PAIRS as $table => $pairs) {
            if (! Schema::hasTable($table)) {
                continue;
            }

            foreach ($pairs as $decimal => $cents) {
                $this->dropCheckIfExists($table, $this->constraintName($table, $cents));
            }
        }
    }

    private function assertCoherent(string $table, string $decimal, string $cents): void
    {
        $violations = (int) DB::table($table)
            ->where(function ($query) use ($decimal, $cents): void {
                $query->whereNull($decimal)
                    ->orWhereNull($cents)
                    ->orWhereRaw("ROUND(`{$decimal}` * 100, 0) <> `{$cents}`");
            })
            ->count();

        if ($violations > 0) {
            throw new RuntimeException(sprintf(
                'F013 fail-closed: `%s` tiene %d fila(s) con `%s` y `%s` incoherentes. '.
                'No se reparan ni normalizan datos historicos automaticamente; '.
                'documente/reconcilie el historico y vuelva a ejecutar la migracion.',
                $table,
                $violations,
                $decimal,
                $cents,
            ));
        }
    }

    private function constraintName(string $table, string $cents): string
    {
        return "{$table}_{$cents}_coherence";
    }

    private function checkExists(string $table, string $name): bool
    {
        $database = DB::connection()->getDatabaseName();

        return DB::table('information_schema.CHECK_CONSTRAINTS')
            ->where('CONSTRAINT_SCHEMA', $database)
            ->where('CONSTRAINT_NAME', $name)
            ->exists();
    }

    private function dropCheckIfExists(string $table, string $name): void
    {
        if (! $this->checkExists($table, $name)) {
            return;
        }

        try {
            DB::statement("ALTER TABLE `{$table}` DROP CONSTRAINT `{$name}`");
        } catch (QueryException) {
            // Constraint ya retirado por una corrida parcial; la guarda previa
            // evita el caso normal, el catch tolera la carrera.
        }
    }
};
