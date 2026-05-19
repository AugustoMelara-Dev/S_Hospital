<?php

namespace Tests\Feature;

use App\Models\BackupLog;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\File;
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
            ->assertJsonPath('data.backups.queue.jobs_table_available', true)
            ->assertJsonPath('data.backups.queue.worker_command', 'php artisan queue:work --queue=backups --tries=1 --timeout=600')
            ->assertJsonPath('data.runtime.logs_writable', true)
            ->assertJsonPath('data.runtime.cache_writable', true)
            ->assertJsonPath('data.preflight.public_routes.0.path', '/up')
            ->assertJsonPath('data.preflight.public_routes.1.path', '/login')
            ->assertJsonPath('data.preflight.public_routes.2.path', '/verify-email')
            ->assertJsonPath('data.preflight.physical_proofs.0.required_file', 'qa/LAN_CLIENT_VALIDATION_PROOF.md')
            ->assertJsonPath('data.preflight.physical_proofs.0.status', 'pending')
            ->assertJsonPath('data.preflight.physical_proofs.0.detail', 'Archivo de evidencia no existe todavia.')
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

    public function test_status_reflects_completed_physical_proof_files_without_declaring_production_ready(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $proofRoot = storage_path('framework/testing-production-proofs');

        File::deleteDirectory($proofRoot);
        File::ensureDirectoryExists($proofRoot.'/qa');
        Config::set('hospital.project_root', $proofRoot);

        File::put($proofRoot.'/qa/LAN_CLIENT_VALIDATION_PROOF.md', $this->completedLanProof());
        File::put($proofRoot.'/qa/THERMAL_PRINTER_PROOF.md', $this->completedThermalProof());

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

    public function test_status_marks_template_physical_proof_files_as_partial(): void
    {
        $this->seed(RolesAndPermissionsSeeder::class);
        $proofRoot = storage_path('framework/testing-production-proofs-partial');

        File::deleteDirectory($proofRoot);
        File::ensureDirectoryExists($proofRoot.'/qa');
        Config::set('hospital.project_root', $proofRoot);

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

        return $admin;
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
- [x] `/assets/*.js` loads as JavaScript. Result/evidence: asset principal con content-type JavaScript.
- [x] Login completes without 419 or session-expired state. Result/evidence: dashboard abre con usuario de caja.
- [x] Cashbox opens. Result/evidence: caja abierta con monto inicial registrado.
- [x] Invoice is created with patient name. Result/evidence: factura generada para Paciente LAN.
- [x] Payment is registered. Result/evidence: pago en efectivo aparece en recibo.
- [x] Receipt preview opens. Result/evidence: vista de recibo 80mm visible.
- [x] Invoice history and reprint work. Result/evidence: historial muestra factura y reimpresion abre recibo historico.
- [x] Reports load. Result/evidence: reporte diario carga metricas.
- [x] Backup request from UI changes from `pending` to `success`. Result/evidence: backup manual completo con checksum visible.

## Evidence

- Screenshot/photo/log reference per step: qa/evidence/lan-client-2026-05-19/*.png
- Notes: Validacion hecha desde equipo cliente distinto al servidor.
MARKDOWN;
    }

    private function completedThermalProof(): string
    {
        return <<<'MARKDOWN'
# Thermal printer proof

## Environment

- Date/time: 2026-05-19 14:35
- Responsible person: Operador de caja
- Printer brand/model: Epson TM-T20III
- Printer driver: Windows Epson thermal driver
- Connection type: USB compartida en caja
- Browser/version: Chrome 125
- Cashier computer: CAJA-01
- Invoice used: FAC-000123
- Evidence/photo reference: qa/evidence/printer-2026-05-19
- Final conclusion: Impresion fisica aprobada para recibos 80mm y 58mm con reimpresion historica.

## 80mm physical print result

- 80mm result: Legible a escala 100 por ciento, sin salir como carta.
- 80mm evidence/reference: foto 80mm-01.jpg y muestra firmada.
- 80mm observations: Totales, paciente, cajero y CAI visibles.

## 58mm physical print result

- 58mm result: Legible a escala 100 por ciento, sin cortar totales.
- 58mm evidence/reference: foto 58mm-01.jpg y muestra firmada.
- 58mm observations: Nombre de paciente largo ajusta correctamente.

## Reprint and browser print settings

- Reprint result: Reimpresion desde historial conserva snapshots.
- Margins result: Margenes minimos configurados.
- Browser headers/footers result: Encabezados y pies del navegador desactivados.
- Problems found: none found during physical validation.

## Required checks

- [x] 80mm receipt prints at 100 percent scale. Result/evidence: muestra fisica 80mm-01.
- [x] 80mm receipt does not print as letter-size page. Result/evidence: ancho coincide con rollo termico.
- [x] 80mm receipt includes hospital name, RTN/CAI when configured, invoice number, patient, cashier, services and totals. Result/evidence: campos visibles en foto 80mm-02.
- [x] 58mm receipt prints at 100 percent scale. Result/evidence: muestra fisica 58mm-01.
- [x] 58mm receipt does not cut totals or patient name. Result/evidence: totales y paciente completos.
- [x] Reprint from invoice history prints with historical snapshots. Result/evidence: muestra reprint-01.
- [x] Margins are minimal and no browser headers/footers appear. Result/evidence: revision visual de muestra impresa.

## Evidence

- Photo path, printed-sample reference, or signed local note: qa/evidence/printer-2026-05-19/*.jpg
- Notes: Validacion ejecutada con impresora fisica de caja.
MARKDOWN;
    }
}
