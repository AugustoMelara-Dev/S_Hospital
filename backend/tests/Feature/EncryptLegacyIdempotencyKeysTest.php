<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Contracts\Encryption\DecryptException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class EncryptLegacyIdempotencyKeysTest extends TestCase
{
    use RefreshDatabase;

    public function test_encrypts_legacy_plaintext_idempotency_keys()
    {
        DB::table('idempotency_keys')->truncate();

        $user = User::factory()->create();

        $legacyId = DB::table('idempotency_keys')->insertGetId([
            'user_id' => $user->id,
            'route_signature' => 'POST api/test',
            'idempotency_key' => 'legacy-key-123',
            'request_fingerprint' => 'fingerprint123',
            'response_status' => 200,
            'response_body' => '{"patient_name": "John Doe Plaintext"}',
            'created_at' => now(),
            'updated_at' => now()
        ]);

        $encryptedBody = Crypt::encryptString('{"patient_name": "Jane Doe Encrypted"}');
        $encryptedId = DB::table('idempotency_keys')->insertGetId([
            'user_id' => $user->id,
            'route_signature' => 'POST api/test',
            'idempotency_key' => 'encrypted-key-456',
            'request_fingerprint' => 'fingerprint456',
            'response_status' => 200,
            'response_body' => $encryptedBody,
            'created_at' => now(),
            'updated_at' => now()
        ]);

        Artisan::call('migrate', ['--path' => 'database/migrations/2026_06_14_000002_encrypt_legacy_idempotency_keys.php']);

        $legacyRow = DB::table('idempotency_keys')->where('id', $legacyId)->first();
        $this->assertStringNotContainsString('John Doe Plaintext', $legacyRow->response_body);
        $this->assertEquals('{"patient_name": "John Doe Plaintext"}', Crypt::decryptString($legacyRow->response_body));

        $encryptedRow = DB::table('idempotency_keys')->where('id', $encryptedId)->first();
        $this->assertEquals($encryptedBody, $encryptedRow->response_body);
        $this->assertEquals('{"patient_name": "Jane Doe Encrypted"}', Crypt::decryptString($encryptedRow->response_body));
    }
}
