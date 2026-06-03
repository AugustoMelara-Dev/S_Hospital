<?php

namespace Tests\Feature;

use App\Events\CashSessionChanged;
use App\Events\InvoiceChanged;
use App\Events\PaymentChanged;
use Illuminate\Broadcasting\Channel;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Event;
use Tests\TestCase;

class BroadcastingWiringTest extends TestCase
{
    use RefreshDatabase;

    public function test_echo_config_endpoint_returns_soketi_settings(): void
    {
        Config::set('app.url', 'http://192.168.1.10:8000');

        $this->getJson('/api/system/echo-config')
            ->assertOk()
            ->assertJsonPath('data.driver', 'pusher')
            ->assertJsonPath('data.scheme', 'http')
            ->assertJsonPath('data.host', '192.168.1.10')
            ->assertJsonPath('data.authEndpoint', '/api/broadcasting/auth')
            ->assertJsonPath('data.channels.invoices', 'invoices')
            ->assertJsonPath('data.channels.cash', 'cash')
            ->assertJsonPath('data.channels.payments', 'payments')
            ->assertJsonPath('data.channels.settings', 'settings')
            ->assertJsonPath('data.channels.backups', 'backups');
    }

    public function test_invoice_changed_event_broadcasts_on_invoices_channel(): void
    {
        $event = new InvoiceChanged($this->makeInvoice(), 'created');
        $channels = $event->broadcastOn();

        $this->assertCount(1, $channels);
        $this->assertInstanceOf(Channel::class, $channels[0]);
        $this->assertSame('invoices', $channels[0]->name);
        $this->assertSame('invoice.changed', $event->broadcastAs());
        $this->assertArrayHasKey('invoice_number', $event->broadcastWith());
    }

    public function test_payment_changed_event_broadcasts_on_payments_and_invoices_channels(): void
    {
        $payment = $this->makePayment();
        $event = new PaymentChanged($payment, 'registered');

        $channels = $event->broadcastOn();
        $this->assertCount(2, $channels);
        $names = array_map(fn (Channel $c) => $c->name, $channels);
        $this->assertContains('payments', $names);
        $this->assertContains('invoices', $names);
        $this->assertSame('payment.changed', $event->broadcastAs());
    }

    public function test_cash_session_changed_event_broadcasts_on_cash_channel(): void
    {
        $event = new CashSessionChanged($this->makeCashSession(), 'opened');

        $channels = $event->broadcastOn();
        $this->assertCount(1, $channels);
        $this->assertSame('cash', $channels[0]->name);
        $this->assertSame('cash-session.changed', $event->broadcastAs());
    }

    public function test_broadcasting_is_a_noop_when_driver_is_log(): void
    {
        // Default in CI is 'log' so that unit tests do not require a
        // Soketi container. Verify the events still construct and the
        // broadcasting config can be read.
        Config::set('broadcasting.default', 'log');

        $event = new InvoiceChanged($this->makeInvoice(), 'created');
        $this->assertNotNull($event->broadcastOn());
    }

    public function test_invoice_creation_dispatches_invoice_changed_event(): void
    {
        Event::fake([InvoiceChanged::class, PaymentChanged::class, CashSessionChanged::class]);

        $this->seedBillingBase();
        $cashier = $this->cashier();
        $this->openSession($cashier);
        $invoiceId = $this->createInvoice($cashier, 'Maria Lopez', 'Glucosa');

        Event::assertDispatched(InvoiceChanged::class, function (InvoiceChanged $e) use ($invoiceId) {
            return $e->invoice->id === $invoiceId && $e->change === 'created';
        });
    }

    private function makeInvoice(): \App\Models\Invoice
    {
        $invoice = new \App\Models\Invoice();
        $invoice->id = 1;
        $invoice->invoice_number = '000-001-01-00000042';
        $invoice->patient_name = 'Test';
        $invoice->status = \App\Models\Invoice::STATUS_ISSUED;
        $invoice->total = '17.25';
        $invoice->paid_amount = '0.00';
        $invoice->balance_due = '17.25';
        $invoice->setRawAttributes(['updated_at' => now()], true);

        return $invoice;
    }

    private function makePayment(): \App\Models\Payment
    {
        $payment = new \App\Models\Payment();
        $payment->id = 1;
        $payment->invoice_id = 1;
        $payment->cash_session_id = 1;
        $payment->method = 'cash';
        $payment->amount = '17.25';
        $payment->status = \App\Models\Payment::STATUS_POSTED;
        $payment->setRawAttributes(['updated_at' => now()], true);

        return $payment;
    }

    private function makeCashSession(): \App\Models\CashRegisterSession
    {
        $session = new \App\Models\CashRegisterSession();
        $session->id = 1;
        $session->user_id = 1;
        $session->status = \App\Models\CashRegisterSession::STATUS_OPEN;
        $session->opened_at = now();

        return $session;
    }

    private function seedBillingBase(): void
    {
        $this->seed([
            \Database\Seeders\RolesAndPermissionsSeeder::class,
            \Database\Seeders\ServiceCatalogSeeder::class,
        ]);
        \App\Models\FiscalSetting::query()->create([
            'hospital_name' => 'Hospital San Isidro',
            'rtn' => '08011999123456',
            'default_tax_rate' => '15.00',
            'receipt_paper_size' => 'half_letter',
        ]);
        \App\Models\FiscalSequence::query()->create([
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

    private function openSession(\App\Models\User $cashier): int
    {
        return app(\App\Actions\Cash\OpenCashSessionAction::class)
            ->execute(['opening_amount' => '500.00'], $cashier)
            ->id;
    }

    private function createInvoice(\App\Models\User $cashier, string $patientName, string $serviceName): int
    {
        return app(\App\Actions\Billing\CreateInvoiceAction::class)
            ->execute([
                'patient_name' => $patientName,
                'items' => [[
                    'service_id' => \App\Models\Service::query()->where('name', $serviceName)->firstOrFail()->id,
                    'quantity' => '1.00',
                ]],
            ], $cashier)
            ->id;
    }

    private function cashier(): \App\Models\User
    {
        $cashier = \App\Models\User::factory()->create();
        $cashier->assignRole('cajero');

        return $cashier->refresh()->load('roles.permissions');
    }
}
