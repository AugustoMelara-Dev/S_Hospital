<?php

namespace Tests\Feature\Catalog;

use App\Models\Service;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Database\Seeders\ServiceCatalogSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\PermissionRegistrar;
use Tests\TestCase;

class InstitutionalServiceRuleProtectionTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        app(PermissionRegistrar::class)->forgetCachedPermissions();
        $this->seed([RolesAndPermissionsSeeder::class, ServiceCatalogSeeder::class]);
    }

    public function test_new_service_cannot_assign_institutional_erythropoietin_rule(): void
    {
        $erythropoietin = Service::query()->where('name', 'Eritropoyetina')->firstOrFail();

        $this->actingAs($this->admin())
            ->postJson('/api/services', [
                'category_id' => $erythropoietin->category_id,
                'area_id' => $erythropoietin->area_id,
                'name' => 'Producto alterno de farmacia',
                'price' => '25.00',
                'taxable' => false,
                'active' => true,
                'visible_in_billing' => true,
                'is_billable' => true,
                'special_rule_code' => Service::ERYTHROPOIETIN_RULE,
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('special_rule_code');

        $this->assertDatabaseMissing('services', [
            'name' => 'Producto alterno de farmacia',
            'special_rule_code' => Service::ERYTHROPOIETIN_RULE,
        ]);
    }

    public function test_ordinary_service_cannot_be_updated_to_assign_institutional_erythropoietin_rule(): void
    {
        $service = Service::query()->where('name', 'Glucosa')->firstOrFail();

        $this->actingAs($this->admin())
            ->patchJson("/api/services/{$service->id}", [
                'price' => '25.00',
                'price_change_reason' => 'Intento de asignar regla protegida',
                'taxable' => false,
                'tax_change_reason' => 'Intento de asignar regla protegida',
                'special_rule_code' => Service::ERYTHROPOIETIN_RULE,
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('special_rule_code');

        $service->refresh();
        $this->assertNull($service->special_rule_code);
    }

    public function test_seeded_erythropoietin_keeps_rule_when_ordinary_fields_are_updated(): void
    {
        $service = Service::query()->where('name', 'Eritropoyetina')->firstOrFail();

        $this->actingAs($this->admin())
            ->patchJson("/api/services/{$service->id}", [
                'description' => 'Medicamento institucional protegido',
            ])
            ->assertOk()
            ->assertJsonPath('data.special_rule_code', Service::ERYTHROPOIETIN_RULE);

        $this->assertSame(
            Service::ERYTHROPOIETIN_RULE,
            $service->refresh()->special_rule_code,
        );
    }

    private function admin(): User
    {
        $admin = User::factory()->create();
        $admin->assignRole('admin');

        return $admin->refresh();
    }
}
