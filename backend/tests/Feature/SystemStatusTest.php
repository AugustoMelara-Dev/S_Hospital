<?php

namespace Tests\Feature;

use App\Jobs\RunBackupJob;
use App\Models\BackupLog;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class SystemStatusTest extends TestCase
{
    use RefreshDatabase;

    public function test_setup_status_handles_fresh_database_without_seeded_roles(): void
    {
        $this->getJson('/api/system/setup-status')
            ->assertOk()
            ->assertJsonPath('needs_setup', true)
            ->assertJsonPath('steps.admin_exists', false)
            ->assertJsonPath('steps.fiscal_settings', false)
            ->assertJsonPath('steps.catalog_has_services', false)
            ->assertJsonPath('steps.fiscal_sequence_exists', false);
    }

    public function test_admin_can_view_operational_status_without_secret_values(): void
    {
        $proofRoot = storage_path('framework/testing-production-proofs-empty');
        File::deleteDirectory($proofRoot);
        File::ensureDirectoryExists($proofRoot.'/qa');
        File::ensureDirectoryExists($proofRoot.'/frontend/dist/assets');
        File::put($proofRoot.'/frontend/dist/index.html', '<div id="root"></div>');
        File::put($proofRoot.'/frontend/dist/assets/index-test.js', 'console.log("ok");');
        Config::set('hospital.project_root', $proofRoot);
        Config::set('app.url', 'http://soporte:supersecret@192.168.1.10:8000');

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
        BackupLog::query()->create([
            'filename' => 'hospital-backup-failed.sql',
            'path' => 'backups/hospital-backup-failed.sql',
            'disk' => 'local',
            'status' => BackupLog::STATUS_FAILED,
            'type' => BackupLog::TYPE_MANUAL,
            'created_by' => $admin->id,
            'error_message' => 'SQLSTATE[HY000] DB_PASSWORD=supersecret failed at C:\Projects\S_Hospital\backend\.env',
            'completed_at' => now(),
        ]);

        $response = $this->actingAs($admin)
            ->getJson('/api/system/status')
            ->assertOk()
            ->assertJsonPath('data.readiness.state', 'PRODUCTION_CANDIDATE')
            ->assertJsonPath('data.readiness.production_ready', false)
            ->assertJsonPath('data.backups.pending_count', 1)
            ->assertJsonPath('data.backups.failed_count', 1)
            ->assertJsonPath('data.backups.worker_recently_active', false)
            ->assertJsonPath('data.backups.stale_pending_count', 0)
            ->assertJsonPath('data.backups.stale_pending_threshold_minutes', 15)
            ->assertJsonPath('data.backups.last_success_filename', 'hospital-backup-ok.sql')
            ->assertJsonPath('data.backups.last_failure_message', 'Error tecnico registrado. Revise el paquete de soporte.')
            ->assertJsonPath('data.backups.queue.jobs_table_available', true)
            ->assertJsonPath('data.backups.queue.worker_command', 'php artisan queue:work --queue=backups --tries=1 --timeout=600')
            ->assertJsonPath('data.runtime.logs_writable', true)
            ->assertJsonPath('data.runtime.cache_writable', true)
            ->assertJsonPath('data.runtime.pending_migration_count', 0)
            ->assertJsonPath('data.runtime.pending_migrations', [])
            ->assertJsonPath('data.frontend.dist_index_exists', true)
            ->assertJsonPath('data.frontend.assets_present', true)
            ->assertJsonPath('data.frontend.entry_label', 'frontend/dist/index.html')
            ->assertJsonPath('data.network.host_type', 'lan')
            ->assertJsonPath('data.network.lan_ready', true)
            ->assertJsonPath('data.network.client_url', 'http://192.168.1.10:8000')
            ->assertJsonPath('data.database.connected', true)
            ->assertJsonPath('data.environment.app_url', 'http://192.168.1.10:8000')
            ->assertJsonPath('data.environment.app_version', 'local')
            ->assertJsonPath('data.preflight.public_routes.0.path', '/up')
            ->assertJsonPath('data.preflight.public_routes.1.path', '/login')
            ->assertJsonPath('data.preflight.public_routes.2.path', '/verify-email')
            ->assertJsonPath('data.preflight.physical_proofs.0.required_file', 'qa/LAN_CLIENT_VALIDATION_PROOF.md')
            ->assertJsonPath('data.preflight.physical_proofs.0.status', 'pending')
            ->assertJsonPath('data.preflight.physical_proofs.0.detail', 'Archivo de evidencia no existe todavia.')
            ->assertJsonPath('data.preflight.commands.backup_worker', 'php artisan queue:work --queue=backups --tries=1 --timeout=600')
            ->assertJsonMissingPath('data.database.password');

        $this->assertStringNotContainsString('password', json_encode($response->json(), JSON_THROW_ON_ERROR));
        $this->assertStringNotContainsString('supersecret', json_encode($response->json(), JSON_THROW_ON_ERROR));
        $this->assertStringNotContainsString('soporte:supersecret', json_encode($response->json(), JSON_THROW_ON_ERROR));
        $this->assertStringNotContainsString('SQLSTATE', json_encode($response->json(), JSON_THROW_ON_ERROR));
        $this->assertStringNotContainsString($proofRoot, json_encode($response->json(), JSON_THROW_ON_ERROR));
        $this->assertIsString($response->json('data.backups.oldest_pending_at'));
    }

    public function test_loopback_app_url_is_treated_as_local_single_machine_mode(): void
    {
        $proofRoot = storage_path('framework/testing-local-mode-status');
        File::deleteDirectory($proofRoot);
        File::ensureDirectoryExists($proofRoot.'/frontend/dist/assets');
        File::put($proofRoot.'/frontend/dist/index.html', '<div id="root"></div>');
        File::put($proofRoot.'/frontend/dist/assets/index-test.js', 'console.log("ok");');
        Config::set('hospital.project_root', $proofRoot);
        Config::set('app.url', 'http://127.0.0.1:8081');

        $this->seed(RolesAndPermissionsSeeder::class);

        $response = $this->actingAs($this->admin())
            ->getJson('/api/system/status')
            ->assertOk()
            ->assertJsonPath('data.network.host_type', 'loopback')
            ->assertJsonPath('data.network.lan_ready', false)
            ->assertJsonPath('data.network.client_url', 'http://127.0.0.1:8081')
            ->assertJsonPath('data.network.guidance', 'Operacion local en este equipo. Use esta direccion solo en la computadora servidor.')
            ->assertJsonPath('data.preflight.public_routes.1.expected', 'Pantalla de ingreso abre en este equipo')
            ->assertJsonPath('data.preflight.public_routes.2.expected', 'Pantalla esperada abre localmente');

        $blockers = collect($response->json('data.readiness.blockers'));
        $checks = collect($response->json('data.preflight.production_checks'));

        $this->assertNull($blockers->firstWhere('code', 'PENDING_LAN_CLIENT_VALIDATION'));
        $this->assertSame('validated', $blockers->firstWhere('code', 'LOCAL_ACCESS_CONFIGURED')['status'] ?? null);
        $this->assertNull($checks->firstWhere('code', 'LAN_APP_URL_CONFIGURED'));
        $this->assertSame('validated', $checks->firstWhere('code', 'LOCAL_APP_URL_CONFIGURED')['status'] ?? null);
    }

    public function test_status_flags_stale_pending_backups_for_worker_diagnosis(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $admin = $this->admin();

        $backup = BackupLog::query()->create([
            'filename' => 'hospital-backup-stale.sql',
            'path' => 'backups/hospital-backup-stale.sql',
            'disk' => 'local',
            'status' => BackupLog::STATUS_PENDING,
            'type' => BackupLog::TYPE_MANUAL,
            'created_by' => $admin->id,
        ]);
        $backup->forceFill([
            'created_at' => now()->subMinutes(20),
            'updated_at' => now()->subMinutes(20),
        ])->save();

        $response = $this->actingAs($admin)
            ->getJson('/api/system/status')
            ->assertOk()
            ->assertJsonPath('data.backups.pending_count', 1)
            ->assertJsonPath('data.backups.stale_pending_count', 1)
            ->assertJsonPath('data.backups.stale_pending_threshold_minutes', 15);

        $this->assertIsString($response->json('data.backups.oldest_pending_at'));
    }

    public function test_recent_successful_backup_with_clean_queue_marks_worker_active(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        Config::set('queue.default', 'database');
        Cache::put('hospital:scheduler:last_tick', now()->subSeconds(30)->toIso8601String(), 60);
        Cache::put('hospital:scheduler:last_result', 'ok', 60);
        $admin = $this->admin();
        $path = 'backups/hospital-backup-recent.sql.gz.enc';
        $contents = 'encrypted-backup-payload';

        Storage::disk('local')->put($path, $contents);

        BackupLog::query()->create([
            'filename' => 'hospital-backup-recent.sql.gz.enc',
            'path' => $path,
            'disk' => 'local',
            'status' => BackupLog::STATUS_SUCCESS,
            'type' => BackupLog::TYPE_MANUAL,
            'created_by' => $admin->id,
            'size_bytes' => strlen($contents),
            'checksum_sha256' => hash('sha256', $contents),
            'completed_at' => now(),
        ]);

        $this->actingAs($admin)
            ->getJson('/api/system/status')
            ->assertOk()
            ->assertJsonPath('data.backups.pending_count', 0)
            ->assertJsonPath('data.backups.queue.failed_jobs_count', 0)
            ->assertJsonPath('data.backups.queue.pending_backup_jobs', 0)
            ->assertJsonPath('data.backups.last_success_file_exists', true)
            ->assertJsonPath('data.backups.last_success_checksum_matches', true)
            ->assertJsonPath('data.backups.worker_recently_active', true)
            ->assertJsonPath('data.preflight.production_checks.8.code', 'BACKUP_WORKER_CONTINUOUS')
            ->assertJsonPath('data.preflight.production_checks.8.status', 'validated');
    }

    public function test_recent_successful_backup_without_physical_file_does_not_validate_worker(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        Config::set('queue.default', 'database');
        Cache::put('hospital:scheduler:last_tick', now()->subSeconds(30)->toIso8601String(), 60);
        Cache::put('hospital:scheduler:last_result', 'ok', 60);
        $admin = $this->admin();

        Storage::disk('local')->delete('backups/hospital-backup-missing.sql.gz.enc');

        BackupLog::query()->create([
            'filename' => 'hospital-backup-missing.sql.gz.enc',
            'path' => 'backups/hospital-backup-missing.sql.gz.enc',
            'disk' => 'local',
            'status' => BackupLog::STATUS_SUCCESS,
            'type' => BackupLog::TYPE_MANUAL,
            'created_by' => $admin->id,
            'size_bytes' => 100,
            'checksum_sha256' => str_repeat('c', 64),
            'completed_at' => now(),
        ]);

        $this->actingAs($admin)
            ->getJson('/api/system/status')
            ->assertOk()
            ->assertJsonPath('data.backups.last_success_file_exists', false)
            ->assertJsonPath('data.backups.worker_recently_active', false)
            ->assertJsonPath('data.preflight.production_checks.8.code', 'BACKUP_WORKER_CONTINUOUS')
            ->assertJsonPath('data.preflight.production_checks.8.status', 'manual_required');
    }

    public function test_database_queue_retry_after_exceeds_backup_worker_timeout(): void
    {
        $job = new RunBackupJob(1);

        $this->assertGreaterThanOrEqual(
            $job->timeout + 60,
            (int) config('queue.connections.database.retry_after'),
        );
    }

    public function test_status_flags_pending_database_migrations(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $admin = $this->admin();

        DB::table('migrations')
            ->where('migration', '2026_06_01_000001_add_amount_cents_to_payments_table')
            ->delete();

        $response = $this->actingAs($admin)
            ->getJson('/api/system/status')
            ->assertOk()
            ->assertJsonPath('data.runtime.pending_migration_count', 1)
            ->assertJsonPath('data.runtime.pending_migrations.0', '2026_06_01_000001_add_amount_cents_to_payments_table');

        $blockers = collect($response->json('data.readiness.blockers'));
        $checks = collect($response->json('data.preflight.production_checks'));

        $this->assertSame(
            'pending',
            $blockers->firstWhere('code', 'PENDING_DATABASE_MIGRATIONS')['status'] ?? null,
        );
        $this->assertSame(
            'pending',
            $checks->firstWhere('code', 'DATABASE_MIGRATIONS_CURRENT')['status'] ?? null,
        );
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

    public function test_status_reflects_completed_physical_proof_files_without_declaring_production_ready(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $proofRoot = storage_path('framework/testing-production-proofs');

        File::deleteDirectory($proofRoot);
        File::ensureDirectoryExists($proofRoot.'/qa');
        File::ensureDirectoryExists($proofRoot.'/qa/evidence/lan-client-2026-05-19');
        File::ensureDirectoryExists($proofRoot.'/qa/evidence/printer-2026-05-19');
        Config::set('hospital.project_root', $proofRoot);

        File::put($proofRoot.'/qa/LAN_CLIENT_VALIDATION_PROOF.md', $this->completedLanProof());
        File::put($proofRoot.'/qa/INSTITUTIONAL_RECEIPT_PRINT_PROOF.md', $this->completedReceiptPrintProof());

        $this->actingAs($this->admin())
            ->getJson('/api/system/status')
            ->assertOk()
            ->assertJsonPath('data.readiness.production_ready', false)
            ->assertJsonPath('data.readiness.blockers.0.status', 'validated')
            ->assertJsonPath('data.readiness.blockers.1.status', 'validated')
            ->assertJsonPath('data.preflight.physical_proofs.0.status', 'validated')
            ->assertJsonPath('data.preflight.physical_proofs.0.detail', 'Evidencia completada; el preflight final debe confirmarla sin bypass.')
            ->assertJsonPath('data.preflight.physical_proofs.1.status', 'validated');
    }

    public function test_status_accepts_primary_receipt_print_proof_without_thermal_ticket_evidence(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $proofRoot = storage_path('framework/testing-production-proofs-primary-receipt');

        File::deleteDirectory($proofRoot);
        File::ensureDirectoryExists($proofRoot.'/qa');
        File::ensureDirectoryExists($proofRoot.'/qa/evidence/printer-primary-2026-05-19');
        Config::set('hospital.project_root', $proofRoot);
        $this->beforeApplicationDestroyed(fn () => File::deleteDirectory($proofRoot));

        File::put($proofRoot.'/qa/INSTITUTIONAL_RECEIPT_PRINT_PROOF.md', $this->primaryReceiptPrintProof());

        $response = $this->actingAs($this->admin())
            ->getJson('/api/system/status')
            ->assertOk()
            ->assertJsonPath('data.readiness.blockers.1.label', 'Impresora institucional fisica media carta/carta/A5')
            ->assertJsonPath('data.readiness.blockers.1.status', 'validated')
            ->assertJsonPath('data.preflight.physical_proofs.1.label', 'Impresora institucional media carta/carta/A5')
            ->assertJsonPath('data.preflight.physical_proofs.1.status', 'validated');

        $encoded = json_encode($response->json(), JSON_THROW_ON_ERROR);
        $this->assertStringNotContainsString('80mm', $encoded);
        $this->assertStringNotContainsString('58mm', $encoded);
    }

    public function test_status_rejects_completed_physical_proof_when_local_evidence_reference_is_missing(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $proofRoot = storage_path('framework/testing-production-proofs-missing-evidence');

        File::deleteDirectory($proofRoot);
        File::ensureDirectoryExists($proofRoot.'/qa');
        Config::set('hospital.project_root', $proofRoot);

        File::put($proofRoot.'/qa/INSTITUTIONAL_RECEIPT_PRINT_PROOF.md', $this->completedReceiptPrintProof());

        $this->actingAs($this->admin())
            ->getJson('/api/system/status')
            ->assertOk()
            ->assertJsonPath('data.preflight.physical_proofs.1.status', 'partial')
            ->assertJsonPath('data.preflight.physical_proofs.1.detail', 'La evidencia local referenciada no existe: qa/evidence/printer-2026-05-19');
    }

    public function test_status_accepts_lan_proof_without_realtime_websocket_evidence(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $proofRoot = storage_path('framework/testing-production-proofs-lan-basic');

        File::deleteDirectory($proofRoot);
        File::ensureDirectoryExists($proofRoot.'/qa');
        File::ensureDirectoryExists($proofRoot.'/qa/evidence/lan-client-2026-05-19');
        Config::set('hospital.project_root', $proofRoot);
        $this->beforeApplicationDestroyed(fn () => File::deleteDirectory($proofRoot));

        $proofWithoutWebSocket = str_replace(
            [
                "- [x] `/api/system/echo-config` exposes LAN realtime config. Result/evidence: driver pusher host 192.168.1.7 port 6001.\n",
                "- [x] WebSocket/Soketi TCP port is reachable from the client computer. Result/evidence: TCP connect OK to 192.168.1.7:6001.\n",
            ],
            '',
            $this->completedLanProof(),
        );
        File::put($proofRoot.'/qa/LAN_CLIENT_VALIDATION_PROOF.md', $proofWithoutWebSocket);

        $response = $this->actingAs($this->admin())
            ->getJson('/api/system/status')
            ->assertOk()
            ->assertJsonPath('data.preflight.physical_proofs.0.status', 'validated')
            ->assertJsonPath('data.preflight.physical_proofs.0.detail', 'Evidencia completada; el preflight final debe confirmarla sin bypass.');

        $encoded = json_encode($response->json(), JSON_THROW_ON_ERROR);
        $this->assertStringNotContainsString('/api/system/echo-config', $encoded);
        $this->assertStringNotContainsString('WebSocket', $encoded);
        $this->assertStringNotContainsString('Soketi', $encoded);
    }

    public function test_status_marks_template_physical_proof_files_as_partial(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $proofRoot = storage_path('framework/testing-production-proofs-partial');

        File::deleteDirectory($proofRoot);
        File::ensureDirectoryExists($proofRoot.'/qa');
        Config::set('hospital.project_root', $proofRoot);
        Config::set('app.url', 'http://192.168.1.10:8000');

        File::put($proofRoot.'/qa/LAN_CLIENT_VALIDATION_PROOF.md', "# LAN proof\n\n- Date/time:\n- Responsible person:\n\n- [ ] `/up` responds from the client computer. Result/evidence:\n");

        $this->actingAs($this->admin())
            ->getJson('/api/system/status')
            ->assertOk()
            ->assertJsonPath('data.readiness.blockers.0.status', 'pending')
            ->assertJsonPath('data.preflight.physical_proofs.0.status', 'partial')
            ->assertJsonPath('data.preflight.physical_proofs.0.detail', 'Archivo demasiado corto para evidencia real.');
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

    public function test_normal_user_can_view_sanitized_operational_status_summary(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $proofRoot = storage_path('framework/testing-public-status-summary');

        File::deleteDirectory($proofRoot);
        File::ensureDirectoryExists($proofRoot.'/qa');
        File::ensureDirectoryExists($proofRoot.'/frontend/dist');
        File::put($proofRoot.'/frontend/dist/index.html', '<div id="root"></div>');
        File::put($proofRoot.'/frontend/package.json', '{"version":"0.1.0"}');
        Config::set('hospital.project_root', $proofRoot);
        $this->beforeApplicationDestroyed(fn () => File::deleteDirectory($proofRoot));

        $user = User::factory()->create();
        $user->assignRole('cajero');

        $response = $this->actingAs($user)
            ->getJson('/api/system/status-summary')
            ->assertOk()
            ->assertJsonPath('data.summary.label', 'Requiere revision')
            ->assertJsonPath('data.checks.0.code', 'BACKEND_ACTIVE')
            ->assertJsonPath('data.checks.0.status', 'validated')
            ->assertJsonPath('data.checks.1.code', 'DATABASE_CONNECTED')
            ->assertJsonPath('data.checks.2.code', 'FRONTEND_AVAILABLE')
            ->assertJsonPath('data.checks.2.status', 'validated')
            ->assertJsonPath('data.checks.7.code', 'LAN_ACCESS')
            ->assertJsonPath('data.checks.7.status', 'manual_required')
            ->assertJsonPath('data.checks.8.code', 'INSTALLED_VERSION')
            ->assertJsonMissingPath('data.environment')
            ->assertJsonMissingPath('data.database')
            ->assertJsonMissingPath('data.backups.queue.worker_command')
            ->assertJsonMissingPath('data.preflight.commands');

        $json = json_encode($response->json(), JSON_THROW_ON_ERROR);

        foreach (['app_url', 'app_debug', 'php_version', 'worker_command', 'scheduler_command', 'APP_KEY', 'DB_PASSWORD', $proofRoot] as $forbidden) {
            $this->assertStringNotContainsString($forbidden, $json);
        }
    }

    public function test_backups_permission_alone_cannot_view_operational_status(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $user = User::factory()->create();
        $user->givePermissionTo('backups.view');

        $this->actingAs($user)
            ->getJson('/api/system/status')
            ->assertForbidden();
    }

    private function admin(): User
    {
        $admin = User::factory()->create();
        $admin->assignRole('admin');

        return $admin->refresh();
    }

    private function completedLanProof(): string
    {
        return <<<'MARKDOWN'
# LAN client validation proof

## Environment

- Date/time: 2026-05-19 14:10
- Responsible person: Operador de caja
- Client computer name: CAJA-02
- Server IP or LAN name: 192.168.1.7
- Server LAN URL: http://192.168.1.7:8000
- Client browser/version: Chrome 125
- User/role used: cajero.validacion
- Evidence/capture reference: qa/evidence/lan-client-2026-05-19
- Final conclusion: Segunda PC validada por IP LAN con sesion estable y flujo operativo completo.

## Required checks

- [x] `/up` responds from the client computer. Result/evidence: HTTP 200 registrado en captura 01.
- [x] `/login` loads from the client computer using the server IP or LAN name. Result/evidence: pantalla de login visible en captura 02.
- [x] `/verify-email` loads the expected SPA route or documented response. Result/evidence: ruta SPA responde sin error 500.
- [x] `/api/system/echo-config` exposes LAN realtime config. Result/evidence: driver pusher host 192.168.1.7 port 6001.
- [x] `/assets/*.js` loads as JavaScript. Result/evidence: asset principal con content-type JavaScript.
- [x] WebSocket/Soketi TCP port is reachable from the client computer. Result/evidence: TCP connect OK to 192.168.1.7:6001.
- [x] Login completes without 419 or session-expired state. Result/evidence: dashboard abre con usuario de caja.
- [x] Cashbox opens. Result/evidence: caja abierta con monto inicial registrado.
- [x] Invoice is created with patient name. Result/evidence: factura generada para Paciente LAN.
- [x] Payment is registered. Result/evidence: pago en efectivo aparece en recibo.
- [x] Receipt preview opens. Result/evidence: vista de recibo institucional media carta visible.
- [x] Invoice history and reprint work. Result/evidence: historial muestra factura y reimpresion abre recibo historico.
- [x] Reports load. Result/evidence: reporte diario carga metricas.
- [x] Backup request from UI changes from `pending` to `success`. Result/evidence: backup manual completo con checksum visible.

## Evidence

- Screenshot/photo/log reference per step: qa/evidence/lan-client-2026-05-19/*.png
- Notes: Validacion hecha desde equipo cliente distinto al servidor.
MARKDOWN;
    }

    private function completedReceiptPrintProof(): string
    {
        return <<<'MARKDOWN'
# Institutional printer proof

## Environment

- Date/time: 2026-05-19 14:35
- Responsible person: Operador de caja
- Printer brand/model: Impresora laser institucional
- Printer driver: Windows printer driver
- Connection type: USB compartida en caja
- Browser/version: Chrome 125
- Cashier computer: CAJA-01
- Invoice used: FAC-000123
- Evidence/photo reference: qa/evidence/printer-2026-05-19
- Final conclusion: Impresion fisica aprobada para recibos media carta, carta, A5, 80mm y 58mm con reimpresion historica.

## Media carta physical print result

- Media carta result: Legible a escala 100 por ciento, sin cortar totales.
- Media carta evidence/reference: foto-media-carta-01.jpg y muestra firmada.
- Media carta observations: Totales, paciente, cajero y CAI visibles.

## Media carta, carta and A5 physical print result

- Carta result: Legible a escala 100 por ciento.
- Carta evidence/reference: foto-carta-01.jpg y muestra firmada.
- Carta observations: Nombre de paciente largo ajusta correctamente.
- A5 result: Legible a escala 100 por ciento.
- A5 evidence/reference: foto-a5-01.jpg y muestra firmada.
- A5 observations: Conceptos y sello visibles.
- 80mm result: Legible a escala 100 por ciento.
- 80mm evidence/reference: foto-80mm-01.jpg y muestra firmada.
- 80mm observations: Totales y paciente visibles.
- 58mm result: Legible a escala 100 por ciento.
- 58mm evidence/reference: foto-58mm-01.jpg y muestra firmada.
- 58mm observations: Conceptos y sello visibles.

## Reprint and browser print settings

- Reprint result: Reimpresion desde historial conserva snapshots.
- Margins result: Margenes minimos configurados.
- Browser headers/footers result: Encabezados y pies del navegador desactivados.
- Problems found: none found during physical validation.

## Required checks

- [x] Media carta receipt prints at 100 percent scale. Result/evidence: muestra fisica media-carta-01.
- [x] Carta receipt prints at 100 percent scale. Result/evidence: muestra fisica carta-01.
- [x] A5 receipt prints at 100 percent scale. Result/evidence: muestra fisica a5-01.
- [x] 80mm receipt prints at 100 percent scale. Result/evidence: muestra fisica 80mm-01.
- [x] 58mm receipt prints at 100 percent scale. Result/evidence: muestra fisica 58mm-01.
- [x] Institutional receipt includes hospital name, RTN/CAI when configured, invoice number, patient, cashier, services and totals. Result/evidence: campos visibles en foto institucional-02.
- [x] Institutional receipt has white background and no QR, barcode, internal codes or technical fields. Result/evidence: muestra sin codigos internos ni fondo oscuro.
- [x] Reprint from invoice history prints with historical snapshots. Result/evidence: muestra reprint-01.
- [x] Margins are minimal and no browser headers/footers appear. Result/evidence: revision visual de muestra impresa.

## Evidence

- Photo path, printed-sample reference, or signed local note: qa/evidence/printer-2026-05-19/*.jpg
- Notes: Validacion ejecutada con impresora fisica de caja.
MARKDOWN;
    }

    private function primaryReceiptPrintProof(): string
    {
        return <<<'MARKDOWN'
# Institutional printer proof

## Environment

- Date/time: 2026-05-19 14:35
- Responsible person: Operador de caja
- Printer brand/model: Impresora laser institucional
- Printer driver: Windows printer driver
- Connection type: USB compartida en caja
- Browser/version: Chrome 125
- Cashier computer: CAJA-01
- Invoice used: FAC-000123
- Evidence/photo reference: qa/evidence/printer-primary-2026-05-19
- Final conclusion: Impresion fisica aprobada para recibos media carta, carta y A5 con reimpresion historica.

## Media carta, carta and A5 physical print result

- Media carta result: Legible a escala 100 por ciento, sin cortar totales.
- Media carta evidence/reference: foto-media-carta-01.jpg y muestra firmada.
- Media carta observations: Totales, paciente, cajero y CAI visibles.
- Carta result: Legible a escala 100 por ciento.
- Carta evidence/reference: foto-carta-01.jpg y muestra firmada.
- Carta observations: Nombre de paciente largo ajusta correctamente.
- A5 result: Legible a escala 100 por ciento.
- A5 evidence/reference: foto-a5-01.jpg y muestra firmada.
- A5 observations: Conceptos y sello visibles.

## Reprint and browser print settings

- Reprint result: Reimpresion desde historial conserva snapshots.
- Margins result: Margenes minimos configurados.
- Browser headers/footers result: Encabezados y pies del navegador desactivados.
- Problems found: none found during physical validation.

## Required checks

- [x] Media carta receipt prints at 100 percent scale. Result/evidence: muestra fisica media-carta-01.
- [x] Carta receipt prints at 100 percent scale. Result/evidence: muestra fisica carta-01.
- [x] A5 receipt prints at 100 percent scale. Result/evidence: muestra fisica a5-01.
- [x] Institutional receipt includes hospital name, RTN/CAI when configured, invoice number, patient, cashier, services and totals. Result/evidence: campos visibles en foto institucional-02.
- [x] Institutional receipt has white background and no QR, barcode, internal codes or technical fields. Result/evidence: muestra sin codigos internos ni fondo oscuro.
- [x] Reprint from invoice history prints with historical snapshots. Result/evidence: muestra reprint-01.
- [x] Margins are minimal and no browser headers/footers appear. Result/evidence: revision visual de muestra impresa.

## Evidence

- Photo path, printed-sample reference, or signed local note: qa/evidence/printer-primary-2026-05-19/*.jpg
- Notes: Validacion ejecutada con impresora fisica de caja.
MARKDOWN;
    }

    public function test_scheduler_heartbeat_is_reported_as_never_run_when_no_tick_recorded(): void
    {
        Cache::forget('hospital:scheduler:last_tick');
        Cache::forget('hospital:scheduler:last_result');
        Cache::forget('hospital:scheduler:last_message');
        $this->seed(RolesAndPermissionsSeeder::class);
        $admin = $this->admin();

        $this->actingAs($admin)
            ->getJson('/api/system/status')
            ->assertOk()
            ->assertJsonPath('data.backups.queue.scheduler_heartbeat.status', 'never_run')
            ->assertJsonPath('data.backups.queue.scheduler_heartbeat.ticks_last_24h', 0);
    }

    public function test_scheduler_heartbeat_is_ok_when_recent_tick_recorded(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $admin = $this->admin();

        Cache::put('hospital:scheduler:last_tick', now()->subSeconds(30)->toIso8601String(), 60);
        Cache::put('hospital:scheduler:last_result', 'ok', 60);

        $this->actingAs($admin)
            ->getJson('/api/system/status')
            ->assertOk()
            ->assertJsonPath('data.backups.queue.scheduler_heartbeat.status', 'ok')
            ->assertJsonPath('data.backups.queue.scheduler_heartbeat.last_result', 'ok');
    }

    public function test_scheduler_heartbeat_flags_stale_ticks(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $admin = $this->admin();

        // 5 minutes ago => 'stale' (between 180s and 600s).
        Cache::put('hospital:scheduler:last_tick', now()->subMinutes(5)->toIso8601String(), 600);

        $this->actingAs($admin)
            ->getJson('/api/system/status')
            ->assertOk()
            ->assertJsonPath('data.backups.queue.scheduler_heartbeat.status', 'stale');
    }

    public function test_scheduler_heartbeat_flags_stuck_ticks(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $admin = $this->admin();

        // 20 minutes ago => 'stuck' (> 600s).
        Cache::put('hospital:scheduler:last_tick', now()->subMinutes(20)->toIso8601String(), 1500);

        $this->actingAs($admin)
            ->getJson('/api/system/status')
            ->assertOk()
            ->assertJsonPath('data.backups.queue.scheduler_heartbeat.status', 'stuck');
    }

    public function test_scheduler_tick_command_records_heartbeat_in_cache_and_db(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        Cache::forget('hospital:scheduler:last_tick');

        $this->artisan('hospital:scheduler-tick', ['--result' => 'ok'])
            ->assertSuccessful();

        $this->assertNotNull(Cache::get('hospital:scheduler:last_tick'));
        $this->assertSame('ok', Cache::get('hospital:scheduler:last_result'));
        $this->assertDatabaseHas('scheduler_ticks', ['result' => 'ok']);
    }
}
