<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\CashRegisterSession;
use App\Models\FiscalSetting;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Session\Middleware\StartSession;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Http\Middleware\EnsureFrontendRequestsAreStateful;
use Tests\TestCase;

class FiscalSettingsTest extends TestCase
{
    use RefreshDatabase;

    public function test_cashier_cannot_edit_fiscal_settings(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);

        $cashier = User::factory()->create();
        $cashier->assignRole('cajero');
        $cashier = $cashier->refresh();

        $this->actingAs($cashier)
            ->putJson('/api/settings/fiscal', $this->validPayload())
            ->assertForbidden();
    }

    public function test_admin_can_view_and_edit_fiscal_settings(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);

        $admin = User::factory()->create();
        $admin->assignRole('admin');
        $admin = $admin->refresh();

        $this->actingAs($admin)
            ->putJson('/api/settings/fiscal', $this->validPayload())
            ->assertOk()
            ->assertJsonPath('data.hospital_name', 'Hospital San Miguel')
            ->assertJsonPath('data.receipt_paper_size', 'half_letter')
            ->assertJsonMissingPath('data.receipt_width');

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

    public function test_admin_can_save_institutional_and_thermal_receipt_paper_sizes(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);

        $admin = User::factory()->create();
        $admin->assignRole('admin');

        foreach (['half_letter', 'letter', 'a5', '80mm', '58mm'] as $paperSize) {
            $this->actingAs($admin)
                ->putJson('/api/settings/fiscal', [
                    ...$this->validPayload(),
                    'receipt_paper_size' => $paperSize,
                ])
                ->assertOk()
                ->assertJsonPath('data.receipt_paper_size', $paperSize);

            $this->assertDatabaseHas('fiscal_settings', [
                'receipt_paper_size' => $paperSize,
            ]);
        }

        $this->actingAs($admin)
            ->putJson('/api/settings/fiscal', [
                ...$this->validPayload(),
                'receipt_paper_size' => 'ticket-roll',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('receipt_paper_size');
    }

    public function test_receipt_paper_size_update_returns_deprecation_warning(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);

        $admin = User::factory()->create();
        $admin->assignRole('admin');

        $this->actingAs($admin)
            ->putJson('/api/settings/fiscal', [
                ...$this->validPayload(),
                'receipt_paper_size' => 'letter',
            ])
            ->assertOk()
            ->assertHeader(
                'Warning',
                '299 - "El campo receipt_paper_size en la configuracion fiscal esta obsoleto y se ha migrado a perfiles de impresion de recibos institucionales."',
            )
            ->assertJsonPath('warning', 'El campo receipt_paper_size en la configuración fiscal está obsoleto y se ha migrado a perfiles de impresión de recibos institucionales.')
            ->assertJsonPath('_deprecated.receipt_paper_size', 'Migrado a perfiles de impresión de recibos institucionales.');
    }

    public function test_paper_size_change_with_open_cash_session_emits_mid_shift_warning(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);

        FiscalSetting::query()->create($this->validPayload());

        $admin = User::factory()->create();
        $admin->assignRole('admin');

        $cashier = User::factory()->create();
        $cashier->assignRole('cajero');

        $session = CashRegisterSession::query()->create([
            'user_id' => $cashier->id,
            'opening_amount' => '0.00',
            'status' => CashRegisterSession::STATUS_OPEN,
            'opened_at' => now(),
        ]);

        $response = $this->actingAs($admin)
            ->putJson('/api/settings/fiscal', [
                ...$this->validPayload(),
                'receipt_paper_size' => 'letter',
            ])
            ->assertOk();

        $response->assertHeader('X-S-Hospital-Paper-Size-Warning', 'mid-shift-change');
        $response->assertJsonPath('meta.paper_size_changed_mid_shift', true);
        $response->assertJsonPath('meta.open_cash_session_id', $session->id);

        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $admin->id,
            'action' => 'fiscal_settings.paper_size_changed_mid_shift',
            'entity_type' => 'App\\Models\\FiscalSetting',
            'reason' => "Cambio de papel con caja abierta (#{$session->id}).",
        ]);
    }

    public function test_paper_size_change_without_open_cash_session_does_not_warn(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);

        FiscalSetting::query()->create($this->validPayload());

        $admin = User::factory()->create();
        $admin->assignRole('admin');

        $response = $this->actingAs($admin)
            ->putJson('/api/settings/fiscal', [
                ...$this->validPayload(),
                'receipt_paper_size' => 'letter',
            ])
            ->assertOk();

        $response->assertJsonPath('meta.paper_size_changed_mid_shift', false);
        $response->assertJsonPath('meta.open_cash_session_id', null);

        $this->assertDatabaseMissing('audit_logs', [
            'action' => 'fiscal_settings.paper_size_changed_mid_shift',
        ]);
    }

    public function test_default_tax_rate_change_requires_reason_before_mutating_settings(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);

        FiscalSetting::query()->create($this->validPayload());

        $admin = User::factory()->create();
        $admin->assignRole('admin');

        $this->actingAs($admin)
            ->putJson('/api/settings/fiscal', [
                ...$this->validPayload(),
                'default_tax_rate' => '18.00',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('reason');

        $this->assertDatabaseHas('fiscal_settings', [
            'default_tax_rate' => '15.00',
        ]);

        $this->assertDatabaseMissing('audit_logs', [
            'action' => 'fiscal_settings.updated',
            'reason' => null,
        ]);
    }

    public function test_default_tax_rate_change_with_reason_is_audited(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);

        FiscalSetting::query()->create($this->validPayload());

        $admin = User::factory()->create();
        $admin->assignRole('admin');

        $this->actingAs($admin)
            ->putJson('/api/settings/fiscal', [
                ...$this->validPayload(),
                'default_tax_rate' => '18.00',
                'reason' => 'Actualizacion autorizada del ISV',
            ])
            ->assertOk()
            ->assertJsonPath('data.default_tax_rate', '18.00');

        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $admin->id,
            'action' => 'fiscal_settings.updated',
            'entity_type' => 'App\\Models\\FiscalSetting',
            'reason' => 'Actualizacion autorizada del ISV',
        ]);
    }

    public function test_rtn_change_requires_reason_before_mutating_settings(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);

        FiscalSetting::query()->create($this->validPayload());

        $admin = User::factory()->create();
        $admin->assignRole('admin');

        $this->actingAs($admin)
            ->putJson('/api/settings/fiscal', [
                ...$this->validPayload(),
                'rtn' => '08011999111111',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('reason');

        $this->assertDatabaseHas('fiscal_settings', [
            'rtn' => '08011999123456',
        ]);
    }

    public function test_rtn_change_with_reason_is_audited(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);

        FiscalSetting::query()->create($this->validPayload());

        $admin = User::factory()->create();
        $admin->assignRole('admin');

        $this->actingAs($admin)
            ->putJson('/api/settings/fiscal', [
                ...$this->validPayload(),
                'rtn' => '08011999111111',
                'reason' => 'Correccion documentada de RTN',
            ])
            ->assertOk()
            ->assertJsonPath('data.rtn', '08011999111111');

        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $admin->id,
            'action' => 'fiscal_settings.updated',
            'entity_type' => 'App\\Models\\FiscalSetting',
            'reason' => 'Correccion documentada de RTN',
        ]);
    }

    public function test_admin_can_update_brand_color_without_full_fiscal_payload(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);

        FiscalSetting::query()->create($this->validPayload());

        $admin = User::factory()->create();
        $admin->assignRole('admin');

        $this->actingAs($admin)
            ->putJson('/api/settings/fiscal', [
                'primary_color' => 'blue',
            ])
            ->assertOk()
            ->assertJsonPath('data.primary_color', 'blue')
            ->assertJsonPath('data.rtn', '08011999123456')
            ->assertJsonPath('data.default_tax_rate', '15.00');

        $this->assertDatabaseHas('fiscal_settings', [
            'hospital_name' => 'Hospital San Miguel',
            'rtn' => '08011999123456',
            'default_tax_rate' => '15.00',
            'primary_color' => 'blue',
        ]);

        $audit = AuditLog::query()
            ->where('action', 'fiscal_settings.updated')
            ->where('entity_type', FiscalSetting::class)
            ->firstOrFail();

        $this->assertSame($admin->id, $audit->user_id);
        $this->assertNull($audit->reason);
        $this->assertSame('indigo', $audit->old_values['primary_color']);
        $this->assertSame('blue', $audit->new_values['primary_color']);
    }

    public function test_legacy_receipt_width_field_is_not_updateable(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);

        $admin = User::factory()->create();
        $admin->assignRole('admin');

        $this->actingAs($admin)
            ->putJson('/api/settings/fiscal', [
                ...$this->validPayload(),
                'receipt_width' => '80mm',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('receipt_width');
    }

    public function test_guest_cannot_view_full_fiscal_settings_but_can_view_public_branding(): void
    {
        FiscalSetting::query()->create([
            'receipt_template_mode' => 'thermal',
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

    public function test_public_branding_and_logo_routes_do_not_start_sessions(): void
    {
        foreach (['api/settings/branding', 'api/settings/logo', 'api/settings/logo/file'] as $uri) {
            $route = collect(app('router')->getRoutes())
                ->first(fn ($candidate): bool => $candidate->uri() === $uri && in_array('GET', $candidate->methods(), true));

            $this->assertNotNull($route, "{$uri} route must exist");
            $this->assertNotContains(EnsureFrontendRequestsAreStateful::class, $route->gatherMiddleware(), "{$uri} must stay stateless before login.");
            $this->assertNotContains(StartSession::class, $route->gatherMiddleware(), "{$uri} must not mutate auth cookies before login.");
        }
    }

    public function test_cashier_cannot_view_full_fiscal_settings(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);

        FiscalSetting::query()->create([
            'receipt_template_mode' => 'thermal',
            ...$this->validPayload(),
            'scanner_enabled' => true,
            'partial_payments_enabled' => true,
        ]);

        $cashier = User::factory()->create();
        $cashier->assignRole('cajero');

        $this->actingAs($cashier)
            ->getJson('/api/settings/fiscal')
            ->assertForbidden();
    }

    public function test_cashier_can_view_minimal_operational_settings_without_full_fiscal_or_receipt_profile_data(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);

        FiscalSetting::query()->create([
            'receipt_template_mode' => 'thermal',
            ...$this->validPayload(),
            'scanner_enabled' => true,
            'partial_payments_enabled' => true,
        ]);

        $cashier = User::factory()->create();
        $cashier->assignRole('cajero');

        $this->getJson('/api/settings/operational')
            ->assertUnauthorized();

        $this->actingAs($cashier)
            ->getJson('/api/settings/operational')
            ->assertOk()
            ->assertJsonPath('data.default_tax_rate', '15.00')
            ->assertJsonPath('data.scanner_enabled', true)
            ->assertJsonPath('data.partial_payments_enabled', true)
            ->assertJsonMissingPath('data.receipt_paper_size')
            ->assertJsonMissingPath('data.rtn')
            ->assertJsonMissingPath('data.address');
    }

    public function test_admin_can_update_operational_settings_without_full_fiscal_payload(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);

        FiscalSetting::query()->create([
            ...$this->validPayload(),
            'scanner_enabled' => true,
            'partial_payments_enabled' => false,
        ]);

        $admin = User::factory()->create();
        $admin->assignRole('admin');

        $this->actingAs($admin)
            ->putJson('/api/settings/operational', [
                'scanner_enabled' => false,
                'partial_payments_enabled' => true,
            ])
            ->assertOk()
            ->assertJsonPath('data.scanner_enabled', false)
            ->assertJsonPath('data.partial_payments_enabled', true)
            ->assertJsonMissingPath('data.rtn')
            ->assertJsonMissingPath('data.hospital_name')
            ->assertJsonMissingPath('data.receipt_paper_size');

        $this->assertDatabaseHas('fiscal_settings', [
            'scanner_enabled' => false,
            'partial_payments_enabled' => true,
            'hospital_name' => 'Hospital San Miguel',
            'rtn' => '08011999123456',
        ]);

        $audit = AuditLog::query()
            ->where('action', 'operational_settings.updated')
            ->where('entity_type', FiscalSetting::class)
            ->firstOrFail();

        $this->assertSame($admin->id, $audit->user_id);
        $this->assertSame([
            'scanner_enabled' => true,
            'partial_payments_enabled' => false,
        ], $audit->old_values);
        $this->assertSame([
            'scanner_enabled' => false,
            'partial_payments_enabled' => true,
        ], $audit->new_values);
    }

    public function test_supervisor_can_view_but_not_update_fiscal_settings(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);

        FiscalSetting::query()->create($this->validPayload());

        $supervisor = User::factory()->create();
        $supervisor->assignRole('supervisor');
        $supervisor = $supervisor->refresh();

        $this->actingAs($supervisor)
            ->getJson('/api/settings/fiscal')
            ->assertOk();

        $this->actingAs($supervisor)
            ->putJson('/api/settings/fiscal', $this->validPayload())
            ->assertForbidden();
    }

    public function test_admin_can_upload_logo_and_public_endpoint_returns_cache_busted_url(): void
    {
        Storage::fake('public');
        $this->seed(RolesAndPermissionsSeeder::class);

        $admin = User::factory()->create();
        $admin->assignRole('admin');

        $this->actingAs($admin)
            ->postJson('/api/settings/logo', [
                'logo' => UploadedFile::fake()->image('hospital.png', 320, 160),
            ])
            ->assertOk()
            ->assertJsonPath('message', 'Logo actualizado con exito.')
            ->assertJsonPath('logo_url', fn (string $url): bool => str_contains($url, '/api/settings/logo/file?t='));

        Storage::disk('public')->assertExists('branding/logo.png');
        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $admin->id,
            'action' => 'settings.logo.updated',
        ]);

        $audit = AuditLog::query()
            ->where('action', 'settings.logo.updated')
            ->firstOrFail();

        $this->assertSame('image/png', $audit->new_values['mime_type']);
        $this->assertArrayHasKey('sha256', $audit->new_values);
        $this->assertArrayNotHasKey('path', $audit->new_values);

        $this->getJson('/api/settings/logo')
            ->assertOk()
            ->assertJsonPath('logo_url', fn (?string $url): bool => is_string($url) && str_contains($url, '/api/settings/logo/file?t='));

        $response = $this->get('/api/settings/logo/file')
            ->assertOk();

        $cacheControl = (string) $response->headers->get('cache-control', '');
        $this->assertStringContainsString('public', $cacheControl);
        $this->assertStringContainsString('max-age=300', $cacheControl);
    }

    public function test_logo_upload_requires_fiscal_update_permission_and_image_file(): void
    {
        Storage::fake('public');
        $this->seed(RolesAndPermissionsSeeder::class);

        $cashier = User::factory()->create();
        $cashier->assignRole('cajero');

        $this->actingAs($cashier)
            ->postJson('/api/settings/logo', [
                'logo' => UploadedFile::fake()->image('hospital.png'),
            ])
            ->assertForbidden();

        $admin = User::factory()->create();
        $admin->assignRole('admin');

        $this->actingAs($admin)
            ->postJson('/api/settings/logo', [
                'logo' => UploadedFile::fake()->create('hospital.txt', 1, 'text/plain'),
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('logo');
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
