<?php

namespace App\Support;

use Illuminate\Validation\ValidationException;

class Money
{
    public static function parseCents(string $value, string $field): int
    {
        $normalized = trim($value);

        if (! preg_match('/^\d+(\.\d{1,2})?$/', $normalized)) {
            throw ValidationException::withMessages([
                $field => 'El monto debe tener maximo dos decimales.',
            ]);
        }

        [$integer, $decimal] = array_pad(explode('.', $normalized, 2), 2, '00');

        return ((int) $integer * 100) + (int) str_pad(substr($decimal, 0, 2), 2, '0');
    }

    public static function parsePositiveCents(string $value, string $field): int
    {
        $cents = self::parseCents($value, $field);

        if ($cents <= 0) {
            throw ValidationException::withMessages([
                $field => 'El monto debe ser mayor que cero.',
            ]);
        }

        return $cents;
    }

    public static function formatCents(int $cents): string
    {
        $sign = $cents < 0 ? '-' : '';
        $absolute = abs($cents);

        return $sign.intdiv($absolute, 100).'.'.str_pad((string) ($absolute % 100), 2, '0', STR_PAD_LEFT);
    }

    public function __construct(private readonly int $cents) {}

    public static function fromCents(int $cents): self
    {
        return new self($cents);
    }

    public static function fromFloat(float $value): self
    {
        $cents = (int) round($value * 100);

        return new self($cents);
    }

    public static function zero(): self
    {
        return new self(0);
    }

    /**
     * @param  iterable<mixed>  $items
     * @param  callable(mixed): self  $selector
     */
    public static function sum(iterable $items, callable $selector): self
    {
        $totalCents = 0;

        foreach ($items as $item) {
            $money = $selector($item);
            $totalCents += $money->cents;
        }

        return new self($totalCents);
    }

    public function toCents(): int
    {
        return $this->cents;
    }

    public function toFloat(): float
    {
        return $this->cents / 100.0;
    }

    public function plus(self $other): self
    {
        return new self($this->cents + $other->cents);
    }

    public function minus(self $other): self
    {
        return new self($this->cents - $other->cents);
    }

    public function times(float|int $multiplier): self
    {
        $multiplierTimesThousand = (int) round($multiplier * 1000);

        $productCents = intdiv($this->cents * $multiplierTimesThousand + 500, 1000);

        return new self($productCents);
    }

    /**
     * Split a money amount across N parts without losing cents. Remainder
     * cents are distributed one cent at a time starting from the first part.
     *
     * @param  list<int>  $weights
     * @return list<self>
     */
    public function allocate(array $weights): array
    {
        if (count($weights) === 0) {
            return [];
        }

        $totalWeight = 0;
        foreach ($weights as $weight) {
            if ($weight < 0) {
                throw new \InvalidArgumentException('Allocation weights must be non-negative.');
            }
            $totalWeight += $weight;
        }

        if ($totalWeight === 0) {
            return array_map(static fn (): self => new self(0), $weights);
        }

        $shares = [];
        $allocatedCents = 0;

        foreach ($weights as $weight) {
            $share = intdiv($this->cents * $weight, $totalWeight);
            $shares[] = $share;
            $allocatedCents += $share;
        }

        $remainder = $this->cents - $allocatedCents;
        for ($i = 0; $remainder !== 0 && $i < count($shares); $i++, $remainder--) {
            $shares[$i]++;
        }

        return array_map(static fn (int $cents): self => new self($cents), $shares);
    }

    public function equals(self $other): bool
    {
        return $this->cents === $other->cents;
    }
}
