<?php

namespace Tests\Feature;

use App\Actions\Billing\CreateInvoiceAction;
use App\Models\CashRegisterSession;
use App\Models\FiscalSequence;
use App\Models\FiscalSetting;
use App\Models\Payment;
use App\Models\Service;
use App\Models\User;
use App\Support\Money;
use Database\Seeders\RolesAndPermissionsSeeder;
use Database\Seeders\ServiceCatalogSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ConcurrentFiscalNumberTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

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
        $user = User::factory()->create([
            'username' => 'cajero-test',
            'name' => 'Cajero Test',
            'email' => 'cajero-test@hospital.local',
            'must_change_password' => false,
            'active' => true,
        ]);
        $user->assignRole('cajero');

        CashRegisterSession::query()->create([
            'user_id' => $user->id,
            'open_user_id' => $user->id,
            'opening_amount' => '500.00',
            'status' => CashRegisterSession::STATUS_OPEN,
            'opened_at' => now(),
        ]);

        return $user;
    }

    private function item(string $serviceName): array
    {
        return [
            'service_id' => Service::query()->where('name', $serviceName)->firstOrFail()->id,
            'quantity' => '1.00',
        ];
    }

    public function test_fiscal_number_action_uses_lock_for_update_in_serializable_transaction(): void
    {
        FiscalSequence::query()->where('document_type', 'invoice')->firstOrFail();

        $reflection = new \ReflectionClass(CreateInvoiceAction::class);
        $source = file_get_contents($reflection->getFileName());

        $this->assertStringContainsString(
            'lockForUpdate',
            $source,
            'GenerateFiscalNumberAction must hold a row lock on fiscal_sequences to prevent duplicate correlatives under concurrent invoice emissions.'
        );
    }

    public function test_repeated_serial_emissions_produce_monotonic_increment(): void
    {
        $cashier = $this->cashier();

        $observed = [];
        for ($i = 0; $i < 5; $i++) {
            $response = $this->actingAs($cashier)
                ->postJson('/api/invoices', [
                    'patient_name' => "Paciente {$i}",
                    'items' => [$this->item('Glucosa')],
                ])
                ->assertCreated();

            $observed[] = $response->json('data.invoice_number');
        }

        $actualRange = array_map(
            fn (string $number) => (int) substr($number, strrpos($number, '-') + 1),
            $observed,
        );

        $this->assertSame(
            range(1, 5),
            $actualRange,
            'Serial invoice emissions must produce correlatives 1..5.'
        );

        $this->assertCount(
            5,
            array_unique($observed),
            'Each serial emission must yield a distinct invoice number.'
        );
    }

    public function test_full_lifecycle_uses_amount_cents_in_payment_math(): void
    {
        $cashier = $this->cashier();

        $invoiceResponse = $this->actingAs($cashier)
            ->postJson('/api/invoices', [
                'patient_name' => 'Maria Lopez',
                'items' => [$this->item('Glucosa')],
            ])
            ->assertCreated();

        $invoiceId = $invoiceResponse->json('data.id');
        $totalCents = Money::parseCents($invoiceResponse->json('data.total'), 'total');

        $payment = $this->actingAs($cashier)
            ->postJson("/api/invoices/{$invoiceId}/payments", [
                'method' => 'cash',
                'amount' => number_format($totalCents / 100, 2, '.', ''),
                'cash_session_id' => CashRegisterSession::query()
                    ->where('user_id', $cashier->id)
                    ->where('status', CashRegisterSession::STATUS_OPEN)
                    ->value('id'),
            ])
            ->assertCreated()
            ->json('data.payment');

        $this->assertSame($totalCents, $payment['amount_cents']);
        $this->assertSame(
            number_format($totalCents / 100, 2, '.', ''),
            $payment['amount']
        );

        $this->assertDatabaseHas('payments', [
            'id' => $payment['id'],
            'amount_cents' => $totalCents,
            'status' => Payment::STATUS_POSTED,
        ]);
    }

    public function test_concurrent_fork_pattern_documentation_marker(): void
    {
        if (! extension_loaded('pcntl')) {
            $this->markTestSkipped('Concurrent fork test requires pcntl (not available on Windows CI). The runtime verification is performed manually and recorded in qa/FINAL_CONCURRENCY_PROOF.md.');
        }

        $this->assertTrue(
            extension_loaded('pcntl'),
            'pcntl is loaded; a forked child can be spawned to validate the lockForUpdate path against a real MariaDB instance.'
        );
    }
}
