<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Support\LempiraAmountWords;
use Tests\TestCase;

class LempiraAmountWordsTest extends TestCase
{
    public function test_it_writes_lempira_amounts_without_using_floats(): void
    {
        $this->assertSame(
            'DIECISIETE LEMPIRAS CON VEINTICINCO CENTAVOS',
            LempiraAmountWords::fromDecimal('17.25'),
        );

        $this->assertSame(
            'MIL LEMPIRAS CON UN CENTAVO',
            LempiraAmountWords::fromDecimal('1000.01'),
        );
    }

    public function test_it_handles_zero_and_singular_currency_names(): void
    {
        $this->assertSame(
            'CERO LEMPIRAS CON CERO CENTAVOS',
            LempiraAmountWords::fromDecimal('0.00'),
        );

        $this->assertSame(
            'UN LEMPIRA CON UN CENTAVO',
            LempiraAmountWords::fromDecimal('1.01'),
        );
    }
}
