<?php

namespace Tests\Unit\Actions;

use App\Actions\Billing\CalculateInvoiceTotalsAction;
use App\Models\Service;
use Tests\TestCase;

class EritropoyetinaRuleTest extends TestCase
{
    private CalculateInvoiceTotalsAction $action;

    protected function setUp(): void
    {
        parent::setUp();
        $this->action = new CalculateInvoiceTotalsAction();
    }

    public function test_it_charges_zero_for_erythropoietin_when_dialysis_prescription_is_true(): void
    {
        $epoService = new Service([
            'id' => 10,
            'name' => 'Eritropoyetina 2000 UI',
            'price' => '25.00',
            'taxable' => false,
            'special_rule_code' => Service::ERYTHROPOIETIN_RULE,
        ]);

        $items = [
            [
                'service' => $epoService,
                'quantity' => '1.00',
                'dialysis_prescription' => true,
                'notes' => 'Receta de diálisis válida',
            ],
        ];

        $result = $this->action->execute($items, '15.00');

        $this->assertSame('0.00', $result['subtotal']);
        $this->assertSame('0.00', $result['total']);
        $this->assertTrue($result['items'][0]['special_rule_applied']);
        $this->assertSame('0.00', $result['items'][0]['unit_price']);
    }

    public function test_it_charges_full_price_for_erythropoietin_when_dialysis_prescription_is_false(): void
    {
        $epoService = new Service([
            'id' => 10,
            'name' => 'Eritropoyetina 2000 UI',
            'price' => '25.00',
            'taxable' => false,
            'special_rule_code' => Service::ERYTHROPOIETIN_RULE,
        ]);

        $items = [
            [
                'service' => $epoService,
                'quantity' => '1.00',
                'dialysis_prescription' => false,
                'notes' => 'Sin receta',
            ],
        ];

        $result = $this->action->execute($items, '15.00');

        $this->assertSame('25.00', $result['subtotal']);
        $this->assertSame('25.00', $result['total']);
        $this->assertFalse($result['items'][0]['special_rule_applied']);
        $this->assertSame('25.00', $result['items'][0]['unit_price']);
    }
}
