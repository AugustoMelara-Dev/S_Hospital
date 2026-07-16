<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\CashRegisterSession;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CloseCashSessionDifferenceTest extends TestCase
{
    use RefreshDatabase;

    public function test_closing_cash_session_without_notes_when_diff_is_nonzero_returns_422(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $cashier = User::factory()->create();
        $cashier->assignRole('cajero');

        $session = CashRegisterSession::query()->create([
            'user_id' => $cashier->id,
            'open_user_id' => $cashier->id,
            'opening_amount' => '100.00',
            'status' => CashRegisterSession::STATUS_OPEN,
            'opened_at' => now(),
        ]);

        $this->actingAs($cashier)
            ->postJson("/api/cash-sessions/{$session->id}/close", [
                'closing_amount' => '105.00',
            ])
            ->assertStatus(422)
            ->assertJsonPath('errors.notes.0', fn ($message) => is_string($message) && $message !== '');
    }

    public function test_closing_cash_session_with_short_notes_when_diff_is_nonzero_returns_422(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $cashier = User::factory()->create();
        $cashier->assignRole('cajero');

        $session = CashRegisterSession::query()->create([
            'user_id' => $cashier->id,
            'open_user_id' => $cashier->id,
            'opening_amount' => '100.00',
            'status' => CashRegisterSession::STATUS_OPEN,
            'opened_at' => now(),
        ]);

        $this->actingAs($cashier)
            ->postJson("/api/cash-sessions/{$session->id}/close", [
                'closing_amount' => '105.00',
                'notes' => 'x',
            ])
            ->assertStatus(422)
            ->assertJsonPath('errors.notes.0', fn ($message) => is_string($message) && str_contains($message, '5'));

        $this->assertSame(CashRegisterSession::STATUS_OPEN, $session->fresh()->status);
    }

    public function test_closing_cash_session_with_notes_when_diff_is_nonzero_succeeds_and_audits(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $cashier = User::factory()->create();
        $cashier->assignRole('cajero');

        $session = CashRegisterSession::query()->create([
            'user_id' => $cashier->id,
            'open_user_id' => $cashier->id,
            'opening_amount' => '100.00',
            'status' => CashRegisterSession::STATUS_OPEN,
            'opened_at' => now(),
        ]);

        $this->actingAs($cashier)
            ->postJson("/api/cash-sessions/{$session->id}/close", [
                'closing_amount' => '105.00',
                'notes' => 'Diferencia por vuelto en factura #1234 entregado a paciente con moneda de mas.',
            ])
            ->assertOk();

        $session->refresh();
        $this->assertSame(CashRegisterSession::STATUS_CLOSED, $session->status);
        $this->assertSame('5.00', $session->difference_amount);
        $this->assertNotNull($session->closing_notes);

        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $cashier->id,
            'action' => 'cash_session.closed',
            'entity_type' => CashRegisterSession::class,
            'entity_id' => $session->id,
            'result' => 'success',
        ]);

        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $cashier->id,
            'action' => 'cash_session.difference',
            'entity_type' => CashRegisterSession::class,
            'entity_id' => $session->id,
            'result' => 'success',
        ]);
    }

    public function test_closing_cash_session_rejects_a_denomination_breakdown_that_does_not_match_the_counted_amount(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $cashier = User::factory()->create();
        $cashier->assignRole('cajero');

        $session = CashRegisterSession::query()->create([
            'user_id' => $cashier->id,
            'open_user_id' => $cashier->id,
            'opening_amount' => '100.00',
            'status' => CashRegisterSession::STATUS_OPEN,
            'opened_at' => now(),
        ]);

        $this->actingAs($cashier)
            ->postJson("/api/cash-sessions/{$session->id}/close", [
                'closing_amount' => '100.00',
                'closing_breakdown' => [
                    'bills' => ['50' => 1],
                    'other_amount' => '0.00',
                ],
            ])
            ->assertStatus(422)
            ->assertJsonPath('errors.closing_breakdown.0', fn ($message) => is_string($message) && str_contains($message, 'monto contado'));

        $this->assertSame(CashRegisterSession::STATUS_OPEN, $session->fresh()->status);
    }

    public function test_closing_cash_session_persists_and_audits_the_matching_denomination_breakdown(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $cashier = User::factory()->create();
        $cashier->assignRole('cajero');

        $session = CashRegisterSession::query()->create([
            'user_id' => $cashier->id,
            'open_user_id' => $cashier->id,
            'opening_amount' => '125.50',
            'status' => CashRegisterSession::STATUS_OPEN,
            'opened_at' => now(),
        ]);

        $breakdown = [
            'bills' => [
                '500' => 0,
                '200' => 0,
                '100' => 0,
                '50' => 2,
                '20' => 1,
                '10' => 0,
                '5' => 0,
                '2' => 0,
                '1' => 0,
            ],
            'other_amount' => '5.50',
        ];

        $this->actingAs($cashier)
            ->postJson("/api/cash-sessions/{$session->id}/close", [
                'closing_amount' => '125.50',
                'closing_breakdown' => $breakdown,
            ])
            ->assertOk()
            ->assertJsonPath('data.closing_breakdown', $breakdown);

        $session->refresh();
        $this->assertSame($breakdown, $session->closing_breakdown);

        $audit = AuditLog::query()
            ->where('action', 'cash_session.closed')
            ->where('entity_id', $session->id)
            ->firstOrFail();

        $this->assertSame($breakdown, $audit->new_values['closing_breakdown'] ?? null);
    }
}
