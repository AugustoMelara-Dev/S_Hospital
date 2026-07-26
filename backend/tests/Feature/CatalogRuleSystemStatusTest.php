<?php

namespace Tests\Feature;

use App\Models\Service;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Database\Seeders\ServiceCatalogSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\PermissionRegistrar;
use Tests\TestCase;

class CatalogRuleSystemStatusTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        app(PermissionRegistrar::class)->forgetCachedPermissions();
        $this->seed([RolesAndPermissionsSeeder::class, ServiceCatalogSeeder::class]);
    }

    public function test_operational_status_blocks_billing_when_institutional_catalog_rule_is_invalid(): void
    {
        $ordinary = Service::query()
            ->where('name', 'Glucosa')
            ->firstOrFail();
        $ordinary->forceFill([
            'special_rule_code' => Service::ERYTHROPOIETIN_RULE,
        ])->save();

        $response = $this->actingAs($this->admin())
            ->getJson('/api/system/status')
            ->assertOk();

        $blocker = collect($response->json('data.readiness.blockers'))
            ->firstWhere('code', 'CATALOG_INSTITUTIONAL_RULE_INVALID');

        $this->assertSame([
            'code' => 'CATALOG_INSTITUTIONAL_RULE_INVALID',
            'label' => 'Revise la regla institucional de eritropoyetina antes de facturar.',
            'status' => 'pending',
        ], $blocker);
    }

    public function test_operational_status_has_no_catalog_rule_blocker_for_seeded_catalog(): void
    {
        $response = $this->actingAs($this->admin())
            ->getJson('/api/system/status')
            ->assertOk();

        $blocker = collect($response->json('data.readiness.blockers'))
            ->firstWhere('code', 'CATALOG_INSTITUTIONAL_RULE_INVALID');

        $this->assertNull($blocker);
    }

    private function admin(): User
    {
        $admin = User::factory()->create();
        $admin->assignRole('admin');

        return $admin->refresh();
    }
}
