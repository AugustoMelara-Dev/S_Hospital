<?php

namespace Tests\Unit\Support;

use App\Support\Money;
use PHPUnit\Framework\TestCase;

class MoneyTest extends TestCase
{
    public function test_it_formats_cents_to_string(): void
    {
        $this->assertSame('15.00', Money::formatCents(1500));
        $this->assertSame('0.50', Money::formatCents(50));
        $this->assertSame('0.05', Money::formatCents(5));
        $this->assertSame('-15.00', Money::formatCents(-1500));
        $this->assertSame('0.00', Money::formatCents(0));
    }

    public function test_it_formats_lempiras(): void
    {
        $this->assertSame('L. 15.00', Money::formatLempiras(1500));
        $this->assertSame('L. 0.50', Money::formatLempiras(50));
        $this->assertSame('L. 0.05', Money::formatLempiras(5));
        $this->assertSame('- L. 15.00', Money::formatLempiras(-1500));
        $this->assertSame('L. 0.00', Money::formatLempiras(0));
    }

    public function test_from_cents_returns_same_integer(): void
    {
        $this->assertSame(1500, Money::fromCents(1500)->toCents());
        $this->assertSame(0, Money::fromCents(0)->toCents());
        $this->assertSame(-50, Money::fromCents(-50)->toCents());
    }

    public function test_zero_factory_returns_zero_cents(): void
    {
        $this->assertSame(0, Money::zero()->toCents());
    }

    public function test_public_api_does_not_accept_or_return_float_money(): void
    {
        $methods = collect((new \ReflectionClass(Money::class))->getMethods(\ReflectionMethod::IS_PUBLIC));

        $this->assertFalse($methods->contains(fn (\ReflectionMethod $method): bool => in_array(
            $method->getName(),
            ['fromFloat', 'toFloat', 'times'],
            true,
        )));
    }

    public function test_plus_adds_integer_cents_without_drift(): void
    {
        $a = Money::fromCents(333);
        $b = Money::fromCents(667);
        $this->assertSame(1000, $a->plus($b)->toCents());
    }

    public function test_minus_subtracts_integer_cents(): void
    {
        $a = Money::fromCents(1000);
        $b = Money::fromCents(250);
        $this->assertSame(750, $a->minus($b)->toCents());
        $this->assertSame(-250, $a->minus($b)->minus(Money::fromCents(1000))->toCents());
    }

    public function test_allocate_splits_evenly_when_no_remainder(): void
    {
        $shares = Money::fromCents(100)->allocate([1, 1, 1]);
        $this->assertCount(3, $shares);
        $this->assertSame(34, $shares[0]->toCents());
        $this->assertSame(33, $shares[1]->toCents());
        $this->assertSame(33, $shares[2]->toCents());
    }

    public function test_allocate_distributes_remainder_to_first_parts(): void
    {
        $shares = Money::fromCents(10)->allocate([1, 1, 1]);
        $this->assertSame(4, $shares[0]->toCents());
        $this->assertSame(3, $shares[1]->toCents());
        $this->assertSame(3, $shares[2]->toCents());
    }

    public function test_allocate_respects_weights(): void
    {
        $shares = Money::fromCents(100)->allocate([3, 1]);
        $this->assertSame(75, $shares[0]->toCents());
        $this->assertSame(25, $shares[1]->toCents());
    }

    public function test_allocate_with_zero_weight_returns_zero(): void
    {
        $shares = Money::fromCents(100)->allocate([0, 1]);
        $this->assertSame(0, $shares[0]->toCents());
        $this->assertSame(100, $shares[1]->toCents());
    }

    public function test_allocate_with_all_zero_weights_returns_all_zeros(): void
    {
        $shares = Money::fromCents(100)->allocate([0, 0, 0]);
        $this->assertSame(0, $shares[0]->toCents());
        $this->assertSame(0, $shares[1]->toCents());
        $this->assertSame(0, $shares[2]->toCents());
    }

    public function test_allocate_total_matches_original(): void
    {
        $original = Money::fromCents(99);
        $shares = $original->allocate([1, 2, 3, 4]);

        $sumCents = 0;
        foreach ($shares as $share) {
            $sumCents += $share->toCents();
        }
        $this->assertSame(99, $sumCents);
    }

    public function test_allocate_negative_total_preserves_every_cent(): void
    {
        $shares = Money::fromCents(-100)->allocate([1, 1, 1]);

        $this->assertSame([-34, -33, -33], array_map(
            static fn (Money $share): int => $share->toCents(),
            $shares,
        ));
        $this->assertSame(-100, array_sum(array_map(
            static fn (Money $share): int => $share->toCents(),
            $shares,
        )));
    }

    public function test_equals_compares_by_cents(): void
    {
        $this->assertTrue(Money::fromCents(100)->equals(Money::fromCents(100)));
        $this->assertTrue(Money::fromCents(0)->equals(Money::zero()));
        $this->assertFalse(Money::fromCents(100)->equals(Money::fromCents(101)));
    }

    public function test_sum_adds_selector_results(): void
    {
        $items = [
            ['amount' => Money::fromCents(100)],
            ['amount' => Money::fromCents(250)],
            ['amount' => Money::fromCents(50)],
        ];
        $sum = Money::sum($items, static fn (array $item): Money => $item['amount']);
        $this->assertSame(400, $sum->toCents());
    }

    public function test_sum_over_empty_iterable_returns_zero(): void
    {
        $sum = Money::sum([], static fn (mixed $item): Money => Money::fromCents(0));
        $this->assertSame(0, $sum->toCents());
    }
}
