<?php

namespace Tests\Feature;

use App\Models\FiscalSequence;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class FiscalSequenceTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_create_valid_fiscal_sequence(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);

        $admin = User::factory()->create();
        $admin->assignRole('admin');

        $this->actingAs($admin)
            ->postJson('/api/fiscal-sequences', $this->validPayload())
            ->assertCreated()
            ->assertJsonPath('data.document_type', 'invoice')
            ->assertJsonPath('data.prefix', '000-001-01')
            ->assertJsonPath('data.active', true);

        $this->assertDatabaseHas('fiscal_sequences', [
            'document_type' => 'invoice',
            'prefix' => '000-001-01',
            'cai' => 'TEST-CAI',
            'created_by' => $admin->id,
        ]);
        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $admin->id,
            'action' => 'fiscal_sequence.created',
            'entity_type' => 'App\\Models\\FiscalSequence',
        ]);
    }

    public function test_fiscal_sequence_index_requires_view_permission(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $supervisor = User::factory()->create();
        $supervisor->assignRole('supervisor');
        $cashier = User::factory()->create();
        $cashier->assignRole('cajero');

        FiscalSequence::query()->create($this->validPayload());

        $this->actingAs($supervisor)
            ->getJson('/api/fiscal-sequences')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.document_type', 'invoice');

        $this->actingAs($cashier)
            ->getJson('/api/fiscal-sequences')
            ->assertForbidden();
    }

    public function test_rejects_invalid_sequence_range(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $admin = $this->admin();

        $this->actingAs($admin)
            ->postJson('/api/fiscal-sequences', [
                ...$this->validPayload(),
                'min_number' => 100,
                'max_number' => 99,
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('max_number');
    }

    public function test_rejects_expired_valid_until_date(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $admin = $this->admin();

        $this->actingAs($admin)
            ->postJson('/api/fiscal-sequences', [
                ...$this->validPayload(),
                'valid_until' => now()->subDay()->toDateString(),
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('valid_until');
    }

    public function test_rejects_empty_cai(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $admin = $this->admin();

        $this->actingAs($admin)
            ->postJson('/api/fiscal-sequences', [
                ...$this->validPayload(),
                'cai' => '',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('cai');
    }

    public function test_rejects_max_number_lower_than_min_number(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $admin = $this->admin();

        $this->actingAs($admin)
            ->postJson('/api/fiscal-sequences', [
                ...$this->validPayload(),
                'min_number' => 2,
                'max_number' => 1,
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('max_number');
    }

    public function test_rejects_lowering_current_number(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $admin = $this->admin();

        $sequence = FiscalSequence::query()->create([
            ...$this->validPayload(),
            'current_number' => 10,
        ]);

        $this->actingAs($admin)
            ->patchJson("/api/fiscal-sequences/{$sequence->id}", [
                'current_number' => 9,
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('current_number');
    }

    public function test_rejects_current_number_that_leaves_next_number_outside_range(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $admin = $this->admin();

        $this->actingAs($admin)
            ->postJson('/api/fiscal-sequences', [
                ...$this->validPayload(),
                'min_number' => 100,
                'max_number' => 99999999,
                'current_number' => 0,
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('current_number');
    }

    public function test_rejects_multiple_active_invoice_sequences(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $admin = $this->admin();

        FiscalSequence::query()->create([
            ...$this->validPayload(),
            'active' => true,
        ]);

        $this->actingAs($admin)
            ->postJson('/api/fiscal-sequences', [
                ...$this->validPayload(),
                'prefix' => '000-002-01',
                'cai' => 'SECOND-CAI',
                'active' => true,
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('active');
    }

    public function test_admin_update_of_fiscal_sequence_is_audited(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $admin = $this->admin();

        $sequence = FiscalSequence::query()->create([
            ...$this->validPayload(),
            'active' => false,
        ]);

        $this->actingAs($admin)
            ->patchJson("/api/fiscal-sequences/{$sequence->id}", [
                'max_number' => 88888888,
            ])
            ->assertOk()
            ->assertJsonPath('data.max_number', 88888888);

        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $admin->id,
            'action' => 'fiscal_sequence.updated',
            'entity_type' => 'App\\Models\\FiscalSequence',
            'entity_id' => $sequence->id,
        ]);
    }

    public function test_cashier_cannot_create_fiscal_sequence(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);

        $cashier = User::factory()->create();
        $cashier->assignRole('cajero');

        $this->actingAs($cashier)
            ->postJson('/api/fiscal-sequences', $this->validPayload())
            ->assertForbidden();
    }

    private function admin(): User
    {
        $admin = User::factory()->create();
        $admin->assignRole('admin');

        return $admin;
    }

    /**
     * @return array<string, mixed>
     */
    private function validPayload(): array
    {
        return [
            'document_type' => 'invoice',
            'prefix' => '000-001-01',
            'min_number' => 1,
            'max_number' => 99999999,
            'current_number' => 0,
            'cai' => 'TEST-CAI',
            'valid_until' => now()->addYear()->toDateString(),
            'active' => true,
        ];
    }
}
