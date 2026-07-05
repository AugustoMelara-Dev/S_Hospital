<?php

namespace Tests\Feature;

use App\Models\ReceiptPrintProfile;
use App\Models\User;
use Database\Seeders\ReceiptPrintProfileSeeder;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ReceiptPrintProfileAdvancedFieldsTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_without_advanced_permission_cannot_send_manual_fields(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $this->seed(ReceiptPrintProfileSeeder::class);

        $user = User::factory()->create();
        $user->givePermissionTo('receipt_settings.update');

        $this->assertTrue($user->can('receipt_settings.update'));
        $this->assertFalse($user->can('receipt_settings.advanced'));

        $profile = ReceiptPrintProfile::query()
            ->where('code', ReceiptPrintProfile::CODE_HALF_LETTER)
            ->firstOrFail();

        $response = $this->actingAs($user)
            ->patchJson("/api/settings/institutional-receipts/print-profiles/{$profile->id}", [
                'width_mm' => '200.00',
            ]);

        $response->assertStatus(403);

        $body = $response->json();
        $this->assertArrayHasKey('errors', $body);
        $this->assertArrayHasKey('receipt_settings.advanced', $body['errors']);
        $this->assertNotEmpty($body['errors']['receipt_settings.advanced']);
        $this->assertIsString($body['errors']['receipt_settings.advanced'][0]);
        $this->assertNotSame('', $body['errors']['receipt_settings.advanced'][0]);

        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $user->id,
            'action' => 'receipt_settings.advanced_denied',
            'entity_type' => ReceiptPrintProfile::class,
            'entity_id' => $profile->id,
            'result' => 'denied',
        ]);
    }

    public function test_user_without_advanced_permission_cannot_change_technical_print_fields(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $this->seed(ReceiptPrintProfileSeeder::class);

        $user = User::factory()->create();
        $user->givePermissionTo('receipt_settings.update');

        $profile = ReceiptPrintProfile::query()
            ->where('code', ReceiptPrintProfile::CODE_HALF_LETTER)
            ->firstOrFail();

        $this->actingAs($user)
            ->patchJson("/api/settings/institutional-receipts/print-profiles/{$profile->id}", [
                'paper_kind' => 'custom_mm',
                'orientation' => 'portrait',
                'show_technical_fields' => true,
            ])
            ->assertStatus(403)
            ->assertJsonValidationErrors('receipt_settings.advanced');

        $profile->refresh();
        $this->assertSame('half_letter_landscape', $profile->paper_kind);
        $this->assertSame('landscape', $profile->orientation);
        $this->assertFalse((bool) $profile->show_technical_fields);

        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $user->id,
            'action' => 'receipt_settings.advanced_denied',
            'entity_type' => ReceiptPrintProfile::class,
            'entity_id' => $profile->id,
            'result' => 'denied',
        ]);
    }

    public function test_user_without_advanced_permission_cannot_activate_support_only_profiles(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $this->seed(ReceiptPrintProfileSeeder::class);

        $user = User::factory()->create();
        $user->givePermissionTo('receipt_settings.update');

        $profile = ReceiptPrintProfile::query()
            ->where('code', ReceiptPrintProfile::CODE_THERMAL_80)
            ->firstOrFail();

        $this->actingAs($user)
            ->patchJson("/api/settings/institutional-receipts/print-profiles/{$profile->id}", [
                'active' => true,
            ])
            ->assertStatus(403)
            ->assertJsonValidationErrors('receipt_settings.advanced');

        $this->assertFalse((bool) $profile->refresh()->active);
    }

    public function test_standard_profile_normal_fields_remain_allowed_without_advanced_permission(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $this->seed(ReceiptPrintProfileSeeder::class);

        $user = User::factory()->create();
        $user->givePermissionTo('receipt_settings.update');

        $profile = ReceiptPrintProfile::query()
            ->where('code', ReceiptPrintProfile::CODE_A5)
            ->firstOrFail();

        $this->actingAs($user)
            ->patchJson("/api/settings/institutional-receipts/print-profiles/{$profile->id}", [
                'template_code' => 'institutional_classic',
                'copies_mode' => 'original_first',
                'show_copy_legend' => false,
                'show_physical_seal_space' => true,
                'use_logo' => true,
                'active' => true,
                'is_global_default' => true,
            ])
            ->assertOk();

        $profile->refresh();
        $this->assertSame('institutional_classic', $profile->template_code);
        $this->assertSame('original_first', $profile->copies_mode);
        $this->assertFalse((bool) $profile->show_copy_legend);
        $this->assertTrue((bool) $profile->show_physical_seal_space);
        $this->assertTrue((bool) $profile->use_logo);
        $this->assertTrue((bool) $profile->active);
        $this->assertTrue((bool) $profile->is_global_default);
    }

    public function test_advanced_manual_fields_require_support_reason(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $this->seed(ReceiptPrintProfileSeeder::class);

        $support = User::factory()->create();
        $support->assignRole('soporte_tecnico');

        $profile = ReceiptPrintProfile::query()
            ->where('code', ReceiptPrintProfile::CODE_HALF_LETTER)
            ->firstOrFail();
        $originalScale = (string) $profile->font_scale;

        $this->actingAs($support)
            ->patchJson("/api/settings/institutional-receipts/print-profiles/{$profile->id}", [
                'font_scale' => '1.10',
                'width_mm' => '215.90',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('support_reason');

        $this->assertSame($originalScale, (string) $profile->refresh()->font_scale);
        $this->assertDatabaseMissing('audit_logs', [
            'user_id' => $support->id,
            'action' => 'receipt_print_profile.updated',
            'entity_type' => ReceiptPrintProfile::class,
            'entity_id' => $profile->id,
        ]);
    }

    public function test_user_with_advanced_permission_can_update_manual_fields_and_is_audited(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $this->seed(ReceiptPrintProfileSeeder::class);

        $support = User::factory()->create();
        $support->assignRole('soporte_tecnico');

        $profile = ReceiptPrintProfile::query()
            ->where('code', ReceiptPrintProfile::CODE_HALF_LETTER)
            ->firstOrFail();

        $this->actingAs($support)
            ->patchJson("/api/settings/institutional-receipts/print-profiles/{$profile->id}", [
                'font_scale' => '1.10',
                'width_mm' => '215.90',
                'support_reason' => 'Ajuste por prueba fisica de impresion',
            ])
            ->assertOk();

        $profile->refresh();
        $this->assertSame('1.10', $profile->font_scale);
        $this->assertSame('215.90', $profile->width_mm);

        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $support->id,
            'action' => 'receipt_print_profile.updated',
            'entity_type' => ReceiptPrintProfile::class,
            'entity_id' => $profile->id,
            'result' => 'success',
            'reason' => 'Ajuste por prueba fisica de impresion',
        ]);
    }

    public function test_basic_update_without_advanced_fields_succeeds_without_advanced_permission(): void
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
                'copies_mode' => 'original_first',
                'show_copy_legend' => false,
                'use_logo' => true,
            ])
            ->assertOk();

        $profile->refresh();
        $this->assertSame('original_first', $profile->copies_mode);
        $this->assertFalse((bool) $profile->show_copy_legend);
        $this->assertTrue((bool) $profile->use_logo);
    }
}
