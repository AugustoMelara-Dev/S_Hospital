<?php

declare(strict_types=1);

namespace App\Support;

class LempiraAmountWords
{
    /**
     * Convert a decimal money snapshot into the wording used by the
     * institutional receipt. The input is parsed through Money to keep
     * the same cents semantics as billing and payments.
     */
    public static function fromDecimal(string $amount): string
    {
        return self::fromCents(Money::parseCents($amount, 'amount'));
    }

    public static function fromCents(int $cents): string
    {
        $lempiras = intdiv($cents, 100);
        $centavos = $cents % 100;

        return self::numberToWords($lempiras).' '.($lempiras === 1 ? 'LEMPIRA' : 'LEMPIRAS')
            .' CON '
            .self::numberToWords($centavos).' '.($centavos === 1 ? 'CENTAVO' : 'CENTAVOS');
    }

    private static function numberToWords(int $number): string
    {
        if ($number === 0) {
            return 'CERO';
        }

        $parts = [];

        $millions = intdiv($number, 1000000);
        if ($millions > 0) {
            $parts[] = $millions === 1 ? 'UN MILLON' : self::numberToWords($millions).' MILLONES';
            $number %= 1000000;
        }

        $thousands = intdiv($number, 1000);
        if ($thousands > 0) {
            $parts[] = $thousands === 1 ? 'MIL' : self::belowThousandToWords($thousands).' MIL';
            $number %= 1000;
        }

        if ($number > 0) {
            $parts[] = self::belowThousandToWords($number);
        }

        return implode(' ', $parts);
    }

    private static function belowThousandToWords(int $number): string
    {
        $units = [
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
        ];

        if ($number < 30) {
            return $units[$number];
        }

        $hundreds = [
            1 => 'CIENTO',
            2 => 'DOSCIENTOS',
            3 => 'TRESCIENTOS',
            4 => 'CUATROCIENTOS',
            5 => 'QUINIENTOS',
            6 => 'SEISCIENTOS',
            7 => 'SETECIENTOS',
            8 => 'OCHOCIENTOS',
            9 => 'NOVECIENTOS',
        ];

        if ($number === 100) {
            return 'CIEN';
        }

        if ($number > 100) {
            $hundredsDigit = intdiv($number, 100);
            $remainder = $number % 100;

            return $hundreds[$hundredsDigit].($remainder > 0 ? ' '.self::belowHundredToWords($remainder) : '');
        }

        return self::belowHundredToWords($number);
    }

    private static function belowHundredToWords(int $number): string
    {
        $units = [
            1 => 'UN',
            2 => 'DOS',
            3 => 'TRES',
            4 => 'CUATRO',
            5 => 'CINCO',
            6 => 'SEIS',
            7 => 'SIETE',
            8 => 'OCHO',
            9 => 'NUEVE',
        ];
        $tens = [
            30 => 'TREINTA',
            40 => 'CUARENTA',
            50 => 'CINCUENTA',
            60 => 'SESENTA',
            70 => 'SETENTA',
            80 => 'OCHENTA',
            90 => 'NOVENTA',
        ];

        if ($number < 30) {
            return self::belowThousandToWords($number);
        }

        $ten = intdiv($number, 10) * 10;
        $unit = $number % 10;

        return $tens[$ten].($unit > 0 ? ' Y '.$units[$unit] : '');
    }
}
