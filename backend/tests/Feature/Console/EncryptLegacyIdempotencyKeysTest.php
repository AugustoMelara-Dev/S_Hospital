<?php

namespace Tests\Feature\Console;

use App\Models\IdempotencyKey;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class EncryptLegacyIdempotencyKeysTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    protected function setUp(): void
    {
        parent::setUp();
        $this->user = User::factory()->create();
    }

    public function test_encrypts_plaintext_response_body(): void
    {
        // Insert a legacy plaintext row directly using DB to bypass Eloquent mutator
        $plaintext = json_encode([
            'patient_name' => 'John Doe',
            'invoice_number' => '000-001-01-00000001',
            'amount' => 1500
        ]);

        $id = DB::table('idempotency_keys')->insertGetId([
            'user_id' => $this->user->id,
            'route_signature' => 'POST /api/test',
            'idempotency_key' => 'legacy-key-123',
            'request_fingerprint' => 'fingerprint-123',
            'response_status' => 200,
            'response_body' => $plaintext,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->artisan('idempotency:encrypt-legacy')
            ->expectsOutputToContain('Total Processed')
            ->assertSuccessful();

        // Validate the raw SQL no longer contains the plaintext
        $rawRow = DB::table('idempotency_keys')->where('id', $id)->first();
        $this->assertStringNotContainsString('John Doe', $rawRow->response_body);
        $this->assertStringNotContainsString('000-001-01-00000001', $rawRow->response_body);

        // Validate it can be decrypted properly
        $decrypted = Crypt::decryptString($rawRow->response_body);
        $this->assertEquals($plaintext, $decrypted);
        
        // And using Eloquent model works fine
        $model = IdempotencyKey::find($id);
        $this->assertEquals($plaintext, $model->response_body_plain);
    }

    public function test_does_not_double_encrypt(): void
    {
        $plaintext = json_encode(['data' => 'test']);
        
        // Insert an ALREADY encrypted row
        $id = DB::table('idempotency_keys')->insertGetId([
            'user_id' => $this->user->id,
            'route_signature' => 'POST /api/test',
            'idempotency_key' => 'already-encrypted',
            'request_fingerprint' => 'fingerprint-123',
            'response_status' => 200,
            'response_body' => Crypt::encryptString($plaintext),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $rawBefore = DB::table('idempotency_keys')->where('id', $id)->first()->response_body;

        $this->artisan('idempotency:encrypt-legacy')
            ->expectsTable(
                ['Total Processed', 'Encrypted', 'Skipped (Already Encrypted or Empty)', 'Failed'],
                [[1, 0, 1, 0]]
            )
            ->assertSuccessful();

        $rawAfter = DB::table('idempotency_keys')->where('id', $id)->first()->response_body;
        
        // Value shouldn't change
        $this->assertEquals($rawBefore, $rawAfter);
    }

    public function test_dry_run_does_not_modify_data(): void
    {
        $plaintext = json_encode(['data' => 'test']);
        
        $id = DB::table('idempotency_keys')->insertGetId([
            'user_id' => $this->user->id,
            'route_signature' => 'POST /api/test',
            'idempotency_key' => 'dry-run-key',
            'request_fingerprint' => 'fingerprint-123',
            'response_status' => 200,
            'response_body' => $plaintext,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->artisan('idempotency:encrypt-legacy', ['--dry-run' => true])
            ->expectsOutputToContain('DRY-RUN')
            ->expectsTable(
                ['Total Processed', 'Encrypted', 'Skipped (Already Encrypted or Empty)', 'Failed'],
                [[1, 1, 0, 0]]
            )
            ->assertSuccessful();

        $rawAfter = DB::table('idempotency_keys')->where('id', $id)->first()->response_body;
        $this->assertEquals($plaintext, $rawAfter);
    }

    public function test_ignores_null_or_empty_values(): void
    {
        DB::table('idempotency_keys')->insertGetId([
            'user_id' => $this->user->id,
            'route_signature' => 'POST /api/test',
            'idempotency_key' => 'empty-key',
            'request_fingerprint' => 'fingerprint-123',
            'response_status' => 500,
            'response_body' => null,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->artisan('idempotency:encrypt-legacy')
            ->expectsTable(
                ['Total Processed', 'Encrypted', 'Skipped (Already Encrypted or Empty)', 'Failed'],
                [[1, 0, 1, 0]]
            )
            ->assertSuccessful();
    }
}
