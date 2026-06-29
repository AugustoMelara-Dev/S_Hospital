<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class AuthTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_can_login_with_username(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);

        $user = User::factory()->create([
            'username' => 'admin.local',
            'email' => 'admin.local@example.test',
            'password' => Hash::make('Password123!'),
        ]);
        $user->assignRole('admin');

        $response = $this->postJson('/api/auth/login', [
            'login' => 'admin.local',
            'password' => 'Password123!',
        ]);

        $response->assertOk()
            ->assertJsonPath('data.username', 'admin.local')
            ->assertJsonPath('data.roles.0', 'admin')
            ->assertJsonPath('data.must_change_password', false);
    }

    public function test_login_session_can_read_protected_api_afterward(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);

        $user = User::factory()->create([
            'username' => 'admin.local',
            'email' => 'admin.local@example.test',
            'password' => Hash::make('Password123!'),
        ]);
        $user->assignRole('admin');

        $this->postJson('/api/auth/login', [
            'login' => 'admin.local',
            'password' => 'Password123!',
        ])->assertOk();

        $this->getJson('/api/settings/fiscal')
            ->assertOk();
    }

    public function test_user_can_login_with_email(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);

        $user = User::factory()->create([
            'username' => 'supervisor.local',
            'email' => 'supervisor.local@example.test',
            'password' => Hash::make('Password123!'),
        ]);
        $user->assignRole('supervisor');

        $response = $this->postJson('/api/auth/login', [
            'login' => 'supervisor.local@example.test',
            'password' => 'Password123!',
        ]);

        $response->assertOk()
            ->assertJsonPath('data.username', 'supervisor.local');
    }

    public function test_invalid_login_is_rejected(): void
    {
        User::factory()->create([
            'username' => 'admin.local',
            'password' => Hash::make('Password123!'),
        ]);

        $this->postJson('/api/auth/login', [
            'login' => 'admin.local',
            'password' => 'wrong-password',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors('login');
    }

    public function test_failed_login_writes_forensic_audit_without_password(): void
    {
        User::factory()->create([
            'username' => 'admin.local',
            'password' => Hash::make('Password123!'),
        ]);

        $this->postJson('/api/auth/login', [
            'login' => 'admin.local',
            'password' => 'wrong-password',
        ])->assertUnprocessable();

        $audit = AuditLog::query()
            ->where('action', 'auth.login_failed')
            ->where('entity_type', User::class)
            ->firstOrFail();

        $this->assertSame('failed', $audit->result);
        $this->assertSame('admin.local', $audit->new_values['login'] ?? null);
        $this->assertArrayNotHasKey('password', $audit->new_values ?? []);
        $this->assertNotNull($audit->ip);
        $this->assertSame('POST', $audit->http_method);
    }

    public function test_authenticated_user_can_read_me(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);

        $user = User::factory()->create();
        $user->assignRole('cajero');

        $this->actingAs($user)
            ->getJson('/api/auth/me')
            ->assertOk()
            ->assertJsonPath('data.id', $user->id)
            ->assertJsonPath('data.roles.0', 'cajero');
    }

    public function test_me_requires_authentication(): void
    {
        $this->getJson('/api/auth/me')
            ->assertUnauthorized();
    }

    public function test_session_endpoint_returns_null_for_guest_without_console_noise(): void
    {
        $this->getJson('/api/auth/session')
            ->assertOk()
            ->assertJsonPath('data', null);
    }

    public function test_session_endpoint_returns_authenticated_user_payload(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);

        $user = User::factory()->create();
        $user->assignRole('admin');

        $this->actingAs($user)
            ->getJson('/api/auth/session')
            ->assertOk()
            ->assertJsonPath('data.id', $user->id)
            ->assertJsonPath('data.roles.0', 'admin');
    }

    public function test_session_payload_does_not_expose_internal_or_inoperable_permissions(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);

        $user = User::factory()->create();
        $user->assignRole('cajero');
        $user->syncPermissions([User::EXACT_ACCESS_MARKER_PERMISSION, 'cash.view', 'receipts.void']);

        $response = $this->actingAs($user)
            ->getJson('/api/auth/session')
            ->assertOk()
            ->assertJsonPath('data.permissions', ['cash.view']);

        $this->assertNotContains(User::EXACT_ACCESS_MARKER_PERMISSION, $response->json('data.permissions'));
        $this->assertNotContains('receipts.void', $response->json('data.permissions'));
    }

    public function test_session_endpoint_does_not_hydrate_inactive_user_payload(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);

        $user = User::factory()->create([
            'active' => false,
        ]);
        $user->assignRole('admin');

        $this->actingAs($user)
            ->getJson('/api/auth/session')
            ->assertOk()
            ->assertJsonPath('data', null);
    }

    public function test_inactive_user_cannot_login_or_create_session(): void
    {
        $user = User::factory()->create([
            'username' => 'inactive.admin',
            'email' => 'inactive.admin@example.test',
            'password' => Hash::make('Password123!'),
            'active' => false,
        ]);

        $this->postJson('/api/auth/login', [
            'login' => 'inactive.admin',
            'password' => 'Password123!',
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('login');

        $this->getJson('/api/auth/session')
            ->assertOk()
            ->assertJsonPath('data', null);

        $this->assertDatabaseHas('login_attempts', [
            'login' => 'inactive.admin',
            'success' => false,
        ]);
        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $user->id,
            'action' => 'auth.login_blocked',
            'entity_type' => User::class,
            'entity_id' => $user->id,
            'result' => 'failed',
        ]);
    }

    public function test_user_can_logout(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->postJson('/api/auth/logout')
            ->assertOk()
            ->assertJsonPath('ok', true);
    }

    public function test_auth_lifecycle_writes_login_password_and_logout_audit_logs(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);

        $user = User::factory()->create([
            'username' => 'audited.admin',
            'email' => 'audited.admin@example.test',
            'password' => Hash::make('Password123!'),
            'must_change_password' => true,
        ]);
        $user->assignRole('admin');

        $this->postJson('/api/auth/login', [
            'login' => 'audited.admin',
            'password' => 'Password123!',
        ])->assertOk();

        $this->postJson('/api/auth/change-password', [
            'current_password' => 'Password123!',
            'password' => 'NewPassword123!',
            'password_confirmation' => 'NewPassword123!',
        ])->assertOk();

        $this->postJson('/api/auth/logout')
            ->assertOk();

        foreach (['auth.login', 'auth.login_success', 'auth.password_changed', 'auth.logout'] as $action) {
            $this->assertDatabaseHas('audit_logs', [
                'user_id' => $user->id,
                'action' => $action,
                'entity_type' => User::class,
                'entity_id' => $user->id,
                'result' => 'success',
            ]);
        }

        $auditPayloads = AuditLog::query()
            ->where('user_id', $user->id)
            ->whereIn('action', ['auth.login', 'auth.login_success', 'auth.password_changed', 'auth.logout'])
            ->pluck('new_values');

        foreach ($auditPayloads as $payload) {
            $this->assertArrayNotHasKey('password', $payload ?? []);
            $this->assertArrayNotHasKey('current_password', $payload ?? []);
        }
    }

    public function test_must_change_password_is_reported_and_blocks_protected_operations(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);

        $user = User::factory()->create([
            'must_change_password' => true,
        ]);
        $user->assignRole('admin');

        $this->actingAs($user)
            ->getJson('/api/auth/me')
            ->assertOk()
            ->assertJsonPath('data.must_change_password', true);

        $this->actingAs($user)
            ->getJson('/api/cash-sessions/current')
            ->assertForbidden()
            ->assertJsonPath('must_change_password', true);

        $this->actingAs($user)
            ->postJson('/api/auth/logout')
            ->assertOk()
            ->assertJsonPath('ok', true);

        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $user->id,
            'action' => 'auth.logout',
            'entity_type' => User::class,
            'entity_id' => $user->id,
            'result' => 'success',
        ]);
    }

    public function test_user_can_change_required_password(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);

        $user = User::factory()->create([
            'password' => Hash::make('Password123!'),
            'must_change_password' => true,
        ]);
        $user->assignRole('admin');

        $this->actingAs($user)
            ->postJson('/api/auth/change-password', [
                'current_password' => 'Password123!',
                'password' => 'NewPassword123!',
                'password_confirmation' => 'NewPassword123!',
            ])
            ->assertOk()
            ->assertJsonPath('data.must_change_password', false);

        $this->assertTrue(Hash::check('NewPassword123!', $user->refresh()->password));
        $this->assertFalse($user->must_change_password);
    }

    public function test_session_remains_active_after_required_password_change(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);

        $user = User::factory()->create([
            'username' => 'catalog.local',
            'email' => 'catalog.local@example.test',
            'password' => Hash::make('Password123!'),
            'must_change_password' => true,
        ]);
        $user->assignRole('admin');

        $this->postJson('/api/auth/login', [
            'login' => 'catalog.local',
            'password' => 'Password123!',
        ])->assertOk()
            ->assertJsonPath('data.must_change_password', true);

        $this->postJson('/api/auth/change-password', [
            'current_password' => 'Password123!',
            'password' => 'NewPassword123!',
            'password_confirmation' => 'NewPassword123!',
        ])->assertOk()
            ->assertJsonPath('data.must_change_password', false);

        $this->getJson('/api/auth/session')
            ->assertOk()
            ->assertJsonPath('data.username', 'catalog.local')
            ->assertJsonPath('data.must_change_password', false);
    }

    public function test_change_password_rejects_wrong_current_password(): void
    {
        $user = User::factory()->create([
            'password' => Hash::make('Password123!'),
            'must_change_password' => true,
        ]);

        $this->actingAs($user)
            ->postJson('/api/auth/change-password', [
                'current_password' => 'wrong-password',
                'password' => 'NewPassword123!',
                'password_confirmation' => 'NewPassword123!',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('current_password');
    }

    public function test_inactive_user_is_blocked_on_authenticated_request(): void
    {
        $user = User::factory()->create([
            'active' => false,
        ]);

        $this->actingAs($user)
            ->getJson('/api/auth/me')
            ->assertForbidden()
            ->assertJsonPath('message', 'User inactive.');
    }
}
