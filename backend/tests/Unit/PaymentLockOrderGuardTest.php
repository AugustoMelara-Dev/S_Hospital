<?php

namespace Tests\Unit;

use PHPUnit\Framework\TestCase;

class PaymentLockOrderGuardTest extends TestCase
{
    public function test_register_payment_locks_cash_session_before_invoice(): void
    {
        $source = file_get_contents(dirname(__DIR__, 2).'/app/Actions/Payments/RegisterPaymentAction.php');

        $cashSessionLock = strpos($source, 'CashRegisterSession::query()');
        $invoiceLock = strpos($source, 'Invoice::query()');

        $this->assertIsInt($cashSessionLock);
        $this->assertIsInt($invoiceLock);
        $this->assertLessThan(
            $invoiceLock,
            $cashSessionLock,
            'RegisterPaymentAction debe bloquear cash_session antes que invoice para coincidir con CloseCashSessionAction.'
        );
    }
}
