<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class PermissionAuditTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);
    }

    public function test_attaching_a_role_creates_an_audit_log_entry(): void
    {
        $admin = User::factory()->create([
            'username' => 'admin-audit',
            'email' => 'admin-audit@hospital.local',
            'password' => Hash::make('Password123!'),
            'must_change_password' => false,
            'active' => true,
        ])->assignRole('admin');

        $subject = User::factory()->create([
            'username' => 'cajero-audit',
            'email' => 'cajero-audit@hospital.local',
            'password' => Hash::make('Password123!'),
            'must_change_password' => false,
            'active' => true,
        ]);

        $this->actingAs($admin, 'web');

        $cajeroRole = Role::findByName('cajero');
        $subject->assignRole($cajeroRole);

        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $admin->id,
            'action' => 'role.attached',
            'entity_type' => User::class,
            'entity_id' => $subject->id,
        ]);

        $log = AuditLog::query()->where('action', 'role.attached')->latest('id')->firstOrFail();
        $this->assertSame('cajero', $log->new_values['role_name'] ?? null);
    }

    public function test_creating_a_role_creates_an_audit_log_entry(): void
    {
        $admin = User::factory()->create([
            'username' => 'admin-role',
            'email' => 'admin-role@hospital.local',
            'password' => Hash::make('Password123!'),
            'must_change_password' => false,
            'active' => true,
        ])->assignRole('admin');

        $this->actingAs($admin, 'web');

        Role::create(['name' => 'supervisor-caja', 'guard_name' => 'web']);

        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $admin->id,
            'action' => 'created',
            'entity_type' => Role::class,
        ]);
    }
}
