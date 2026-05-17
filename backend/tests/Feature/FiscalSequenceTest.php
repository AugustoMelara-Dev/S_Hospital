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
