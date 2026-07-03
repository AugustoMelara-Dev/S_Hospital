<?php

namespace Tests\Feature;

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
}
