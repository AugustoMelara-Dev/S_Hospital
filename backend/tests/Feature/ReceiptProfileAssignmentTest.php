<?php

namespace Tests\Feature;

use App\Actions\InstitutionalReceipts\ResolveReceiptPrintProfileAction;
use App\Models\CashRegisterSession;
use App\Models\ReceiptPrintProfile;
use App\Models\ReceiptProfileAssignment;
use App\Models\User;
use Database\Seeders\ReceiptPrintProfileSeeder;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class ReceiptProfileAssignmentTest extends TestCase
{
    use RefreshDatabase;

    public function test_global_fallback_resolves_media_carta_default(): void
    {
        $this->seed(ReceiptPrintProfileSeeder::class);

        $profile = app(ResolveReceiptPrintProfileAction::class)->execute();

        $this->assertSame(ReceiptPrintProfile::CODE_HALF_LETTER, $profile->code);
    }

    public function test_user_assignment_overrides_global_assignment(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $this->seed(ReceiptPrintProfileSeeder::class);

        $admin = $this->admin();
        $cashier = User::factory()->create();
        $global = ReceiptPrintProfile::query()->where('code', ReceiptPrintProfile::CODE_HALF_LETTER)->firstOrFail();
        $userProfile = ReceiptPrintProfile::query()->where('code', ReceiptPrintProfile::CODE_A5)->firstOrFail();

        $this->actingAs($admin)
            ->putJson('/api/settings/institutional-receipts/assignments', [
                'profile_id' => $global->id,
                'scope_type' => ReceiptProfileAssignment::SCOPE_GLOBAL,
                'active' => true,
            ])
            ->assertOk();

        $this->actingAs($admin)
            ->putJson('/api/settings/institutional-receipts/assignments', [
                'profile_id' => $userProfile->id,
                'scope_type' => ReceiptProfileAssignment::SCOPE_USER,
                'scope_id' => $cashier->id,
                'active' => true,
            ])
            ->assertOk();

        $resolved = app(ResolveReceiptPrintProfileAction::class)->execute($cashier);

        $this->assertSame(ReceiptPrintProfile::CODE_A5, $resolved->code);
    }

    public function test_cash_session_assignment_overrides_user_assignment(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $this->seed(ReceiptPrintProfileSeeder::class);

        $admin = $this->admin();
        $cashier = User::factory()->create();
        $cashSession = CashRegisterSession::query()->create([
            'user_id' => $cashier->id,
            'open_user_id' => $cashier->id,
            'opening_amount' => '100.00',
            'status' => CashRegisterSession::STATUS_OPEN,
            'opened_at' => now(),
        ]);
        $userProfile = ReceiptPrintProfile::query()->where('code', ReceiptPrintProfile::CODE_A5)->firstOrFail();
        $sessionProfile = ReceiptPrintProfile::query()->where('code', ReceiptPrintProfile::CODE_LETTER)->firstOrFail();

        $this->actingAs($admin)
            ->putJson('/api/settings/institutional-receipts/assignments', [
                'profile_id' => $userProfile->id,
                'scope_type' => ReceiptProfileAssignment::SCOPE_USER,
                'scope_id' => $cashier->id,
                'active' => true,
            ])
            ->assertOk();

        $this->actingAs($admin)
            ->putJson('/api/settings/institutional-receipts/assignments', [
                'profile_code' => $sessionProfile->code,
                'scope_type' => ReceiptProfileAssignment::SCOPE_CASH_SESSION,
                'scope_id' => $cashSession->id,
                'active' => true,
            ])
            ->assertOk();

        $resolved = app(ResolveReceiptPrintProfileAction::class)->execute($cashier, $cashSession);

        $this->assertSame(ReceiptPrintProfile::CODE_LETTER, $resolved->code);
    }

    public function test_replacing_assignment_for_same_scope_leaves_one_active_assignment_and_audits(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $this->seed(ReceiptPrintProfileSeeder::class);

        $admin = $this->admin();
        $first = ReceiptPrintProfile::query()->where('code', ReceiptPrintProfile::CODE_HALF_LETTER)->firstOrFail();
        $second = ReceiptPrintProfile::query()->where('code', ReceiptPrintProfile::CODE_A5)->firstOrFail();

        $this->actingAs($admin)
            ->putJson('/api/settings/institutional-receipts/assignments', [
                'profile_id' => $first->id,
                'scope_type' => ReceiptProfileAssignment::SCOPE_GLOBAL,
                'active' => true,
            ])
            ->assertOk();

        $this->actingAs($admin)
            ->putJson('/api/settings/institutional-receipts/assignments', [
                'profile_id' => $second->id,
                'scope_type' => ReceiptProfileAssignment::SCOPE_GLOBAL,
                'active' => true,
            ])
            ->assertOk()
            ->assertJsonPath('data.print_profile.code', ReceiptPrintProfile::CODE_A5);

        $activeAssignments = ReceiptProfileAssignment::query()
            ->where('scope_type', ReceiptProfileAssignment::SCOPE_GLOBAL)
            ->whereNull('scope_id')
            ->where('active', true)
            ->get();

        $this->assertCount(1, $activeAssignments);
        $this->assertSame($second->id, $activeAssignments->sole()->receipt_print_profile_id);
        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $admin->id,
            'action' => 'receipt_profile_assignment.replaced',
            'entity_type' => ReceiptProfileAssignment::class,
        ]);
    }

    public function test_deactivating_global_assignment_leaves_no_active_assignment_for_scope(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $this->seed(ReceiptPrintProfileSeeder::class);

        $admin = $this->admin();
        $profile = ReceiptPrintProfile::query()->where('code', ReceiptPrintProfile::CODE_HALF_LETTER)->firstOrFail();

        $this->actingAs($admin)
            ->putJson('/api/settings/institutional-receipts/assignments', [
                'profile_id' => $profile->id,
                'scope_type' => ReceiptProfileAssignment::SCOPE_GLOBAL,
                'active' => true,
            ])
            ->assertOk();

        $this->actingAs($admin)
            ->putJson('/api/settings/institutional-receipts/assignments', [
                'profile_id' => $profile->id,
                'scope_type' => ReceiptProfileAssignment::SCOPE_GLOBAL,
                'active' => false,
            ])
            ->assertOk()
            ->assertJsonPath('data.active', false);

        $this->assertFalse(
            ReceiptProfileAssignment::query()
                ->where('scope_type', ReceiptProfileAssignment::SCOPE_GLOBAL)
                ->whereNull('scope_id')
                ->where('active', true)
                ->exists()
        );
        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $admin->id,
            'action' => 'receipt_profile_assignment.deactivated',
            'entity_type' => ReceiptProfileAssignment::class,
        ]);
    }

    public function test_cash_register_scope_is_rejected_until_cash_register_flow_exists(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $this->seed(ReceiptPrintProfileSeeder::class);

        $admin = $this->admin();
        $profile = ReceiptPrintProfile::query()->where('code', ReceiptPrintProfile::CODE_HALF_LETTER)->firstOrFail();

        $this->actingAs($admin)
            ->putJson('/api/settings/institutional-receipts/assignments', [
                'profile_id' => $profile->id,
                'scope_type' => ReceiptProfileAssignment::SCOPE_CASH_REGISTER,
                'scope_id' => 1,
                'active' => true,
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('scope_type');
    }

    public function test_active_assignment_requires_active_print_profile(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $this->seed(ReceiptPrintProfileSeeder::class);

        $admin = $this->admin();
        $profile = ReceiptPrintProfile::query()->where('code', ReceiptPrintProfile::CODE_A5)->firstOrFail();
        $profile->update(['active' => false]);

        $this->actingAs($admin)
            ->putJson('/api/settings/institutional-receipts/assignments', [
                'profile_id' => $profile->id,
                'scope_type' => ReceiptProfileAssignment::SCOPE_GLOBAL,
                'active' => true,
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('profile_id');
    }

    public function test_active_assignment_prevents_deactivating_print_profile(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $this->seed(ReceiptPrintProfileSeeder::class);

        $admin = $this->admin();
        $profile = ReceiptPrintProfile::query()->where('code', ReceiptPrintProfile::CODE_A5)->firstOrFail();

        $this->actingAs($admin)
            ->putJson('/api/settings/institutional-receipts/assignments', [
                'profile_id' => $profile->id,
                'scope_type' => ReceiptProfileAssignment::SCOPE_GLOBAL,
                'active' => true,
            ])
            ->assertOk();

        $this->actingAs($admin)
            ->patchJson("/api/settings/institutional-receipts/print-profiles/{$profile->id}", [
                'active' => false,
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('active');
    }

    public function test_thermal_profile_cannot_be_global_default(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $this->seed(ReceiptPrintProfileSeeder::class);

        $admin = $this->admin();
        $thermal = ReceiptPrintProfile::query()->where('code', ReceiptPrintProfile::CODE_THERMAL_80)->firstOrFail();

        $this->actingAs($admin)
            ->patchJson("/api/settings/institutional-receipts/print-profiles/{$thermal->id}", [
                'active' => true,
                'is_global_default' => true,
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('is_global_default');
    }

    public function test_resolver_throws_when_no_active_profile_is_available(): void
    {
        $this->seed(ReceiptPrintProfileSeeder::class);

        ReceiptPrintProfile::query()->update([
            'active' => false,
            'is_global_default' => false,
        ]);

        $this->expectException(ValidationException::class);

        app(ResolveReceiptPrintProfileAction::class)->execute();
    }

    private function admin(): User
    {
        $admin = User::factory()->create();
        $admin->assignRole('admin');

        return $admin;
    }
}
