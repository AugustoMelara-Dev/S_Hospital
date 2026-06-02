<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Actions\Billing\GenerateFiscalNumberAction;
use App\Models\FiscalSequence;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class GenerateFiscalNumberActionTest extends TestCase
{
    use RefreshDatabase;

    public function test_emits_the_next_correlative_inside_the_range(): void
    {
        FiscalSequence::query()->create($this->sequenceAttributes(currentNumber: 41));

        $result = app(GenerateFiscalNumberAction::class)->execute();

        $this->assertSame(42, $result['next_number']);
        $this->assertSame('000-001-01-00000042', $result['invoice_number']);
        $this->assertDatabaseHas('fiscal_sequences', [
            'prefix' => '000-001-01',
            'current_number' => 42,
        ]);
    }

    public function test_throws_when_there_is_no_active_sequence(): void
    {
        $this->expectException(ValidationException::class);

        app(GenerateFiscalNumberAction::class)->execute();
    }

    public function test_throws_when_there_is_more_than_one_active_sequence(): void
    {
        FiscalSequence::query()->create($this->sequenceAttributes(prefix: '000-001-01'));

        // Bypass the unique constraint to simulate the data corruption
        // that the action is meant to catch. The application must
        // refuse to emit a correlative rather than silently picking
        // one of the two sequences.
        \DB::table('fiscal_sequences')->insert(
            $this->sequenceAttributes(prefix: '000-002-01'),
        );

        $this->expectException(ValidationException::class);

        app(GenerateFiscalNumberAction::class)->execute();
    }

    public function test_throws_when_the_sequence_has_no_cai(): void
    {
        FiscalSequence::query()->create($this->sequenceAttributes(cai: ''));

        $this->expectException(ValidationException::class);

        app(GenerateFiscalNumberAction::class)->execute();
    }

    public function test_throws_when_the_sequence_is_already_out_of_range(): void
    {
        FiscalSequence::query()->create($this->sequenceAttributes(
            minNumber: 1,
            maxNumber: 5,
            currentNumber: 5,
        ));

        $this->expectException(ValidationException::class);

        app(GenerateFiscalNumberAction::class)->execute();
    }

    /**
     * @return array<string, mixed>
     */
    private function sequenceAttributes(
        string $prefix = '000-001-01',
        int $minNumber = 1,
        int $maxNumber = 99999999,
        int $currentNumber = 0,
        string $cai = 'TEST-CAI',
    ): array {
        return [
            'document_type' => 'invoice',
            'prefix' => $prefix,
            'min_number' => $minNumber,
            'max_number' => $maxNumber,
            'current_number' => $currentNumber,
            'cai' => $cai,
            'valid_until' => now()->addYear()->toDateString(),
            'active' => true,
        ];
    }
}
