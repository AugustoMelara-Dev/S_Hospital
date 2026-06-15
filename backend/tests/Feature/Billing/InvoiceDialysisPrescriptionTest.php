<?php

namespace Tests\Feature\Billing;

use App\Models\CashRegisterSession;
use App\Models\FiscalSequence;
use App\Models\FiscalSetting;
use App\Models\Invoice;
use App\Models\Service;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Database\Seeders\ServiceCatalogSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Permission;
use Tests\TestCase;

class InvoiceDialysisPrescriptionTest extends TestCase
{
    use RefreshDatabase;

    public function test_erythropoietin_is_free_when_caller_has_mark_dialysis_permission(): void
    {
        $this->seedBillingBase();
        $issuer = $this->issuerWithDialysisPermission();
        $erythropoietin = Service::query()->where('name', 'Eritropoyetina')->firstOrFail();

        $this->actingAs($issuer)
            ->postJson('/api/invoices', [
                'patient_name' => 'Maria Lopez',
                'dialysis_prescription' => true,
                'items' => [
                    ['service_id' => $erythropoietin->id, 'quantity' => '1.00'],
                ],
            ])
            ->assertCreated()
            ->assertJsonPath('data.items.0.unit_price', '0.00')
            ->assertJsonPath('data.items.0.special_rule_applied', true)
            ->assertJsonPath('data.total', '0.00')
            ->assertJsonPath('data.balance_due', '0.00')
            ->assertJsonPath('data.status', Invoice::STATUS_PAID);
    }

    public function test_erythropoietin_is_charged_when_dialysis_flag_absent(): void
    {
        $this->seedBillingBase();
        $issuer = $this->issuerWithDialysisPermission();
        $erythropoietin = Service::query()->where('name', 'Eritropoyetina')->firstOrFail();

        $this->actingAs($issuer)
            ->postJson('/api/invoices', [
                'patient_name' => 'Maria Lopez',
                'items' => [
                    ['service_id' => $erythropoietin->id, 'quantity' => '1.00'],
                ],
            ])
            ->assertCreated()
            ->assertJsonPath('data.items.0.unit_price', '25.00')
            ->assertJsonPath('data.items.0.special_rule_applied', false)
            ->assertJsonPath('data.total', '28.75')
            ->assertJsonPath('data.status', Invoice::STATUS_ISSUED);
    }

    public function test_cashier_without_permission_cannot_toggle_dialysis_prescription(): void
    {
        $this->seedBillingBase();
        $cashier = $this->cashier();
        $erythropoietin = Service::query()->where('name', 'Eritropoyetina')->firstOrFail();

        $this->actingAs($cashier)
            ->postJson('/api/invoices', [
                'patient_name' => 'Maria Lopez',
                'dialysis_prescription' => true,
                'items' => [
                    ['service_id' => $erythropoietin->id, 'quantity' => '1.00'],
                ],
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('dialysis_prescription');
    }

    public function test_dialysis_flag_does_not_zero_other_services(): void
    {
        $this->seedBillingBase();
        $issuer = $this->issuerWithDialysisPermission();
        $glucose = Service::query()->where('name', 'Glucosa')->firstOrFail();

        $this->actingAs($issuer)
            ->postJson('/api/invoices', [
                'patient_name' => 'Maria Lopez',
                'dialysis_prescription' => true,
                'items' => [
                    ['service_id' => $glucose->id, 'quantity' => '1.00'],
                ],
            ])
            ->assertCreated()
            ->assertJsonPath('data.items.0.unit_price', '15.00')
            ->assertJsonPath('data.items.0.special_rule_applied', false)
            ->assertJsonPath('data.total', '17.25');
    }

    public function test_dialysis_flag_false_keeps_erythropoietin_at_full_price(): void
    {
        $this->seedBillingBase();
        $issuer = $this->issuerWithDialysisPermission();
        $erythropoietin = Service::query()->where('name', 'Eritropoyetina')->firstOrFail();

        $this->actingAs($issuer)
            ->postJson('/api/invoices', [
                'patient_name' => 'Maria Lopez',
                'dialysis_prescription' => false,
                'items' => [
                    ['service_id' => $erythropoietin->id, 'quantity' => '1.00'],
                ],
            ])
            ->assertCreated()
            ->assertJsonPath('data.items.0.unit_price', '25.00')
            ->assertJsonPath('data.total', '28.75');
    }

    private function seedBillingBase(): void
    {
        $this->seed([RolesAndPermissionsSeeder::class, ServiceCatalogSeeder::class]);
        $this->createDialysisPermission();
        FiscalSetting::query()->create([
            'receipt_template_mode' => 'thermal',
            'hospital_name' => 'Hospital San Isidro',
            'rtn' => '08011999123456',
            'default_tax_rate' => '15.00',
            'receipt_paper_size' => 'half_letter',
        ]);
        FiscalSequence::query()->create([
            'document_type' => 'invoice',
            'prefix' => '000-001-01',
            'min_number' => 1,
            'max_number' => 99999999,
            'current_number' => 0,
            'cai' => 'TEST-CAI',
            'valid_until' => now()->addYear()->toDateString(),
            'active' => true,
        ]);
    }

    private function createDialysisPermission(): void
    {
        $permission = Permission::query()
            ->firstOrCreate(['name' => 'patients.mark_dialysis_prescription', 'guard_name' => 'web']);
    }

    private function cashier(): User
    {
        $cashier = User::factory()->create();
        $cashier->assignRole('cajero');
        CashRegisterSession::query()->create([
            'user_id' => $cashier->id,
            'open_user_id' => $cashier->id,
            'opening_amount' => '500.00',
            'status' => CashRegisterSession::STATUS_OPEN,
            'opened_at' => now(),
        ]);

        return $cashier->refresh();
    }

    private function issuerWithDialysisPermission(): User
    {
        $user = User::factory()->create();
        $user->assignRole('cajero');
        $user->givePermissionTo('patients.mark_dialysis_prescription');
        CashRegisterSession::query()->create([
            'user_id' => $user->id,
            'open_user_id' => $user->id,
            'opening_amount' => '500.00',
            'status' => CashRegisterSession::STATUS_OPEN,
            'opened_at' => now(),
        ]);

        return $user->refresh();
    }
}
