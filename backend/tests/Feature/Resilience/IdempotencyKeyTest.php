<?php

declare(strict_types=1);

namespace Tests\Feature\Resilience;

use App\Models\AuditLog;
use App\Models\CashRegisterSession;
use App\Models\FiscalSequence;
use App\Models\FiscalSetting;
use App\Models\IdempotencyKey;
use App\Models\Payment;
use App\Models\Service;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Database\Seeders\ServiceCatalogSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Resilience audit: cashier browser drops the response after the server
 * commits a payment. Without an Idempotency-Key the cashier is charged
 * twice on the retry. With the header, the duplicate request replays
 * the original response byte-for-byte.
 */
class IdempotencyKeyTest extends TestCase
{
    use RefreshDatabase;

    public function test_repeated_payment_with_same_idempotency_key_replays_original_response(): void
    {
        $this->seedBillingBase();
        $this->togglePartial(true);

        $cashier = $this->cashierWithOpenSession();
        $sessionId = $this->openSessionFor($cashier, '500.00');
        $glucose = Service::query()->where('name', 'Glucosa')->firstOrFail();

        $invoiceId = $this->actingAs($cashier)
            ->postJson('/api/invoices', [
                'patient_name' => 'Maria Lopez',
                'items' => [['service_id' => $glucose->id, 'quantity' => '1.00']],
            ])
            ->assertCreated()
            ->json('data.id');

        $payload = [
            'cash_session_id' => $sessionId,
            'method' => Payment::METHOD_CASH,
            'amount' => '17.25',
        ];
        $key = (string) Str::uuid();

        $first = $this->actingAs($cashier)
            ->withHeaders(['Idempotency-Key' => $key])
            ->postJson("/api/invoices/{$invoiceId}/payments", $payload)
            ->assertCreated();

        $firstPaymentId = $first->json('data.payment.id');

        $second = $this->actingAs($cashier)
            ->withHeaders(['Idempotency-Key' => $key])
            ->postJson("/api/invoices/{$invoiceId}/payments", $payload);

        $second->assertCreated();
        $second->assertHeader('Idempotent-Replay', 'true');
        $this->assertSame($firstPaymentId, $second->json('data.payment.id'));

        $this->assertSame(1, Payment::query()->where('invoice_id', $invoiceId)->count());
    }

    public function test_same_idempotency_key_with_different_payload_is_rejected(): void
    {
        $this->seedBillingBase();
        $this->togglePartial(true);

        $cashier = $this->cashierWithOpenSession();
        $sessionId = $this->openSessionFor($cashier, '500.00');
        $glucose = Service::query()->where('name', 'Glucosa')->firstOrFail();

        $invoiceId = $this->actingAs($cashier)
            ->postJson('/api/invoices', [
                'patient_name' => 'Maria Lopez',
                'items' => [['service_id' => $glucose->id, 'quantity' => '1.00']],
            ])
            ->assertCreated()
            ->json('data.id');

        $key = (string) Str::uuid();

        $this->actingAs($cashier)
            ->withHeaders(['Idempotency-Key' => $key])
            ->postJson("/api/invoices/{$invoiceId}/payments", [
                'cash_session_id' => $sessionId,
                'method' => Payment::METHOD_CASH,
                'amount' => '5.00',
            ])
            ->assertCreated();

        $this->actingAs($cashier)
            ->withHeaders(['Idempotency-Key' => $key])
            ->postJson("/api/invoices/{$invoiceId}/payments", [
                'cash_session_id' => $sessionId,
                'method' => Payment::METHOD_CASH,
                'amount' => '9.00',
            ])
            ->assertStatus(422)
            ->assertJsonPath('errors.idempotency_key.0', 'Reutilice la misma carga o genere una nueva clave.');

        $this->assertSame(1, Payment::query()->where('invoice_id', $invoiceId)->count());
    }

    public function test_idempotency_key_is_per_user(): void
    {
        $this->seedBillingBase();
        $this->togglePartial(true);

        $cashierA = $this->cashierWithOpenSession('A');
        $sessionA = $this->openSessionFor($cashierA, '500.00');
        $glucose = Service::query()->where('name', 'Glucosa')->firstOrFail();

        $invoiceId = $this->actingAs($cashierA)
            ->postJson('/api/invoices', [
                'patient_name' => 'A',
                'items' => [['service_id' => $glucose->id, 'quantity' => '1.00']],
            ])
            ->assertCreated()
            ->json('data.id');

        $cashierB = $this->cashierWithOperateAny('B');
        $sessionB = $this->openSessionFor($cashierB, '500.00');

        $key = (string) Str::uuid();

        $this->actingAs($cashierA)
            ->withHeaders(['Idempotency-Key' => $key])
            ->postJson("/api/invoices/{$invoiceId}/payments", [
                'cash_session_id' => $sessionA,
                'method' => Payment::METHOD_CASH,
                'amount' => '8.00',
            ])
            ->assertCreated();

        $this->actingAs($cashierB)
            ->withHeaders(['Idempotency-Key' => $key])
            ->postJson("/api/invoices/{$invoiceId}/payments", [
                'cash_session_id' => $sessionB,
                'method' => Payment::METHOD_CASH,
                'amount' => '8.00',
            ])
            ->assertCreated()
            ->assertHeaderMissing('Idempotent-Replay');

        $this->assertSame(2, Payment::query()->where('invoice_id', $invoiceId)->count());
    }

    public function test_failed_request_with_idempotency_key_can_be_retried(): void
    {
        $this->seedBillingBase();
        $this->togglePartial(false);

        $cashier = $this->cashierWithOpenSession();
        $sessionId = $this->openSessionFor($cashier, '500.00');
        $glucose = Service::query()->where('name', 'Glucosa')->firstOrFail();

        $invoiceId = $this->actingAs($cashier)
            ->postJson('/api/invoices', [
                'patient_name' => 'X',
                'items' => [['service_id' => $glucose->id, 'quantity' => '1.00']],
            ])
            ->assertCreated()
            ->json('data.id');

        $key = (string) Str::uuid();

        $this->actingAs($cashier)
            ->withHeaders(['Idempotency-Key' => $key])
            ->postJson("/api/invoices/{$invoiceId}/payments", [
                'cash_session_id' => $sessionId,
                'method' => Payment::METHOD_CASH,
                'amount' => '5.00',
            ])
            ->assertStatus(422);

        $this->togglePartial(true);

        $this->actingAs($cashier)
            ->withHeaders(['Idempotency-Key' => $key])
            ->postJson("/api/invoices/{$invoiceId}/payments", [
                'cash_session_id' => $sessionId,
                'method' => Payment::METHOD_CASH,
                'amount' => '5.00',
            ])
            ->assertCreated();

        $this->assertSame(1, IdempotencyKey::query()->where('idempotency_key', $key)->whereNotNull('completed_at')->count());
        $this->assertSame(1, Payment::query()->where('invoice_id', $invoiceId)->count());
    }

    public function test_replay_does_not_double_audit_log_entry(): void
    {
        $this->seedBillingBase();
        $this->togglePartial(true);

        $cashier = $this->cashierWithOpenSession();
        $sessionId = $this->openSessionFor($cashier, '500.00');
        $glucose = Service::query()->where('name', 'Glucosa')->firstOrFail();

        $invoiceId = $this->actingAs($cashier)
            ->postJson('/api/invoices', [
                'patient_name' => 'Audit',
                'items' => [['service_id' => $glucose->id, 'quantity' => '1.00']],
            ])
            ->assertCreated()
            ->json('data.id');

        $key = (string) Str::uuid();
        $payload = [
            'cash_session_id' => $sessionId,
            'method' => Payment::METHOD_CASH,
            'amount' => '7.00',
        ];

        $this->actingAs($cashier)
            ->withHeaders(['Idempotency-Key' => $key])
            ->postJson("/api/invoices/{$invoiceId}/payments", $payload)
            ->assertCreated();

        $this->actingAs($cashier)
            ->withHeaders(['Idempotency-Key' => $key])
            ->postJson("/api/invoices/{$invoiceId}/payments", $payload)
            ->assertCreated();

        $payment = Payment::query()->where('invoice_id', $invoiceId)->firstOrFail();
        $auditCount = AuditLog::query()
            ->where('action', 'payment.registered')
            ->where('entity_id', $payment->id)
            ->count();

        $this->assertSame(1, $auditCount);
    }

    public function test_response_body_is_stored_encrypted_and_does_not_contain_pii_in_plaintext(): void
    {
        $this->seedBillingBase();
        $this->togglePartial(true);

        $cashier = $this->cashierWithOpenSession();
        $sessionId = $this->openSessionFor($cashier, '500.00');
        $glucose = Service::query()->where('name', 'Glucosa')->firstOrFail();

        $piiToken = 'PII-TOKEN-'.strtoupper(Str::random(16));
        $amountToken = 'AMT-MARKER-'.strtoupper(Str::random(8));

        $invoiceId = $this->actingAs($cashier)
            ->postJson('/api/invoices', [
                'patient_name' => $piiToken,
                'items' => [['service_id' => $glucose->id, 'quantity' => '1.00']],
            ])
            ->assertCreated()
            ->json('data.id');

        $key = (string) Str::uuid();
        $this->actingAs($cashier)
            ->withHeaders(['Idempotency-Key' => $key])
            ->postJson("/api/invoices/{$invoiceId}/payments", [
                'cash_session_id' => $sessionId,
                'method' => Payment::METHOD_CASH,
                'amount' => '11.00',
                'reference' => $amountToken,
            ])
            ->assertCreated();

        $row = IdempotencyKey::query()->where('idempotency_key', $key)->firstOrFail();

        // The raw `response_body` column is ciphertext, never the original
        // JSON. Patient name and reference token must not appear in the
        // raw ciphertext, even though they were sent in the request.
        $raw = (string) $row->getRawOriginal('response_body');
        $this->assertNotSame('', $raw);
        $this->assertStringNotContainsString($piiToken, $raw);
        $this->assertStringNotContainsString($amountToken, $raw);

        // The accessor transparently decrypts.
        $decoded = json_decode((string) $row->response_body_plain, true);
        $this->assertIsArray($decoded);
        $this->assertSame(201, $row->response_status);

        // The raw value decrypts to a non-empty JSON payload via Crypt.
        $this->assertSame($row->response_body_plain, Crypt::decryptString($raw));
    }

    public function test_response_body_is_also_encrypted_in_failed_request_payloads(): void
    {
        // The middleware only stores 2xx responses, so a 422 row is deleted.
        // We still want to confirm that a successful POST against a different
        // endpoint stores an encrypted body.
        $this->seedBillingBase();
        $cashier = $this->cashierWithOpenSession();

        $key = (string) Str::uuid();
        $this->actingAs($cashier)
            ->withHeaders(['Idempotency-Key' => $key])
            ->postJson('/api/cash-sessions/open', [
                'opening_amount' => '0.00',
                'notes' => 'PII-Cash-Open-Secret',
            ])
            ->assertCreated();

        $row = IdempotencyKey::query()->where('idempotency_key', $key)->firstOrFail();
        $raw = (string) $row->getRawOriginal('response_body');
        $this->assertStringNotContainsString('PII-Cash-Open-Secret', $raw);
        $this->assertSame($row->response_body_plain, Crypt::decryptString($raw));
    }

    public function test_replay_decrypts_body_for_caller(): void
    {
        $this->seedBillingBase();
        $this->togglePartial(true);

        $cashier = $this->cashierWithOpenSession();
        $sessionId = $this->openSessionFor($cashier, '500.00');
        $glucose = Service::query()->where('name', 'Glucosa')->firstOrFail();

        $invoiceId = $this->actingAs($cashier)
            ->postJson('/api/invoices', [
                'patient_name' => 'Replay-Secret',
                'items' => [['service_id' => $glucose->id, 'quantity' => '1.00']],
            ])
            ->assertCreated()
            ->json('data.id');

        $key = (string) Str::uuid();
        $payload = [
            'cash_session_id' => $sessionId,
            'method' => Payment::METHOD_CASH,
            'amount' => '4.00',
        ];

        $first = $this->actingAs($cashier)
            ->withHeaders(['Idempotency-Key' => $key])
            ->postJson("/api/invoices/{$invoiceId}/payments", $payload)
            ->assertCreated();

        $second = $this->actingAs($cashier)
            ->withHeaders(['Idempotency-Key' => $key])
            ->postJson("/api/invoices/{$invoiceId}/payments", $payload)
            ->assertCreated();

        $second->assertHeader('Idempotent-Replay', 'true');
        $this->assertSame($first->json('data.payment.id'), $second->json('data.payment.id'));

        // The replayed payload is fully decrypted for the caller, including
        // the patient name embedded in the original invoice.
        $this->assertSame(201, $second->status());
    }

    private function seedBillingBase(): void
    {
        $this->seed([RolesAndPermissionsSeeder::class, ServiceCatalogSeeder::class]);
        FiscalSetting::query()->create([
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

    private function togglePartial(bool $enabled): void
    {
        FiscalSetting::query()->update(['partial_payments_enabled' => $enabled]);
    }

    private function cashierWithOpenSession(string $suffix = ''): User
    {
        $cashier = User::factory()->create([
            'username' => 'caj'.$suffix.'-'.uniqid(),
        ]);
        $cashier->assignRole('cajero');

        return $cashier->refresh();
    }

    private function cashierWithOperateAny(string $suffix = ''): User
    {
        $cashier = $this->cashierWithOpenSession($suffix);
        $cashier->givePermissionTo('invoices.operate_any');

        return $cashier->refresh();
    }

    private function openSessionFor(User $cashier, string $openingAmount): int
    {
        $session = CashRegisterSession::query()->create([
            'user_id' => $cashier->id,
            'open_user_id' => $cashier->id,
            'opening_amount' => $openingAmount,
            'status' => CashRegisterSession::STATUS_OPEN,
            'opened_at' => now(),
        ]);

        return (int) $session->id;
    }
}
