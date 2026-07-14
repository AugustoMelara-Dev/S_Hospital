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
            'SUM(balance_due_cents)',
            $source,
            'BuildCashReconciliationAction must aggregate invoices.balance_due_cents now that the column exists.'
        );

        $this->assertStringNotContainsString(
            'ROUND(balance_due * 100)',
            $source,
            'BuildCashReconciliationAction must not fall back to ROUND(balance_due * 100) since balance_due_cents is non-nullable.'
        );
    }

    public function test_financial_facts_use_invoice_and_item_cents_columns(): void
    {
        $source = $this->readSource('app/Actions/Reports/FinancialFactsService.php');

        foreach (['total_cents', 'balance_due_cents', 'line_total_cents'] as $column) {
            $this->assertStringContainsString(
                $column,
                $source,
                "FinancialFactsService must aggregate {$column} instead of recomputing cents from decimal values."
            );
        }

        foreach (['ROUND(total * 100)', 'ROUND(balance_due * 100)', 'ROUND(invoice_items.line_total * 100)'] as $unsafeSql) {
            $this->assertStringNotContainsString(
                $unsafeSql,
                $source,
                "FinancialFactsService must not use {$unsafeSql}; reports need persisted integer cents for stable LAN cashier totals."
            );
        }
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

    public function test_report_services_do_not_recompute_invoice_cents_via_sql(): void
    {
        $reports = [
            'app/Actions/Reports/DashboardReportService.php',
            'app/Actions/Reports/DailyReportService.php',
            'app/Actions/Reports/MonthlyReportService.php',
            'app/Actions/Reports/AreaReportService.php',
            'app/Actions/Reports/AreaIncomeReportService.php',
            'app/Actions/Reports/ServiceSalesReportService.php',
            'app/Actions/Reports/CategoryReportService.php',
            'app/Actions/Reports/FinancialFactsService.php',
        ];

        foreach ($reports as $relativePath) {
            $source = $this->readSource($relativePath);

            $this->assertStringNotContainsString(
                'ROUND(invoice_items.quantity * 100)',
                $source,
                "{$relativePath} must aggregate invoice_items.quantity_cents (added in the cents migration)."
            );

            $this->assertStringNotContainsString(
                'ROUND(invoice_items.line_total * 100)',
                $source,
                "{$relativePath} must aggregate invoice_items.line_total_cents (added in the cents migration)."
            );

            $this->assertStringNotContainsString(
                'ROUND(invoice_items.line_subtotal * 100)',
                $source,
                "{$relativePath} must aggregate invoice_items.line_subtotal_cents (added in the cents migration)."
            );

            $this->assertStringNotContainsString(
                'ROUND(invoice_items.tax_amount * 100)',
                $source,
                "{$relativePath} must aggregate invoice_items.tax_amount_cents (added in the cents migration)."
            );

            $this->assertStringNotContainsString(
                'ROUND(invoice_items.line_total * payment_totals',
                $source,
                "{$relativePath} must compute cents-weighted totals using *_cents columns, not SQL float."
            );

            $this->assertStringNotContainsString(
                'ROUND(invoice_items.line_subtotal * payment_totals',
                $source,
                "{$relativePath} must compute cents-weighted totals using *_cents columns, not SQL float."
            );

            $this->assertStringNotContainsString(
                'ROUND(invoice_items.tax_amount * payment_totals',
                $source,
                "{$relativePath} must compute cents-weighted totals using *_cents columns, not SQL float."
            );

            $this->assertStringNotContainsString(
                'ROUND(invoices.balance_due * 100',
                $source,
                "{$relativePath} must use invoices.balance_due_cents directly instead of recomputing via SQL float."
            );

            $this->assertStringNotContainsString(
                'ROUND(invoices.total * 100',
                $source,
                "{$relativePath} must use invoices.total_cents directly instead of recomputing via SQL float."
            );

            $this->assertStringNotContainsString(
                'ROUND(total * 100)',
                $source,
                "{$relativePath} must use invoices.total_cents directly instead of recomputing via SQL float."
            );
        }
    }
}
