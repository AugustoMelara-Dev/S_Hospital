<?php

namespace Tests\Unit;

use App\Support\ExcelSafe;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

class ExcelSafeTest extends TestCase
{
    #[DataProvider('dangerousFormulaPrefixes')]
    public function test_dangerous_excel_formula_prefixes_are_quoted(string $value): void
    {
        $this->assertSame("'".$value, ExcelSafe::value($value));
    }

    public function test_safe_strings_and_non_strings_are_preserved(): void
    {
        $this->assertSame('Paciente Maria', ExcelSafe::value('Paciente Maria'));
        $this->assertSame('', ExcelSafe::value(''));
        $this->assertSame(1250, ExcelSafe::value(1250));
    }

    /**
     * @return array<string, array{0: string}>
     */
    public static function dangerousFormulaPrefixes(): array
    {
        return [
            'equals' => ['=HYPERLINK("http://example.invalid")'],
            'plus' => ['+SUM(1,1)'],
            'minus' => ['-10+20'],
            'at' => ['@SUM(1,1)'],
            'tab' => ["\t=cmd"],
            'carriage-return' => ["\r=cmd"],
            'line-feed' => ["\n=cmd"],
        ];
    }
}
