<?php

namespace Tests\Unit;

use App\Support\PaperSize;
use InvalidArgumentException;
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
