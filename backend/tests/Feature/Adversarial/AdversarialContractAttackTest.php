<?php

declare(strict_types=1);

namespace Tests\Feature\Adversarial;

use App\Models\CashMovement;
use App\Models\CashRegisterSession;
use App\Models\Category;
use App\Models\FiscalSequence;
use App\Models\FiscalSetting;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\Service;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

/**
 * FASE 2 — auditoría adversarial (02_AUDITORIA_ADVERSARIAL_HOSPITAL.md).
 *
 * Casos NUEVOS que el implementador no había cubierto, construidos para
 * intentar refutar las garantías declaradas. No repiten el contrato EPO ya
 * probado en ErythropoietinPerLineEmissionTest; atacan servicios inactivos,
 * propiedad de la caja/sesión, límites de pago y el cero legítimo.
 *
 * Importes sintéticos, sin impuestos, base desechable.
 */
class AdversarialContractAttackTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);

        FiscalSetting::query()->create([
            'receipt_template_mode' => 'institutional',
            'hospital_name' => 'Hospital San Isidro',
            'rtn' => '08011999123456',
            'default_tax_rate' => '0.00',
            'receipt_paper_size' => 'half_letter',
        ]);

        FiscalSequence::query()->create([
            'document_type' => 'invoice',
            'prefix' => '000-001-01',
            'min_number' => 1,
            'max_number' => 99999999,
            'current_number' => 0,
            'cai' => 'ADV-CAI',
            'valid_until' => now()->addYear()->toDateString(),
            'active' => true,
        ]);

        if (Schema::hasColumn('fiscal_settings', 'partial_payments_enabled')) {
            FiscalSetting::query()->update(['partial_payments_enabled' => false]);
        }
    }

    /** §5 — un servicio inactivo no entra por emisión NI por valoración. */
    public function test_inactive_service_is_rejected_on_emission_and_preview(): void
    {
        $cashier = $this->cashier();
        $inactive = $this->service('Servicio desactivado', '100.00', active: false);

        $this->actingAs($cashier)->postJson('/api/invoices', [
            'patient_name' => 'Paciente sintetico',
            'items' => [['service_id' => $inactive->id, 'quantity' => '1.00']],
        ])->assertStatus(422)->assertJsonValidationErrors('items.0.service_id');

        $this->actingAs($cashier)->postJson('/api/invoices/preview', [
            'items' => [['service_id' => $inactive->id, 'quantity' => '1.00']],
        ])->assertStatus(422);

        $this->assertSame(0, Invoice::query()->count(), 'Un servicio inactivo no puede emitir factura.');
    }

    /** §5 — un servicio no visible/no facturable tampoco entra. */
    public function test_non_billable_service_is_rejected(): void
    {
        $cashier = $this->cashier();
        $hidden = $this->service('Servicio oculto', '100.00', visibleInBilling: false);

        $this->actingAs($cashier)->postJson('/api/invoices', [
            'patient_name' => 'Paciente sintetico',
            'items' => [['service_id' => $hidden->id, 'quantity' => '1.00']],
        ])->assertStatus(422)->assertJsonValidationErrors('items.0.service_id');

        $this->assertSame(0, Invoice::query()->count());
    }

    /** §3/§4 — no se cobra con la caja de otro usuario aunque sea su propia factura. */
    public function test_payment_with_another_users_cash_session_is_rejected(): void
    {
        $cashierA = $this->cashier();
        $cashierB = $this->cashier();
        $service = $this->service('Servicio normal', '100.00');
        $invoiceId = $this->emit($cashierA, $service);

        $sessionA = CashRegisterSession::query()->where('user_id', $cashierA->id)->firstOrFail();

        $this->actingAs($cashierB)->postJson("/api/invoices/{$invoiceId}/payments", [
            'cash_session_id' => $sessionA->id,
            'method' => 'cash',
            'amount' => '100.00',
        ])->assertStatus(403);

        $this->assertSame(0, Payment::query()->count(), 'No debe crearse pago con caja ajena.');
        $this->assertSame(0, CashMovement::query()->count(), 'No debe crearse movimiento de caja.');
        $this->assertSame('100.00', Invoice::query()->findOrFail($invoiceId)->balance_due);
    }

    /** §3/§6 — un cajero no opera la factura de otro fuera de su ámbito. */
    public function test_payment_on_another_cashiers_invoice_is_rejected(): void
    {
        $cashierA = $this->cashier();
        $cashierB = $this->cashier();
        $service = $this->service('Servicio normal', '100.00');
        $invoiceId = $this->emit($cashierA, $service);

        // Antigüedad: la factura es de un día operativo anterior.
        Invoice::query()->whereKey($invoiceId)->update([
            'issued_at' => now()->subDay()->setTime(9, 0),
        ]);

        $sessionB = CashRegisterSession::query()->where('user_id', $cashierB->id)->firstOrFail();

        $this->actingAs($cashierB)->postJson("/api/invoices/{$invoiceId}/payments", [
            'cash_session_id' => $sessionB->id,
            'method' => 'cash',
            'amount' => '100.00',
        ])->assertStatus(403);

        $this->assertSame(0, Payment::query()->count());
    }

    /** §4 — caja cerrada no cobra. */
    public function test_payment_with_closed_cash_session_is_rejected(): void
    {
        $cashier = $this->cashier();
        $service = $this->service('Servicio normal', '100.00');
        $invoiceId = $this->emit($cashier, $service);

        $session = CashRegisterSession::query()->where('user_id', $cashier->id)->firstOrFail();
        $session->forceFill(['status' => CashRegisterSession::STATUS_CLOSED, 'closed_at' => now()])->save();

        $this->actingAs($cashier)->postJson("/api/invoices/{$invoiceId}/payments", [
            'cash_session_id' => $session->id,
            'method' => 'cash',
            'amount' => '100.00',
        ])->assertStatus(422)->assertJsonValidationErrors('cash_session_id');

        $this->assertSame(0, Payment::query()->count());
    }

    /** §9 — el pago no puede exceder el saldo. */
    public function test_payment_exceeding_balance_is_rejected(): void
    {
        $cashier = $this->cashier();
        $service = $this->service('Servicio normal', '100.00');
        $invoiceId = $this->emit($cashier, $service);
        $session = CashRegisterSession::query()->where('user_id', $cashier->id)->firstOrFail();

        $this->actingAs($cashier)->postJson("/api/invoices/{$invoiceId}/payments", [
            'cash_session_id' => $session->id,
            'method' => 'cash',
            'amount' => '100.01',
        ])->assertStatus(422)->assertJsonValidationErrors('amount');

        $this->assertSame(0, Payment::query()->count());
        $this->assertSame('100.00', Invoice::query()->findOrFail($invoiceId)->balance_due);
    }

    /** §9 — con pago parcial deshabilitado, un monto menor al saldo se rechaza. */
    public function test_partial_payment_rejected_when_disabled(): void
    {
        $cashier = $this->cashier();
        $service = $this->service('Servicio normal', '100.00');
        $invoiceId = $this->emit($cashier, $service);
        $session = CashRegisterSession::query()->where('user_id', $cashier->id)->firstOrFail();

        $this->actingAs($cashier)->postJson("/api/invoices/{$invoiceId}/payments", [
            'cash_session_id' => $session->id,
            'method' => 'cash',
            'amount' => '40.00',
        ])->assertStatus(422)->assertJsonValidationErrors('amount');

        $this->assertSame(0, Payment::query()->count());
    }

    /** §9 — importes mal formados o no positivos no pasan. */
    public function test_malformed_and_non_positive_amounts_are_rejected(): void
    {
        $cashier = $this->cashier();
        $service = $this->service('Servicio normal', '100.00');
        $invoiceId = $this->emit($cashier, $service);
        $session = CashRegisterSession::query()->where('user_id', $cashier->id)->firstOrFail();

        foreach (['0', '-5.00', '1.234', 'abc', ''] as $amount) {
            $this->actingAs($cashier)->postJson("/api/invoices/{$invoiceId}/payments", [
                'cash_session_id' => $session->id,
                'method' => 'cash',
                'amount' => $amount,
            ])->assertStatus(422, "amount={$amount} debía rechazarse");
        }

        $this->assertSame(0, Payment::query()->count());
    }

    /** §9 — factura anulada no se cobra. */
    public function test_payment_on_void_invoice_is_rejected(): void
    {
        $cashier = $this->cashier();
        $service = $this->service('Servicio normal', '100.00');
        $invoiceId = $this->emit($cashier, $service);
        $session = CashRegisterSession::query()->where('user_id', $cashier->id)->firstOrFail();

        Invoice::query()->whereKey($invoiceId)->update(['status' => Invoice::STATUS_VOID]);

        $this->actingAs($cashier)->postJson("/api/invoices/{$invoiceId}/payments", [
            'cash_session_id' => $session->id,
            'method' => 'cash',
            'amount' => '100.00',
        ])->assertStatus(422);

        $this->assertSame(0, Payment::query()->count());
    }

    /** §9 — emisión sin cobro: cero movimientos de caja de cualquier tipo. */
    public function test_zero_emission_creates_no_cash_movement_of_any_kind(): void
    {
        $cashier = $this->cashier();
        $epo = $this->service('Eritropoyetina 2000 UI', '25.00', specialRule: Service::ERYTHROPOIETIN_RULE);

        $this->actingAs($cashier)->postJson('/api/invoices', [
            'patient_name' => 'Paciente sin cobro',
            'dialysis_prescription' => true,
            'items' => [['service_id' => $epo->id, 'quantity' => '1.00']],
        ])->assertCreated()
            ->assertJsonPath('data.total', '0.00')
            ->assertJsonPath('data.settlement', Invoice::SETTLEMENT_FREE_BY_RULE);

        $this->assertSame(0, Payment::query()->count());
        $this->assertSame(0, CashMovement::query()->count());
    }

    // --- helpers ---------------------------------------------------------

    private function emit(User $issuer, Service $service, string $quantity = '1.00'): int
    {
        return (int) $this->actingAs($issuer)->postJson('/api/invoices', [
            'patient_name' => 'Paciente sintetico',
            'items' => [['service_id' => $service->id, 'quantity' => $quantity]],
        ])->assertCreated()->json('data.id');
    }

    private function service(
        string $name,
        string $price,
        ?string $specialRule = null,
        bool $active = true,
        bool $visibleInBilling = true,
    ): Service {
        $category = Category::factory()->create(['active' => true]);

        return Service::factory()->create([
            'name' => $name,
            'price' => $price,
            'taxable' => false,
            'special_rule_code' => $specialRule,
            'active' => $active,
            'visible_in_billing' => $visibleInBilling,
            'is_billable' => true,
            'category_id' => $category->id,
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
