<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Actions\Backups\CreateBackupAction;
use App\Actions\Backups\LastRecoverableBackupAction;
use App\Actions\Backups\VerifyBackupAction;
use App\Models\BackupLog;
use App\Models\CashRegisterSession;
use App\Models\FiscalSequence;
use App\Models\FiscalSetting;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\Service;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Database\Seeders\ServiceCatalogSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * M-W1-BK-01 / HS-BK-RPO: separar el RPO planificado (calculado desde el
 * scheduler real) del RPO/RTO observados, y medir una recuperacion real con
 * datos sinteticos en lugar de copiar cifras historicas.
 *
 * - RPO de creacion: se deriva de backend/config/hospital.php y de la forma del
 *   schedule en backend/routes/console.php (respaldo diario + cada 15 min en la
 *   ventana operativa). Una sola derivacion (`plannedRpoDerivation()`) alimenta
 *   tanto las aserciones como el payload `M-W1-BK-01-METRICS`: no hay literales.
 * - RPO de recuperabilidad verificada: `hospital:verify-backup --latest` es
 *   diario, por lo que la ultima copia *verificada* puede llegar a ~24 h aunque
 *   la creacion sea reciente. Se deriva del schedule y se vigila con la alerta
 *   `recovery_stale` (ver BackupHealthCheckTest).
 * - RPO observado: la edad de la ultima copia recuperable verificada, que ya
 *   expone LastRecoverableBackupAction; en operacion real es el valor a vigilar.
 * - RTO observado: se cronometra un ciclo completo respaldo -> verificacion ->
 *   descifrado -> importacion del dump en una base limpia con datos sinteticos.
 *   Es una medicion de laboratorio (SQLite en memoria): NO se extrapola a
 *   produccion ni sustituye una prueba en el servidor final.
 *
 * La linea `M-W1-BK-01-METRICS` impresa por el test es la evidencia cruda de
 * los tiempos y de los RPO derivados.
 *
 * Limite declarado (H-04): la derivacion lee config + expresiones del archivo
 * `routes/console.php`; no inspecciona los eventos de `Illuminate\Schedule`. Si
 * una expresion deja de poder derivarse (p. ej. la cadencia o el `dailyAt` de
 * verificacion cambian de forma), la derivacion falla en vez de asumir un valor.
 */
class BackupRecoveryMetricsTest extends TestCase
{
    use RefreshDatabase;

    public function test_planned_rpo_is_derived_from_the_real_schedule_not_hardcoded(): void
    {
        $derivation = $this->plannedRpoDerivation();

        $this->assertSame(15, $derivation['operational_cadence_minutes'], 'Cadencia operativa derivada de everyFifteenMinutes().');
        $this->assertSame(240, $derivation['daily_to_operation_start_minutes'], 'Hueco 02:00 -> 06:00.');
        $this->assertSame(480, $derivation['overnight_gap_minutes'], 'Hueco nocturno 18:00 -> 02:00.');

        // RPO de creacion observado en este arbol: 8 h (480 min) con el
        // scheduler activo. Es el peor caso planificado, no una cifra copiada.
        $this->assertSame(480, $derivation['planned_creation_rpo_minutes']);

        // La verificacion de recuperabilidad corre 1 vez al dia: su RPO
        // estructural es ~24 h, no 8 h (brecha H-02).
        $this->assertSame(1, $derivation['verify_runs_per_day']);
        $this->assertSame(1440, $derivation['recoverable_verification_rpo_minutes']);

        // Ambas rutas bare-metal ejecutan el mismo schedule:run (paridad Docker),
        // por lo que el RPO planificado no depende del runtime.
        $loop = (string) file_get_contents(base_path('../scripts/run_backup_scheduler_loop.ps1'));
        $tasks = (string) file_get_contents(base_path('../scripts/install_backup_tasks_windows.ps1'));
        $this->assertStringContainsString('schedule:run', $loop);
        $this->assertStringContainsString('schedule:run', $tasks);

        // Cada alerta debe dispararse despues de su RPO: un umbral menor
        // generaria ruido en cada ciclo normal.
        $creationStale = (int) config('backups.alerts.stale_after_hours', 12);
        $recoverableStale = (int) config('backups.alerts.recoverable_stale_after_hours', 26);
        $this->assertGreaterThan($derivation['planned_creation_rpo_minutes'] / 60, $creationStale);
        $this->assertGreaterThan($derivation['recoverable_verification_rpo_minutes'] / 60, $recoverableStale);
    }

    /**
     * H-01: el payload emitido como evidencia cruda debe provenir de la
     * derivacion, no de una constante. Con otra ventana operativa el RPO
     * derivado cambia; si alguien reintroduce un literal, esta prueba falla
     * (regresion: falla con el literal 480, pasa con la derivacion).
     */
    public function test_metrics_payload_uses_derived_values_not_constants(): void
    {
        Config::set('hospital.schedule.operation_end', '20:00');

        $derivation = $this->plannedRpoDerivation();
        $this->assertSame(360, $derivation['overnight_gap_minutes'], 'Hueco 20:00 -> 02:00.');
        $this->assertSame(360, $derivation['planned_creation_rpo_minutes']);

        $metrics = $this->buildMetrics($this->sampleTimings());
        $decoded = json_decode($this->metricsJson($metrics), true, 512, JSON_THROW_ON_ERROR);

        // El JSON emitido refleja exactamente la derivacion vigente...
        $this->assertSame($derivation['planned_creation_rpo_minutes'], $decoded['planned_rpo_minutes']);
        $this->assertSame(360, $decoded['planned_rpo_minutes']);
        $this->assertNotSame(480, $decoded['planned_rpo_minutes']);
        $this->assertSame($derivation['operational_cadence_minutes'], $decoded['operational_cadence_minutes']);
        $this->assertSame($derivation['recoverable_verification_rpo_minutes'], $decoded['recoverable_verification_rpo_minutes']);
    }

    public function test_observed_rpo_age_is_computed_from_the_last_verified_backup(): void
    {
        $fresh = $this->successfulBackup(now()->subMinutes(20));
        $fresh->forceFill([
            'verify_status' => VerifyBackupAction::STATUS_VERIFIED,
            'verified_at' => now()->subMinutes(20)->toDateTimeString(),
        ])->save();

        $recoverable = app(LastRecoverableBackupAction::class)->execute();

        $this->assertNotNull($recoverable);
        $this->assertSame($fresh->id, $recoverable['id']);
        // Edad observada ~20 min (1200 s), no una cifra asumida.
        $this->assertGreaterThanOrEqual(1100, $recoverable['age_seconds']);
        $this->assertLessThanOrEqual(1300, $recoverable['age_seconds']);

        // Un respaldo no verificado no cuenta: sin verificacion no hay copia
        // recuperable y la edad observada no debe fingirse.
        $fresh->forceFill([
            'verify_status' => VerifyBackupAction::STATUS_KEY_MISMATCH,
            'verified_at' => null,
        ])->save();

        $this->assertNull(app(LastRecoverableBackupAction::class)->execute());
    }

    public function test_observed_lab_rto_is_measured_for_a_synthetic_recovery(): void
    {
        if (DB::connection()->getDriverName() !== 'sqlite') {
            $this->markTestSkipped('El remonte sintetico usa el SQLite de pruebas; en MariaDB el writer emite mysqldump.');
        }

        $this->seedSyntheticData();
        Storage::fake('local');

        $cycleStartedAt = microtime(true);

        $backup = app(CreateBackupAction::class)->execute(null, BackupLog::TYPE_MANUAL);
        $this->assertSame(BackupLog::STATUS_SUCCESS, $backup->status);
        $backupSeconds = microtime(true) - $cycleStartedAt;

        $verificationStartedAt = microtime(true);
        $verification = app(VerifyBackupAction::class)->execute($backup);
        $verifySeconds = microtime(true) - $verificationStartedAt;
        $this->assertSame(VerifyBackupAction::STATUS_VERIFIED, $verification['status']);

        [$dump, $decryptSeconds] = $this->decryptCurrentBackup($backup);

        $restoreStartedAt = microtime(true);
        $restored = new \PDO('sqlite::memory:');
        $restored->setAttribute(\PDO::ATTR_ERRMODE, \PDO::ERRMODE_EXCEPTION);
        $restored->exec($dump);

        $invoices = (int) $restored->query('select count(*) from invoices')->fetchColumn();
        $payments = (int) $restored->query('select count(*) from payments')->fetchColumn();
        $sessions = (int) $restored->query('select count(*) from cash_register_sessions')->fetchColumn();
        $patient = (string) $restored->query('select patient_name from invoices limit 1')->fetchColumn();
        $restoreSeconds = microtime(true) - $restoreStartedAt;
        $totalSeconds = microtime(true) - $cycleStartedAt;

        // Validacion funcional del roundtrip antes de mirar el cronometro.
        $this->assertSame(1, $invoices);
        $this->assertSame(1, $payments);
        $this->assertSame(1, $sessions);
        $this->assertSame('Paciente RTO Sintetico', $patient);

        // Criterio de aceptacion local: una recuperacion de laboratorio debe
        // completarse en segundos, no en minutos. Se deja holgura para CI lento.
        $this->assertLessThan(120.0, $restoreSeconds);
        $this->assertLessThan(300.0, $totalSeconds);

        $timings = [
            'backup_seconds' => $backupSeconds,
            'verify_seconds' => $verifySeconds,
            'decrypt_seconds' => $decryptSeconds,
            'restore_seconds' => $restoreSeconds,
            'total_seconds' => $totalSeconds,
            'restored' => [
                'invoices' => $invoices,
                'payments' => $payments,
                'cash_register_sessions' => $sessions,
            ],
        ];

        $metrics = $this->buildMetrics($timings);

        // La evidencia cruda emitida usa los RPO derivados (H-01), no literales.
        $this->assertSame(
            $this->plannedRpoDerivation()['planned_creation_rpo_minutes'],
            $metrics['planned_rpo_minutes'],
        );

        fwrite(STDOUT, PHP_EOL.'M-W1-BK-01-METRICS '.$this->metricsJson($metrics).PHP_EOL);
    }

    /**
     * Unica fuente de derivacion del RPO planificado (creacion + verificacion).
     *
     * @return array{
     *     daily_backup_minutes: int,
     *     operation_start_minutes: int,
     *     operation_end_minutes: int,
     *     operational_cadence_minutes: int,
     *     daily_to_operation_start_minutes: int,
     *     overnight_gap_minutes: int,
     *     planned_creation_rpo_minutes: int,
     *     verify_runs_per_day: int,
     *     verify_time_minutes: int,
     *     recoverable_verification_rpo_minutes: int
     * }
     */
    private function plannedRpoDerivation(): array
    {
        $console = (string) file_get_contents(base_path('routes/console.php'));

        // Guard de forma: si el schedule deja de tener esta estructura, la
        // derivacion falla en vez de asumir el valor viejo.
        $this->assertStringContainsString('hospital:backup --type=scheduled', $console);
        $this->assertStringContainsString('->dailyAt(', $console);
        $this->assertStringContainsString('->between(', $console);

        $operationalCadenceMinutes = $this->scheduleCadenceMinutes($console);
        $verify = $this->verifyCadence($console);

        $daily = $this->minutesOfDay((string) config('hospital.schedule.daily_backup_time', '02:00'));
        $operationStart = $this->minutesOfDay((string) config('hospital.schedule.operation_start', '06:00'));
        $operationEnd = $this->minutesOfDay((string) config('hospital.schedule.operation_end', '18:00'));

        $dailyToStart = $this->modularGap($daily, $operationStart);
        $overnight = $this->modularGap($operationEnd, $daily);

        return [
            'daily_backup_minutes' => $daily,
            'operation_start_minutes' => $operationStart,
            'operation_end_minutes' => $operationEnd,
            'operational_cadence_minutes' => $operationalCadenceMinutes,
            'daily_to_operation_start_minutes' => $dailyToStart,
            'overnight_gap_minutes' => $overnight,
            'planned_creation_rpo_minutes' => max($dailyToStart, $operationalCadenceMinutes, $overnight),
            'verify_runs_per_day' => $verify['runs_per_day'],
            'verify_time_minutes' => $verify['time_minutes'],
            'recoverable_verification_rpo_minutes' => $verify['rpo_minutes'],
        ];
    }

    /**
     * Deriva la cadencia operativa de la expresion real del schedule de
     * respaldos (`->everyFifteenMinutes()` y equivalentes).
     */
    private function scheduleCadenceMinutes(string $console): int
    {
        $cadenceByMethod = [
            'everyMinute' => 1,
            'everyTwoMinutes' => 2,
            'everyThreeMinutes' => 3,
            'everyFourMinutes' => 4,
            'everyFiveMinutes' => 5,
            'everyTenMinutes' => 10,
            'everyFifteenMinutes' => 15,
            'everyThirtyMinutes' => 30,
        ];

        $pattern = '/Schedule::command\(\s*\'hospital:backup[^\']*\'[\s\S]{0,300}?->(every[A-Za-z]+Minutes)\(\)/';

        if (preg_match($pattern, $console, $matches) === 1 && isset($cadenceByMethod[$matches[1]])) {
            return $cadenceByMethod[$matches[1]];
        }

        $this->fail('No se pudo derivar la cadencia operativa del schedule real de respaldos en routes/console.php.');
    }

    /**
     * Deriva la cadencia de `hospital:verify-backup --latest` (recuperabilidad).
     *
     * @return array{runs_per_day: int, time_minutes: int, rpo_minutes: int}
     */
    private function verifyCadence(string $console): array
    {
        $pattern = '/Schedule::command\(\s*\'hospital:verify-backup[^\']*\'[\s\S]{0,300}?->dailyAt\(\s*\'([0-2]\d:[0-5]\d)\'\s*\)/';

        if (preg_match($pattern, $console, $matches) !== 1) {
            $this->fail('No se pudo derivar la cadencia de hospital:verify-backup (se esperaba ->dailyAt) en routes/console.php.');
        }

        // `dailyAt` = una corrida diaria; el RPO de recuperabilidad verificada
        // es el tiempo entre verificaciones (una por dia -> 24 h).
        $runsPerDay = 1;

        return [
            'runs_per_day' => $runsPerDay,
            'time_minutes' => $this->minutesOfDay($matches[1]),
            'rpo_minutes' => (int) ceil(1440 / $runsPerDay),
        ];
    }

    /**
     * Construye el payload de evidencia a partir de la derivacion unica.
     *
     * @param  array{
     *     backup_seconds: float,
     *     verify_seconds: float,
     *     decrypt_seconds: float,
     *     restore_seconds: float,
     *     total_seconds: float,
     *     restored: array{invoices: int, payments: int, cash_register_sessions: int}
     * }  $timings
     * @return array<string, mixed>
     */
    private function buildMetrics(array $timings): array
    {
        $derivation = $this->plannedRpoDerivation();

        return [
            'planned_rpo_minutes' => $derivation['planned_creation_rpo_minutes'],
            'operational_cadence_minutes' => $derivation['operational_cadence_minutes'],
            'recoverable_verification_rpo_minutes' => $derivation['recoverable_verification_rpo_minutes'],
            'verify_runs_per_day' => $derivation['verify_runs_per_day'],
            'backup_creation_stale_after_hours' => (int) config('backups.alerts.stale_after_hours', 12),
            'recoverable_stale_after_hours' => (int) config('backups.alerts.recoverable_stale_after_hours', 26),
            'rto_backup_seconds' => round($timings['backup_seconds'], 3),
            'rto_verify_seconds' => round($timings['verify_seconds'], 3),
            'rto_decrypt_seconds' => round($timings['decrypt_seconds'], 3),
            'rto_restore_seconds' => round($timings['restore_seconds'], 3),
            'rto_total_seconds' => round($timings['total_seconds'], 3),
            'restored' => $timings['restored'],
            'driver' => 'sqlite',
            'dataset' => 'synthetic',
        ];
    }

    /**
     * @return array{
     *     backup_seconds: float,
     *     verify_seconds: float,
     *     decrypt_seconds: float,
     *     restore_seconds: float,
     *     total_seconds: float,
     *     restored: array{invoices: int, payments: int, cash_register_sessions: int}
     * }
     */
    private function sampleTimings(): array
    {
        return [
            'backup_seconds' => 0.0,
            'verify_seconds' => 0.0,
            'decrypt_seconds' => 0.0,
            'restore_seconds' => 0.0,
            'total_seconds' => 0.0,
            'restored' => [
                'invoices' => 1,
                'payments' => 1,
                'cash_register_sessions' => 1,
            ],
        ];
    }

    /**
     * @param  array<string, mixed>  $metrics
     */
    private function metricsJson(array $metrics): string
    {
        return json_encode($metrics, JSON_THROW_ON_ERROR);
    }

    /**
     * @return array{0: string, 1: float}
     */
    private function decryptCurrentBackup(BackupLog $backup): array
    {
        $decryptedPath = storage_path('framework/testing/metrics-recovery-'.$backup->id.'.sql');
        @unlink($decryptedPath);

        $startedAt = microtime(true);
        $this->artisan('hospital:decrypt-backup', [
            'input' => Storage::disk('local')->path((string) $backup->path),
            'output' => $decryptedPath,
        ])->assertExitCode(0);
        $seconds = microtime(true) - $startedAt;

        $dump = (string) file_get_contents($decryptedPath);
        @unlink($decryptedPath);

        return [$dump, $seconds];
    }

    private function successfulBackup(\DateTimeInterface $completedAt): BackupLog
    {
        return BackupLog::query()->create([
            'filename' => 'metrics-'.bin2hex(random_bytes(4)).'.sql.gz.enc',
            'path' => 'backups/metrics-'.bin2hex(random_bytes(4)).'.sql.gz.enc',
            'disk' => 'local',
            'size_bytes' => 1024,
            'checksum_sha256' => str_repeat('a', 64),
            'status' => BackupLog::STATUS_SUCCESS,
            'type' => BackupLog::TYPE_SCHEDULED,
            'completed_at' => $completedAt,
        ]);
    }

    private function minutesOfDay(string $time): int
    {
        $this->assertMatchesRegularExpression('/\A([01]\d|2[0-3]):[0-5]\d\z/', $time);

        [$hours, $minutes] = array_map('intval', explode(':', $time));

        return $hours * 60 + $minutes;
    }

    private function modularGap(int $from, int $to): int
    {
        return ($to - $from + 1440) % 1440;
    }

    private function seedSyntheticData(): void
    {
        $this->seed([RolesAndPermissionsSeeder::class, ServiceCatalogSeeder::class]);

        Config::set('backups.encryption.key', 'synthetic-rto-backup-key');

        FiscalSetting::query()->create([
            'receipt_template_mode' => 'thermal',
            'hospital_name' => 'Hospital San Isidro',
            'rtn' => '08011999123456',
            'default_tax_rate' => '15.00',
            'receipt_paper_size' => 'half_letter',
        ]);

        FiscalSequence::query()->create([
            'document_type' => 'invoice',
            'prefix' => '000-001-01',
            'min_number' => 1,
            'max_number' => 99999999,
            'current_number' => 1,
            'cai' => 'TEST-CAI',
            'valid_until' => now()->addYear()->toDateString(),
            'active' => true,
        ]);

        $cashier = User::factory()->create(['username' => 'cashier-rto-metrics']);
        $cashier->assignRole('cajero');

        $session = CashRegisterSession::query()->create([
            'user_id' => $cashier->id,
            'open_user_id' => $cashier->id,
            'opening_amount' => '500.00',
            'status' => CashRegisterSession::STATUS_OPEN,
            'opened_at' => now(),
        ]);

        $this->assertNotNull(Service::query()->where('name', 'Glucosa')->firstOrFail()->id);

        $invoice = Invoice::query()->create([
            'invoice_number' => '000-001-01-00000001',
            'fiscal_sequence_id' => FiscalSequence::query()->first()->id,
            'fiscal_cai' => 'CAI',
            'patient_name' => 'Paciente RTO Sintetico',
            'subtotal' => '15.00',
            'subtotal_cents' => 1500,
            'tax_amount' => '2.25',
            'tax_amount_cents' => 225,
            'discount_amount' => '0.00',
            'discount_amount_cents' => 0,
            'total' => '17.25',
            'total_cents' => 1725,
            'paid_amount' => '17.25',
            'paid_amount_cents' => 1725,
            'balance_due' => '0.00',
            'balance_due_cents' => 0,
            'status' => Invoice::STATUS_PAID,
            'cash_session_id' => $session->id,
            'issued_by' => $cashier->id,
            'issued_at' => now(),
        ]);

        Payment::query()->create([
            'invoice_id' => $invoice->id,
            'cash_session_id' => $session->id,
            'user_id' => $cashier->id,
            'method' => Payment::METHOD_CASH,
            'amount' => '17.25',
            'amount_cents' => 1725,
            'status' => Payment::STATUS_POSTED,
            'paid_at' => now(),
        ]);
    }
}
