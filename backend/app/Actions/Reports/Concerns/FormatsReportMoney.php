<?php

namespace App\Actions\Reports\Concerns;

use App\Support\Money;

trait FormatsReportMoney
{
    private function centsToMoney(int|string|null $cents): string
    {
        return Money::formatCents((int) ($cents ?? 0));
    }

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
