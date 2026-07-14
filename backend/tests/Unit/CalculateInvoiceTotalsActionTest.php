<?php

namespace Tests\Unit;

use App\Actions\Billing\CalculateInvoiceTotalsAction;
use App\Models\Category;
use App\Models\Service;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class CalculateInvoiceTotalsActionTest extends TestCase
{
    use RefreshDatabase;

    private CalculateInvoiceTotalsAction $action;

    protected function setUp(): void
    {
        parent::setUp();
        $this->action = new CalculateInvoiceTotalsAction;
    }

    public function test_single_taxable_item_calculates_correctly(): void
    {
        $service = $this->createService(price: '25.00', taxable: true);

        $result = $this->action->execute([
            ['service' => $service, 'quantity' => '1', 'notes' => null],
        ], '15.00');

        $this->assertSame('25.00', $result['subtotal']);
        $this->assertSame(2500, $result['subtotal_cents']);
        $this->assertSame('3.75', $result['tax_amount']);
        $this->assertSame(375, $result['tax_amount_cents']);
        $this->assertSame('28.75', $result['total']);
        $this->assertSame(2875, $result['total_cents']);
    }

    public function test_isv_15_percent_rounding_half_up(): void
    {
        $service = $this->createService(price: '0.01', taxable: true);

        $result = $this->action->execute([
            ['service' => $service, 'quantity' => '1', 'notes' => null],
        ], '15.00');

        $this->assertSame('0.01', $result['subtotal']);
        $this->assertSame('0.00', $result['tax_amount']);
        $this->assertSame('0.01', $result['total']);
    }

    public function test_tax_on_multiple_items_sums_correctly(): void
    {
        $service1 = $this->createService(price: '10.00', taxable: true);
        $service2 = $this->createService(price: '5.00', taxable: true);

        $result = $this->action->execute([
            ['service' => $service1, 'quantity' => '2', 'notes' => null],
            ['service' => $service2, 'quantity' => '1', 'notes' => null],
        ], '15.00');

        $this->assertSame('25.00', $result['subtotal']);
        $this->assertSame('3.75', $result['tax_amount']);
        $this->assertSame('28.75', $result['total']);
    }

    public function test_invoice_level_isv_avoids_line_rounding_drift(): void
    {
        $service = $this->createService(price: '0.50', taxable: true);

        $items = array_fill(0, 10, ['service' => $service, 'quantity' => '1', 'notes' => null]);

        $result = $this->action->execute($items, '15.00');

        $this->assertSame('5.00', $result['subtotal']);
        $this->assertSame('0.75', $result['tax_amount']);
        $this->assertSame(75, array_sum(array_column($result['items'], 'tax_amount_cents')));
        $this->assertSame('5.75', $result['total']);
    }

    public function test_equivalent_taxable_baskets_generate_same_invoice_tax(): void
    {
        $smallService = $this->createService(price: '0.50', taxable: true);
        $singleService = $this->createService(price: '5.00', taxable: true);

        $manySmallLines = $this->action->execute(
            array_fill(0, 10, ['service' => $smallService, 'quantity' => '1', 'notes' => null]),
            '15.00'
        );
        $singleLine = $this->action->execute([
            ['service' => $singleService, 'quantity' => '1', 'notes' => null],
        ], '15.00');

        $this->assertSame('0.75', $singleLine['tax_amount']);
        $this->assertSame($singleLine['tax_amount'], $manySmallLines['tax_amount']);
        $this->assertSame($singleLine['total'], $manySmallLines['total']);
    }

    public function test_non_taxable_service_has_zero_tax(): void
    {
        $taxable = $this->createService(price: '10.00', taxable: true);
        $nonTaxable = $this->createService(price: '5.00', taxable: false);

        $result = $this->action->execute([
            ['service' => $taxable, 'quantity' => '1', 'notes' => null],
            ['service' => $nonTaxable, 'quantity' => '1', 'notes' => null],
        ], '15.00');

        $this->assertSame('15.00', $result['subtotal']);
        $this->assertSame('1.50', $result['tax_amount']);
        $this->assertSame('16.50', $result['total']);
    }

    public function test_erythropoietin_rule_with_dialysis_prescription_is_free(): void
    {
        $erythropoietin = $this->createService(
            price: '25.00',
            taxable: true,
            specialRuleCode: Service::ERYTHROPOIETIN_RULE
        );
        $otherService = $this->createService(price: '10.00', taxable: true);

        $result = $this->action->execute([
            ['service' => $erythropoietin, 'quantity' => '1', 'notes' => null],
            ['service' => $otherService, 'quantity' => '1', 'notes' => null],
        ], '15.00', true);

        $this->assertSame('10.00', $result['subtotal']);
        $this->assertSame('1.50', $result['tax_amount']);
        $this->assertSame('11.50', $result['total']);

        $items = $result['items'];
        $this->assertTrue($items[0]['special_rule_applied']);
        $this->assertSame('0.00', $items[0]['unit_price']);
        $this->assertSame('0.00', $items[0]['line_total']);
    }

    public function test_erythropoietin_fixed_price_is_not_taxed_without_dialysis_prescription(): void
    {
        $erythropoietin = $this->createService(
            price: '25.00',
            taxable: true,
            specialRuleCode: Service::ERYTHROPOIETIN_RULE
        );

        $result = $this->action->execute([
            ['service' => $erythropoietin, 'quantity' => '1', 'notes' => null],
        ], '15.00');

        $this->assertSame('25.00', $result['subtotal']);
        $this->assertSame('0.00', $result['tax_amount']);
        $this->assertSame('25.00', $result['total']);
        $this->assertSame('0.00', $result['items'][0]['tax_rate']);
        $this->assertSame('0.00', $result['items'][0]['tax_amount']);
        $this->assertFalse($result['items'][0]['special_rule_applied']);
    }

    public function test_zero_total_invoice_when_all_items_free(): void
    {
        $service = $this->createService(
            price: '25.00',
            taxable: true,
            specialRuleCode: Service::ERYTHROPOIETIN_RULE
        );

        $result = $this->action->execute([
            ['service' => $service, 'quantity' => '1', 'notes' => null],
        ], '15.00', true);

        $this->assertSame('0.00', $result['subtotal']);
        $this->assertSame('0.00', $result['tax_amount']);
        $this->assertSame('0.00', $result['total']);
    }

    public function test_fractional_quantity_rounds_half_up(): void
    {
        $service = $this->createService(price: '10.00', taxable: true);

        $result = $this->action->execute([
            ['service' => $service, 'quantity' => '0.5', 'notes' => null],
        ], '15.00');

        $this->assertSame('5.00', $result['subtotal']);
        $this->assertSame('0.75', $result['tax_amount']);
        $this->assertSame('5.75', $result['total']);
    }

    public function test_quantity_with_three_decimal_places_rejected(): void
    {
        $service = $this->createService(price: '10.00', taxable: true);

        $this->expectException(ValidationException::class);
        $this->action->execute([
            ['service' => $service, 'quantity' => '0.001', 'notes' => null],
        ], '15.00');
    }

    public function test_item_snapshot_includes_service_details_without_technical_codes(): void
    {
        $service = $this->createService(
            price: '25.00',
            taxable: true,
            name: 'Eritropoyetina',
            scanCode: 'EPO001'
        );

        $result = $this->action->execute([
            ['service' => $service, 'quantity' => '1', 'notes' => 'Test note'],
        ], '15.00');

        $item = $result['items'][0];
        $this->assertSame('Eritropoyetina', $item['service_name']);
        $this->assertNull($item['scan_code']);
        $this->assertNull($item['barcode']);
        $this->assertNull($item['qr_code']);
        $this->assertSame('1.00', $item['quantity']);
        $this->assertSame(100, $item['quantity_cents']);
        $this->assertSame('25.00', $item['unit_price']);
        $this->assertSame(2500, $item['unit_price_cents']);
        $this->assertSame(2875, $item['line_total_cents']);
        $this->assertSame('Test note', $item['notes']);
    }

    private function createService(
        string $price = '10.00',
        bool $taxable = true,
        ?string $specialRuleCode = null,
        string $name = 'Test Service',
        ?string $scanCode = null
    ): Service {
        $category = Category::factory()->create();

        return Service::factory()->create([
            'name' => $name,
            'price' => $price,
            'taxable' => $taxable,
            'special_rule_code' => $specialRuleCode,
            'scan_code' => $scanCode ?? 'SCAN'.random_int(1000, 9999),
            'barcode' => 'BAR'.random_int(1000, 9999),
            'qr_code' => 'QR'.random_int(1000, 9999),
            'active' => true,
            'visible_in_billing' => true,
            'is_billable' => true,
            'category_id' => $category->id,
        ]);
    }
}
