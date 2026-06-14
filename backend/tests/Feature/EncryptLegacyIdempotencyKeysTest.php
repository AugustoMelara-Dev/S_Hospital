<?php

namespace Tests\Feature;

use App\Models\IdempotencyKey;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class EncryptLegacyIdempotencyKeysTest extends TestCase
{
    use RefreshDatabase;

    public function test_encrypts_legacy_plaintext_idempotency_keys_without_data_loss(): void
    {
        $user = User::factory()->create();

        // 1. Insert a legacy plaintext row directly using DB facade to bypass Model mutators
        $legacyId = DB::table('idempotency_keys')->insertGetId([
            'user_id' => $user->id,
            'route_signature' => 'POST /api/invoices',
            'idempotency_key' => 'legacy-key-123',
            'request_fingerprint' => 'fingerprint-123',
            'response_status' => 201,
            'response_body' => '{"patient_name": "John Doe Plaintext"}',
            'completed_at' => now(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // 2. Insert a modern encrypted row
        $modernId = DB::table('idempotency_keys')->insertGetId([
            'user_id' => $user->id,
            'route_signature' => 'POST /api/invoices',
            'idempotency_key' => 'modern-key-456',
            'request_fingerprint' => 'fingerprint-456',
            'response_status' => 201,
            'response_body' => Crypt::encryptString('{"patient_name": "Jane Doe Encrypted"}'),
            'completed_at' => now(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // 3. We use the artisan command or migration
        $this->artisan('idempotency:encrypt-legacy')->assertSuccessful();

        // Let's verify the legacy row is now encrypted in the DB
        $rawLegacyRow = DB::table('idempotency_keys')->find($legacyId);
        
        $this->assertStringNotContainsString('John Doe Plaintext', $rawLegacyRow->response_body);
        $this->assertEquals('{"patient_name": "John Doe Plaintext"}', Crypt::decryptString($rawLegacyRow->response_body));

        // And the modern row is still encrypted correctly
        $rawModernRow = DB::table('idempotency_keys')->find($modernId);
        $this->assertStringNotContainsString('Jane Doe Encrypted', $rawModernRow->response_body);
        $this->assertEquals('{"patient_name": "Jane Doe Encrypted"}', Crypt::decryptString($rawModernRow->response_body));
    }
}
