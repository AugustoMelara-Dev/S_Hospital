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
            ->assertJsonPath('data.receipt_paper_size', 'half_letter');

        $this->assertDatabaseHas('fiscal_settings', [
            'hospital_name' => 'Hospital San Miguel',
            'rtn' => '08011999123456',
            'updated_by' => $admin->id,
        ]);
        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $admin->id,
            'action' => 'fiscal_settings.created',
            'entity_type' => 'App\\Models\\FiscalSetting',
        ]);

        $this->actingAs($admin)
            ->getJson('/api/settings/fiscal')
            ->assertOk()
            ->assertJsonPath('data.hospital_name', 'Hospital San Miguel');

        $this->actingAs($admin)
            ->putJson('/api/settings/fiscal', [
                ...$this->validPayload(),
                'hospital_name' => 'Hospital San Miguel Actualizado',
            ])
            ->assertOk();

        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $admin->id,
            'action' => 'fiscal_settings.updated',
            'entity_type' => 'App\\Models\\FiscalSetting',
        ]);
    }

    public function test_guest_cannot_view_full_fiscal_settings_but_can_view_public_branding(): void
    {
        FiscalSetting::query()->create([
            ...$this->validPayload(),
            'scanner_enabled' => true,
            'partial_payments_enabled' => true,
        ]);

        $this->getJson('/api/settings/fiscal')
            ->assertUnauthorized();

        $this->getJson('/api/settings/branding')
            ->assertOk()
            ->assertJsonPath('data.hospital_name', 'Hospital San Miguel')
            ->assertJsonMissingPath('data.rtn')
            ->assertJsonMissingPath('data.scanner_enabled')
            ->assertJsonMissingPath('data.partial_payments_enabled');
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
            'receipt_paper_size' => 'half_letter',
            'primary_color' => 'indigo',
            'address' => 'Barrio El Centro',
            'slogan' => 'Tu salud es nuestra prioridad',
        ];
    }
}
