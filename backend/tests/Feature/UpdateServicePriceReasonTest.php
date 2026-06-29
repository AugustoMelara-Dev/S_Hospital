<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\Category;
use App\Models\Service;
use App\Models\ServicePriceHistory;

use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class UpdateServicePriceReasonTest extends TestCase
{
    use RefreshDatabase;

    public function test_price_change_without_reason_returns_422(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $admin = User::factory()->create();
        $admin->assignRole('admin');

        $category = Category::query()->create([
            'name' => 'Laboratorio',
            'slug' => 'laboratorio',
            'active' => true,
            'sort_order' => 1,
        ]);

        $service = Service::query()->create([
            'category_id' => $category->id,
            'name' => 'Hemograma',
            'slug' => 'hemograma',
            'price' => '100.00',
            'taxable' => true,
            'active' => true,
            'is_billable' => true,
            'visible_in_billing' => true,
        ]);

        $this->actingAs($admin)
            ->patchJson("/api/services/{$service->id}", [
                'price' => '120.00',
            ])
            ->assertStatus(422)
            ->assertJsonPath('errors.price_change_reason.0', fn ($message) => is_string($message) && $message !== '');

        $this->assertSame('100.00', $service->fresh()->price);
    }

    public function test_price_change_with_reason_persists_history_and_audit(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $admin = User::factory()->create();
        $admin->assignRole('admin');

        $category = Category::query()->create([
            'name' => 'Laboratorio',
            'slug' => 'laboratorio',
            'active' => true,
            'sort_order' => 1,
        ]);

        $service = Service::query()->create([
            'category_id' => $category->id,
            'name' => 'Hemograma',
            'slug' => 'hemograma',
            'price' => '100.00',
            'taxable' => true,
            'active' => true,
            'is_billable' => true,
            'visible_in_billing' => true,
        ]);

        $this->actingAs($admin)
            ->patchJson("/api/services/{$service->id}", [
                'price' => '120.00',
                'price_change_reason' => 'Ajuste autorizado por administracion central segun memo 2026-04.',
            ])
            ->assertOk();

        $service->refresh();
        $this->assertSame('120.00', $service->price);

        $this->assertDatabaseHas('service_price_histories', [
            'service_id' => $service->id,
            'old_price' => '100.00',
            'new_price' => '120.00',
        ]);

        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $admin->id,
            'action' => 'service.price_updated',
            'entity_type' => Service::class,
            'entity_id' => $service->id,
            'result' => 'success',
        ]);
    }

    public function test_unchanged_price_does_not_require_reason(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $admin = User::factory()->create();
        $admin->assignRole('admin');

        $category = Category::query()->create([
            'name' => 'Radiologia',
            'slug' => 'radiologia',
            'active' => true,
            'sort_order' => 2,
        ]);

        $service = Service::query()->create([
            'category_id' => $category->id,
            'name' => 'Rayos X',
            'slug' => 'rayos-x',
            'price' => '250.00',
            'taxable' => true,
            'active' => true,
            'is_billable' => true,
            'visible_in_billing' => true,
        ]);

        $this->actingAs($admin)
            ->patchJson("/api/services/{$service->id}", [
                'price' => '250.00',
            ])
            ->assertOk();

        $this->assertSame(0, \App\Models\ServicePriceHistory::query()->count());
    }
}
