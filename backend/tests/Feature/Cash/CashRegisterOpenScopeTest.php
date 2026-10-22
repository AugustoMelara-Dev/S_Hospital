<?php

namespace Tests\Feature\Cash;

use App\Actions\Cash\OpenCashSessionAction;
use App\Models\CashRegister;
use App\Models\CashRegisterSession;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * M-W2-FIN-01 (mandato §7): apertura/cierre de caja acotados a la caja fisica.
 *
 * Verifica resolucion de la caja en el servidor (nunca se confia en el ID del
 * navegador), convivencia de dos cajas, bloqueo por caja, liberacion del slot al
 * cerrar y preservacion de `opened_at`. La contencion real entre procesos se
 * cubre en tests/Feature/Concurrent/CashSessionConcurrencyTest (MariaDB).
 */
class CashRegisterOpenScopeTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->withoutMiddleware(ThrottleRequests::class);
        $this->seed(RolesAndPermissionsSeeder::class);
    }

    public function test_open_without_register_uses_the_principal_register(): void
    {
        $cashier = $this->cashier();

        $response = $this->actingAs($cashier)
            ->postJson('/api/cash-sessions/open', ['opening_amount' => '100.00'])
            ->assertCreated();

        $principalId = $this->registerId('principal');

        $this->assertSame($principalId, (int) $response->json('data.cash_register_id'));
        $this->assertSame('principal', $response->json('data.cash_register.code'));

        $row = (array) DB::table('cash_register_sessions')->where('id', $response->json('data.id'))->first();
        $this->assertSame($principalId, (int) $row['cash_register_id']);
        $this->assertSame(1, (int) $row['open_marker']);
        $this->assertSame($cashier->id, (int) $row['open_user_id']);
    }

    public function test_open_returns_the_same_pending_work_contract_as_current_session(): void
    {
        $cashier = $this->cashier();

        $opened = $this->actingAs($cashier)
            ->postJson('/api/cash-sessions/open', ['opening_amount' => '100.00'])
            ->assertCreated();

        // H-04: a freshly opened session must already resolve "pending work" as
        // zero instead of leaving the UI with an unconfirmed state until the
        // next refetch of /cash-sessions/current.
        $opened->assertJsonPath('data.pending_invoice_count', 0);
        $opened->assertJsonPath('data.pending_amount', '0.00');

        $current = $this->actingAs($cashier)->getJson('/api/cash-sessions/current')->assertOk();

        $this->assertSame(0, $current->json('data.pending_invoice_count'));
        $this->assertSame('0.00', $current->json('data.pending_amount'));
        $this->assertSame($opened->json('data.id'), $current->json('data.id'));
    }

    public function test_cash_register_inventory_lists_only_active_real_registers(): void
    {
        $cashier = $this->cashier();
        $activeId = $this->registerId('ventanilla');
        CashRegister::query()->create([
            'code' => 'inactiva',
            'name' => 'Caja fuera de servicio',
            'active' => false,
        ]);

        $response = $this->actingAs($cashier)
            ->getJson('/api/cash-registers')
            ->assertOk()
            ->assertJsonStructure(['data' => [['id', 'code', 'name', 'active']]]);

        $registers = collect($response->json('data'));
        $this->assertTrue($registers->contains(fn (array $row): bool => (int) $row['id'] === $activeId));
        $this->assertTrue($registers->every(fn (array $row): bool => $row['active'] === true));
        $this->assertFalse($registers->contains(fn (array $row): bool => $row['code'] === 'inactiva'));
    }

    public function test_cash_register_inventory_requires_cash_permission(): void
    {
        $this->getJson('/api/cash-registers')->assertUnauthorized();

        $user = User::factory()->create();
        $this->actingAs($user)
            ->getJson('/api/cash-registers')
            ->assertForbidden();
    }

    public function test_open_with_explicit_active_register_is_accepted(): void
    {
        $registerId = $this->registerId('ventanilla');
        $cashier = $this->cashier();

        $this->actingAs($cashier)
            ->postJson('/api/cash-sessions/open', [
                'opening_amount' => '100.00',
                'cash_register_id' => $registerId,
            ])
            ->assertCreated()
            ->assertJsonPath('data.cash_register_id', $registerId)
            ->assertJsonPath('data.cash_register.code', 'ventanilla');
    }

    public function test_open_with_unknown_or_inactive_register_is_rejected(): void
    {
        $cashier = $this->cashier();

        $this->actingAs($cashier)
            ->postJson('/api/cash-sessions/open', [
                'opening_amount' => '100.00',
                'cash_register_id' => 999999,
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('cash_register_id');

        $inactive = CashRegister::query()->create([
            'code' => 'cerrada',
            'name' => 'Caja cerrada',
            'active' => false,
        ]);

        $this->actingAs($cashier)
            ->postJson('/api/cash-sessions/open', [
                'opening_amount' => '100.00',
                'cash_register_id' => $inactive->id,
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('cash_register_id');

        $this->assertSame(0, CashRegisterSession::query()->where('status', CashRegisterSession::STATUS_OPEN)->count());
    }

    public function test_two_users_can_open_distinct_registers_at_the_same_time(): void
    {
        $primary = $this->registerId('principal');
        $secondary = $this->registerId('ventanilla');

        $first = $this->cashier();
        $second = $this->cashier();

        $this->actingAs($first)
            ->postJson('/api/cash-sessions/open', ['opening_amount' => '100.00'])
            ->assertCreated()
            ->assertJsonPath('data.cash_register_id', $primary);

        $this->actingAs($second)
            ->postJson('/api/cash-sessions/open', [
                'opening_amount' => '50.00',
                'cash_register_id' => $secondary,
            ])
            ->assertCreated()
            ->assertJsonPath('data.cash_register_id', $secondary);

        $this->assertSame(2, CashRegisterSession::query()
            ->where('status', CashRegisterSession::STATUS_OPEN)
            ->where('open_marker', CashRegisterSession::OPEN_MARKER)
            ->count());
    }

    public function test_second_open_in_the_same_register_is_rejected_with_a_scoped_message(): void
    {
        $first = $this->cashier();
        $second = $this->cashier();

        $this->actingAs($first)
            ->postJson('/api/cash-sessions/open', ['opening_amount' => '100.00'])
            ->assertCreated();

        $response = $this->actingAs($second)
            ->postJson('/api/cash-sessions/open', ['opening_amount' => '100.00'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('cash_session');

        $this->assertStringContainsString('en esta caja', (string) $response->json('errors.cash_session.0'));
        $this->assertSame(1, CashRegisterSession::query()
            ->where('status', CashRegisterSession::STATUS_OPEN)
            ->count());
    }

    public function test_close_frees_the_register_slot_and_preserves_opened_at(): void
    {
        $cashier = $this->cashier();

        $sessionId = (int) $this->actingAs($cashier)
            ->postJson('/api/cash-sessions/open', ['opening_amount' => '0.00'])
            ->assertCreated()
            ->json('data.id');

        $openedAt = (string) DB::table('cash_register_sessions')->where('id', $sessionId)->value('opened_at');

        $this->actingAs($cashier)
            ->postJson("/api/cash-sessions/{$sessionId}/close", ['closing_amount' => '0.00'])
            ->assertOk()
            ->assertJsonPath('data.status', CashRegisterSession::STATUS_CLOSED);

        $row = (array) DB::table('cash_register_sessions')->where('id', $sessionId)->first();
        $this->assertNull($row['open_marker']);
        $this->assertNull($row['open_user_id']);
        $this->assertSame($openedAt, (string) $row['opened_at']);

        // El slot queda libre: otro cajero puede abrir la misma caja.
        $other = $this->cashier();
        $this->actingAs($other)
            ->postJson('/api/cash-sessions/open', ['opening_amount' => '10.00'])
            ->assertCreated()
            ->assertJsonPath('data.cash_register_id', $this->registerId('principal'));
    }

    public function test_action_defaults_to_principal_for_direct_calls(): void
    {
        $cashier = $this->cashier();

        $session = app(OpenCashSessionAction::class)->execute(
            ['opening_amount' => '25.00'],
            $cashier,
        );

        $this->assertSame($this->registerId('principal'), (int) $session->cash_register_id);
        $this->assertSame(CashRegisterSession::OPEN_MARKER, (int) $session->open_marker);
    }

    private function cashier(): User
    {
        $cashier = User::factory()->create();
        $cashier->assignRole('cajero');

        return $cashier->refresh();
    }

    private function registerId(string $code): int
    {
        $existing = CashRegister::query()->where('code', $code)->value('id');

        if ($existing !== null) {
            return (int) $existing;
        }

        return (int) CashRegister::query()->create([
            'code' => $code,
            'name' => 'Caja '.$code,
            'active' => true,
        ])->id;
    }
}
