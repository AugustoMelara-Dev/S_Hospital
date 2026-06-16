<?php

namespace Tests\Unit;

use App\Models\CashMovement;
use App\Models\Payment;
use PHPUnit\Framework\TestCase;

class OfflineCheckConstraintsMigrationSqlGuardTest extends TestCase
{
    private string $migrationSql;

    protected function setUp(): void
    {
        parent::setUp();

        $this->migrationSql = file_get_contents(
            dirname(__DIR__, 2).'/database/migrations/2026_06_15_000004_add_offline_check_constraints.php'
        );
    }

    public function test_constraints_use_current_payment_and_cash_movement_states(): void
    {
        $this->assertStringContainsString(
            "status IN ('".Payment::STATUS_POSTED."','".Payment::STATUS_VOID."')",
            $this->migrationSql
        );
        $this->assertStringNotContainsString("status IN ('active','void')", $this->migrationSql);

        $expectedTypes = implode("','", [
            CashMovement::TYPE_OPENING,
            CashMovement::TYPE_PAYMENT,
            CashMovement::TYPE_PAYMENT_VOID,
            CashMovement::TYPE_CLOSING,
        ]);

        $this->assertStringContainsString("type IN ('{$expectedTypes}')", $this->migrationSql);
        $this->assertStringNotContainsString("type IN ('opening','sale','withdrawal','adjustment','void')", $this->migrationSql);
    }

    public function test_constraints_do_not_reference_columns_missing_from_current_schema(): void
    {
        foreach (['amount_cents <> 0', 'old_price_cents', 'new_price_cents', 'price_cents'] as $legacyReference) {
            $this->assertStringNotContainsString($legacyReference, $this->migrationSql);
        }

        $this->assertStringContainsString('cash_movements_amount_nonzero', $this->migrationSql);
        $this->assertStringContainsString('old_price', $this->migrationSql);
        $this->assertStringContainsString('new_price', $this->migrationSql);
    }

    public function test_mysql_index_and_down_sql_are_compatible(): void
    {
        $this->assertStringNotContainsString("'ON receipt_print_profiles (is_global_default) '.", $this->migrationSql);
        $this->assertStringNotContainsString('ALTER TABLE DROP CHECK', $this->migrationSql);
        $this->assertStringContainsString('global_default_unique_key', $this->migrationSql);
        $this->assertStringContainsString('throw new RuntimeException', $this->migrationSql);
        $this->assertStringContainsString('ALTER TABLE `', $this->migrationSql);
        $this->assertStringContainsString('DROP CONSTRAINT', $this->migrationSql);
    }
}
