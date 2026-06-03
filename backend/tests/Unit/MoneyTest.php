<?php

namespace Tests\Unit;

use App\Support\Money;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class MoneyTest extends TestCase
{
    public function test_parse_cents_converts_whole_dollars(): void
    {
        $this->assertSame(1000, Money::parseCents('10', 'field'));
        $this->assertSame(0, Money::parseCents('0', 'field'));
        $this->assertSame(1, Money::parseCents('0.01', 'field'));
    }

    public function test_parse_cents_handles_two_decimal_places(): void
    {
        $this->assertSame(1250, Money::parseCents('12.50', 'field'));
        $this->assertSame(9999, Money::parseCents('99.99', 'field'));
        $this->assertSame(100, Money::parseCents('1.00', 'field'));
    }

    public function test_parse_cents_handles_single_decimal(): void
    {
        $this->assertSame(150, Money::parseCents('1.5', 'field'));
        $this->assertSame(50, Money::parseCents('0.5', 'field'));
    }

    public function test_parse_cents_rejects_invalid_format(): void
    {
        $this->expectException(ValidationException::class);
        Money::parseCents('abc', 'field');
    }

    public function test_parse_cents_rejects_more_than_two_decimals(): void
    {
        $this->expectException(ValidationException::class);
        Money::parseCents('10.999', 'field');
    }

    public function test_parse_cents_rejects_negative_values(): void
    {
        $this->expectException(ValidationException::class);
        Money::parseCents('-10.00', 'field');
    }

    public function test_parse_cents_strips_whitespace(): void
    {
        $this->assertSame(1000, Money::parseCents(' 10 ', 'field'));
    }

    public function test_parse_positive_cents_rejects_zero(): void
    {
        $this->expectException(ValidationException::class);
        Money::parsePositiveCents('0', 'field');
    }

    public function test_parse_positive_cents_rejects_negative(): void
    {
        $this->expectException(ValidationException::class);
        Money::parsePositiveCents('-5.00', 'field');
    }

    public function test_parse_positive_cents_accepts_positive_values(): void
    {
        $this->assertSame(500, Money::parsePositiveCents('5.00', 'field'));
    }

    public function test_format_cents_formats_two_decimals(): void
    {
        $this->assertSame('10.00', Money::formatCents(1000));
        $this->assertSame('0.01', Money::formatCents(1));
        $this->assertSame('0.00', Money::formatCents(0));
        $this->assertSame('99.99', Money::formatCents(9999));
    }

    public function test_format_cents_pads_single_digit_cents(): void
    {
        $this->assertSame('10.05', Money::formatCents(1005));
        $this->assertSame('1.00', Money::formatCents(100));
    }

    public function test_format_cents_handles_negative_values(): void
    {
        $this->assertSame('-10.00', Money::formatCents(-1000));
        $this->assertSame('-0.01', Money::formatCents(-1));
    }

    public function test_format_cents_rounds_down_for_exact_values(): void
    {
        $this->assertSame('10.00', Money::formatCents(1000));
    }
}
