<?php

namespace Tests\Feature\Console;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class PruneIdempotencyKeysCommandTest extends TestCase
{
    use RefreshDatabase;

    public function test_dry_run_reports_without_deleting_idempotency_keys(): void
    {
        $user = User::factory()->create();
        $this->insertLegacyKey($user->id, 'old-legacy', now()->subDays(45), now()->subDays(45));
        $this->insertOperationKey($user->id, 'old-operation', now()->subDays(45));

        $this->artisan('hospital:prune-idempotency-keys', ['--dry-run' => true, '--days' => 30])
            ->expectsOutputToContain('legacy=1, operational=1')
            ->assertSuccessful();

        $this->assertDatabaseHas('idempotency_keys', ['idempotency_key' => 'old-legacy']);
        $this->assertDatabaseHas('operation_idempotency_keys', ['key' => 'old-operation']);
    }

    public function test_prune_removes_only_old_idempotency_keys(): void
    {
        $user = User::factory()->create();
        $this->insertLegacyKey($user->id, 'old-completed', now()->subDays(45), now()->subDays(45));
        $this->insertLegacyKey($user->id, 'old-pending', null, now()->subDays(45));
        $this->insertLegacyKey($user->id, 'recent-completed', now()->subDays(2), now()->subDays(2));
        $this->insertOperationKey($user->id, 'old-operation', now()->subDays(45));
        $this->insertOperationKey($user->id, 'recent-operation', now()->subDays(2));

        $this->artisan('hospital:prune-idempotency-keys', ['--days' => 30, '--chunk' => 1])
            ->expectsOutputToContain('Prune completado: legacy=2, operational=1')
            ->assertSuccessful();

        $this->assertDatabaseMissing('idempotency_keys', ['idempotency_key' => 'old-completed']);
        $this->assertDatabaseMissing('idempotency_keys', ['idempotency_key' => 'old-pending']);
        $this->assertDatabaseHas('idempotency_keys', ['idempotency_key' => 'recent-completed']);
        $this->assertDatabaseMissing('operation_idempotency_keys', ['key' => 'old-operation']);
        $this->assertDatabaseHas('operation_idempotency_keys', ['key' => 'recent-operation']);
    }

    private function insertLegacyKey(int $userId, string $key, mixed $completedAt, mixed $updatedAt): void
    {
        DB::table('idempotency_keys')->insert([
            'user_id' => $userId,
            'route_signature' => 'POST:/api/invoices',
            'idempotency_key' => $key,
            'request_fingerprint' => hash('sha256', $key),
            'response_status' => $completedAt ? 200 : null,
            'response_body' => $completedAt ? 'encrypted-fixture' : null,
            'completed_at' => $completedAt,
            'created_at' => $updatedAt,
            'updated_at' => $updatedAt,
        ]);
    }

    private function insertOperationKey(int $userId, string $key, mixed $updatedAt): void
    {
        DB::table('operation_idempotency_keys')->insert([
            'key' => $key,
            'user_id' => $userId,
            'operation' => 'backup',
            'resource_type' => 'manual',
            'resource_id' => null,
            'request_hash' => hash('sha256', $key),
            'created_at' => $updatedAt,
            'updated_at' => $updatedAt,
        ]);
    }
}
