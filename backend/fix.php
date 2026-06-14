<?php
$c=file_get_contents('tests/Feature/CashPaymentsReceiptTest.php');
$o=<<<'EOT'
            ->assertJsonCount(1, 'data.payments')
            ->assertJsonPath('data.payments.0.method', Payment::METHOD_OTHER)
            ->assertJsonPath('data.payments.0.amount', '0.00')
            ->assertJsonPath('data.payments.0.reference', 'Factura sin cobro por regla autorizada');

        $this->assertDatabaseHas('payments', [
            'invoice_id' => $invoiceId,
            'method' => Payment::METHOD_OTHER,
            'amount' => '0.00',
            'amount_cents' => 0,
            'reference' => 'Factura sin cobro por regla autorizada',
        ]);
        $this->assertDatabaseHas('audit_logs', [
            'action' => 'payment.registered',
            'entity_id' => $invoiceId,
EOT;
$n=<<<'EOT'
            ->assertJsonCount(0, 'data.payments');

        $this->assertDatabaseMissing('payments', [
            'invoice_id' => $invoiceId,
        ]);
        $this->assertDatabaseHas('audit_logs', [
            'action' => 'invoice.free_granted',
            'entity_id' => $invoiceId,
EOT;
file_put_contents('tests/Feature/CashPaymentsReceiptTest.php', str_replace($o, $n, $c));
