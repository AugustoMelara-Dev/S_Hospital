<?php

namespace App\Support;

use App\Models\ReceiptPrintProfile;
use InvalidArgumentException;

class PaperSize
{
    private const POINTS_PER_MM = 72 / 25.4;

    private const CUSTOM_WIDTH_MIN_MM = 80;

    private const CUSTOM_WIDTH_MAX_MM = 300;

    private const CUSTOM_HEIGHT_MIN_MM = 50;

    /**
     * Upper bound raised from 220 mm to 320 mm (2026-09-17, mandate §12) so the
     * configurable custom profile can express the portrait formats: carta vertical
     * 279.4 mm and A4 297 mm. The `paper_kind` enum now also admits the native
     * `letter_portrait` / `a4_portrait` values (hs-db M-W2-DB-02), and both paths
     * share the same mm->pt conversion.
     */
    private const CUSTOM_HEIGHT_MAX_MM = 320;

    /**
     * @param  array<string, mixed>  $profile
     * @return array{0: int, 1: int, 2: float, 3: float}
     */
    public static function fromProfileSnapshot(array $profile): array
    {
        $paperKind = $profile['paper_kind'] ?? null;
        if (! is_string($paperKind)) {
            throw new InvalidArgumentException('Institutional receipt paper kind must be a string.');
        }

        return match ($paperKind) {
            'custom_mm' => self::customPaper(
                self::dimension($profile, 'width_mm'),
                self::dimension($profile, 'height_mm'),
            ),
            'half_letter_landscape' => [0, 0, 612, 396],
            'a5_landscape' => [0, 0, 595.28, 419.53],
            'letter_landscape' => [0, 0, 792, 612],
            // Proposed principal institutional design (§12). Letter portrait is
            // exactly 215.9 x 279.4 mm; A4 portrait is 210 x 297 mm and is NOT a
            // synonym of letter, media carta or A5. Both native kinds and the
            // equivalent `custom_mm` geometry use the same mm->point conversion
            // (portraitPaper vs customPaper), so there is a single geometry source.
            'letter_portrait' => self::portraitPaper(215.90, 279.40),
            'a4_portrait' => self::portraitPaper(210.00, 297.00),
            'thermal_80mm', 'thermal_58mm' => [
                0,
                0,
                self::mmToPoints(self::dimension($profile, 'width_mm')),
                self::mmToPoints(self::dimension($profile, 'height_mm')),
            ],
            default => throw new InvalidArgumentException("Unsupported institutional receipt paper kind [{$paperKind}]."),
        };
    }

    /**
     * @param  array<string, mixed>  $profile
     */
    private static function dimension(array $profile, string $field): float
    {
        $value = $profile[$field] ?? null;
        if ((! is_int($value) && ! is_float($value) && ! is_string($value)) || ! is_numeric($value)) {
            throw new InvalidArgumentException("Institutional receipt paper {$field} must be numeric.");
        }

        return (float) $value;
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

    /**
     * Native portrait kinds share this single mm->pt conversion with `custom_mm`
     * equivalents, so `letter_portrait` and a `custom_mm` 215.90 x 279.40 profile
     * resolve to identical points (no silent double source of truth).
     *
     * @return array{0: int, 1: int, 2: float, 3: float}
     */
    private static function portraitPaper(float $widthMm, float $heightMm): array
    {
        return [0, 0, self::mmToPoints($widthMm), self::mmToPoints($heightMm)];
    }

    /**
     * @return array{0: int, 1: int, 2: float, 3: float}
     */
    private static function customPaper(float $widthMm, float $heightMm): array
    {
        if ($widthMm < self::CUSTOM_WIDTH_MIN_MM || $widthMm > self::CUSTOM_WIDTH_MAX_MM) {
            throw new InvalidArgumentException('Custom institutional receipt paper width must be between 80 mm and 300 mm.');
        }

        if ($heightMm < self::CUSTOM_HEIGHT_MIN_MM || $heightMm > self::CUSTOM_HEIGHT_MAX_MM) {
            throw new InvalidArgumentException('Custom institutional receipt paper height must be between 50 mm and 320 mm.');
        }

        return [0, 0, self::mmToPoints($widthMm), self::mmToPoints($heightMm)];
    }
}
