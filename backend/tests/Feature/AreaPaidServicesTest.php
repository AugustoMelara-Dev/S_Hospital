<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class AreaPaidServicesTest extends TestCase
{
    use RefreshDatabase;

    public function test_area_services_legacy_scope_is_not_active_in_final_billing_release(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);

        $this->assertNull(Permission::query()->where('name', 'area_services.view')->where('guard_name', 'web')->first());
        $this->assertNull(Role::query()->where('name', 'usuario_area')->where('guard_name', 'web')->first());

        $user = User::factory()->create([
            'must_change_password' => false,
        ]);
        $user->assignRole('admin');

        $this->actingAs($user)
            ->getJson('/api/area-services/paid')
            ->assertNotFound();
    }
}
