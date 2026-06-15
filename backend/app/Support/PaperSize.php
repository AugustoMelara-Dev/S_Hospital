<?php

namespace App\Support;

use App\Models\ReceiptPrintProfile;
use InvalidArgumentException;

class PaperSize
{
    private const POINTS_PER_MM = 72 / 25.4;

    /**
     * @param  array{paper_kind?: string|null, width_mm?: mixed, height_mm?: mixed}  $profile
     * @return array{0: int, 1: int, 2: float, 3: float}
     */
    public static function fromProfileSnapshot(array $profile): array
    {
        $paperKind = (string) ($profile['paper_kind'] ?? '');

        return match ($paperKind) {
            'custom_mm' => [
                0,
                0,
                self::mmToPoints((float) ($profile['width_mm'] ?? 0)),
                self::mmToPoints((float) ($profile['height_mm'] ?? 0)),
            ],
            'half_letter_landscape' => [0, 0, 612, 396],
            'a5_landscape' => [0, 0, 595.28, 419.53],
            'letter_landscape' => [0, 0, 792, 612],
            'thermal_80mm', 'thermal_58mm' => [
                0,
                0,
                self::mmToPoints((float) ($profile['width_mm'] ?? 0)),
                self::mmToPoints((float) ($profile['height_mm'] ?? 0)),
            ],
            default => throw new InvalidArgumentException("Unsupported institutional receipt paper kind [{$paperKind}]."),
        };
    }

    /**
     * @return array{0: int, 1: int, 2: float, 3: float}
     */
    public static function fromProfile(ReceiptPrintProfile $profile): array
    {
        return self::fromProfileSnapshot([
            'paper_kind' => $profile->paper_kind,
            'width_mm' => $profile->width_mm,
            'height_mm' => $profile->height_mm,
        ]);
    }

    private static function mmToPoints(float $mm): float
    {
        if ($mm <= 0) {
            throw new InvalidArgumentException('Custom institutional receipt paper dimensions must be positive.');
        }

        return $mm * self::POINTS_PER_MM;
    }
}
