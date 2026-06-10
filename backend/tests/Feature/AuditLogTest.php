<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Actions\Reports\OperationalMetricsService;
use App\Models\AuditLog;
use App\Models\BackupLog;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
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
