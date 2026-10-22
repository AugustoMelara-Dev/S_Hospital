<?php

namespace Tests\Feature\Catalog;

use App\Models\Area;
use App\Models\AuditLog;
use App\Models\Category;
use App\Models\Service;
use App\Models\TaxRate;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ServiceBulkTaxTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RolesAndPermissionsSeeder::class);
    }

    public function test_admin_assigns_a_rate_to_a_whole_category_with_audit(): void
    {
        $admin = $this->admin();
        $rate = $this->rate('ISV 15 %', '15.00');
        $category = Category::factory()->create();
        $area = $this->area();
        $first = $this->service($category, $area, 'Consulta general', '50.00');
        $second = $this->service($category, $area, 'Consulta especial', '75.00');
        $other = $this->service(Category::factory()->create(), $area, 'Otro servicio', '10.00');

        $this->actingAs($admin)
            ->patchJson('/api/services/bulk-tax', [
                'category_id' => $category->id,
                'tax_rate_id' => $rate->id,
                'reason' => 'Revision de impuestos del catalogo.',
            ])
            ->assertOk()
            ->assertJsonPath('data.updated', 2);

        foreach ([$first, $second] as $service) {
            $service->refresh();
            $this->assertSame($rate->id, $service->tax_rate_id);
            $this->assertTrue($service->taxable);
        }

        $other->refresh();
        $this->assertNull($other->tax_rate_id);
        $this->assertFalse($other->taxable);

        $logs = AuditLog::query()
            ->where('action', 'service.tax_updated')
            ->where('reason', 'Revision de impuestos del catalogo.')
            ->get();
        $this->assertCount(2, $logs);
        $this->assertSame(
            [$first->id, $second->id],
            $logs->pluck('entity_id')->sort()->values()->all(),
        );

        // Same request again is a no-op: no duplicate audit noise.
        $this->actingAs($admin)
            ->patchJson('/api/services/bulk-tax', [
                'category_id' => $category->id,
                'tax_rate_id' => $rate->id,
                'reason' => 'Revision de impuestos del catalogo.',
            ])
            ->assertOk()
            ->assertJsonPath('data.updated', 0);
    }

    public function test_bulk_null_rate_marks_the_selected_services_exempt(): void
    {
        $admin = $this->admin();
        $rate = $this->rate('ISV 18 %', '18.00');
        $area = $this->area();
        $category = Category::factory()->create();
        $service = $this->service($category, $area, 'Servicio gravado', '25.00', $rate);
        $other = $this->service($category, $area, 'Otro servicio gravado', '25.00', $rate);

        $this->actingAs($admin)
            ->patchJson('/api/services/bulk-tax', [
                'service_ids' => [$service->id, $other->id],
                'tax_rate_id' => null,
                'reason' => 'El hospital definio estos servicios como exentos.',
            ])
            ->assertOk()
            ->assertJsonPath('data.updated', 2);

        $service->refresh();
        $this->assertNull($service->tax_rate_id);
        $this->assertFalse($service->taxable);
    }

    public function test_bulk_tax_requires_reason_and_a_single_target(): void
    {
        $admin = $this->admin();
        $rate = $this->rate('ISV 15 %', '15.00');
        $category = Category::factory()->create();
        $service = $this->service($category, $this->area(), 'Consulta', '10.00');

        $this->actingAs($admin)
            ->patchJson('/api/services/bulk-tax', [
                'category_id' => $category->id,
                'tax_rate_id' => $rate->id,
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('reason');

        $this->actingAs($admin)
            ->patchJson('/api/services/bulk-tax', [
                'category_id' => $category->id,
                'service_ids' => [$service->id],
                'tax_rate_id' => $rate->id,
                'reason' => 'Ambiguedad de destino.',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('service_ids');

        $this->actingAs($admin)
            ->patchJson('/api/services/bulk-tax', [
                'service_ids' => [$service->id],
                'tax_rate_id' => $this->rate('ISV inactivo', '15.00', false)->id,
                'reason' => 'Tasa inactiva.',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('tax_rate_id');
    }

    public function test_cashier_cannot_change_catalog_taxes_in_bulk(): void
    {
        $cashier = User::factory()->create();
        $cashier->assignRole('cajero');
        $rate = $this->rate('ISV 15 %', '15.00');

        $this->actingAs($cashier)
            ->patchJson('/api/services/bulk-tax', [
                'category_id' => Category::factory()->create()->id,
                'tax_rate_id' => $rate->id,
                'reason' => 'Intento no autorizado.',
            ])
            ->assertForbidden();
    }

    private function admin(): User
    {
        $user = User::factory()->create();
        $user->assignRole('admin');

        return $user->refresh();
    }

    private function rate(string $name, string $percentage, bool $active = true): TaxRate
    {
        return TaxRate::query()->create([
            'name' => $name,
            'percentage' => $percentage,
            'active' => $active,
            'is_default' => false,
        ]);
    }

    private function area(): Area
    {
        return Area::query()->create([
            'name' => 'Laboratorio '.uniqid(),
            'slug' => 'laboratorio-'.uniqid(),
            'active' => true,
        ]);
    }

    private function service(
        Category $category,
        Area $area,
        string $name,
        string $price,
        ?TaxRate $rate = null,
    ): Service {
        return Service::factory()->create([
            'category_id' => $category->id,
            'area_id' => $area->id,
            'name' => $name,
            'slug' => str()->slug($name).'-'.uniqid(),
            'price' => $price,
            'taxable' => $rate !== null,
            'tax_rate_id' => $rate?->id,
        ]);
    }
}
