<?php

namespace Tests\Feature;

use App\Models\FiscalSequence;
use App\Models\FiscalSetting;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\Service;
use App\Models\ServiceArea;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Database\Seeders\ServiceCatalogSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Permission;
use Tests\TestCase;

class AreaPaidServicesTest extends TestCase
{
    use RefreshDatabase;

    public function test_area_user_only_sees_paid_services_for_their_area_and_cannot_charge(): void
    {
        $this->seedBillingBase();
        $cashier = $this->cashier();
        $sessionId = $this->openSession($cashier);
        $labInvoice = $this->createInvoice($cashier, 'Glucosa', 'Maria Lopez');
        $pharmacyInvoice = $this->createInvoice($cashier, 'Eritropoyetina', 'Jose Perez');

        $this->payInvoice($cashier, $labInvoice, $sessionId, '17.25');
        $this->payInvoice($cashier, $pharmacyInvoice, $sessionId, '28.75');

        $areaUser = User::factory()->create([
            'service_area_id' => ServiceArea::query()->where('slug', 'laboratorio')->firstOrFail()->id,
        ]);
        $areaUser->givePermissionTo(Permission::findByName('area_services.view', 'web'));

        $this->actingAs($areaUser)
            ->getJson('/api/area-services/paid')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.patient_name', 'Maria Lopez')
            ->assertJsonPath('data.0.service_name', 'Glucosa')
            ->assertJsonPath('data.0.payment_status', Invoice::STATUS_PAID)
            ->assertJsonMissing(['patient_name' => 'Jose Perez'])
            ->assertJsonMissing(['service_name' => 'Eritropoyetina']);

        $this->actingAs($areaUser)
            ->postJson("/api/invoices/{$labInvoice}/payments", [
                'cash_session_id' => $sessionId,
                'method' => Payment::METHOD_CASH,
                'amount' => '1.00',
            ])
            ->assertForbidden();
    }

    private function seedBillingBase(): void
    {
        $this->seed([RolesAndPermissionsSeeder::class, ServiceCatalogSeeder::class]);
        FiscalSetting::query()->create([
            'hospital_name' => 'Hospital Demo',
            'rtn' => '08011999123456',
            'default_tax_rate' => '15.00',
            'receipt_width' => '80mm',
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

        return $cashier->refresh();
    }

    private function openSession(User $cashier): int
    {
        return $this->actingAs($cashier)
            ->postJson('/api/cash-sessions/open', ['opening_amount' => '500.00'])
            ->assertCreated()
            ->json('data.id');
    }

    private function createInvoice(User $cashier, string $serviceName, string $patientName): int
    {
        return $this->actingAs($cashier)
            ->postJson('/api/invoices', [
                'patient_name' => $patientName,
                'items' => [[
                    'service_id' => Service::query()->where('name', $serviceName)->firstOrFail()->id,
                    'quantity' => '1.00',
                ]],
            ])
            ->assertCreated()
            ->json('data.id');
    }

    private function payInvoice(User $cashier, int $invoiceId, int $sessionId, string $amount): void
    {
        $this->actingAs($cashier)
            ->postJson("/api/invoices/{$invoiceId}/payments", [
                'cash_session_id' => $sessionId,
                'method' => Payment::METHOD_CASH,
                'amount' => $amount,
            ])
            ->assertCreated();
    }
}
