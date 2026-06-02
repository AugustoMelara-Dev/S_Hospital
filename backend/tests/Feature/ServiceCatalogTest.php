<?php

namespace Tests\Feature;

use App\Models\Area;
use App\Models\AuditLog;
use App\Models\Category;
use App\Models\Service;
use App\Models\ServicePriceHistory;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Database\Seeders\ServiceCatalogSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Spatie\Permission\PermissionRegistrar;
use Tests\TestCase;

class ServiceCatalogTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }

    public function test_service_catalog_seeder_loads_expected_categories_services_and_special_rule(): void
    {
        $this->assertFileExists(base_path('database/seeders/data/catalogo_servicios_inicial.csv'));

        $this->seed(ServiceCatalogSeeder::class);

        $this->assertSame(5, Category::query()->count());
        $this->assertSame(5, Area::query()->count());
        $this->assertSame(122, Service::query()->count());
        $this->assertSame(0, Service::query()->whereNull('area_id')->count());

        $erythropoietin = Service::query()
            ->where('name', 'Eritropoyetina')
            ->firstOrFail();

        $this->assertSame('25.00', $erythropoietin->price);
        $this->assertSame(Service::ERYTHROPOIETIN_RULE, $erythropoietin->special_rule_code);
        $this->assertNotNull($erythropoietin->source_key);
        $this->assertNotNull($erythropoietin->source_hash);
    }

    public function test_service_catalog_seeder_assigns_validation_scan_codes(): void
    {
        $this->seed(ServiceCatalogSeeder::class);

        $this->assertDatabaseHas('services', [
            'slug' => 'acido-urico',
            'scan_code' => 'LAB-ACIDO-URICO',
            'barcode' => '7700000001001',
            'qr_code' => 'QR-LAB-ACIDO-URICO',
        ]);

        $this->assertDatabaseHas('services', [
            'slug' => 'abdomen-simple',
            'scan_code' => 'RX-ABDOMEN',
            'barcode' => '7700000002001',
            'qr_code' => 'QR-RX-ABDOMEN',
        ]);
    }

    public function test_service_catalog_seeder_is_idempotent(): void
    {
        $this->seed(ServiceCatalogSeeder::class);
        $this->seed(ServiceCatalogSeeder::class);

        $this->assertSame(5, Category::query()->count());
        $this->assertSame(122, Service::query()->count());
    }

    public function test_service_catalog_seeder_does_not_clear_existing_non_validation_codes(): void
    {
        $this->seed(ServiceCatalogSeeder::class);

        $service = Service::query()
            ->where('slug', 'eritropoyetina')
            ->firstOrFail();
        $service->update([
            'scan_code' => 'MED-ERI-LOCAL',
            'barcode' => '7700000003001',
            'qr_code' => 'QR-MED-ERI-LOCAL',
        ]);

        $this->seed(ServiceCatalogSeeder::class);

        $service->refresh();
        $this->assertSame('MED-ERI-LOCAL', $service->scan_code);
        $this->assertSame('7700000003001', $service->barcode);
        $this->assertSame('QR-MED-ERI-LOCAL', $service->qr_code);
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

    public function test_category_index_requires_catalog_view_and_validates_active_filter(): void
    {
        $this->seed([RolesAndPermissionsSeeder::class, ServiceCatalogSeeder::class]);
        $viewer = $this->cashier();
        $plainUser = User::factory()->create();
        $inactiveCategory = Category::query()->firstOrFail();
        $inactiveCategory->forceFill(['active' => false])->save();

        $this->actingAs($plainUser)
            ->getJson('/api/categories')
            ->assertForbidden();

        $this->actingAs($viewer)
            ->getJson('/api/categories?active=0')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $inactiveCategory->id);

        $this->actingAs($viewer)
            ->getJson('/api/categories?active=not-bool')
            ->assertUnprocessable()
            ->assertJsonValidationErrors('active');
    }

    public function test_area_options_are_available_to_catalog_and_managerial_report_users(): void
    {
        $this->seed([RolesAndPermissionsSeeder::class, ServiceCatalogSeeder::class]);
        $catalogViewer = User::factory()->create();
        $reportViewer = User::factory()->create();
        $plainUser = User::factory()->create();
        $catalogViewer->givePermissionTo('catalog.view');
        $reportViewer->givePermissionTo('reports.managerial.view');

        $this->actingAs($catalogViewer)
            ->getJson('/api/areas?active=1')
            ->assertOk()
            ->assertJsonCount(5, 'data')
            ->assertJsonPath('data.0.slug', 'hospitalizacion-y-emergencia');

        $this->actingAs($reportViewer)
            ->getJson('/api/areas?active=1')
            ->assertOk()
            ->assertJsonCount(5, 'data');

        $this->actingAs($plainUser)
            ->getJson('/api/areas')
            ->assertForbidden();
    }

    public function test_service_search_tolerates_typos_and_accents(): void
    {
        $this->seed([RolesAndPermissionsSeeder::class, ServiceCatalogSeeder::class]);
        $cashier = $this->cashier();
        $category = Category::query()->firstOrFail();

        Service::query()->create([
            'category_id' => $category->id,
            'name' => 'Ácido úrico especial',
            'slug' => 'acido-urico-especial',
            'price' => '80.00',
            'taxable' => true,
            'active' => true,
        ]);

        $this->actingAs($cashier)
            ->getJson('/api/services?search=Eritropoytina')
            ->assertOk()
            ->assertJsonFragment(['name' => 'Eritropoyetina']);

        $this->actingAs($cashier)
            ->getJson('/api/services?search=acido urico')
            ->assertOk()
            ->assertJsonFragment(['name' => 'Ácido úrico especial']);
    }

    public function test_service_aliases_are_searchable(): void
    {
        $this->seed([RolesAndPermissionsSeeder::class, ServiceCatalogSeeder::class]);
        $admin = $this->admin();
        $cashier = $this->cashier();
        $service = Service::query()->where('name', 'Eritropoyetina')->firstOrFail();

        $this->actingAs($admin)
            ->patchJson("/api/services/{$service->id}", [
                'aliases' => 'epo, eritro, medicamento dialisis',
            ])
            ->assertOk()
            ->assertJsonPath('data.aliases', 'epo, eritro, medicamento dialisis');

        $this->actingAs($cashier)
            ->getJson('/api/services?search=epo')
            ->assertOk()
            ->assertJsonFragment(['name' => 'Eritropoyetina']);
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
        $area = Area::query()->create([
            'name' => 'Consulta externa',
            'slug' => 'consulta-externa',
            'active' => true,
        ]);

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
                'area_id' => $area->id,
                'name' => 'Consulta general',
                'price' => '100.00',
                'scan_code' => 'CONS-GEN-001',
                'taxable' => true,
                'active' => true,
            ])
            ->assertCreated()
            ->assertJsonPath('data.name', 'Consulta general')
            ->assertJsonPath('data.price', '100.00')
            ->assertJsonPath('data.scan_code', 'CONS-GEN-001')
            ->json('data.id');

        $this->actingAs($admin)
            ->postJson('/api/services', [
                'category_id' => $categoryId,
                'name' => 'Consulta sin area',
                'price' => '100.00',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('area_id');

        $this->actingAs($admin)
            ->patchJson("/api/categories/{$categoryId}", [
                'name' => 'Consulta ambulatoria',
            ])
            ->assertOk()
            ->assertJsonPath('data.name', 'Consulta ambulatoria');

        $this->actingAs($admin)
            ->patchJson("/api/services/{$serviceId}", [
                'price' => '125.00',
                'price_change_reason' => 'Ajuste de tarifa autorizado',
                'barcode' => '7700000000011',
            ])
            ->assertOk()
            ->assertJsonPath('data.price', '125.00')
            ->assertJsonPath('data.barcode', '7700000000011');
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
        $laboratoryArea = Area::query()->where('slug', 'laboratorio')->firstOrFail();

        $this->actingAs($admin)
            ->postJson('/api/categories', [
                'name' => 'Laboratorio',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('name');

        $this->actingAs($admin)
            ->postJson('/api/services', [
                'category_id' => $laboratory->id,
                'area_id' => $laboratoryArea->id,
                'name' => 'Ultrasonido',
                'price' => '80.00',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('name');
    }

    public function test_duplicate_service_names_are_scoped_by_category_and_area(): void
    {
        $this->seed([RolesAndPermissionsSeeder::class, ServiceCatalogSeeder::class]);
        $admin = $this->admin();
        $laboratory = Category::query()->where('slug', 'laboratorio')->firstOrFail();
        $laboratoryArea = Area::query()->where('slug', 'laboratorio')->firstOrFail();
        $externalArea = Area::query()->create([
            'name' => 'Laboratorio externo',
            'slug' => 'laboratorio-externo',
            'active' => true,
        ]);

        $externalServiceId = $this->actingAs($admin)
            ->postJson('/api/services', [
                'category_id' => $laboratory->id,
                'area_id' => $externalArea->id,
                'name' => 'Ultrasonido',
                'price' => '80.00',
            ])
            ->assertCreated()
            ->assertJsonPath('data.area_id', $externalArea->id)
            ->json('data.id');

        $this->actingAs($admin)
            ->patchJson("/api/services/{$externalServiceId}", [
                'area_id' => $laboratoryArea->id,
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('name');
    }

    public function test_services_can_be_found_by_category_and_scan_codes(): void
    {
        $this->seed([RolesAndPermissionsSeeder::class, ServiceCatalogSeeder::class]);
        $admin = $this->admin();
        $cashier = $this->cashier();
        $service = Service::query()->where('name', 'Eritropoyetina')->firstOrFail();

        $this->actingAs($admin)
            ->patchJson("/api/services/{$service->id}", [
                'scan_code' => 'MED-ERI-001',
                'barcode' => '7700000000004',
                'qr_code' => 'QR-MED-ERI-001',
            ])
            ->assertOk()
            ->assertJsonPath('data.scan_code', 'MED-ERI-001');

        $this->actingAs($cashier)
            ->getJson('/api/services?active=1&code=MED-ERI-001')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.name', 'Eritropoyetina');

        $this->actingAs($cashier)
            ->getJson('/api/services?active=1&search=Medicamentos')
            ->assertOk()
            ->assertJsonFragment(['name' => 'Eritropoyetina']);
    }

    public function test_duplicate_scan_codes_return_validation_errors(): void
    {
        $this->seed([RolesAndPermissionsSeeder::class, ServiceCatalogSeeder::class]);
        $admin = $this->admin();
        $category = Category::query()->firstOrFail();
        $area = Area::query()->firstOrFail();
        $service = Service::query()->where('name', 'Eritropoyetina')->firstOrFail();

        $this->actingAs($admin)
            ->patchJson("/api/services/{$service->id}", ['scan_code' => 'DUP-001'])
            ->assertOk();

        $this->actingAs($admin)
            ->postJson('/api/services', [
                'category_id' => $category->id,
                'area_id' => $area->id,
                'name' => 'Servicio duplicado scanner',
                'price' => '10.00',
                'scan_code' => 'DUP-001',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('scan_code');
    }

    public function test_cross_field_duplicate_codes_return_validation_errors(): void
    {
        $this->seed([RolesAndPermissionsSeeder::class, ServiceCatalogSeeder::class]);
        $admin = $this->admin();
        $category = Category::query()->firstOrFail();
        $area = Area::query()->firstOrFail();
        $service = Service::query()->where('name', 'Eritropoyetina')->firstOrFail();

        $this->actingAs($admin)
            ->patchJson("/api/services/{$service->id}", ['scan_code' => 'GLOBAL-CODE-001'])
            ->assertOk();

        $this->actingAs($admin)
            ->postJson('/api/services', [
                'category_id' => $category->id,
                'area_id' => $area->id,
                'name' => 'Servicio duplicado barcode',
                'price' => '10.00',
                'barcode' => 'GLOBAL-CODE-001',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('barcode');

        $this->actingAs($admin)
            ->patchJson("/api/services/{$service->id}", [
                'scan_code' => 'SAME-SERVICE-CODE',
                'qr_code' => 'SAME-SERVICE-CODE',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['scan_code', 'qr_code']);

        $this->actingAs($admin)
            ->patchJson("/api/services/{$service->id}", ['scan_code' => 'PARTIAL-SAME-CODE'])
            ->assertOk();

        $this->actingAs($admin)
            ->patchJson("/api/services/{$service->id}", ['qr_code' => 'PARTIAL-SAME-CODE'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('qr_code');
    }

    public function test_price_change_and_active_change_are_audited(): void
    {
        $this->seed([RolesAndPermissionsSeeder::class, ServiceCatalogSeeder::class]);
        $admin = $this->admin();
        $service = Service::query()->where('name', 'Eritropoyetina')->firstOrFail();

        $this->actingAs($admin)
            ->patchJson("/api/services/{$service->id}", [
                'price' => '30.00',
                'price_change_reason' => 'Actualizacion aprobada por administracion',
            ])
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

        $priceHistory = ServicePriceHistory::query()->where('service_id', $service->id)->firstOrFail();
        $this->assertSame('25.00', $priceHistory->old_price);
        $this->assertSame('30.00', $priceHistory->new_price);
        $this->assertSame($admin->id, $priceHistory->changed_by);
        $this->assertSame('Actualizacion aprobada por administracion', $priceHistory->reason);
        $this->assertSame('Actualizacion aprobada por administracion', $priceAudit->new_values['price_change_reason']);
    }

    public function test_price_change_requires_a_server_side_reason(): void
    {
        $this->seed([RolesAndPermissionsSeeder::class, ServiceCatalogSeeder::class]);
        $admin = $this->admin();
        $service = Service::query()->where('name', 'Eritropoyetina')->firstOrFail();

        $this->actingAs($admin)
            ->patchJson("/api/services/{$service->id}", ['price' => '30.00'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('price_change_reason');

        $this->assertSame('25.00', $service->refresh()->price);
        $this->assertDatabaseMissing('service_price_histories', [
            'service_id' => $service->id,
            'new_price' => '30.00',
        ]);
    }

    public function test_invalid_price_update_returns_validation_error_before_price_reason_check(): void
    {
        $this->seed([RolesAndPermissionsSeeder::class, ServiceCatalogSeeder::class]);
        $admin = $this->admin();
        $service = Service::query()->where('name', 'Eritropoyetina')->firstOrFail();

        $this->actingAs($admin)
            ->patchJson("/api/services/{$service->id}", ['price' => 'precio-malo'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('price')
            ->assertJsonMissingValidationErrors('price_change_reason');

        $this->assertSame('25.00', $service->refresh()->price);
    }

    public function test_billing_filter_excludes_hidden_and_non_billable_services(): void
    {
        $this->seed([RolesAndPermissionsSeeder::class, ServiceCatalogSeeder::class]);
        $admin = $this->admin();
        $cashier = $this->cashier();
        $glucose = Service::query()->where('name', 'Glucosa')->firstOrFail();
        $hemogram = Service::query()->where('name', 'Hemograma Completo')->firstOrFail();

        $this->actingAs($admin)
            ->patchJson("/api/services/{$glucose->id}", ['visible_in_billing' => false])
            ->assertOk();

        $this->actingAs($admin)
            ->patchJson("/api/services/{$hemogram->id}", [
                'is_billable' => false,
                'scan_code' => 'NO-BILL-HEMO',
            ])
            ->assertOk();

        $this->actingAs($cashier)
            ->getJson('/api/services?active=1&billing=1&search=Glucosa')
            ->assertOk()
            ->assertJsonCount(0, 'data');

        $this->actingAs($cashier)
            ->getJson('/api/services?active=1&billing=1&code=NO-BILL-HEMO')
            ->assertOk()
            ->assertJsonCount(0, 'data');

        $this->actingAs($cashier)
            ->getJson('/api/services?active=1&search=Glucosa')
            ->assertOk()
            ->assertJsonFragment(['name' => 'Glucosa']);

        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $admin->id,
            'action' => 'service.visibility_updated',
            'entity_type' => Service::class,
            'entity_id' => $glucose->id,
        ]);
        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $admin->id,
            'action' => 'service.billability_updated',
            'entity_type' => Service::class,
            'entity_id' => $hemogram->id,
        ]);
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
                ->patchJson("/api/services/{$service->id}", [
                    'price' => '30.00',
                    'price_change_reason' => 'Prueba de rollback de auditoria',
                ])
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
