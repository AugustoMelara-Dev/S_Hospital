<?php

namespace Tests\Unit;

use App\Actions\InstitutionalReceipts\AmountToSpanishWords;
use PHPUnit\Framework\TestCase;

class AmountToSpanishWordsTest extends TestCase
{
    public function test_it_converts_zero_lempiras(): void
    {
        $this->assertSame(
            'CERO LEMPIRAS CON 00/100 CENTAVOS',
            (new AmountToSpanishWords)->forCents(0)
        );
    }

    public function test_it_converts_one_lempira(): void
    {
        $this->assertSame(
            'UN LEMPIRA CON 00/100 CENTAVOS',
            (new AmountToSpanishWords)->forCents(100)
        );
    }

    public function test_it_converts_twenty_five_lempiras(): void
    {
        $this->assertSame(
            'VEINTICINCO LEMPIRAS CON 00/100 CENTAVOS',
            (new AmountToSpanishWords)->forCents(2500)
        );
    }

    public function test_it_converts_lempiras_and_centavos(): void
    {
        $this->assertSame(
            'MIL DOSCIENTOS TREINTA Y CUATRO LEMPIRAS CON 56/100 CENTAVOS',
            (new AmountToSpanishWords)->forCents(123456)
        );
    }
}
