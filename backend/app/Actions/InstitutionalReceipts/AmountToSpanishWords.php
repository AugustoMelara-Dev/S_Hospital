<?php

namespace App\Actions\InstitutionalReceipts;

class AmountToSpanishWords
{
    /**
     * Convert a lempira amount in cents to patient-facing Spanish wording.
     */
    public function forCents(int $amountCents): string
    {
        $absoluteCents = max(0, $amountCents);
        $lempiras = intdiv($absoluteCents, 100);
        $centavos = $absoluteCents % 100;

        $currency = $lempiras === 1 ? 'LEMPIRA' : 'LEMPIRAS';

        return sprintf(
            '%s %s CON %02d/100 CENTAVOS',
            $this->numberToWords($lempiras),
            $currency,
            $centavos
        );
    }

    private function numberToWords(int $number): string
    {
        if ($number === 0) {
            return 'CERO';
        }

        if ($number < 0) {
            return 'MENOS '.$this->numberToWords(abs($number));
        }

        if ($number < 30) {
            return [
                0 => 'CERO',
                1 => 'UN',
                2 => 'DOS',
                3 => 'TRES',
                4 => 'CUATRO',
                5 => 'CINCO',
                6 => 'SEIS',
                7 => 'SIETE',
                8 => 'OCHO',
                9 => 'NUEVE',
                10 => 'DIEZ',
                11 => 'ONCE',
                12 => 'DOCE',
                13 => 'TRECE',
                14 => 'CATORCE',
                15 => 'QUINCE',
                16 => 'DIECISEIS',
                17 => 'DIECISIETE',
                18 => 'DIECIOCHO',
                19 => 'DIECINUEVE',
                20 => 'VEINTE',
                21 => 'VEINTIUN',
                22 => 'VEINTIDOS',
                23 => 'VEINTITRES',
                24 => 'VEINTICUATRO',
                25 => 'VEINTICINCO',
                26 => 'VEINTISEIS',
                27 => 'VEINTISIETE',
                28 => 'VEINTIOCHO',
                29 => 'VEINTINUEVE',
            ][$number];
        }

        if ($number < 100) {
            $tens = intdiv($number, 10) * 10;
            $unit = $number % 10;
            $words = [
                30 => 'TREINTA',
                40 => 'CUARENTA',
                50 => 'CINCUENTA',
                60 => 'SESENTA',
                70 => 'SETENTA',
                80 => 'OCHENTA',
                90 => 'NOVENTA',
            ][$tens];

            return $unit === 0 ? $words : $words.' Y '.$this->numberToWords($unit);
        }

        if ($number < 1000) {
            if ($number === 100) {
                return 'CIEN';
            }

            $hundreds = intdiv($number, 100);
            $remainder = $number % 100;
            $words = [
                1 => 'CIENTO',
                2 => 'DOSCIENTOS',
                3 => 'TRESCIENTOS',
                4 => 'CUATROCIENTOS',
                5 => 'QUINIENTOS',
                6 => 'SEISCIENTOS',
                7 => 'SETECIENTOS',
                8 => 'OCHOCIENTOS',
                9 => 'NOVECIENTOS',
            ][$hundreds];

            return $remainder === 0 ? $words : $words.' '.$this->numberToWords($remainder);
        }

        if ($number < 1_000_000) {
            $thousands = intdiv($number, 1000);
            $remainder = $number % 1000;
            $words = $thousands === 1 ? 'MIL' : $this->numberToWords($thousands).' MIL';

            return $remainder === 0 ? $words : $words.' '.$this->numberToWords($remainder);
        }

        $millions = intdiv($number, 1_000_000);
        $remainder = $number % 1_000_000;
        $words = $millions === 1 ? 'UN MILLON' : $this->numberToWords($millions).' MILLONES';

        return $remainder === 0 ? $words : $words.' '.$this->numberToWords($remainder);
    }
}
