<?php

namespace Tests\Unit\Actions;

use App\Actions\Billing\CalculateInvoiceTotalsAction;
use App\Models\Service;
use Tests\TestCase;

class CalculateInvoiceTotalsTest extends TestCase
{
    private CalculateInvoiceTotalsAction $action;

    protected function setUp(): void
    {
        parent::setUp();
        $this->action = new CalculateInvoiceTotalsAction();
    }

    public function test_it_calculates_totals_correctly_for_taxable_services(): void
    {
        $service1 = new Service([
            'id' => 1,
            'price' => '100.00',
            'taxable' => true,
            'special_rule_code' => null,
        ]);

        $service2 = new Service([
            'id' => 2,
            'price' => '50.50',
            'taxable' => true,
            'special_rule_code' => null,
        ]);

        $items = [
            [
                'service' => $service1,
                'quantity' => '2.00',
                'dialysis_prescription' => false,
                'notes' => 'Test notes 1',
            ],
            [
                'service' => $service2,
                'quantity' => '1.00',
                'dialysis_prescription' => false,
                'notes' => 'Test notes 2',
            ],
        ];

        // Tax rate is 15.00%
        $result = $this->action->execute($items, '15.00');

        // Subtotal: (100 * 2) + 50.50 = 250.50
        $this->assertSame('250.50', $result['subtotal']);
        // Tax: 250.50 * 15% = 37.575 (rounded up to 37.58)
        $this->assertSame('37.58', $result['tax_amount']);
        $this->assertSame('0.00', $result['discount_amount']);
        // Total: 250.50 + 37.58 = 288.08
        $this->assertSame('288.08', $result['total']);
    }

    public function test_it_applies_erythropoietin_free_prescription_rule(): void
    {
        $epoService = new Service([
            'id' => 3,
            'price' => '25.00',
            'taxable' => false,
            'special_rule_code' => Service::ERYTHROPOIETIN_RULE,
        ]);

        // Scenario A: Without dialysis prescription (charged full L.25)
        $itemsWithoutDialysis = [
            [
                'service' => $epoService,
                'quantity' => '1.00',
                'dialysis_prescription' => false,
                'notes' => null,
            ],
        ];

        $resultA = $this->action->execute($itemsWithoutDialysis, '15.00');
        $this->assertSame('25.00', $resultA['subtotal']);
        $this->assertSame('0.00', $resultA['tax_amount']);
        $this->assertSame('25.00', $resultA['total']);

        // Scenario B: With dialysis prescription (free L.0)
        $itemsWithDialysis = [
            [
                'service' => $epoService,
                'quantity' => '1.00',
                'dialysis_prescription' => true,
                'notes' => null,
            ],
        ];

        $resultB = $this->action->execute($itemsWithDialysis, '15.00');
        $this->assertSame('0.00', $resultB['subtotal']);
        $this->assertSame('0.00', $resultB['tax_amount']);
        $this->assertSame('0.00', $resultB['total']);
        $this->assertTrue($resultB['items'][0]['special_rule_applied']);
    }

    public function test_it_handles_non_taxable_services_correctly(): void
    {
        $nonTaxable = new Service([
            'id' => 4,
            'price' => '120.00',
            'taxable' => false,
            'special_rule_code' => null,
        ]);

        $items = [
            [
                'service' => $nonTaxable,
                'quantity' => '1.50',
                'dialysis_prescription' => false,
                'notes' => null,
            ],
        ];

        $result = $this->action->execute($items, '15.00');
        // Subtotal: 120.00 * 1.50 = 180.00
        $this->assertSame('180.00', $result['subtotal']);
        // Tax: non-taxable = 0.00
        $this->assertSame('0.00', $result['tax_amount']);
        $this->assertSame('180.00', $result['total']);
    }
}
