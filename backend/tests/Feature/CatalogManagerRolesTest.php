<?php

namespace Tests\Feature;

use App\Models\Area;
use App\Models\Category;
use App\Models\Service;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\TestWith;
use Tests\TestCase;

class CatalogManagerRolesTest extends TestCase
{
    use RefreshDatabase;

    #[TestWith(['admin'])]
    #[TestWith(['supervisor'])]
    public function test_catalog_managers_can_create_services_and_update_prices_with_an_audited_reason(string $role): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $manager = User::factory()->create();
        $manager->assignRole($role);
        $category = Category::factory()->create();
        $area = Area::query()->firstOrFail();

        $serviceId = $this->actingAs($manager)->postJson('/api/services', [
            'name' => 'Servicio autorizado de laboratorio',
            'category_id' => $category->id,
            'area_id' => $area->id,
            'price' => '100.00',
            'taxable' => false,
            'active' => true,
            'visible_in_billing' => true,
            'is_billable' => true,
        ])->assertCreated()->json('data.id');

        $this->patchJson("/api/services/{$serviceId}", ['price' => '120.00'])
            ->assertUnprocessable()->assertJsonValidationErrors('price_change_reason');
        $this->assertSame('100.00', Service::query()->findOrFail($serviceId)->price);

        $this->patchJson("/api/services/{$serviceId}", [
            'price' => '120.00',
            'price_change_reason' => 'Tarifa aprobada por administración',
        ])->assertOk()->assertJsonPath('data.price', '120.00');

        $this->assertDatabaseHas('service_price_histories', [
            'service_id' => $serviceId,
            'old_price' => '100.00',
            'new_price' => '120.00',
        ]);
        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $manager->id,
            'action' => 'service.price_updated',
        ]);
    }

    #[TestWith(['cajero'])]
    #[TestWith(['auditor'])]
    public function test_read_only_roles_cannot_create_services_or_change_prices(string $role): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $viewer = User::factory()->create();
        $viewer->assignRole($role);
        $service = Service::factory()->create([
            'category_id' => Category::factory()->create()->id,
            'area_id' => Area::query()->firstOrFail()->id,
            'price' => '100.00',
        ]);

        $this->actingAs($viewer)->postJson('/api/services', [])->assertForbidden();
        $this->patchJson("/api/services/{$service->id}", [
            'price' => '120.00',
            'price_change_reason' => 'Intento sin permiso suficiente',
        ])->assertForbidden();
        $this->assertSame('100.00', $service->fresh()->price);
    }
}
