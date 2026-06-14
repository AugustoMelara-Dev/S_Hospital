<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Actions\Reports\OperationalMetricsService;
use App\Models\AuditLog;
use App\Models\BackupLog;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class AuditLogTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);
    }

    public function test_audit_log_persists_action_with_no_user(): void
    {
        AuditLog::query()->create([
            'user_id' => null,
            'action' => 'system.startup',
            'entity_type' => 'system',
            'entity_id' => null,
            'old_values' => null,
            'new_values' => ['note' => 'System started'],
            'created_at' => now(),
        ]);

        $this->assertDatabaseHas('audit_logs', [
            'user_id' => null,
            'action' => 'system.startup',
        ]);
    }

    public function test_audit_log_records_serializable_json_payload(): void
    {
        $admin = $this->admin();

        AuditLog::query()->create([
            'user_id' => $admin->id,
            'action' => 'user.toggled',
            'entity_type' => User::class,
            'entity_id' => 42,
            'old_values' => ['active' => true],
            'new_values' => ['active' => false],
            'created_at' => now(),
        ]);

        $entry = AuditLog::query()->where('action', 'user.toggled')->firstOrFail();
        $this->assertSame(['active' => true], $entry->old_values);
        $this->assertSame(['active' => false], $entry->new_values);
    }

    public function test_audit_log_surfaces_in_recent_errors_when_action_contains_failed(): void
    {
        AuditLog::query()->create([
            'user_id' => null,
            'action' => 'backup.failed',
            'entity_type' => BackupLog::class,
            'entity_id' => 1,
            'new_values' => ['status' => 'failed'],
            'created_at' => now(),
        ]);

        $snapshot = app(OperationalMetricsService::class)->snapshot();
        $this->assertNotEmpty($snapshot['recent_errors']);
        $this->assertSame('backup.failed', $snapshot['recent_errors'][0]['action']);
    }

    public function test_auth_login_logout_and_password_change_write_forensic_audit_logs(): void
    {
        $user = User::factory()->create([
            'username' => 'audit-auth',
            'email' => 'audit-auth@hospital.local',
            'password' => Hash::make('Password123!'),
            'must_change_password' => false,
            'active' => true,
        ]);
        $user->assignRole('cajero');

        $this->withHeader('User-Agent', 'F7Audit/1.0')
            ->withServerVariables(['REMOTE_ADDR' => '192.168.10.15'])
            ->postJson('/api/auth/login', [
                'login' => 'audit-auth',
                'password' => 'Password123!',
            ])
            ->assertOk();

        $this->withHeader('User-Agent', 'F7Audit/1.0')
            ->withServerVariables(['REMOTE_ADDR' => '192.168.10.15'])
            ->postJson('/api/auth/change-password', [
                'current_password' => 'Password123!',
                'password' => 'Password456!',
                'password_confirmation' => 'Password456!',
            ])
            ->assertOk();

        $this->withHeader('User-Agent', 'F7Audit/1.0')
            ->withServerVariables(['REMOTE_ADDR' => '192.168.10.15'])
            ->postJson('/api/auth/logout')
            ->assertOk();

        foreach (['auth.login', 'auth.password_changed', 'auth.logout'] as $action) {
            $this->assertDatabaseHas('audit_logs', [
                'user_id' => $user->id,
                'action' => $action,
                'entity_type' => User::class,
                'entity_id' => $user->id,
                'ip' => '192.168.10.15',
                'user_agent' => 'F7Audit/1.0',
                'http_method' => 'POST',
            ]);
        }
    }

    public function test_failed_login_writes_safe_forensic_audit_log(): void
    {
        $this->withHeader('User-Agent', 'F7Audit/failed')
            ->withServerVariables(['REMOTE_ADDR' => '192.168.10.16'])
            ->postJson('/api/auth/login', [
                'login' => 'missing-user',
                'password' => 'plain-secret',
            ])
            ->assertStatus(422);

        $entry = AuditLog::query()->where('action', 'auth.login_failed')->firstOrFail();

        $this->assertNull($entry->user_id);
        $this->assertSame('192.168.10.16', $entry->ip);
        $this->assertSame('F7Audit/failed', $entry->user_agent);
        $this->assertSame('POST', $entry->http_method);
        $this->assertSame(['login' => 'missing-user'], $entry->new_values);
        $this->assertStringNotContainsString('plain-secret', json_encode($entry->toArray(), JSON_THROW_ON_ERROR));
    }

    private function admin(): User
    {
        $user = User::factory()->create([
            'username' => 'admin-audit-'.uniqid(),
            'email' => 'admin-'.uniqid().'@hospital.local',
            'must_change_password' => false,
            'active' => true,
        ]);
        $user->assignRole('admin');

        return $user;
    }
}
