<?php

namespace Tests\Feature;

use App\Models\FiscalSequence;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class UpdateFiscalSequenceReasonTest extends TestCase
{
    use RefreshDatabase;

    public function test_changing_current_number_without_reset_permission_or_reason_returns_422(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $user = User::factory()->create();
        $user->givePermissionTo('settings.fiscal.update');

        $this->assertTrue($user->can('settings.fiscal.update'));
        $this->assertFalse($user->can('fiscal.sequences.reset'));

        $sequence = FiscalSequence::query()->create([
            'document_type' => 'invoice',
            'prefix' => 'A',
            'min_number' => 1,
            'max_number' => 1000,
            'current_number' => 5,
            'cai' => 'CAI-XYZ',
            'valid_until' => now()->addYear(),
            'active' => true,
            'created_by' => $user->id,
            'updated_by' => $user->id,
        ]);

        $this->actingAs($user)
            ->patchJson("/api/fiscal-sequences/{$sequence->id}", [
                'current_number' => 6,
            ])
            ->assertStatus(422)
            ->assertJsonPath('errors.reason.0', fn ($message) => is_string($message) && $message !== '');
    }

    public function test_changing_cai_with_documented_reason_succeeds_and_audits(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $user = User::factory()->create();
        $user->givePermissionTo('settings.fiscal.update');

        $sequence = FiscalSequence::query()->create([
            'document_type' => 'invoice',
            'prefix' => 'A',
            'min_number' => 1,
            'max_number' => 1000,
            'current_number' => 0,
            'cai' => 'CAI-OLD',
            'valid_until' => now()->addYear(),
            'active' => true,
            'created_by' => $user->id,
            'updated_by' => $user->id,
        ]);

        $this->actingAs($user)
            ->patchJson("/api/fiscal-sequences/{$sequence->id}", [
                'cai' => 'CAI-NEW',
                'reason' => 'Renovacion anual documentada segun resolucion SAR 2026-04.',
            ])
            ->assertOk();

        $this->assertSame('CAI-NEW', $sequence->fresh()->cai);

        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $user->id,
            'action' => 'fiscal_sequence.updated',
            'entity_type' => FiscalSequence::class,
            'entity_id' => $sequence->id,
            'result' => 'success',
        ]);

        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $user->id,
            'action' => 'fiscal_sequence.changed_with_reason',
            'entity_type' => FiscalSequence::class,
            'entity_id' => $sequence->id,
            'result' => 'success',
        ]);
    }
}
