<?php

declare(strict_types=1);

namespace App\Actions\Reports\Concerns;

use App\Support\Money;

trait FormatsReportMoney
{
    private function moneyToCents(int|float|string|null $amount): int
    {
        if ($amount === null) {
            return 0;
        }

        return Money::parseCents((string) $amount, 'report_money');
    }

    private function centsToMoney(int|float|string|null $cents): string
    {
        return Money::formatCents((int) ($cents ?? 0));
    }

    private function decimalForSpreadsheet(int|float|string|null $amount): float
    {
        return $this->moneyToCents($amount) / 100;
    }

    private function formatMoneyForDisplay(int|float|string|null $amount): string
    {
        return number_format($this->moneyToCents($amount) / 100, 2);
    }

    private function allocateProportionalCents(int $paymentCents, int $categoryCents, int $invoiceCents): int
    {
        if ($paymentCents <= 0 || $categoryCents <= 0 || $invoiceCents <= 0) {
            return 0;
        }

        return intdiv(($paymentCents * $categoryCents) + intdiv($invoiceCents, 2), $invoiceCents);
    }

    /**
     * @return array<string, string>
     */
    private function zeroMethodTotals(): array
    {
        return [
            'cash' => '0.00',
            'transfer' => '0.00',
            'card' => '0.00',
            'other' => '0.00',
        ];
    }
}
