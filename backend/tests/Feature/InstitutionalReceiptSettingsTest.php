<?php

namespace Tests\Feature;

use App\Models\CashRegisterSession;
use App\Models\FiscalSetting;
use App\Models\InstitutionalReceipt;
use App\Models\InstitutionalReceiptSeries;
use App\Models\ReceiptPrintProfile;
use App\Models\ReceiptProfileAssignment;
use App\Models\User;
use Database\Seeders\ReceiptPrintProfileSeeder;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class InstitutionalReceiptSettingsTest extends TestCase
{
    use RefreshDatabase;

    public function test_cashier_cannot_update_institutional_receipt_settings(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);

        $cashier = User::factory()->create();
        $cashier->assignRole('cajero');

        $this->actingAs($cashier)
            ->putJson('/api/settings/institutional-receipts/institution', $this->validInstitutionPayload())
            ->assertForbidden();
    }

    public function test_admin_can_view_and_update_institutional_receipt_institution_settings(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $this->seed(ReceiptPrintProfileSeeder::class);

        $admin = User::factory()->create();
        $admin->assignRole('admin');

        $this->actingAs($admin)
            ->getJson('/api/settings/institutional-receipts')
            ->assertOk()
            ->assertJsonPath('data.print_profiles.0.code', 'media_carta_horizontal');

        $this->actingAs($admin)
            ->putJson('/api/settings/institutional-receipts/institution', $this->validInstitutionPayload())
            ->assertOk()
            ->assertJsonPath('data.hospital_name', 'Hospital San Isidro')
            ->assertJsonPath('data.receipt_template_mode', 'institutional');

        $this->assertDatabaseHas('fiscal_settings', [
            'hospital_name' => 'Hospital San Isidro',
            'rtn' => '08011999123456',
            'updated_by' => $admin->id,
        ]);
        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $admin->id,
            'action' => 'institutional_receipt.settings.created',
            'entity_type' => FiscalSetting::class,
        ]);
    }

    public function test_view_only_user_does_not_receive_technical_print_profile_fields(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $this->seed(ReceiptPrintProfileSeeder::class);

        $user = User::factory()->create();
        $user->givePermissionTo('receipt_settings.view');
        $profile = ReceiptPrintProfile::query()
            ->where('code', ReceiptPrintProfile::CODE_HALF_LETTER)
            ->firstOrFail();

        ReceiptProfileAssignment::query()->create([
            'receipt_print_profile_id' => $profile->id,
            'scope_type' => ReceiptProfileAssignment::SCOPE_GLOBAL,
            'scope_id' => null,
            'active' => true,
            'created_by' => $user->id,
            'updated_by' => $user->id,
        ]);

        $response = $this->actingAs($user)
            ->getJson('/api/settings/institutional-receipts')
            ->assertOk()
            ->assertJsonPath('data.print_profiles.0.code', ReceiptPrintProfile::CODE_HALF_LETTER);

        $payload = $response->json('data');
        $encoded = json_encode($payload, JSON_THROW_ON_ERROR);

        foreach ([
            'width_mm',
            'height_mm',
            'margin_top_mm',
            'margin_right_mm',
            'margin_bottom_mm',
            'margin_left_mm',
            'font_family',
            'font_scale',
            'show_technical_fields',
            ReceiptPrintProfile::CODE_THERMAL_80,
            ReceiptPrintProfile::CODE_THERMAL_58,
            ReceiptPrintProfile::CODE_CUSTOM_SMALL,
        ] as $hiddenValue) {
            $this->assertStringNotContainsString($hiddenValue, $encoded);
        }

        $this->assertSame([
            'id',
            'code',
            'name',
            'copies_mode',
            'show_copy_legend',
            'show_physical_seal_space',
            'use_logo',
            'active',
            'is_global_default',
        ], array_keys($payload['print_profiles'][0]));
        $this->assertSame([
            'id',
            'scope_type',
            'scope_id',
            'active',
            'print_profile',
        ], array_keys($payload['assignments'][0]));
        $this->assertArrayNotHasKey('receipt_print_profile_id', $payload['assignments'][0]);
        $this->assertArrayNotHasKey('profile_code', $payload['assignments'][0]);
        $this->assertArrayNotHasKey('profile_name', $payload['assignments'][0]);
    }

    public function test_institutional_receipt_settings_accept_missing_rtn_when_not_applicable(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);

        $admin = User::factory()->create();
        $admin->assignRole('admin');

        $this->actingAs($admin)
            ->putJson('/api/settings/institutional-receipts/institution', [
                ...$this->validInstitutionPayload(),
                'rtn' => null,
            ])
            ->assertOk()
            ->assertJsonPath('data.rtn', '');

        $this->assertDatabaseHas('fiscal_settings', [
            'hospital_name' => 'Hospital San Isidro',
            'rtn' => '',
        ]);
    }

    public function test_admin_can_create_and_update_series_with_audit(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);

        $admin = User::factory()->create();
        $admin->assignRole('admin');

        $response = $this->actingAs($admin)
            ->postJson('/api/settings/institutional-receipts/series', $this->validSeriesPayload())
            ->assertCreated()
            ->assertJsonPath('data.series', 'REC-A')
            ->assertJsonPath('data.active', true);

        $seriesId = $response->json('data.id');

        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $admin->id,
            'action' => 'institutional_receipt_series.created',
            'entity_type' => InstitutionalReceiptSeries::class,
            'entity_id' => $seriesId,
        ]);

        $this->actingAs($admin)
            ->patchJson("/api/settings/institutional-receipts/series/{$seriesId}", [
                'current_number' => 2,
                'receipt_number_color' => '#991b1b',
            ])
            ->assertOk()
            ->assertJsonPath('data.current_number', 2)
            ->assertJsonPath('data.receipt_number_color', '#991b1b');

        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $admin->id,
            'action' => 'institutional_receipt_series.updated',
            'entity_type' => InstitutionalReceiptSeries::class,
            'entity_id' => $seriesId,
        ]);
    }

    public function test_invalid_custom_profile_dimensions_are_rejected(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $this->seed(ReceiptPrintProfileSeeder::class);

        $admin = User::factory()->create();
        $admin->assignRole('admin');

        $profile = ReceiptPrintProfile::query()
            ->where('code', ReceiptPrintProfile::CODE_CUSTOM_SMALL)
            ->firstOrFail();

        $this->actingAs($admin)
            ->patchJson("/api/settings/institutional-receipts/print-profiles/{$profile->id}", [
                'active' => true,
                'paper_kind' => 'custom_mm',
                'width_mm' => '45.00',
                'height_mm' => '95.00',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('width_mm');
    }

    public function test_standard_profile_dimensions_must_match_real_paper_size(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $this->seed(ReceiptPrintProfileSeeder::class);

        $admin = User::factory()->create();
        $admin->assignRole('admin');

        $profile = ReceiptPrintProfile::query()
            ->where('code', ReceiptPrintProfile::CODE_HALF_LETTER)
            ->firstOrFail();

        $this->actingAs($admin)
            ->patchJson("/api/settings/institutional-receipts/print-profiles/{$profile->id}", [
                'paper_kind' => 'half_letter_landscape',
                'width_mm' => '180.00',
                'height_mm' => '139.70',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('width_mm');
    }

    public function test_active_duplicate_series_is_rejected(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);

        $admin = User::factory()->create();
        $admin->assignRole('admin');

        InstitutionalReceiptSeries::query()->create([
            ...$this->validSeriesPayload(),
            'created_by' => $admin->id,
            'updated_by' => $admin->id,
        ]);

        $this->actingAs($admin)
            ->postJson('/api/settings/institutional-receipts/series', [
                ...$this->validSeriesPayload(),
                'series' => 'REC-B',
                'prefix' => 'RB',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('active');
    }

    public function test_active_series_next_number_must_remain_inside_range(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);

        $admin = User::factory()->create();
        $admin->assignRole('admin');

        $this->actingAs($admin)
            ->postJson('/api/settings/institutional-receipts/series', [
                ...$this->validSeriesPayload(),
                'min_number' => 10,
                'max_number' => 20,
                'current_number' => 20,
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('current_number');
    }

    public function test_current_number_cannot_be_lowered_below_emitted_receipts(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);

        $admin = User::factory()->create();
        $admin->assignRole('admin');

        $series = InstitutionalReceiptSeries::query()->create([
            ...$this->validSeriesPayload(),
            'current_number' => 8,
            'created_by' => $admin->id,
            'updated_by' => $admin->id,
        ]);

        InstitutionalReceipt::query()->create([
            'cash_session_id' => $this->createCashSession($admin)->id,
            'series_id' => $series->id,
            'receipt_number' => 7,
            'receipt_number_full' => 'REC-A-00000007',
            'amount' => '115.00',
            'amount_cents' => 11500,
            'issued_at' => now(),
            'issued_by' => $admin->id,
            'payer_name' => 'Maria Lopez',
            'concept' => 'Servicios hospitalarios',
            'amount_words' => 'CIENTO QUINCE LEMPIRAS EXACTOS',
            'template_code' => 'institutional_classic',
            'print_profile_code' => ReceiptPrintProfile::CODE_HALF_LETTER,
            'copy_mode' => 'original_only',
            'institution_snapshot' => ['name' => 'Hospital San Isidro'],
            'series_snapshot' => ['series' => $series->series],
            'profile_snapshot' => ['code' => ReceiptPrintProfile::CODE_HALF_LETTER],
            'items_snapshot' => [['name' => 'Consulta', 'amount' => '115.00']],
        ]);

        $this->actingAs($admin)
            ->patchJson("/api/settings/institutional-receipts/series/{$series->id}", [
                'current_number' => 6,
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('current_number');

        $this->actingAs($admin)
            ->patchJson("/api/settings/institutional-receipts/series/{$series->id}", [
                'current_number' => 7,
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('current_number');
    }

    public function test_current_number_no_op_update_is_allowed_when_receipt_exists_at_same_number(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);

        $admin = User::factory()->create();
        $admin->assignRole('admin');

        $series = InstitutionalReceiptSeries::query()->create([
            ...$this->validSeriesPayload(),
            'current_number' => 7,
            'created_by' => $admin->id,
            'updated_by' => $admin->id,
        ]);

        InstitutionalReceipt::query()->create([
            'cash_session_id' => $this->createCashSession($admin)->id,
            'series_id' => $series->id,
            'receipt_number' => 7,
            'receipt_number_full' => 'REC-A-00000007',
            'amount' => '115.00',
            'amount_cents' => 11500,
            'issued_at' => now(),
            'issued_by' => $admin->id,
            'payer_name' => 'Maria Lopez',
            'concept' => 'Servicios hospitalarios',
            'amount_words' => 'CIENTO QUINCE LEMPIRAS EXACTOS',
            'template_code' => 'institutional_classic',
            'print_profile_code' => ReceiptPrintProfile::CODE_HALF_LETTER,
            'copy_mode' => 'original_only',
            'institution_snapshot' => ['name' => 'Hospital San Isidro'],
            'series_snapshot' => ['series' => $series->series],
            'profile_snapshot' => ['code' => ReceiptPrintProfile::CODE_HALF_LETTER],
            'items_snapshot' => [['name' => 'Consulta', 'amount' => '115.00']],
        ]);

        $this->actingAs($admin)
            ->patchJson("/api/settings/institutional-receipts/series/{$series->id}", [
                'current_number' => 7,
                'receipt_number_color' => '#991b1b',
            ])
            ->assertOk()
            ->assertJsonPath('data.current_number', 7)
            ->assertJsonPath('data.receipt_number_color', '#991b1b');
    }

    public function test_test_preview_requires_permission_and_does_not_reserve_numbers_but_audits(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $this->seed(ReceiptPrintProfileSeeder::class);

        $cashier = User::factory()->create();
        $cashier->assignRole('cajero');

        $this->actingAs($cashier)
            ->postJson('/api/settings/institutional-receipts/test-preview')
            ->assertForbidden();

        $admin = User::factory()->create();
        $admin->assignRole('admin');

        $series = InstitutionalReceiptSeries::query()->create([
            ...$this->validSeriesPayload(),
            'current_number' => 4,
            'created_by' => $admin->id,
            'updated_by' => $admin->id,
        ]);

        $this->actingAs($admin)
            ->postJson('/api/settings/institutional-receipts/test-preview', [
                'profile_code' => ReceiptPrintProfile::CODE_HALF_LETTER,
                'payer_name' => 'Paciente de prueba',
                'amount' => '25.00',
            ])
            ->assertOk()
            ->assertJsonPath('data.watermark', 'PRUEBA - SIN VALIDEZ')
            ->assertJsonPath('data.next_receipt_number', 5);

        $this->assertSame(4, $series->fresh()->current_number);
        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $admin->id,
            'action' => 'institutional_receipt.test_preview_requested',
            'entity_type' => InstitutionalReceiptSeries::class,
            'entity_id' => $series->id,
        ]);
    }

    public function test_test_preview_and_print_reject_support_profiles_without_advanced_permission(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $this->seed(ReceiptPrintProfileSeeder::class);

        $operator = User::factory()->create();
        $operator->givePermissionTo('receipts.print_test');

        foreach (['test-preview', 'test-print'] as $endpoint) {
            $this->actingAs($operator)
                ->postJson("/api/settings/institutional-receipts/{$endpoint}", [
                    'profile_code' => ReceiptPrintProfile::CODE_THERMAL_80,
                    'payer_name' => 'Paciente prueba',
                    'amount' => '25.00',
                ])
                ->assertForbidden()
                ->assertJsonValidationErrors('receipt_settings.advanced');
        }

        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $operator->id,
            'action' => 'receipt_settings.advanced_denied',
            'entity_type' => ReceiptPrintProfile::class,
            'result' => 'failed',
        ]);

        $this->actingAs($operator)
            ->postJson('/api/settings/institutional-receipts/test-preview', [
                'profile_code' => ReceiptPrintProfile::CODE_HALF_LETTER,
                'payer_name' => 'Paciente prueba',
                'amount' => '25.00',
            ])
            ->assertOk()
            ->assertJsonPath('data.profile.code', ReceiptPrintProfile::CODE_HALF_LETTER);
    }

    /**
     * @return array<string, mixed>
     */
    private function validInstitutionPayload(): array
    {
        return [
            'hospital_name' => 'Hospital San Isidro',
            'rtn' => '08011999123456',
            'address' => 'Barrio El Centro',
            'slogan' => 'Servicio institucional',
            'government_line' => 'Gobierno de Honduras',
            'secretariat_line' => 'Secretaria de Salud',
            'receipt_location' => 'La Esperanza, Intibuca',
            'receipt_footer_text' => 'Gracias por su pago',
            'receipt_template_mode' => 'institutional',
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function validSeriesPayload(): array
    {
        return [
            'document_type' => InstitutionalReceiptSeries::DOCUMENT_TYPE,
            'series' => 'REC-A',
            'prefix' => 'RA',
            'number_format' => '{series}-{number:08}',
            'min_number' => 1,
            'max_number' => 100,
            'current_number' => 0,
            'range_authorization' => 'AUTORIZACION-RECIBOS',
            'legal_text' => 'Recibo institucional',
            'receipt_number_color' => '#b91c1c',
            'active' => true,
            'reprint_behavior' => InstitutionalReceiptSeries::REPRINT_AUDIT_ONLY,
            'void_behavior' => InstitutionalReceiptSeries::VOID_PERMISSION_REASON_AUDIT,
        ];
    }

    private function createCashSession(User $user): CashRegisterSession
    {
        return CashRegisterSession::query()->create([
            'user_id' => $user->id,
            'open_user_id' => $user->id,
            'opening_amount' => '100.00',
            'status' => CashRegisterSession::STATUS_OPEN,
            'opened_at' => now(),
        ]);
    }
}
