<?php

namespace Tests\Feature;

use App\Models\FiscalSetting;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class FiscalSettingsTest extends TestCase
{
    use RefreshDatabase;

    public function test_cashier_cannot_edit_fiscal_settings(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);

        $cashier = User::factory()->create();
        $cashier->assignRole('cajero');

        $this->actingAs($cashier)
            ->putJson('/api/settings/fiscal', $this->validPayload())
            ->assertForbidden();
    }

    public function test_admin_can_view_and_edit_fiscal_settings(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);

        $admin = User::factory()->create();
        $admin->assignRole('admin');

        $this->actingAs($admin)
            ->putJson('/api/settings/fiscal', $this->validPayload())
            ->assertOk()
            ->assertJsonPath('data.hospital_name', 'Hospital San Miguel')
            ->assertJsonPath('data.receipt_width', '80mm');

        $this->assertDatabaseHas('fiscal_settings', [
            'hospital_name' => 'Hospital San Miguel',
            'rtn' => '08011999123456',
            'updated_by' => $admin->id,
        ]);

        $this->actingAs($admin)
            ->getJson('/api/settings/fiscal')
            ->assertOk()
            ->assertJsonPath('data.hospital_name', 'Hospital San Miguel');
    }

    public function test_supervisor_can_view_but_not_update_fiscal_settings(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);

        FiscalSetting::query()->create($this->validPayload());

        $supervisor = User::factory()->create();
        $supervisor->assignRole('supervisor');

        $this->actingAs($supervisor)
            ->getJson('/api/settings/fiscal')
            ->assertOk();

        $this->actingAs($supervisor)
            ->putJson('/api/settings/fiscal', $this->validPayload())
            ->assertForbidden();
    }

    /**
     * @return array<string, string>
     */
    private function validPayload(): array
    {
        return [
            'hospital_name' => 'Hospital San Miguel',
            'rtn' => '08011999123456',
            'default_tax_rate' => '15.00',
            'receipt_width' => '80mm',
        ];
    }
}
