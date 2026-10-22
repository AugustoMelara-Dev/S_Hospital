<?php

namespace Tests\Feature\Fiscal;

use App\Models\Category;
use App\Models\Service;
use App\Models\TaxRate;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TaxRateManagementTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RolesAndPermissionsSeeder::class);
    }

    private function admin(): User
    {
        $user = User::factory()->create();
        $user->assignRole('admin');

        return $user->refresh();
    }

    private function cashier(): User
    {
        $user = User::factory()->create();
        $user->assignRole('cajero');

        return $user->refresh();
    }

    public function test_admin_creates_a_tax_rate_with_reason_and_audit(): void
    {
        $admin = $this->admin();

        $response = $this->actingAs($admin)->postJson('/api/tax-rates', [
            'name' => 'ISV 15 %',
            'percentage' => 15,
            'is_default' => true,
            'reason' => 'Tasa vigente del hospital.',
        ])->assertCreated()
            ->assertJsonPath('data.name', 'ISV 15 %')
            ->assertJsonPath('data.percentage', '15.00')
            ->assertJsonPath('data.is_default', true);

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'tax_rate.created',
            'reason' => 'Tasa vigente del hospital.',
        ]);

        $this->assertSame((int) $response->json('data.id'), (int) TaxRate::query()->value('id'));
    }

    public function test_only_one_tax_rate_can_be_default(): void
    {
        $admin = $this->admin();
        $first = TaxRate::query()->create([
            'name' => 'ISV 15 %',
            'percentage' => '15.00',
            'active' => true,
            'is_default' => true,
        ]);

        $this->actingAs($admin)->postJson('/api/tax-rates', [
            'name' => 'ISV 18 %',
            'percentage' => 18,
            'is_default' => true,
            'reason' => 'Nueva tasa.',
        ])->assertCreated();

        $this->assertFalse($first->refresh()->is_default);
        $this->assertSame(1, TaxRate::query()->where('is_default', true)->count());
    }

    public function test_cashier_cannot_create_a_tax_rate(): void
    {
        $this->actingAs($this->cashier())->postJson('/api/tax-rates', [
            'name' => 'ISV 15 %',
            'percentage' => 15,
            'reason' => 'Intento.',
        ])->assertForbidden();
    }

    public function test_cashier_can_list_tax_rates_for_the_catalog(): void
    {
        TaxRate::query()->create([
            'name' => 'ISV 15 %',
            'percentage' => '15.00',
            'active' => true,
            'is_default' => true,
        ]);

        $this->actingAs($this->cashier())
            ->getJson('/api/tax-rates')
            ->assertOk()
            ->assertJsonCount(1, 'data');
    }

    public function test_cannot_delete_a_tax_rate_assigned_to_a_service(): void
    {
        $admin = $this->admin();
        $rate = TaxRate::query()->create([
            'name' => 'ISV 15 %',
            'percentage' => '15.00',
            'active' => true,
            'is_default' => true,
        ]);
        $category = Category::factory()->create();
        Service::factory()->create([
            'category_id' => $category->id,
            'tax_rate_id' => $rate->id,
            'taxable' => true,
        ]);

        $this->actingAs($admin)
            ->deleteJson("/api/tax-rates/{$rate->id}", ['reason' => 'Limpieza.'])
            ->assertStatus(422);

        $this->assertDatabaseHas('tax_rates', ['id' => $rate->id]);
    }

    public function test_deletes_an_unused_tax_rate_with_audit(): void
    {
        $admin = $this->admin();
        $rate = TaxRate::query()->create([
            'name' => 'ISV 18 %',
            'percentage' => '18.00',
            'active' => true,
            'is_default' => false,
        ]);

        $this->actingAs($admin)
            ->deleteJson("/api/tax-rates/{$rate->id}", ['reason' => 'Tasa no usada.'])
            ->assertOk();

        $this->assertDatabaseMissing('tax_rates', ['id' => $rate->id]);
        $this->assertDatabaseHas('audit_logs', [
            'action' => 'tax_rate.deleted',
            'reason' => 'Tasa no usada.',
        ]);
    }
}
