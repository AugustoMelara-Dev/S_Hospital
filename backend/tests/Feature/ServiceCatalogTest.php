<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\Category;
use App\Models\Service;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Database\Seeders\ServiceCatalogSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Tests\TestCase;

class ServiceCatalogTest extends TestCase
{
    use RefreshDatabase;

    public function test_service_catalog_seeder_loads_expected_categories_services_and_special_rule(): void
    {
        $this->assertFileExists(base_path('database/seeders/data/catalogo_servicios_inicial.csv'));

        $this->seed(ServiceCatalogSeeder::class);

        $this->assertSame(5, Category::query()->count());
        $this->assertSame(122, Service::query()->count());

        $erythropoietin = Service::query()
            ->where('name', 'Eritropoyetina')
            ->firstOrFail();

        $this->assertSame('25.00', $erythropoietin->price);
        $this->assertSame(Service::ERYTHROPOIETIN_RULE, $erythropoietin->special_rule_code);
        $this->assertNotNull($erythropoietin->source_key);
        $this->assertNotNull($erythropoietin->source_hash);
    }

    public function test_service_catalog_seeder_is_idempotent(): void
    {
        $this->seed(ServiceCatalogSeeder::class);
        $this->seed(ServiceCatalogSeeder::class);

        $this->assertSame(5, Category::query()->count());
        $this->assertSame(122, Service::query()->count());
    }

    public function test_service_catalog_seeder_updates_seeded_rows_by_stable_source_key_after_rename(): void
    {
        $this->seed(ServiceCatalogSeeder::class);

        $service = Service::query()->where('name', 'Eritropoyetina')->firstOrFail();
        $sourceKey = $service->source_key;
        $service->update([
            'name' => 'Eritropoyetina renombrada',
            'slug' => 'eritropoyetina-renombrada',
        ]);

        $this->seed(ServiceCatalogSeeder::class);

        $this->assertSame(122, Service::query()->count());
        $this->assertDatabaseHas('services', [
            'source_key' => $sourceKey,
            'name' => 'Eritropoyetina',
            'slug' => 'eritropoyetina',
        ]);
    }

    public function test_service_catalog_price_parser_rejects_invalid_decimal_values(): void
    {
        $method = new \ReflectionMethod(ServiceCatalogSeeder::class, 'price');
        $method->setAccessible(true);

        $this->assertSame('25.00', $method->invoke(new ServiceCatalogSeeder, '25'));
        $this->assertSame('25.50', $method->invoke(new ServiceCatalogSeeder, '25.5'));

        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('Invalid service catalog price');

        $method->invoke(new ServiceCatalogSeeder, '25.999');
    }

    public function test_catalog_view_permission_allows_reading_categories_and_services(): void
    {
        $this->seed([RolesAndPermissionsSeeder::class, ServiceCatalogSeeder::class]);
        $cashier = $this->cashier();

        $this->actingAs($cashier)
            ->getJson('/api/categories')
            ->assertOk()
            ->assertJsonCount(5, 'data');

        $this->actingAs($cashier)
            ->getJson('/api/services?search=Eritropoyetina')
            ->assertOk()
            ->assertJsonPath('data.0.name', 'Eritropoyetina')
            ->assertJsonPath('data.0.special_rule_code', Service::ERYTHROPOIETIN_RULE);
    }

    public function test_services_can_be_requested_with_capped_per_page_to_return_full_initial_catalog(): void
    {
        $this->seed([RolesAndPermissionsSeeder::class, ServiceCatalogSeeder::class]);
        $cashier = $this->cashier();

        $this->actingAs($cashier)
            ->getJson('/api/services?per_page=150')
            ->assertOk()
            ->assertJsonCount(122, 'data')
            ->assertJsonPath('meta.total', 122);

        $this->actingAs($cashier)
            ->getJson('/api/services?per_page=151')
            ->assertUnprocessable()
            ->assertJsonValidationErrors('per_page');
    }

    public function test_catalog_manage_permission_allows_creating_and_editing_categories_and_services(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $admin = $this->admin();

        $categoryId = $this->actingAs($admin)
            ->postJson('/api/categories', [
                'name' => 'Consulta externa',
                'active' => true,
                'sort_order' => 9,
            ])
            ->assertCreated()
            ->assertJsonPath('data.name', 'Consulta externa')
            ->json('data.id');

        $serviceId = $this->actingAs($admin)
            ->postJson('/api/services', [
                'category_id' => $categoryId,
                'name' => 'Consulta general',
                'price' => '100.00',
                'taxable' => true,
                'active' => true,
            ])
            ->assertCreated()
            ->assertJsonPath('data.name', 'Consulta general')
            ->assertJsonPath('data.price', '100.00')
            ->json('data.id');

        $this->actingAs($admin)
            ->patchJson("/api/categories/{$categoryId}", [
                'name' => 'Consulta ambulatoria',
            ])
            ->assertOk()
            ->assertJsonPath('data.name', 'Consulta ambulatoria');

        $this->actingAs($admin)
            ->patchJson("/api/services/{$serviceId}", [
                'price' => '125.00',
            ])
            ->assertOk()
            ->assertJsonPath('data.price', '125.00');
    }

    public function test_cashier_cannot_create_or_edit_services(): void
    {
        $this->seed([RolesAndPermissionsSeeder::class, ServiceCatalogSeeder::class]);
        $cashier = $this->cashier();
        $service = Service::query()->firstOrFail();

        $this->actingAs($cashier)
            ->postJson('/api/services', [
                'category_id' => $service->category_id,
                'name' => 'Servicio no autorizado',
                'price' => '10.00',
            ])
            ->assertForbidden();

        $this->actingAs($cashier)
            ->patchJson("/api/services/{$service->id}", [
                'price' => '99.00',
            ])
            ->assertForbidden();
    }

    public function test_cashier_cannot_create_or_edit_categories(): void
    {
        $this->seed([RolesAndPermissionsSeeder::class, ServiceCatalogSeeder::class]);
        $cashier = $this->cashier();
        $category = Category::query()->firstOrFail();

        $this->actingAs($cashier)
            ->postJson('/api/categories', [
                'name' => 'Categoria no autorizada',
            ])
            ->assertForbidden();

        $this->actingAs($cashier)
            ->patchJson("/api/categories/{$category->id}", [
                'name' => 'Categoria no permitida',
            ])
            ->assertForbidden();
    }

    public function test_duplicate_category_and_service_slugs_return_validation_errors(): void
    {
        $this->seed([RolesAndPermissionsSeeder::class, ServiceCatalogSeeder::class]);
        $admin = $this->admin();
        $laboratory = Category::query()->where('slug', 'laboratorio')->firstOrFail();

        $this->actingAs($admin)
            ->postJson('/api/categories', [
                'name' => 'Laboratorio',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('name');

        $this->actingAs($admin)
            ->postJson('/api/services', [
                'category_id' => $laboratory->id,
                'name' => 'Ultrasonido',
                'price' => '80.00',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('name');
    }

    public function test_price_change_and_active_change_are_audited(): void
    {
        $this->seed([RolesAndPermissionsSeeder::class, ServiceCatalogSeeder::class]);
        $admin = $this->admin();
        $service = Service::query()->where('name', 'Eritropoyetina')->firstOrFail();

        $this->actingAs($admin)
            ->patchJson("/api/services/{$service->id}", ['price' => '30.00'])
            ->assertOk();

        $this->actingAs($admin)
            ->patchJson("/api/services/{$service->id}", ['active' => false])
            ->assertOk();

        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $admin->id,
            'action' => 'service.price_updated',
            'entity_type' => Service::class,
            'entity_id' => $service->id,
        ]);
        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $admin->id,
            'action' => 'service.active_updated',
            'entity_type' => Service::class,
            'entity_id' => $service->id,
        ]);

        $priceAudit = AuditLog::query()->where('action', 'service.price_updated')->firstOrFail();

        $this->assertSame('25.00', $priceAudit->old_values['price']);
        $this->assertSame('30.00', $priceAudit->new_values['price']);
    }

    public function test_services_can_be_filtered_by_inactive_status(): void
    {
        $this->seed([RolesAndPermissionsSeeder::class, ServiceCatalogSeeder::class]);
        $admin = $this->admin();
        $service = Service::query()->where('name', 'Eritropoyetina')->firstOrFail();
        $service->forceFill(['active' => false])->save();

        $this->actingAs($admin)
            ->getJson('/api/services?active=0')
            ->assertOk()
            ->assertJsonPath('data.0.name', 'Eritropoyetina');

        $this->actingAs($admin)
            ->getJson('/api/services?active=1&search=Eritropoyetina')
            ->assertOk()
            ->assertJsonCount(0, 'data');
    }

    public function test_service_change_rolls_back_when_audit_log_fails(): void
    {
        $this->seed([RolesAndPermissionsSeeder::class, ServiceCatalogSeeder::class]);
        $admin = $this->admin();
        $service = Service::query()->where('name', 'Eritropoyetina')->firstOrFail();

        Event::listen('eloquent.creating: '.AuditLog::class, function (): void {
            throw new \RuntimeException('audit failed');
        });

        try {
            $this->actingAs($admin)
                ->patchJson("/api/services/{$service->id}", ['price' => '30.00'])
                ->assertStatus(500);
        } finally {
            Event::forget('eloquent.creating: '.AuditLog::class);
        }

        $this->assertSame('25.00', $service->refresh()->price);
    }

    private function admin(): User
    {
        $admin = User::factory()->create();
        $admin->assignRole('admin');

        return $admin;
    }

    private function cashier(): User
    {
        $cashier = User::factory()->create();
        $cashier->assignRole('cajero');

        return $cashier;
    }
}
