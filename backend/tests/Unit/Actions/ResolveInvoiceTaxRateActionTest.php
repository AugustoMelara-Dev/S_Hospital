<?php

namespace Tests\Unit\Actions;

use App\Actions\Billing\ResolveInvoiceTaxRateAction;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/**
 * The 15% used below is a TEST FIXTURE for the pre-existing code default, not a
 * fiscal decision. The action's job is to label the origin, never to invent a
 * rate silently.
 */
class ResolveInvoiceTaxRateActionTest extends TestCase
{
    private ResolveInvoiceTaxRateAction $action;

    protected function setUp(): void
    {
        parent::setUp();
        $this->action = new ResolveInvoiceTaxRateAction;
    }

    public function test_missing_configuration_falls_back_to_the_labeled_code_default(): void
    {
        $result = $this->action->fromStoredRate(null);

        $this->assertTrue($result['available']);
        $this->assertSame('15.00', $result['rate']);
        $this->assertSame(1500, $result['rate_basis_points']);
        $this->assertSame(ResolveInvoiceTaxRateAction::ORIGIN_CODE_DEFAULT, $result['origin']);
    }

    /**
     * @return array<string, array{string, int, string}>
     */
    public static function storedRateProvider(): array
    {
        return [
            'configured 15' => ['15.00', 1500, '15.00'],
            'configured zero' => ['0.00', 0, '0.00'],
            'configured 18' => ['18.00', 1800, '18.00'],
            'one decimal' => ['7.5', 750, '7.50'],
        ];
    }

    #[DataProvider('storedRateProvider')]
    public function test_configured_rate_is_normalized_and_labeled_as_fiscal_settings(
        string $stored,
        int $basisPoints,
        string $normalized,
    ): void {
        $result = $this->action->fromStoredRate($stored);

        $this->assertTrue($result['available']);
        $this->assertSame($normalized, $result['rate']);
        $this->assertSame($basisPoints, $result['rate_basis_points']);
        $this->assertSame(ResolveInvoiceTaxRateAction::ORIGIN_FISCAL_SETTINGS, $result['origin']);
    }

    /**
     * @return array<string, array{string}>
     */
    public static function invalidRateProvider(): array
    {
        return [
            'empty' => [''],
            'non numeric' => ['abc'],
            'negative' => ['-5.00'],
            'three decimals' => ['15.001'],
            'currency text' => ['L. 15.00'],
        ];
    }

    #[DataProvider('invalidRateProvider')]
    public function test_unparseable_rate_is_reported_as_unavailable_and_never_as_zero(string $stored): void
    {
        $result = $this->action->fromStoredRate($stored);

        $this->assertFalse($result['available']);
        $this->assertNull($result['rate']);
        $this->assertNull($result['rate_basis_points']);
        $this->assertSame(ResolveInvoiceTaxRateAction::ORIGIN_UNAVAILABLE, $result['origin']);
    }
}
