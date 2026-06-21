<?php

namespace Tests\Unit;

use PHPUnit\Framework\TestCase;

class PaymentLockOrderGuardTest extends TestCase
{
    public function test_register_payment_locks_cash_session_before_invoice(): void
    {
        $source = file_get_contents(dirname(__DIR__, 2).'/app/Actions/Payments/RegisterPaymentAction.php');

        $this->assertCashSessionLockBeforeInvoiceLock($source, 'RegisterPaymentAction');
    }

    public function test_void_payment_locks_cash_session_before_invoice(): void
    {
        $source = file_get_contents(dirname(__DIR__, 2).'/app/Actions/Payments/VoidPaymentAction.php');

        $this->assertCashSessionLockBeforeInvoiceLock($source, 'VoidPaymentAction');
    }

    public function test_reverse_invoice_locks_cash_sessions_before_invoice(): void
    {
        $source = file_get_contents(dirname(__DIR__, 2).'/app/Actions/Billing/ReverseInvoiceAction.php');

        $this->assertCashSessionLockBeforeInvoiceLock($source, 'ReverseInvoiceAction');
    }

    public function test_issue_receipt_locks_cash_session_before_invoice(): void
    {
        $source = file_get_contents(dirname(__DIR__, 2).'/app/Actions/InstitutionalReceipts/IssueInstitutionalReceiptAction.php');

        $cashSessionLock = strpos($source, '$cashSession = CashRegisterSession::query()');
        $invoiceLock = strpos($source, '$invoice = Invoice::query()');

        $this->assertIsInt($cashSessionLock);
        $this->assertIsInt($invoiceLock);
        $this->assertLessThan(
            $invoiceLock,
            $cashSessionLock,
            'IssueInstitutionalReceiptAction debe bloquear cash_session antes que invoice para coincidir con CloseCashSessionAction.'
        );
    }

    private function assertCashSessionLockBeforeInvoiceLock(string $source, string $action): void
    {
        $cashSessionLock = preg_match('/CashRegisterSession::query\(\).*?->lockForUpdate\(\)/s', $source, $cashMatches, PREG_OFFSET_CAPTURE)
            ? $cashMatches[0][1]
            : false;
        $invoiceLock = preg_match('/Invoice::query\(\).*?->lockForUpdate\(\)/s', $source, $invoiceMatches, PREG_OFFSET_CAPTURE)
            ? $invoiceMatches[0][1]
            : false;

        $this->assertIsInt($cashSessionLock);
        $this->assertIsInt($invoiceLock);
        $this->assertLessThan(
            $invoiceLock,
            $cashSessionLock,
            "{$action} debe bloquear cash_session antes que invoice para coincidir con CloseCashSessionAction."
        );
    }
}
