<?php

namespace Tests\Feature\Cash;

use App\Models\CashRegisterSession;
use App\Models\FiscalSequence;
use App\Models\FiscalSetting;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\Service;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Database\Seeders\ServiceCatalogSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * M-W2-FIN-02: regresion del 403 al segundo pago por `issued_at` corrompido.
 *
 * En MariaDB con `explicit_defaults_for_timestamp=0`, `invoices.issued_at` tiene
 * `ON UPDATE current_timestamp()`; registrar un pago reescribia la hora de
 * emision con la del cobro. La autorizacion por dia operativo
 * (`InvoiceAccess::wasIssuedDuringCurrentOperationalDay`) denegaba el siguiente
 * pago (403) y la historia fiscal quedaba alterada.
 *
 * Esta prueba fija el invariante: un cobro (parcial o total) NO cambia
 * `issued_at`. Corre en SQLite y en MariaDB (phpunit.mysql.xml).
 */
class InvoiceIssuedAtPreservationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->withoutMiddleware(ThrottleRequests::class);
        $this->seed([RolesAndPermissionsSeeder::class, ServiceCatalogSeeder::class]);
    }

    public function test_registering_payments_does_not_change_the_invoice_issued_at(): void
    {
        Carbon::setTestNow('2026-07-15 08:00:00');

        try {
            $this->createFiscalSettingAndSequence();
            $cashier = $this->cashier();
            $sessionId = $this->openSession($cashier);
            $invoiceId = $this->createInvoice($cashier);

            $issuedAt = (string) DB::table('invoices')->where('id', $invoiceId)->value('issued_at');
            $this->assertSame('2026-07-15 08:00:00', $issuedAt);

            Carbon::setTestNow('2026-07-15 08:30:00');
            $this->actingAs($cashier)
                ->postJson("/api/invoices/{$invoiceId}/payments", [
                    'cash_session_id' => $sessionId,
                    'method' => Payment::METHOD_CASH,
                    'amount' => '10.00',
                ])
                ->assertCreated();

            $this->assertSame(
                $issuedAt,
                (string) DB::table('invoices')->where('id', $invoiceId)->value('issued_at'),
                'Un pago parcial no debe reescribir issued_at.',
            );

            Carbon::setTestNow('2026-07-15 08:35:00');
            $this->actingAs($cashier)
                ->postJson("/api/invoices/{$invoiceId}/payments", [
                    'cash_session_id' => $sessionId,
                    'method' => Payment::METHOD_TRANSFER,
                    'amount' => '7.25',
                    'reference' => 'TRX-FINAL',
                ])
                ->assertCreated()
                ->assertJsonPath('data.invoice.status', Invoice::STATUS_PAID);

            $this->assertSame(
                $issuedAt,
                (string) DB::table('invoices')->where('id', $invoiceId)->value('issued_at'),
                'El segundo pago no debe reescribir issued_at ni devolver 403.',
            );
        } finally {
            Carbon::setTestNow();
        }
    }

    private function createFiscalSettingAndSequence(): void
    {
        FiscalSetting::query()->create([
            'hospital_name' => 'Hospital San Isidro',
            'rtn' => '08011999123456',
            'default_tax_rate' => '15.00',
            'receipt_paper_size' => 'half_letter',
            'partial_payments_enabled' => true,
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
        return CashRegisterSession::query()->create([
            'user_id' => $cashier->id,
            'open_user_id' => $cashier->id,
            'opening_amount' => '500.00',
            'status' => CashRegisterSession::STATUS_OPEN,
            'opened_at' => now(),
        ])->id;
    }

    private function createInvoice(User $cashier): int
    {
        return $this->actingAs($cashier)
            ->postJson('/api/invoices', [
                'patient_name' => 'Maria Lopez',
                'items' => [[
                    'service_id' => Service::query()->where('name', 'Glucosa')->firstOrFail()->id,
                    'quantity' => '1.00',
                ]],
            ])
            ->assertCreated()
            ->json('data.id');
    }
}
