<?php

namespace Tests\Unit;

use App\Actions\Cash\CloseCashSessionAction;
use App\Actions\Payments\RegisterPaymentAction;
use PHPUnit\Framework\TestCase;

class CashPaymentLockOrderTest extends TestCase
{
    public function test_payment_and_close_actions_lock_cash_session_before_invoice_and_payment_rows(): void
    {
        $paymentSource = file_get_contents((new \ReflectionClass(RegisterPaymentAction::class))->getFileName());
        $closeSource = file_get_contents((new \ReflectionClass(CloseCashSessionAction::class))->getFileName());

        $this->assertIsString($paymentSource);
        $this->assertIsString($closeSource);

        $this->assertLessThan(
            strpos($paymentSource, 'Invoice::query()'),
            strpos($paymentSource, 'CashRegisterSession::query()'),
            'RegisterPaymentAction must lock cash_register_sessions before invoices.',
        );

        $this->assertLessThan(
            strpos($closeSource, 'Invoice::query()'),
            strpos($closeSource, 'CashRegisterSession::query()'),
            'CloseCashSessionAction must lock cash_register_sessions before invoices.',
        );

        $this->assertLessThan(
            strpos($closeSource, 'Payment::query()'),
            strpos($closeSource, 'CashRegisterSession::query()'),
            'CloseCashSessionAction must lock cash_register_sessions before payments.',
        );
    }
}
