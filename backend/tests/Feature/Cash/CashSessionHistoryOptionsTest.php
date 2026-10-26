<?php

namespace Tests\Feature\Cash;

use App\Models\CashRegister;
use App\Models\CashRegisterSession;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CashSessionHistoryOptionsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);
    }

    public function test_history_filters_opening_dates_and_closed_differences(): void
    {
        $user = User::factory()->create()->givePermissionTo(['cash.view', 'cash.close_any']);
        $wanted = $this->makeSession($user, '2026-10-10 23:59:59', '-10.00');
        $this->makeSession($user, '2026-10-09 23:59:59', '-10.00');
        $this->makeSession($user, '2026-10-10 12:00:00', '0.00');
        $this->makeSession($user, '2026-10-10 12:00:00', '10.00');
        $this->makeSession($user, '2026-10-10 12:00:00', null);

        $this->actingAs($user)->getJson('/api/cash-sessions?date_from=2026-10-10&date_to=2026-10-10&difference=shortage')
            ->assertOk()->assertJsonPath('meta.total', 1)->assertJsonPath('data.0.id', $wanted->id);
        foreach (['balanced', 'overage'] as $difference) {
            $this->getJson('/api/cash-sessions?date_from=2026-10-10&difference='.$difference)
                ->assertOk()->assertJsonPath('meta.total', 1);
        }
    }

    public function test_history_validates_dates_and_difference_and_preserves_own_scope(): void
    {
        $own = User::factory()->create()->givePermissionTo('cash.view');
        $other = User::factory()->create();
        $this->makeSession($own, '2026-10-10 12:00:00', '0.00');
        $this->makeSession($other, '2026-10-10 12:00:00', '0.00');
        $this->actingAs($own)->getJson('/api/cash-sessions?user_id='.$other->id.'&difference=balanced')
            ->assertOk()->assertJsonPath('meta.total', 1)->assertJsonPath('data.0.user_id', $own->id);
        $this->getJson('/api/cash-sessions?date_from=2026-10-11&date_to=2026-10-10&difference=invalid')
            ->assertUnprocessable()->assertJsonValidationErrors(['date_to', 'difference']);
        $this->getJson('/api/cash-sessions?date_to=2026-10-10')->assertOk()->assertJsonPath('meta.total', 1);
    }

    public function test_options_are_paginated_searchable_and_selected_item_is_resolved_outside_page(): void
    {
        $manager = User::factory()->create()->givePermissionTo('reports.managerial.view');
        $old = $this->makeSession($manager, '2026-01-01 12:00:00', '0.00');
        for ($i = 0; $i < 51; $i++) {
            $this->makeSession($manager, '2026-10-10 12:00:00', '0.00');
        }
        $response = $this->actingAs($manager)->getJson('/api/cash-sessions/options?kind=sessions&per_page=20&selected_id='.$old->id)
            ->assertOk()->assertJsonCount(20, 'data')->assertJsonPath('meta.total', 52)
            ->assertJsonPath('selected.value', (string) $old->id);
        $this->assertSame(['value', 'label'], array_keys($response->json('data.0')));
        $this->getJson('/api/cash-sessions/options?kind=sessions&search=2026-01-01')
            ->assertOk()->assertJsonPath('meta.total', 1)->assertJsonPath('data.0.value', (string) $old->id);
        $this->getJson('/api/cash-sessions/options?kind=sessions&search='.$old->id)
            ->assertOk()->assertJsonPath('data.0.value', (string) $old->id);
        $this->getJson('/api/cash-sessions/options?kind=sessions&page=3&per_page=20')
            ->assertOk()->assertJsonCount(12, 'data');
    }

    public function test_cashier_and_register_options_include_old_history_but_do_not_leak_other_users(): void
    {
        $own = User::factory()->create(['name' => 'Cajera antigua'])->givePermissionTo('cash.view');
        $other = User::factory()->create(['name' => 'Otro cajero']);
        $old = $this->makeSession($own, '2026-01-01 12:00:00', '0.00');
        $foreign = $this->makeSession($other, '2026-10-10 12:00:00', '0.00');
        $register = CashRegister::findOrFail($old->cash_register_id);
        $register->update(['active' => false]);
        $this->actingAs($own)->getJson('/api/cash-sessions/options?kind=cashiers&search=antigua')
            ->assertOk()->assertJsonPath('meta.total', 1)->assertJsonPath('data.0.value', (string) $own->id);
        $this->getJson('/api/cash-sessions/options?kind=sessions&selected_id='.$foreign->id)
            ->assertOk()->assertJsonPath('meta.total', 1)->assertJsonPath('selected', null);
        $this->getJson('/api/cash-sessions/options?kind=cashiers&selected_id='.$other->id)
            ->assertOk()->assertJsonPath('selected', null);
        $this->getJson('/api/cash-sessions/options?kind=registers')
            ->assertOk()->assertJsonPath('meta.total', 1)->assertJsonPath('data.0.value', (string) $register->id);
    }

    public function test_options_require_read_permission_and_validate_bounded_input(): void
    {
        $this->getJson('/api/cash-sessions/options?kind=sessions')->assertUnauthorized();
        $user = User::factory()->create();
        $this->actingAs($user)->getJson('/api/cash-sessions/options?kind=sessions')->assertForbidden();
        $user->givePermissionTo('reports.cash_session.view');
        $this->getJson('/api/cash-sessions/options?kind=unknown&per_page=100&selected_id=-1')
            ->assertUnprocessable()->assertJsonValidationErrors(['kind', 'per_page', 'selected_id']);
    }

    public function test_report_only_cashier_cannot_select_foreign_history_and_search_does_not_escape_scope(): void
    {
        $own = User::factory()->create(['name' => 'Visible'])->givePermissionTo('reports.cash_session.view');
        $other = User::factory()->create(['name' => 'Hidden']);
        $this->makeSession($own, '2026-10-10 12:00:00', '0.00');
        $foreign = $this->makeSession($other, '2026-10-10 12:00:00', '0.00');
        $this->actingAs($own)->getJson('/api/cash-sessions/options?kind=sessions&search=Hidden&selected_id='.$foreign->id)
            ->assertOk()->assertJsonPath('meta.total', 0)->assertJsonPath('selected', null);
        $this->getJson('/api/cash-sessions/options?kind=registers&selected_id='.$foreign->cash_register_id)
            ->assertOk()->assertJsonPath('meta.total', 1)->assertJsonPath('selected', null);
        $this->getJson('/api/cash-sessions/options?kind=cashiers&search=Hidden')
            ->assertOk()->assertJsonPath('meta.total', 0);
    }

    private function makeSession(User $user, string $openedAt, ?string $difference): CashRegisterSession
    {
        $register = CashRegister::create(['code' => 'test-'.uniqid(), 'name' => 'Ventanilla', 'active' => true]);

        return CashRegisterSession::create([
            'user_id' => $user->id,
            'cash_register_id' => $register->id,
            'opening_amount' => '0.00',
            'status' => $difference === null ? 'open' : 'closed',
            'opened_at' => $openedAt,
            'closed_at' => $difference === null ? null : $openedAt,
            'difference_amount' => $difference,
        ]);
    }
}
