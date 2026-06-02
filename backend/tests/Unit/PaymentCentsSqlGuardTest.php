<?php

namespace Tests\Unit;

use Tests\TestCase;

class PaymentCentsSqlGuardTest extends TestCase
{
    private function readSource(string $relativePath): string
    {
        $path = base_path($relativePath);

        $this->assertFileExists($path, "Expected file to exist at {$path}");

        $contents = file_get_contents($path);

        $this->assertNotFalse($contents, "Could not read file at {$path}");

        return $contents;
    }

    public function test_report_services_prefer_payment_amount_cents_over_float_round(): void
    {
        $files = [
            'app/Actions/Reports/DashboardReportService.php',
            'app/Actions/Reports/DailyReportService.php',
        ];

        foreach ($files as $relativePath) {
            $source = $this->readSource($relativePath);

            $this->assertStringNotContainsString(
                'ROUND(payments.amount * 100)',
                $source,
                "{$relativePath} must not compute cents via ROUND(payments.amount * 100) since the payments table has an integer amount_cents column."
            );

            $this->assertStringContainsString(
                'payments.amount_cents',
                $source,
                "{$relativePath} must aggregate payments.amount_cents instead of recomputing cents via SQL float math."
            );
        }
    }

    public function test_reconciliation_uses_invoice_cents_columns(): void
    {
        $source = $this->readSource('app/Actions/Cash/BuildCashReconciliationAction.php');

        $this->assertStringContainsString(
            'SUM(COALESCE(balance_due_cents',
            $source,
            'BuildCashReconciliationAction must aggregate invoices.balance_due_cents while tolerating legacy rows during migration.'
        );
    }

    public function test_payment_actions_persist_invoice_cents_columns(): void
    {
        $actions = [
            'app/Actions/Payments/RegisterPaymentAction.php',
            'app/Actions/Payments/VoidPaymentAction.php',
        ];

        foreach ($actions as $relativePath) {
            $source = $this->readSource($relativePath);

            $this->assertStringContainsString(
                'paid_amount_cents',
                $source,
                "{$relativePath} must keep invoices.paid_amount_cents in sync when payments change."
            );

            $this->assertStringContainsString(
                'balance_due_cents',
                $source,
                "{$relativePath} must keep invoices.balance_due_cents in sync when payments change."
            );
        }
    }

    public function test_create_invoice_action_persists_invoice_cents_columns(): void
    {
        $source = $this->readSource('app/Actions/Billing/CreateInvoiceAction.php');

        foreach (['subtotal_cents', 'tax_amount_cents', 'total_cents', 'paid_amount_cents', 'balance_due_cents'] as $column) {
            $this->assertStringContainsString(
                $column,
                $source,
                "CreateInvoiceAction must persist invoices.{$column} so reports can read cents without recomputing SQL floats."
            );
        }
    }
}
