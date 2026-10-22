<?php

namespace Tests\Unit;

use App\Support\PaperSize;
use InvalidArgumentException;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

class ReceiptPaperProfileTest extends TestCase
{
    public function test_custom_mm_profile_converts_to_pdf_points(): void
    {
        $paper = PaperSize::fromProfileSnapshot([
            'paper_kind' => 'custom_mm',
            'width_mm' => '180.00',
            'height_mm' => '95.00',
        ]);

        $this->assertSame([0, 0], array_slice($paper, 0, 2));
        $this->assertEqualsWithDelta(510.2362204724, $paper[2], 0.000001);
        $this->assertEqualsWithDelta(269.2913385827, $paper[3], 0.000001);
    }

    #[DataProvider('invalidCustomDimensions')]
    public function test_custom_mm_profile_rejects_dimensions_outside_the_supported_contract(
        string $width,
        string $height,
    ): void {
        $this->expectException(InvalidArgumentException::class);

        PaperSize::fromProfileSnapshot([
            'paper_kind' => 'custom_mm',
            'width_mm' => $width,
            'height_mm' => $height,
        ]);
    }

    /**
     * @return iterable<string, array{string, string}>
     */
    public static function invalidCustomDimensions(): iterable
    {
        yield 'width below 80mm' => ['79.99', '95.00'];
        yield 'width above 300mm' => ['300.01', '95.00'];
        yield 'height below 50mm' => ['180.00', '49.99'];
        // Contract extended from 220 mm to 320 mm (2026-09-17, mandate §12) so the
        // custom profile can express carta vertical (279.4 mm) and A4 (297 mm).
        yield 'height above 320mm' => ['180.00', '320.01'];
    }

    public function test_standard_profiles_use_exact_pdf_points(): void
    {
        $this->assertSame([0, 0, 612, 396], PaperSize::fromProfileSnapshot([
            'paper_kind' => 'half_letter_landscape',
        ]));
        $this->assertSame([0, 0, 595.28, 419.53], PaperSize::fromProfileSnapshot([
            'paper_kind' => 'a5_landscape',
        ]));
        $this->assertSame([0, 0, 792, 612], PaperSize::fromProfileSnapshot([
            'paper_kind' => 'letter_landscape',
        ]));
        // Proposed principal portrait design (§12): 612 x 792 pt.
        $letterPortrait = PaperSize::fromProfileSnapshot([
            'paper_kind' => 'letter_portrait',
        ]);
        $this->assertSame([0, 0], array_slice($letterPortrait, 0, 2));
        $this->assertEqualsWithDelta(612, $letterPortrait[2], 0.000001);
        $this->assertEqualsWithDelta(792, $letterPortrait[3], 0.000001);

        // A4 portrait: 210 x 297 mm => 595.28 x 841.89 pt.
        $a4Portrait = PaperSize::fromProfileSnapshot([
            'paper_kind' => 'a4_portrait',
        ]);
        $this->assertEqualsWithDelta(595.28, $a4Portrait[2], 0.01);
        $this->assertEqualsWithDelta(841.89, $a4Portrait[3], 0.01);
    }

    public function test_native_portrait_kinds_and_custom_mm_share_one_geometry_source(): void
    {
        // The native kinds and the equivalent custom_mm geometry must resolve to
        // exactly the same points; otherwise the seeder and PaperSize would be a
        // silent double source of truth.
        $pairs = [
            'letter_portrait' => ['paper_kind' => 'custom_mm', 'width_mm' => '215.90', 'height_mm' => '279.40'],
            'a4_portrait' => ['paper_kind' => 'custom_mm', 'width_mm' => '210.00', 'height_mm' => '297.00'],
        ];

        foreach ($pairs as $nativeKind => $customProfile) {
            $native = PaperSize::fromProfileSnapshot(['paper_kind' => $nativeKind]);
            $custom = PaperSize::fromProfileSnapshot($customProfile);

            $this->assertSame($custom, $native, "{$nativeKind} must resolve exactly like its custom_mm geometry");
        }
    }

    public function test_letter_portrait_and_a4_landscape_are_distinct_and_not_landscape(): void
    {
        $letterPortrait = PaperSize::fromProfileSnapshot(['paper_kind' => 'letter_portrait']);
        $a4Portrait = PaperSize::fromProfileSnapshot(['paper_kind' => 'a4_portrait']);

        // Carta vertical must differ from carta horizontal and from media carta.
        $this->assertNotSame(PaperSize::fromProfileSnapshot(['paper_kind' => 'letter_landscape']), $letterPortrait);
        $this->assertNotSame(PaperSize::fromProfileSnapshot(['paper_kind' => 'half_letter_landscape']), $letterPortrait);
        // A4 is not a synonym of letter or A5.
        $this->assertNotSame($letterPortrait, $a4Portrait);
        $this->assertNotSame(PaperSize::fromProfileSnapshot(['paper_kind' => 'a5_landscape']), $a4Portrait);
        $this->assertEqualsWithDelta(612, $letterPortrait[2], 0.000001);
        $this->assertEqualsWithDelta(792, $letterPortrait[3], 0.000001);
        $this->assertEqualsWithDelta(595.28, $a4Portrait[2], 0.01);
        $this->assertEqualsWithDelta(841.89, $a4Portrait[3], 0.01);
    }

    public function test_half_letter_and_a5_landscape_are_distinct_paper_sizes(): void
    {
        $halfLetter = PaperSize::fromProfileSnapshot(['paper_kind' => 'half_letter_landscape']);
        $a5 = PaperSize::fromProfileSnapshot(['paper_kind' => 'a5_landscape']);
        $pointsPerMm = 72 / 25.4;

        // Media carta apaisada: 215.9 x 139.7 mm => 612 x 396 pt.
        $this->assertSame([0, 0, 612, 396], $halfLetter);
        $this->assertEqualsWithDelta(215.9, $halfLetter[2] / $pointsPerMm, 0.000001);
        $this->assertEqualsWithDelta(139.7, $halfLetter[3] / $pointsPerMm, 0.000001);

        // A5 apaisado: 210 x 148 mm => 595.28 x 419.53 pt (rounded to 0.01 pt).
        $this->assertSame([0, 0, 595.28, 419.53], $a5);
        $this->assertEqualsWithDelta(210.0, $a5[2] / $pointsPerMm, 0.002);
        $this->assertEqualsWithDelta(148.0, $a5[3] / $pointsPerMm, 0.002);

        // They must never be treated as interchangeable.
        $this->assertNotSame($halfLetter, $a5);
        $this->assertNotEqualsWithDelta($halfLetter[2], $a5[2], 1.0);
        $this->assertNotEqualsWithDelta($halfLetter[3], $a5[3], 1.0);
    }

    public function test_custom_mm_dimensions_accept_the_exact_contract_boundaries(): void
    {
        $pointsPerMm = 72 / 25.4;

        $minimum = PaperSize::fromProfileSnapshot([
            'paper_kind' => 'custom_mm',
            'width_mm' => '80.00',
            'height_mm' => '50.00',
        ]);
        $maximum = PaperSize::fromProfileSnapshot([
            'paper_kind' => 'custom_mm',
            'width_mm' => '300.00',
            'height_mm' => '320.00',
        ]);

        $this->assertEqualsWithDelta(80 * $pointsPerMm, $minimum[2], 0.000001);
        $this->assertEqualsWithDelta(50 * $pointsPerMm, $minimum[3], 0.000001);
        $this->assertEqualsWithDelta(300 * $pointsPerMm, $maximum[2], 0.000001);
        $this->assertEqualsWithDelta(320 * $pointsPerMm, $maximum[3], 0.000001);
    }

    public function test_custom_mm_profile_carries_the_exact_portrait_geometry(): void
    {
        $letterPortrait = PaperSize::fromProfileSnapshot([
            'paper_kind' => 'custom_mm',
            'width_mm' => '215.90',
            'height_mm' => '279.40',
        ]);
        $a4Portrait = PaperSize::fromProfileSnapshot([
            'paper_kind' => 'custom_mm',
            'width_mm' => '210.00',
            'height_mm' => '297.00',
        ]);

        // The seeder's exact portrait geometry, expressed as custom_mm, must match
        // the native letter_portrait / a4_portrait conversion (see the parity test).
        $this->assertEqualsWithDelta(612, $letterPortrait[2], 0.000001);
        $this->assertEqualsWithDelta(792, $letterPortrait[3], 0.000001);
        $this->assertEqualsWithDelta(595.2755905512, $a4Portrait[2], 0.000001);
        $this->assertEqualsWithDelta(841.8897637795, $a4Portrait[3], 0.000001);
    }

    public function test_optional_thermal_profiles_convert_from_configured_dimensions(): void
    {
        $paper80 = PaperSize::fromProfileSnapshot([
            'paper_kind' => 'thermal_80mm',
            'width_mm' => '80.00',
            'height_mm' => '200.00',
        ]);
        $paper58 = PaperSize::fromProfileSnapshot([
            'paper_kind' => 'thermal_58mm',
            'width_mm' => '58.00',
            'height_mm' => '200.00',
        ]);

        $this->assertEqualsWithDelta(226.7716535433, $paper80[2], 0.000001);
        $this->assertEqualsWithDelta(164.4094488189, $paper58[2], 0.000001);
        $this->assertEqualsWithDelta(566.9291338583, $paper80[3], 0.000001);
        $this->assertEqualsWithDelta(566.9291338583, $paper58[3], 0.000001);
    }

    public function test_unsupported_profile_kind_is_rejected(): void
    {
        $this->expectException(InvalidArgumentException::class);

        PaperSize::fromProfileSnapshot([
            'paper_kind' => 'unknown_profile',
        ]);
    }
}
