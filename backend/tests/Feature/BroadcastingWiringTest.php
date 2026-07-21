<?php

namespace Tests\Feature;

use App\Actions\Billing\CreateInvoiceAction;
use App\Actions\Cash\OpenCashSessionAction;
use App\Events\CashSessionChanged;
use App\Events\InvoiceChanged;
use App\Events\PaymentChanged;
use App\Models\CashRegisterSession;
use App\Models\FiscalSequence;
use App\Models\FiscalSetting;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\Service;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Database\Seeders\ServiceCatalogSeeder;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Route;
use Tests\TestCase;

class BroadcastingWiringTest extends TestCase
{
    use RefreshDatabase;

    public function test_echo_config_endpoint_returns_soketi_settings(): void
    {
        Config::set('app.url', 'http://192.168.1.10:8000');
        Config::set('broadcasting.connections.pusher.key', 'client-key');
        Config::set('broadcasting.connections.pusher.options.host', 'soketi');
        Config::set('broadcasting.connections.pusher.client_options.host', '192.168.1.10');
        Config::set('broadcasting.connections.pusher.client_options.port', 6001);
        $user = User::factory()->create();

        $this->actingAs($user)->getJson('/api/system/echo-config')
            ->assertOk()
            ->assertJsonPath('data.driver', 'pusher')
            ->assertJsonPath('data.scheme', 'http')
            ->assertJsonPath('data.host', '192.168.1.10')
            ->assertJsonPath('data.key', 'client-key')
            ->assertJsonPath('data.authEndpoint', '/broadcasting/auth')
            ->assertJsonPath('data.channels.invoices', 'invoices')
            ->assertJsonPath('data.channels.cash', 'cash')
            ->assertJsonPath('data.channels.payments', 'payments')
            ->assertJsonPath('data.channels.settings', 'settings')
            ->assertJsonPath('data.channels.backups', 'backups');
    }

    public function test_echo_config_endpoint_fails_closed_for_invalid_runtime_configuration(): void
    {
        Config::set('app.url', ['not-a-url']);
        Config::set('broadcasting.default', ['pusher']);
        Config::set('broadcasting.connections.pusher.key', ['client-key']);
        Config::set('broadcasting.connections.pusher.options', 'invalid');
        Config::set('broadcasting.connections.pusher.client_options', [
            'host' => 'hospital.local ws://attacker.invalid',
            'port' => 70000,
            'scheme' => 'javascript',
        ]);
        $user = User::factory()->create();

        $this->actingAs($user)->getJson('/api/system/echo-config')
            ->assertOk()
            ->assertJsonPath('data.enabled', false)
            ->assertJsonPath('data.key', '')
            ->assertJsonPath('data.cluster', 'mt1')
            ->assertJsonPath('data.host', '127.0.0.1')
            ->assertJsonPath('data.port', 6001)
            ->assertJsonPath('data.scheme', 'http')
            ->assertJsonPath('data.useTLS', false);
    }

    public function test_echo_config_endpoint_has_operational_smoke_safe_throttle(): void
    {
        $route = collect(Route::getRoutes())->first(
            fn ($route): bool => $route->uri() === 'api/system/echo-config' && in_array('GET', $route->methods(), true),
        );

        $this->assertNotNull($route);
        $this->assertContains('throttle:public-read', $route->middleware());
    }

    public function test_private_invoice_channel_requires_invoice_view_permission(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $this->enablePusherForChannelAuth();

        $cashier = $this->authUser('cashier-invoices');
        $cashier->assignRole('cajero');

        $this->assertTrue($cashier->refresh()->can('invoices.view'));
        $this->loginAsUser($cashier);

        $this->postJson('/broadcasting/auth', [
            'socket_id' => '123.456',
            'channel_name' => 'private-invoices',
        ])
            ->assertOk();

        $this->postJson('/api/auth/logout')->assertOk();

        $plainUser = $this->authUser('plain-invoices');
        $this->loginAsUser($plainUser);

        $this->postJson('/broadcasting/auth', [
            'socket_id' => '123.456',
            'channel_name' => 'private-invoices',
        ])
            ->assertForbidden();
    }

    public function test_private_payment_and_cash_channels_require_their_permissions(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $this->enablePusherForChannelAuth();

        $cashier = $this->authUser('cashier-cash');
        $cashier->assignRole('cajero');
        $this->loginAsUser($cashier);

        foreach (['private-payments', 'private-cash'] as $channel) {
            $this->postJson('/broadcasting/auth', [
                'socket_id' => '123.456',
                'channel_name' => $channel,
            ])
                ->assertOk();
        }

        $this->postJson('/api/auth/logout')->assertOk();

        $plainUser = $this->authUser('plain-cash');
        $this->loginAsUser($plainUser);

        foreach (['private-payments', 'private-cash'] as $channel) {
            $this->postJson('/broadcasting/auth', [
                'socket_id' => '123.456',
                'channel_name' => $channel,
            ])
                ->assertForbidden();
        }
    }

    public function test_invoice_changed_event_broadcasts_on_invoices_channel(): void
    {
        $event = new InvoiceChanged($this->makeInvoice(), 'created');
        $channels = $event->broadcastOn();

        $this->assertCount(1, $channels);
        $this->assertInstanceOf(PrivateChannel::class, $channels[0]);
        $this->assertSame('private-invoices', $channels[0]->name);
        $this->assertSame('invoice.changed', $event->broadcastAs());
        $payload = $event->broadcastWith();
        $this->assertSame(1, $payload['id']);
        $this->assertArrayNotHasKey('patient_name', $payload);
        $this->assertArrayNotHasKey('invoice_number', $payload);
        $this->assertArrayNotHasKey('total', $payload);
        $this->assertArrayNotHasKey('paid_amount', $payload);
        $this->assertArrayNotHasKey('balance_due', $payload);
    }

    public function test_payment_changed_event_broadcasts_on_payments_and_invoices_channels(): void
    {
        $payment = $this->makePayment();
        $event = new PaymentChanged($payment, 'registered');

        $channels = $event->broadcastOn();
        $this->assertCount(2, $channels);
        $names = array_map(fn (PrivateChannel $c) => $c->name, $channels);
        $this->assertContains('private-payments', $names);
        $this->assertContains('private-invoices', $names);
        $this->assertSame('payment.changed', $event->broadcastAs());
        $payload = $event->broadcastWith();
        $this->assertArrayNotHasKey('method', $payload);
        $this->assertArrayNotHasKey('amount', $payload);
        $this->assertArrayNotHasKey('cash_session_id', $payload);
    }

    public function test_cash_session_changed_event_broadcasts_on_cash_channel(): void
    {
        $event = new CashSessionChanged($this->makeCashSession(), 'opened');

        $channels = $event->broadcastOn();
        $this->assertCount(1, $channels);
        $this->assertInstanceOf(PrivateChannel::class, $channels[0]);
        $this->assertSame('private-cash', $channels[0]->name);
        $this->assertSame('cash-session.changed', $event->broadcastAs());
        $this->assertArrayNotHasKey('user_id', $event->broadcastWith());
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

    private function makeInvoice(): Invoice
    {
        $invoice = new Invoice;
        $invoice->id = 1;
        $invoice->invoice_number = '000-001-01-00000042';
        $invoice->patient_name = 'Test';
        $invoice->status = Invoice::STATUS_ISSUED;
        $invoice->total = '17.25';
        $invoice->paid_amount = '0.00';
        $invoice->balance_due = '17.25';
        $invoice->setRawAttributes([
            'id' => 1,
            'updated_at' => now(),
        ], true);

        return $invoice;
    }

    private function enablePusherForChannelAuth(): void
    {
        Config::set('broadcasting.default', 'pusher');
        Config::set('broadcasting.connections.pusher.key', 'test-key');
        Config::set('broadcasting.connections.pusher.secret', 'test-secret');
        Config::set('broadcasting.connections.pusher.app_id', 'test-app');
        require base_path('routes/channels.php');
    }

    private function authUser(string $username): User
    {
        return User::factory()->create([
            'username' => $username,
            'email' => "{$username}@hospital.local",
            'password' => Hash::make('Password123!'),
            'must_change_password' => false,
            'active' => true,
        ]);
    }

    private function loginAsUser(User $user): void
    {
        $this->postJson('/api/auth/login', [
            'login' => $user->username,
            'password' => 'Password123!',
        ])->assertOk();
    }

    private function makePayment(): Payment
    {
        $payment = new Payment;
        $payment->id = 1;
        $payment->invoice_id = 1;
        $payment->cash_session_id = 1;
        $payment->method = 'cash';
        $payment->amount = '17.25';
        $payment->status = Payment::STATUS_POSTED;
        $payment->setRawAttributes(['updated_at' => now()], true);

        return $payment;
    }

    private function makeCashSession(): CashRegisterSession
    {
        $session = new CashRegisterSession;
        $session->id = 1;
        $session->user_id = 1;
        $session->status = CashRegisterSession::STATUS_OPEN;
        $session->opened_at = now();

        return $session;
    }

    private function seedBillingBase(): void
    {
        $this->seed([
            RolesAndPermissionsSeeder::class,
            ServiceCatalogSeeder::class,
        ]);
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

    private function openSession(User $cashier): int
    {
        return app(OpenCashSessionAction::class)
            ->execute(['opening_amount' => '500.00'], $cashier)
            ->id;
    }

    private function createInvoice(User $cashier, string $patientName, string $serviceName): int
    {
        return app(CreateInvoiceAction::class)
            ->execute([
                'patient_name' => $patientName,
                'items' => [[
                    'service_id' => Service::query()->where('name', $serviceName)->firstOrFail()->id,
                    'quantity' => '1.00',
                ]],
            ], $cashier)
            ->id;
    }

    private function cashier(): User
    {
        $cashier = User::factory()->create();
        $cashier->assignRole('cajero');

        return $cashier->refresh()->load('roles.permissions');
    }
}
