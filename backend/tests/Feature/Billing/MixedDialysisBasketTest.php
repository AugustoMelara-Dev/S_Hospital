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
use Tests\TestCase;

class MixedDialysisBasketTest extends TestCase
{
    use RefreshDatabase;

    public function test_dialysis_prescription_keeps_other_nine_hundred_lempira_service_billable(): void
    {
        $this->seedBillingBase();
        $product = Service::query()->where('name', 'Glucosa')->firstOrFail();
        $product->forceFill([
            'price' => '900.00',
            'taxable' => false,
            'special_rule_code' => null,
        ])->save();
        $erythropoietin = Service::query()->where('name', 'Eritropoyetina')->firstOrFail();

        $invoiceId = $this->actingAs($this->cashier())
            ->postJson('/api/invoices', [
                'patient_name' => 'Paciente con receta',
                'dialysis_prescription' => true,
                'items' => [
                    ['service_id' => $product->id, 'quantity' => '1.00'],
                    ['service_id' => $erythropoietin->id, 'quantity' => '1.00'],
                ],
            ])
            ->assertCreated()
            ->assertJsonPath('data.subtotal', '900.00')
            ->assertJsonPath('data.tax_amount', '0.00')
            ->assertJsonPath('data.total', '900.00')
            ->assertJsonPath('data.items.0.unit_price', '900.00')
            ->assertJsonPath('data.items.0.line_total', '900.00')
            ->assertJsonPath('data.items.0.special_rule_applied', false)
            ->assertJsonPath('data.items.1.unit_price', '0.00')
            ->assertJsonPath('data.items.1.line_total', '0.00')
            ->assertJsonPath('data.items.1.special_rule_applied', true)
            ->json('data.id');

        $invoice = Invoice::query()->findOrFail($invoiceId);
        $this->assertSame(90000, $invoice->total_cents);
        $this->assertSame(
            $invoice->total_cents,
            $invoice->items()->sum('line_total_cents'),
        );
        $this->assertSame(
            1,
            $invoice->items()->where('special_rule_applied', true)->count(),
        );
    }

    private function seedBillingBase(): void
    {
        $this->seed([RolesAndPermissionsSeeder::class, ServiceCatalogSeeder::class]);

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
}
