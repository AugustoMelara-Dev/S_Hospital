<?php

namespace Tests\Unit\Support;

use App\Support\Money;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class MoneyTest extends TestCase
{
    public function test_it_parses_cents_correctly(): void
    {
        $this->assertSame(10000, Money::parseCents('100', 'monto'));
        $this->assertSame(10050, Money::parseCents('100.5', 'monto'));
        $this->assertSame(10050, Money::parseCents('100.50', 'monto'));
        $this->assertSame(5, Money::parseCents('0.05', 'monto'));
        $this->assertSame(0, Money::parseCents('0.00', 'monto'));
    }

    public function test_it_throws_validation_exception_for_invalid_cents(): void
    {
        $this->expectException(ValidationException::class);
        Money::parseCents('100.555', 'monto');
    }

    public function test_it_parses_positive_cents_correctly(): void
    {
        $this->assertSame(10050, Money::parsePositiveCents('100.50', 'monto'));
    }

    public function test_it_throws_validation_exception_for_non_positive_cents(): void
    {
        $this->expectException(ValidationException::class);
        Money::parsePositiveCents('0.00', 'monto');
    }

    public function test_it_formats_cents_correctly(): void
    {
        $this->assertSame('100.00', Money::formatCents(10000));
        $this->assertSame('100.50', Money::formatCents(10050));
        $this->assertSame('0.05', Money::formatCents(5));
        $this->assertSame('0.00', Money::formatCents(0));
        $this->assertSame('-100.00', Money::formatCents(-10000));
    }
}
