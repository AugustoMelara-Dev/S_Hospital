<?php

namespace Tests\Feature;

use App\Models\BackupLog;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Config;
use Tests\TestCase;

class SystemStatusTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_view_operational_status_without_secret_values(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $admin = $this->admin();

        BackupLog::query()->create([
            'filename' => 'hospital-backup-ok.sql',
            'path' => 'backups/hospital-backup-ok.sql',
            'disk' => 'local',
            'status' => BackupLog::STATUS_SUCCESS,
            'type' => BackupLog::TYPE_MANUAL,
            'created_by' => $admin->id,
            'size_bytes' => 100,
            'checksum_sha256' => str_repeat('a', 64),
            'completed_at' => now(),
        ]);
        BackupLog::query()->create([
            'filename' => 'hospital-backup-pending.sql',
            'path' => 'backups/hospital-backup-pending.sql',
            'disk' => 'local',
            'status' => BackupLog::STATUS_PENDING,
            'type' => BackupLog::TYPE_MANUAL,
            'created_by' => $admin->id,
        ]);

        $response = $this->actingAs($admin)
            ->getJson('/api/system/status')
            ->assertOk()
            ->assertJsonPath('data.readiness.state', 'PRODUCTION_CANDIDATE')
            ->assertJsonPath('data.readiness.production_ready', false)
            ->assertJsonPath('data.backups.pending_count', 1)
            ->assertJsonPath('data.backups.last_success_filename', 'hospital-backup-ok.sql')
            ->assertJsonPath('data.backups.queue.worker_command', 'php artisan queue:work --queue=backups --tries=1 --timeout=600')
            ->assertJsonPath('data.preflight.public_routes.0.path', '/up')
            ->assertJsonPath('data.preflight.public_routes.1.path', '/login')
            ->assertJsonPath('data.preflight.public_routes.2.path', '/verify-email')
            ->assertJsonPath('data.preflight.physical_proofs.0.required_file', 'qa/LAN_CLIENT_VALIDATION_PROOF.md')
            ->assertJsonPath('data.preflight.commands.backup_worker', 'php artisan queue:work --queue=backups --tries=1 --timeout=600')
            ->assertJsonMissingPath('data.database.password');

        $this->assertStringNotContainsString('password', json_encode($response->json(), JSON_THROW_ON_ERROR));
    }

    public function test_status_marks_environment_partial_only_when_production_debug_is_off(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        Config::set('app.env', 'production');
        Config::set('app.debug', false);

        $this->actingAs($this->admin())
            ->getJson('/api/system/status')
            ->assertOk()
            ->assertJsonPath('data.environment.app_env', 'production')
            ->assertJsonPath('data.environment.app_debug', false)
            ->assertJsonPath('data.readiness.blockers.2.status', 'partial');
    }

    public function test_non_admin_roles_cannot_view_operational_status(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);

        foreach (['cajero', 'supervisor'] as $role) {
            $user = User::factory()->create();
            $user->assignRole($role);

            $this->actingAs($user)
                ->getJson('/api/system/status')
                ->assertForbidden();
        }
    }

    private function admin(): User
    {
        $admin = User::factory()->create();
        $admin->assignRole('admin');

        return $admin;
    }
}
