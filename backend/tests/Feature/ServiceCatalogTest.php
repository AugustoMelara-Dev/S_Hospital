<?php

namespace Tests\Feature;

use App\Models\Area;
use App\Models\AuditLog;
use App\Models\Category;
use App\Models\FiscalSequence;
use App\Models\FiscalSetting;
use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Models\Service;
use App\Models\ServiceArea;
use App\Models\ServicePriceHistory;
use App\Models\TaxRate;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Database\Seeders\ServiceCatalogSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use LogicException;
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
        // F016 fase 1 (migracion 2026_09_13_220001, T2-040): a las 5 areas del
        // CSV se suma la contraparte canonica "Otros" creada por la migracion
        // incluso en instalacion nueva (la usa areaSlugForCategory como default).
        $this->assertSame(6, Area::query()->count());
        $this->assertSame(1, Area::query()->where('slug', 'otros')->count());
        $this->assertSame(151, Service::query()->count());
        $this->assertSame(149, Service::query()->where('active', true)->count());
        $this->assertSame(0, Service::query()->whereNull('area_id')->count());

        $erythropoietin = Service::query()
            ->where('name', 'Eritropoyetina')
            ->firstOrFail();

        $this->assertSame('25.00', $erythropoietin->price);
        $this->assertTrue($erythropoietin->taxable);
        $this->assertSame(Service::ERYTHROPOIETIN_RULE, $erythropoietin->special_rule_code);
        $this->assertNotNull($erythropoietin->source_key);
        $this->assertNotNull($erythropoietin->source_hash);

        $this->assertSame('Farmacia', $erythropoietin->area?->name);
        $this->assertSame(
            'Laboratorio',
            Service::query()->where('name', 'Glucosa')->firstOrFail()->area?->name,
        );
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
        $this->assertSame(6, ServiceArea::query()->count());
        $this->assertSame(151, Service::query()->count());
    }

    public function test_service_catalog_seeder_retires_rows_removed_from_the_managed_csv(): void
    {
        $this->seed(ServiceCatalogSeeder::class);
        $obsoleteCategory = Category::query()->create([
            'source_key' => 'csv:category:catalogo-anterior',
            'name' => 'Catálogo anterior',
            'slug' => 'catalogo-anterior',
            'active' => true,
            'sort_order' => 99,
        ]);
        $obsoleteService = Service::query()->create([
            'source_key' => 'csv:service:catalogo-anterior:servicio-obsoleto',
            'name' => 'Servicio obsoleto',
            'slug' => 'servicio-obsoleto',
            'category_id' => $obsoleteCategory->id,
            'area_id' => Area::query()->firstOrFail()->id,
            'price' => '10.00',
            'taxable' => true,
            'active' => true,
            'visible_in_billing' => true,
            'is_billable' => true,
        ]);

        $this->seed(ServiceCatalogSeeder::class);

        $obsoleteService->refresh();
        $obsoleteCategory->refresh();
        $this->assertFalse($obsoleteService->active);
        $this->assertFalse($obsoleteService->visible_in_billing);
        $this->assertFalse($obsoleteService->is_billable);
        $this->assertFalse($obsoleteCategory->active);
        $this->assertSame(149, Service::query()->where('active', true)->count());
    }

    public function test_service_catalog_seeder_preserves_existing_operational_service_changes(): void
    {
        $this->seed(ServiceCatalogSeeder::class);

        $service = Service::query()
            ->where('name', 'Glucosa')
            ->firstOrFail();
        $service->update([
            'price' => '99.00',
            'tax_rate_id' => null,
            'taxable' => false,
            'active' => false,
            'visible_in_billing' => false,
            'is_billable' => false,
            'scan_code' => 'LOCAL-GLU',
            'barcode' => '7700000003999',
            'qr_code' => 'QR-LOCAL-GLU',
        ]);

        $this->seed(ServiceCatalogSeeder::class);

        $service->refresh();
        $this->assertSame('99.00', $service->price);
        $this->assertFalse($service->taxable);
        $this->assertFalse($service->active);
        $this->assertFalse($service->visible_in_billing);
        $this->assertFalse($service->is_billable);
        $this->assertSame('LOCAL-GLU', $service->scan_code);
        $this->assertSame('7700000003999', $service->barcode);
        $this->assertSame('QR-LOCAL-GLU', $service->qr_code);
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

        $this->assertSame(151, Service::query()->count());
        $this->assertDatabaseHas('services', [
            'source_key' => $sourceKey,
            'name' => 'Eritropoyetina',
            'slug' => 'eritropoyetina',
        ]);
    }

    public function test_service_catalog_source_key_is_explicit_and_does_not_change_with_display_name(): void
    {
        $method = new \ReflectionMethod(ServiceCatalogSeeder::class, 'serviceSourceKey');
        $method->setAccessible(true);
        $seeder = new ServiceCatalogSeeder;

        $legacyKey = 'csv:service:servicios-generales:estancia-administrativa';

        $this->assertSame($legacyKey, $method->invoke($seeder, [
            'source_key' => $legacyKey,
            'categoria' => 'Servicios generales',
            'servicio' => 'Estancia administrativa',
        ]));
        $this->assertSame($legacyKey, $method->invoke($seeder, [
            'source_key' => $legacyKey,
            'categoria' => 'Servicios generales',
            'servicio' => 'Internamiento',
        ]));
    }

    public function test_photo_catalog_loads_confirmed_prices_and_keeps_ambiguous_kdh_out_of_billing(): void
    {
        $this->seed(ServiceCatalogSeeder::class);

        foreach ([
            ['csv:service:laboratorio:general-de-heces', '15.00'],
            ['csv:service:laboratorio:hemograma-completo', '35.00'],
            ['csv:service:laboratorio:hematocrito', '10.00'],
            ['csv:service:laboratorio:hepatitis-abc', '65.00'],
            ['csv:service:laboratorio:hdl-colesterol', '20.00'],
            ['csv:service:laboratorio:helicobacter-pylori', '85.00'],
            ['csv:service:laboratorio:cd4', '50.00'],
            ['csv:service:laboratorio:urocultivo', '80.00'],
            ['csv:service:laboratorio:hemoglobina-glicosilada-hba-c', '105.00'],
            ['csv:service:radiologia:mano', '65.00'],
            ['csv:service:radiologia:torax', '45.00'],
            ['csv:service:radiologia:columna-lumbar', '85.00'],
            ['csv:service:radiologia:pelvis', '45.00'],
            ['csv:service:radiologia:pre-d-p-oblicua-y-lat', '65.00'],
            ['csv:service:radiologia:articulacion-proxofeno-coxofeno', '45.00'],
            ['csv:service:radiologia:lumbosacra', '85.00'],
            ['csv:service:radiologia:poner-yeso', '45.00'],
            ['csv:service:odontologia:extraccion', '20.00'],
            ['csv:service:odontologia:tapado', '105.00'],
        ] as [$sourceKey, $price]) {
            $this->assertDatabaseHas('services', [
                'source_key' => $sourceKey,
                'price' => $price,
                'active' => true,
                'visible_in_billing' => true,
                'is_billable' => true,
            ]);
        }

        $this->assertDatabaseHas('services', [
            'name' => 'Gases Arteriales',
            'price' => '305.00',
        ]);
        $this->assertDatabaseHas('services', [
            'name' => 'Gases Arteriales (si viene de la privada)',
            'price' => '600.00',
        ]);
        $this->assertDatabaseHas('services', [
            'name' => 'Unidad de Sangre fuera del hospital',
            'price' => '1500.00',
        ]);

        foreach (['K.D.H. (tarifa L. 10)', 'K.D.H. (tarifa L. 35)'] as $name) {
            $this->assertDatabaseHas('services', [
                'name' => $name,
                'active' => false,
                'visible_in_billing' => false,
                'is_billable' => false,
                'description' => 'Pendiente de confirmación administrativa; no disponible para cobro.',
            ]);
        }

        $this->assertSame(1, Service::query()->where('name', 'Pre D.P. Oblicua y Lat.')->count());
        $this->assertSame(1, Service::query()->where('name', 'Articulación Proxofeno Coxofeno')->count());
        $this->assertSame(1, Service::query()->whereRaw('lower(name) = ?', ['tibia derecha'])->count());
    }

    public function test_catalog_semantic_rename_preserves_local_tariff_and_historical_invoice_snapshot(): void
    {
        $this->seed(ServiceCatalogSeeder::class);

        $service = Service::query()
            ->where('source_key', 'csv:service:servicios-generales:estancia-administrativa')
            ->firstOrFail();
        $serviceId = $service->id;
        $service->forceFill([
            'name' => 'Estancia administrativa',
            'slug' => 'estancia-administrativa',
            'price' => '999.00',
            'tax_rate_id' => null,
            'taxable' => false,
        ])->save();

        $invoice = $this->createIssuedInvoiceForService($service, User::factory()->create());
        $item = $invoice->items()->sole();
        $snapshotName = $item->service_name;
        $snapshotPrice = $item->unit_price;

        $this->seed(ServiceCatalogSeeder::class);

        $service->refresh();
        $item->refresh();
        $this->assertSame($serviceId, $service->id);
        $this->assertSame('Internamiento', $service->name);
        $this->assertSame('999.00', $service->price);
        $this->assertFalse($service->taxable);
        $this->assertSame($snapshotName, $item->service_name);
        $this->assertSame($snapshotPrice, $item->unit_price);
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

        $this->actingAs($cashier)
            ->getJson('/api/service-areas?active=1')
            ->assertOk()
            ->assertJsonFragment(['name' => 'Laboratorio'])
            ->assertJsonFragment(['name' => 'Rayos X']);
    }

    public function test_authenticated_catalog_reads_do_not_rotate_session_cookie(): void
    {
        $this->seed([RolesAndPermissionsSeeder::class, ServiceCatalogSeeder::class]);
        $cashier = $this->cashier();

        $response = $this->actingAs($cashier)
            ->withCookie((string) config('session.cookie'), 'existing-session')
            ->getJson('/api/services?active=1&billing=1&visible_in_billing=1&is_billable=1&per_page=24');

        $response->assertOk();
        $this->assertFalse($response->headers->has('Set-Cookie'));
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
        $inactiveArea = Area::query()->firstOrFail();
        $inactiveArea->forceFill(['active' => false])->save();

        // 6 areas tras el seed (5 del CSV + "Otros" canonica de la migracion
        // 2026_09_13_220001); al desactivar 1 quedan 5 activas.
        $this->actingAs($catalogViewer)
            ->getJson('/api/areas?active=1')
            ->assertOk()
            ->assertJsonCount(5, 'data');

        $this->actingAs($reportViewer)
            ->getJson('/api/areas?active=0')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $inactiveArea->id);

        $this->actingAs($catalogViewer)
            ->getJson('/api/areas?active=not-bool')
            ->assertUnprocessable()
            ->assertJsonValidationErrors('active');

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
            ->assertJsonCount(150, 'data')
            ->assertJsonPath('meta.total', 151);

        $this->actingAs($cashier)
            ->getJson('/api/services?per_page=150&page=2')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('meta.total', 151);

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

    public function test_services_can_store_area_and_operational_metadata(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $admin = $this->admin();
        $category = Category::query()->create([
            'name' => 'Laboratorio',
            'slug' => 'laboratorio',
            'active' => true,
            'sort_order' => 1,
        ]);
        $area = Area::query()->create([
            'name' => 'Laboratorio',
            'slug' => 'laboratorio',
            'active' => true,
        ]);

        $serviceId = $this->actingAs($admin)
            ->postJson('/api/services', [
                'category_id' => $category->id,
                'area_id' => $area->id,
                'name' => 'Acido urico',
                'price' => '80.00',
                'taxable' => true,
                'active' => true,
                'aliases' => 'urico, au',
                'description' => 'Examen de laboratorio',
                'internal_code' => 'LAB-AU',
                'print_on_receipt' => true,
                'visible_in_billing' => true,
                'is_billable' => true,
            ])
            ->assertCreated()
            ->assertJsonPath('data.area.name', 'Laboratorio')
            ->assertJsonPath('data.aliases', 'urico, au')
            ->assertJsonPath('data.internal_code', 'LAB-AU')
            ->assertJsonPath('data.visible_in_billing', true)
            ->json('data.id');

        $this->assertDatabaseHas('services', [
            'id' => $serviceId,
            'area_id' => $area->id,
            'internal_code' => 'LAB-AU',
            'visible_in_billing' => true,
            'is_billable' => true,
            'print_on_receipt' => true,
        ]);
    }

    public function test_admin_can_manage_service_areas(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $admin = $this->admin();

        $areaId = $this->actingAs($admin)
            ->postJson('/api/service-areas', [
                'name' => 'Rehabilitacion',
                'active' => true,
                'sort_order' => 8,
            ])
            ->assertCreated()
            ->assertJsonPath('data.name', 'Rehabilitacion')
            ->assertJsonPath('data.slug', 'rehabilitacion')
            ->json('data.id');

        $this->actingAs($admin)
            ->patchJson("/api/service-areas/{$areaId}", [
                'name' => 'Terapia fisica',
                'active' => false,
            ])
            ->assertOk()
            ->assertJsonPath('data.name', 'Terapia fisica')
            ->assertJsonPath('data.active', false);

        $this->actingAs($this->cashier())
            ->postJson('/api/service-areas', ['name' => 'No autorizado'])
            ->assertForbidden();
    }

    public function test_service_search_uses_area_aliases_and_internal_code_filters(): void
    {
        $this->seed([RolesAndPermissionsSeeder::class, ServiceCatalogSeeder::class]);
        $admin = $this->admin();
        $cashier = $this->cashier();
        $glucose = Service::query()->where('name', 'Glucosa')->firstOrFail();
        // `services.area_id` referencia `areas` (canonica) y la validacion usa
        // exists:areas,id. Los ids de `service_areas` (legacy) divergen en
        // MariaDB por el autoincremento entre tablas; usar Area evita el 422.
        $laboratory = Area::query()->where('slug', 'laboratorio')->firstOrFail();
        $rayos = Area::query()->where('slug', 'rayos-x')->firstOrFail();

        $this->actingAs($admin)
            ->patchJson("/api/services/{$glucose->id}", [
                'aliases' => 'azucar en sangre, glicemia',
                'internal_code' => 'LAB-GLU',
                'area_id' => $laboratory->id,
            ])
            ->assertOk();

        $this->actingAs($cashier)
            ->getJson('/api/services?search=glicemia')
            ->assertOk()
            ->assertJsonFragment(['name' => 'Glucosa']);

        $this->actingAs($cashier)
            ->getJson('/api/services?search=LAB-GLU')
            ->assertOk()
            ->assertJsonFragment(['name' => 'Glucosa']);

        $this->actingAs($cashier)
            ->getJson('/api/services?search=laboratorio')
            ->assertOk()
            ->assertJsonFragment(['name' => 'Glucosa']);

        $this->actingAs($cashier)
            ->getJson('/api/services?area_id='.$rayos->id)
            ->assertOk()
            ->assertJsonMissing(['name' => 'Glucosa']);
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

    public function test_service_price_must_be_greater_than_zero_on_create_and_update(): void
    {
        $this->seed([RolesAndPermissionsSeeder::class, ServiceCatalogSeeder::class]);
        $admin = $this->admin();
        $service = Service::query()->firstOrFail();

        $this->actingAs($admin)
            ->postJson('/api/services', [
                'category_id' => $service->category_id,
                'area_id' => $service->area_id,
                'name' => 'Servicio sin precio valido',
                'price' => '0.00',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('price');

        $this->actingAs($admin)
            ->patchJson("/api/services/{$service->id}", [
                'price' => '0.00',
                'price_change_reason' => 'Intento de precio cero',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('price');
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
        $service = Service::query()->where('name', 'Glucosa')->firstOrFail();
        $originalPrice = (string) $service->price;

        $this->actingAs($admin)
            ->patchJson("/api/services/{$service->id}", [
                'price' => '30.00',
                'price_change_reason' => 'Actualizacion aprobada por administracion',
            ])
            ->assertOk();

        $this->actingAs($admin)
            ->patchJson("/api/services/{$service->id}", [
                'active' => false,
                'availability_change_reason' => 'Servicio retirado temporalmente de caja',
            ])
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

        $this->assertSame($originalPrice, $priceAudit->old_values['price']);
        $this->assertSame('30.00', $priceAudit->new_values['price']);

        $priceHistory = ServicePriceHistory::query()->where('service_id', $service->id)->firstOrFail();
        $this->assertSame($originalPrice, $priceHistory->old_price);
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

    public function test_billing_availability_change_requires_a_server_side_reason(): void
    {
        $this->seed([RolesAndPermissionsSeeder::class, ServiceCatalogSeeder::class]);
        $admin = $this->admin();
        $service = Service::query()->where('name', 'Glucosa')->firstOrFail();

        $this->actingAs($admin)
            ->patchJson("/api/services/{$service->id}", ['visible_in_billing' => false])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('availability_change_reason');

        $service->refresh();

        $this->assertTrue($service->visible_in_billing);
        $this->assertDatabaseMissing('audit_logs', [
            'action' => 'service.visibility_updated',
            'entity_type' => Service::class,
            'entity_id' => $service->id,
        ]);
    }

    public function test_billing_availability_change_with_reason_is_audited(): void
    {
        $this->seed([RolesAndPermissionsSeeder::class, ServiceCatalogSeeder::class]);
        $admin = $this->admin();
        $service = Service::query()->where('name', 'Glucosa')->firstOrFail();
        $reason = 'Retirado temporalmente de caja por revision interna';

        $this->actingAs($admin)
            ->patchJson("/api/services/{$service->id}", [
                'active' => false,
                'visible_in_billing' => false,
                'is_billable' => false,
                'availability_change_reason' => $reason,
            ])
            ->assertOk()
            ->assertJsonPath('data.active', false)
            ->assertJsonPath('data.visible_in_billing', false)
            ->assertJsonPath('data.is_billable', false);

        foreach (['service.active_updated', 'service.visibility_updated', 'service.billability_updated'] as $action) {
            $audit = AuditLog::query()
                ->where('action', $action)
                ->where('entity_type', Service::class)
                ->where('entity_id', $service->id)
                ->firstOrFail();

            $this->assertSame($reason, $audit->new_values['availability_change_reason']);
        }
    }

    public function test_erythropoietin_price_comes_from_the_authorized_catalog(): void
    {
        $this->seed([RolesAndPermissionsSeeder::class, ServiceCatalogSeeder::class]);
        $admin = $this->admin();
        $service = Service::query()->where('name', 'Eritropoyetina')->firstOrFail();

        $this->actingAs($admin)
            ->patchJson("/api/services/{$service->id}", [
                'price' => '30.00',
                'price_change_reason' => 'Tarifa autorizada por administracion',
                'special_rule_code' => Service::ERYTHROPOIETIN_RULE,
            ])
            ->assertOk()
            ->assertJsonPath('data.price', '30.00')
            ->assertJsonPath('data.special_rule_code', Service::ERYTHROPOIETIN_RULE);

        $this->assertSame('30.00', $service->refresh()->price);
        $this->assertDatabaseHas('service_price_histories', [
            'service_id' => $service->id,
            'old_price' => '25.00',
            'new_price' => '30.00',
        ]);
    }

    public function test_erythropoietin_rule_cannot_be_assigned_from_catalog_create(): void
    {
        $this->seed([RolesAndPermissionsSeeder::class, ServiceCatalogSeeder::class]);
        $admin = $this->admin();
        $service = Service::query()->where('name', 'Eritropoyetina')->firstOrFail();

        $this->actingAs($admin)
            ->postJson('/api/services', [
                'category_id' => $service->category_id,
                'area_id' => $service->area_id,
                'name' => 'Eritropoyetina gravada',
                'price' => '25.00',
                'taxable' => true,
                'active' => true,
                'visible_in_billing' => true,
                'is_billable' => true,
                'special_rule_code' => Service::ERYTHROPOIETIN_RULE,
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('special_rule_code')
            ->assertJsonMissingValidationErrors(['price', 'taxable']);
    }

    public function test_erythropoietin_rule_cannot_be_assigned_from_catalog_update(): void
    {
        $this->seed([RolesAndPermissionsSeeder::class, ServiceCatalogSeeder::class]);
        $admin = $this->admin();
        $service = Service::query()->where('name', 'Glucosa')->firstOrFail();

        $this->actingAs($admin)
            ->patchJson("/api/services/{$service->id}", [
                'price' => '25.00',
                'price_change_reason' => 'Tarifa autorizada por farmacia',
                'special_rule_code' => Service::ERYTHROPOIETIN_RULE,
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('special_rule_code')
            ->assertJsonMissingValidationErrors(['price', 'taxable']);

        $service->refresh();

        $this->assertTrue($service->taxable);
        $this->assertNull($service->special_rule_code);
    }

    public function test_erythropoietin_rule_is_preserved_while_price_and_tax_follow_catalog(): void
    {
        $this->seed([RolesAndPermissionsSeeder::class, ServiceCatalogSeeder::class]);
        $admin = $this->admin();
        $service = Service::query()->where('name', 'Eritropoyetina')->firstOrFail();

        $this->actingAs($admin)
            ->patchJson("/api/services/{$service->id}", [
                'price' => '30.00',
                'price_change_reason' => 'Tarifa autorizada por administracion',
                'taxable' => true,
                'tax_change_reason' => 'Tratamiento fiscal autorizado',
            ])
            ->assertOk()
            ->assertJsonPath('data.price', '30.00')
            ->assertJsonPath('data.taxable', true)
            ->assertJsonPath('data.special_rule_code', Service::ERYTHROPOIETIN_RULE);

        $service->refresh();

        $this->assertSame('30.00', $service->price);
        $this->assertTrue($service->taxable);
        $this->assertSame(Service::ERYTHROPOIETIN_RULE, $service->special_rule_code);

        $this->actingAs($admin)
            ->patchJson("/api/services/{$service->id}", ['special_rule_code' => null])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('special_rule_code');
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
            ->patchJson("/api/services/{$glucose->id}", [
                'visible_in_billing' => false,
                'availability_change_reason' => 'Servicio oculto temporalmente para caja',
            ])
            ->assertOk();

        $this->actingAs($admin)
            ->patchJson("/api/services/{$hemogram->id}", [
                'is_billable' => false,
                'scan_code' => 'NO-BILL-HEMO',
                'availability_change_reason' => 'Servicio no cobrable temporalmente en caja',
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
            ->getJson('/api/services?active=1&visible_in_billing=1&is_billable=0&code=NO-BILL-HEMO')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.name', 'Hemograma Completo')
            ->assertJsonPath('data.0.visible_in_billing', true)
            ->assertJsonPath('data.0.is_billable', false);

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

    public function test_billing_filter_excludes_services_from_inactive_categories(): void
    {
        $this->seed([RolesAndPermissionsSeeder::class, ServiceCatalogSeeder::class]);
        $cashier = $this->cashier();
        $glucose = Service::query()->where('name', 'Glucosa')->firstOrFail();

        $glucose->category->forceFill(['active' => false])->save();

        $this->actingAs($cashier)
            ->getJson('/api/services?active=1&billing=1&search=Glucosa')
            ->assertOk()
            ->assertJsonCount(0, 'data');

        $this->actingAs($cashier)
            ->getJson('/api/services?active=1&search=Glucosa')
            ->assertOk()
            ->assertJsonFragment(['name' => 'Glucosa']);
    }

    public function test_service_metadata_changes_are_audited_with_old_and_new_payloads(): void
    {
        $this->seed([RolesAndPermissionsSeeder::class, ServiceCatalogSeeder::class]);
        $admin = $this->admin();
        $service = Service::query()->where('name', 'Glucosa')->firstOrFail();
        $originalCategoryId = $service->category_id;
        $originalAreaId = $service->area_id;
        $newCategory = Category::query()->create([
            'name' => 'Administracion institucional',
            'slug' => 'administracion-institucional',
            'active' => true,
            'sort_order' => 90,
        ]);
        $newArea = Area::query()->create([
            'name' => 'Auditoria financiera',
            'slug' => 'auditoria-financiera',
            'active' => true,
        ]);

        $this->actingAs($admin)
            ->patchJson("/api/services/{$service->id}", [
                'category_id' => $newCategory->id,
                'area_id' => $newArea->id,
                'aliases' => 'azucar, glucemia, glicemia',
            ])
            ->assertOk()
            ->assertJsonPath('data.category_id', $newCategory->id)
            ->assertJsonPath('data.area_id', $newArea->id)
            ->assertJsonPath('data.aliases', 'azucar, glucemia, glicemia');

        $audit = AuditLog::query()
            ->where('action', 'service.updated')
            ->where('entity_type', Service::class)
            ->where('entity_id', $service->id)
            ->firstOrFail();

        $this->assertSame($originalCategoryId, $audit->old_values['category_id']);
        $this->assertSame($originalAreaId, $audit->old_values['area_id']);
        $this->assertSame('Glucosa (Glicemia)', $audit->old_values['aliases']);
        $this->assertSame($newCategory->id, $audit->new_values['category_id']);
        $this->assertSame($newArea->id, $audit->new_values['area_id']);
        $this->assertSame('azucar, glucemia, glicemia', $audit->new_values['aliases']);
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

    public function test_deleting_unbilled_service_requires_reason_and_deactivates_instead_of_removing_it(): void
    {
        $this->seed([RolesAndPermissionsSeeder::class, ServiceCatalogSeeder::class]);
        $admin = $this->admin();
        $service = Service::query()->where('name', 'Glucosa')->firstOrFail();
        $reason = 'Servicio retirado temporalmente de caja por revision operativa';

        $this->actingAs($admin)
            ->deleteJson("/api/services/{$service->id}")
            ->assertUnprocessable()
            ->assertJsonValidationErrors('availability_change_reason');

        $this->assertTrue($service->refresh()->active);
        $this->assertDatabaseMissing('audit_logs', [
            'action' => 'service.deactivated',
            'entity_type' => Service::class,
            'entity_id' => $service->id,
        ]);

        $this->actingAs($admin)
            ->deleteJson("/api/services/{$service->id}", [
                'availability_change_reason' => $reason,
            ])
            ->assertOk()
            ->assertJsonPath('data.id', $service->id)
            ->assertJsonPath('data.active', false);

        $this->assertDatabaseHas('services', [
            'id' => $service->id,
            'active' => false,
        ]);

        $audit = AuditLog::query()
            ->where('user_id', $admin->id)
            ->where('action', 'service.deactivated')
            ->where('entity_type', Service::class)
            ->where('entity_id', $service->id)
            ->where('result', 'success')
            ->firstOrFail();

        $this->assertSame($reason, $audit->new_values['availability_change_reason']);
    }

    public function test_deleting_invoiced_service_returns_conflict_and_keeps_it_active(): void
    {
        $this->seed([RolesAndPermissionsSeeder::class, ServiceCatalogSeeder::class]);
        $admin = $this->admin();
        $service = Service::query()->where('name', 'Glucosa')->firstOrFail();

        $this->createIssuedInvoiceForService($service, $admin);

        $this->actingAs($admin)
            ->deleteJson("/api/services/{$service->id}")
            ->assertStatus(409)
            ->assertJsonPath('message', 'No se puede eliminar un servicio facturado. Desactive el servicio para ocultarlo de nuevos cobros.');

        $this->assertTrue($service->fresh()->active);
        $this->assertDatabaseMissing('audit_logs', [
            'action' => 'service.deactivated',
            'entity_type' => Service::class,
            'entity_id' => $service->id,
        ]);
    }

    public function test_invoiced_service_cannot_be_deleted_through_model(): void
    {
        $this->seed([RolesAndPermissionsSeeder::class, ServiceCatalogSeeder::class]);
        $admin = $this->admin();
        $service = Service::query()->where('name', 'Glucosa')->firstOrFail();

        $this->createIssuedInvoiceForService($service, $admin);

        try {
            $service->delete();
            $this->fail('Deleting an invoiced service through Eloquent should be blocked.');
        } catch (LogicException $exception) {
            $this->assertSame(
                'Los servicios facturados no se eliminan; deben desactivarse para conservar el historico.',
                $exception->getMessage(),
            );
        }

        $this->assertDatabaseHas('services', [
            'id' => $service->id,
            'active' => true,
        ]);
        $this->assertDatabaseHas('invoice_items', [
            'service_id' => $service->id,
            'service_name' => 'Glucosa',
        ]);
    }

    public function test_service_change_rolls_back_when_audit_log_fails(): void
    {
        $this->seed([RolesAndPermissionsSeeder::class, ServiceCatalogSeeder::class]);
        $admin = $this->admin();
        $service = Service::query()->where('name', 'Glucosa')->firstOrFail();
        $originalPrice = (string) $service->price;

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

        $this->assertSame($originalPrice, $service->refresh()->price);
    }

    public function test_catalog_manager_can_read_catalog_detail_and_history_without_separate_view_permission(): void
    {
        $this->seed([RolesAndPermissionsSeeder::class, ServiceCatalogSeeder::class]);
        $manager = User::factory()->create();
        $manager->givePermissionTo('catalog.manage');
        $service = Service::query()->where('name', 'Glucosa')->firstOrFail();

        $this->actingAs($manager)->getJson('/api/categories')->assertOk();
        $this->actingAs($manager)->getJson('/api/services')->assertOk();
        $this->actingAs($manager)
            ->getJson("/api/services/{$service->id}")
            ->assertOk()
            ->assertJsonPath('data.id', $service->id);
        $this->actingAs($manager)
            ->getJson("/api/services/{$service->id}/history")
            ->assertOk();
    }

    public function test_service_history_exposes_useful_changes_actor_and_reason(): void
    {
        $this->seed([RolesAndPermissionsSeeder::class, ServiceCatalogSeeder::class]);
        $admin = $this->admin();
        $service = Service::query()->where('name', 'Glucosa')->firstOrFail();

        $this->actingAs($admin)
            ->patchJson("/api/services/{$service->id}", [
                'price' => '31.50',
                'price_change_reason' => 'Tarifa aprobada para el nuevo periodo',
            ])
            ->assertOk();

        $this->actingAs($admin)
            ->getJson("/api/services/{$service->id}/history")
            ->assertOk()
            ->assertJsonPath('data.0.label', 'Precio actualizado')
            ->assertJsonPath('data.0.reason', 'Tarifa aprobada para el nuevo periodo')
            ->assertJsonPath('data.0.user.id', $admin->id)
            ->assertJsonPath('data.0.changes.0.field', 'price')
            ->assertJsonPath('data.0.changes.0.after', '31.50')
            ->assertJsonMissingPath('data.0.changes.0.internal_code');
    }

    public function test_category_deactivation_reports_impact_and_requires_reason(): void
    {
        $this->seed([RolesAndPermissionsSeeder::class, ServiceCatalogSeeder::class]);
        $admin = $this->admin();
        $category = Category::query()->has('services')->firstOrFail();

        $this->actingAs($admin)
            ->getJson('/api/categories')
            ->assertOk()
            ->assertJsonFragment([
                'id' => $category->id,
                'services_count' => $category->services()->count(),
                'active_services_count' => $category->services()->where('active', true)->count(),
            ]);

        $this->actingAs($admin)
            ->patchJson("/api/categories/{$category->id}", ['active' => false])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('availability_change_reason');

        $reason = 'Categoría suspendida por revisión administrativa';
        $this->actingAs($admin)
            ->patchJson("/api/categories/{$category->id}", [
                'active' => false,
                'availability_change_reason' => $reason,
            ])
            ->assertOk()
            ->assertJsonPath('data.active', false);

        $this->assertSame($reason, AuditLog::query()
            ->where('entity_type', Category::class)
            ->where('entity_id', $category->id)
            ->latest('id')
            ->firstOrFail()
            ->reason);
    }

    private function admin(): User
    {
        $admin = User::factory()->create();
        $admin->assignRole('admin');

        return $admin->refresh();
    }

    private function cashier(): User
    {
        $cashier = User::factory()->create();
        $cashier->assignRole('cajero');

        return $cashier->refresh();
    }

    private function createIssuedInvoiceForService(Service $service, User $issuer): Invoice
    {
        $sequence = FiscalSequence::query()->create([
            'document_type' => 'invoice',
            'prefix' => '000-001-01',
            'min_number' => 1,
            'max_number' => 99999999,
            'current_number' => 1,
            'cai' => 'CATALOG-DELETE-TEST',
            'valid_until' => now()->addYear()->toDateString(),
            'active' => true,
        ]);

        $invoice = Invoice::query()->create([
            'invoice_number' => 'CAT-DEL-00000001',
            'fiscal_sequence_id' => $sequence->id,
            'fiscal_cai' => $sequence->cai,
            'tax_label' => 'ISV',
            'tax_rate_snapshot' => '15.00',
            'patient_name' => 'Paciente catalogo',
            'subtotal' => '100.00',
            'subtotal_cents' => 10000,
            'tax_amount' => '15.00',
            'tax_amount_cents' => 1500,
            'discount_amount' => '0.00',
            'discount_amount_cents' => 0,
            'total' => '115.00',
            'total_cents' => 11500,
            'paid_amount' => '0.00',
            'paid_amount_cents' => 0,
            'balance_due' => '115.00',
            'balance_due_cents' => 11500,
            'status' => Invoice::STATUS_ISSUED,
            'issued_by' => $issuer->id,
            'issued_at' => now(),
        ]);

        InvoiceItem::query()->create([
            'invoice_id' => $invoice->id,
            'service_id' => $service->id,
            'service_name' => $service->name,
            'category_id' => $service->category_id,
            'category_name' => $service->category->name,
            'area_id' => $service->area_id,
            'area_name' => $service->area->name,
            'quantity' => '1.00',
            'quantity_cents' => 100,
            'unit_price' => '100.00',
            'unit_price_cents' => 10000,
            'tax_rate' => '15.00',
            'tax_amount' => '15.00',
            'tax_amount_cents' => 1500,
            'line_subtotal' => '100.00',
            'line_subtotal_cents' => 10000,
            'line_total' => '115.00',
            'line_total_cents' => 11500,
            'special_rule_applied' => false,
        ]);

        return $invoice;
    }

    public function test_production_catalog_seed_is_exempt_and_offers_an_exempt_rate(): void
    {
        $seeder = new ServiceCatalogSeeder(true);
        $seeder->setContainer($this->app);
        $seeder->run();

        $this->assertSame(151, Service::query()->count());
        $this->assertSame(0, Service::query()->whereNotNull('tax_rate_id')->count());
        $this->assertSame(0, Service::query()->where('taxable', true)->count());

        $exemptRate = TaxRate::query()->sole();
        $this->assertSame('Exento 0 %', $exemptRate->name);
        $this->assertSame('0.00', $exemptRate->percentage);
        $this->assertFalse($exemptRate->is_default);

        // Rerun keeps the exact same catalog (no duplicate rates, no rewrites).
        $this->seed(ServiceCatalogSeeder::class);
        $this->assertSame(151, Service::query()->count());
        $this->assertSame(1, TaxRate::query()->count());
        $this->assertSame(0, Service::query()->whereNotNull('tax_rate_id')->count());
    }

    public function test_seeder_materializes_the_configured_default_tax_rate(): void
    {
        FiscalSetting::query()->create([
            'hospital_name' => 'Hospital Sintetico',
            'rtn' => '08011999000001',
            'default_tax_rate' => '15.00',
        ]);

        $this->seed(ServiceCatalogSeeder::class);

        $default = TaxRate::query()->where('is_default', true)->sole();
        $this->assertSame('ISV 15 %', $default->name);
        $this->assertSame('15.00', $default->percentage);
        $this->assertTrue($default->active);
        $this->assertSame(1, TaxRate::query()->where('percentage', '0.00')->count());

        // A-03 single source: in dev/test the seeded catalog is materialised
        // with the configured rate (no `taxable`-only rows), so the billing
        // engine and the catalog UI read the same `tax_rate_id`. The production
        // path (seed_exempt, asserted above) installs the catalog exempt.
        $this->assertSame(151, Service::query()->whereNotNull('tax_rate_id')->count());
        $this->assertSame(151, Service::query()->where('taxable', true)->count());
    }
}
