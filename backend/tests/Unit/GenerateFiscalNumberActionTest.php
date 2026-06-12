<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Actions\Billing\GenerateFiscalNumberAction;
use App\Models\FiscalSequence;
use Illuminate\Database\QueryException;
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
        try {
            app(GenerateFiscalNumberAction::class)->execute();
            $this->fail('Expected fiscal sequence validation to fail.');
        } catch (ValidationException $exception) {
            $this->assertSame(
                'No existe una secuencia fiscal activa para facturas.',
                $exception->errors()['fiscal_sequence'][0] ?? null,
            );
        }
    }

    public function test_prefers_specific_active_invoice_sequence_over_legacy_active_null_marker(): void
    {
        $specific = FiscalSequence::query()->create($this->sequenceAttributes(prefix: '000-001-01', currentNumber: 10));

        // Simulates a pre-active_document_type row that is still marked
        // active=true but has not been repaired by the model event yet.
        // A canonical active_document_type='invoice' row must win.
        \DB::table('fiscal_sequences')->insert(
            $this->sequenceAttributes(prefix: '000-002-01', currentNumber: 88),
        );

        $result = app(GenerateFiscalNumberAction::class)->execute();

        $this->assertSame($specific->id, $result['sequence']->id);
        $this->assertSame(11, $result['next_number']);
        $this->assertDatabaseHas('fiscal_sequences', [
            'id' => $specific->id,
            'current_number' => 11,
            'active_document_type' => 'invoice',
        ]);
        $this->assertDatabaseHas('fiscal_sequences', [
            'prefix' => '000-002-01',
            'current_number' => 88,
            'active' => true,
            'active_document_type' => null,
        ]);
    }

    public function test_uses_single_legacy_active_null_marker_when_no_specific_sequence_exists(): void
    {
        \DB::table('fiscal_sequences')->insert(
            $this->sequenceAttributes(prefix: '000-002-01', currentNumber: 88),
        );

        $result = app(GenerateFiscalNumberAction::class)->execute();

        $this->assertSame(89, $result['next_number']);
        $this->assertSame('000-002-01-00000089', $result['invoice_number']);
        $this->assertDatabaseHas('fiscal_sequences', [
            'prefix' => '000-002-01',
            'current_number' => 89,
            'active_document_type' => 'invoice',
        ]);
    }

    public function test_throws_when_multiple_legacy_active_sequences_are_ambiguous(): void
    {
        \DB::table('fiscal_sequences')->insert([
            $this->sequenceAttributes(prefix: '000-001-01'),
            $this->sequenceAttributes(prefix: '000-002-01'),
        ]);

        try {
            app(GenerateFiscalNumberAction::class)->execute();
            $this->fail('Expected ambiguous fiscal sequence validation to fail.');
        } catch (ValidationException $exception) {
            $this->assertSame(
                'Existe mas de una secuencia fiscal activa para facturas.',
                $exception->errors()['fiscal_sequence'][0] ?? null,
            );
        }
    }

    public function test_db_unique_constraint_blocks_two_active_sequences_of_the_same_type(): void
    {
        // Verifies the schema-level invariant: two simultaneously-active
        // FiscalSequence rows for document_type='invoice' must be impossible.
        // This is the safety net behind GenerateFiscalNumberAction's app-level
        // guard. The application-level validation in StoreFiscalSequenceRequest
        // already prevents this, but the DB constraint catches direct INSERTs
        // and concurrent admin activations.
        FiscalSequence::query()->create($this->sequenceAttributes(prefix: '000-001-01'));

        $this->expectException(QueryException::class);
        FiscalSequence::query()->create($this->sequenceAttributes(prefix: '000-002-01'));
    }

    public function test_multiple_inactive_sequences_are_allowed(): void
    {
        // Inactive rows have active_document_type=NULL, which MySQL/MariaDB
        // permit any number of in a unique index. Verify that you can have
        // a library of historical sequences without hitting the unique
        // constraint.
        FiscalSequence::query()->create($this->sequenceAttributes(prefix: '000-001-01', active: false));
        FiscalSequence::query()->create($this->sequenceAttributes(prefix: '000-002-01', active: false));
        FiscalSequence::query()->create($this->sequenceAttributes(prefix: '000-003-01', active: false));

        $this->assertSame(3, FiscalSequence::query()->where('active', false)->count());
        $this->assertSame(0, FiscalSequence::query()->where('active', true)->count());
    }

    public function test_activating_a_sequence_deactivates_others_via_unique_constraint(): void
    {
        // The saving() event on the model writes active_document_type=document_type
        // when active=true. The DB unique index on that column enforces that
        // only one row per document_type can be active. This test confirms
        // the deactivate-then-activate flow works without a manual
        // "unset previous active" step in the application.
        $first = FiscalSequence::query()->create($this->sequenceAttributes(prefix: '000-001-01', active: false));
        $second = FiscalSequence::query()->create($this->sequenceAttributes(prefix: '000-002-01', active: false));

        // Activate first: should succeed.
        $first->active = true;
        $first->save();
        $this->assertSame('invoice', $first->fresh()->active_document_type);

        // Try to activate second while first is still active: should fail.
        $second->active = true;
        $caught = false;
        try {
            $second->save();
        } catch (QueryException) {
            $caught = true;
        }
        $this->assertTrue($caught, 'Expected the unique constraint to block concurrent activations.');

        // Deactivate first, then activate second: should succeed.
        $first->active = false;
        $first->save();
        $second->active = true;
        $second->save();
        $this->assertSame('invoice', $second->fresh()->active_document_type);
        $this->assertNull($first->fresh()->active_document_type);
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
        bool $active = true,
    ): array {
        return [
            'document_type' => 'invoice',
            'prefix' => $prefix,
            'min_number' => $minNumber,
            'max_number' => $maxNumber,
            'current_number' => $currentNumber,
            'cai' => $cai,
            'valid_until' => now()->addYear()->toDateString(),
            'active' => $active,
        ];
    }
}
