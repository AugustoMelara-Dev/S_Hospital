<?php

namespace Tests\Unit\Actions;

use App\Models\AuditLog;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuditUserActionsTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;
    private User $cashier;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);

        $this->admin = User::factory()->create();
        $this->admin->assignRole('admin');

        $this->cashier = User::factory()->create([
            'name' => 'Original Name',
            'email' => 'original@email.com',
            'username' => 'original_username',
            'active' => true,
        ]);
        $this->cashier->assignRole('cajero');
    }

    public function test_it_audits_user_creation(): void
    {
        $this->actingAs($this->admin, 'web');

        $payload = [
            'name' => 'New Cashier',
            'email' => 'new@email.com',
            'username' => 'new_cashier',
            'password' => 'SecurePass123',
            'role' => 'cajero',
            'active' => true,
        ];

        $response = $this->postJson('/api/admin/users', $payload);

        $response->assertStatus(201);

        $createdUser = User::where('username', 'new_cashier')->firstOrFail();

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'user.created',
            'entity_type' => User::class,
            'entity_id' => $createdUser->id,
            'user_id' => $this->admin->id,
        ]);

        $log = AuditLog::where('action', 'user.created')->firstOrFail();
        $this->assertNull($log->old_values);
        $this->assertSame($createdUser->username, $log->new_values['username']);
    }

    public function test_it_audits_user_updates(): void
    {
        $this->actingAs($this->admin, 'web');

        $payload = [
            'name' => 'Updated Name',
            'email' => 'updated@email.com',
            'username' => 'updated_username',
            'role' => 'supervisor',
        ];

        $response = $this->patchJson("/api/admin/users/{$this->cashier->id}", $payload);

        $response->assertStatus(200);

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'user.updated',
            'entity_type' => User::class,
            'entity_id' => $this->cashier->id,
            'user_id' => $this->admin->id,
        ]);

        $log = AuditLog::where('action', 'user.updated')->firstOrFail();
        $this->assertSame('Original Name', $log->old_values['name']);
        $this->assertSame('Updated Name', $log->new_values['name']);
    }

    public function test_it_audits_toggling_user_active_status(): void
    {
        $this->actingAs($this->admin, 'web');

        $response = $this->postJson("/api/admin/users/{$this->cashier->id}/toggle-active");

        $response->assertStatus(200);

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'user.status_updated',
            'entity_type' => User::class,
            'entity_id' => $this->cashier->id,
            'user_id' => $this->admin->id,
        ]);

        $log = AuditLog::where('action', 'user.status_updated')->firstOrFail();
        $this->assertTrue($log->old_values['active']);
        $this->assertFalse($log->new_values['active']);
    }

    public function test_it_audits_user_password_resets(): void
    {
        $this->actingAs($this->admin, 'web');

        $payload = [
            'password' => 'NewSecurePassword123',
        ];

        $response = $this->postJson("/api/admin/users/{$this->cashier->id}/reset-password", $payload);

        $response->assertStatus(200);

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'user.password_reset',
            'entity_type' => User::class,
            'entity_id' => $this->cashier->id,
            'user_id' => $this->admin->id,
        ]);
    }
}
