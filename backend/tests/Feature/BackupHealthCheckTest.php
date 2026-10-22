<?php

namespace Tests\Feature;

use App\Actions\Backups\Alerts\AlertChannel;
use App\Actions\Backups\CheckBackupHealthAction;
use App\Models\AuditLog;
use App\Models\BackupLog;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class BackupHealthCheckTest extends TestCase
{
    use RefreshDatabase;

    public function test_health_flags_missing_backup_and_is_idempotent(): void
    {
        $first = app(CheckBackupHealthAction::class)->execute();

        $this->assertSame('attention', $first['status']);
        $this->assertContains('backup_stale', array_column($first['alerts'], 'code'));

        app(CheckBackupHealthAction::class)->execute();

        $this->assertSame(1, AuditLog::query()->where('action', 'backup.alert_raised')->count());
        $this->assertSame(0, AuditLog::query()->where('action', 'backup.alert_resolved')->count());
    }

    public function test_health_resolves_alerts_when_recovery_is_verified(): void
    {
        app(CheckBackupHealthAction::class)->execute();

        $backup = BackupLog::query()->create([
            'filename' => 'healthy.sql.gz.enc',
            'path' => 'backups/healthy.sql.gz.enc',
            'disk' => 'local',
            'size_bytes' => 10,
            'checksum_sha256' => str_repeat('a', 64),
            'status' => BackupLog::STATUS_SUCCESS,
            'type' => BackupLog::TYPE_MANUAL,
            'completed_at' => now(),
        ]);
        $backup->forceFill([
            'verify_status' => 'verified',
            'verified_at' => now()->toDateTimeString(),
            'key_identifier' => str_repeat('b', 64),
        ])->save();

        $second = app(CheckBackupHealthAction::class)->execute();

        $this->assertSame('ok', $second['status']);
        $this->assertSame([], $second['alerts']);
        $this->assertNotNull($second['last_recoverable']);
        $this->assertDatabaseHas('audit_logs', [
            'action' => 'backup.alert_resolved',
            'result' => 'success',
        ]);
        $this->assertSame([], Cache::get(CheckBackupHealthAction::CACHE_KEY_ACTIVE));
    }

    public function test_health_flags_consecutive_failures_and_stale_pending(): void
    {
        Config::set('backups.alerts.consecutive_failures', 2);

        foreach ([1, 2] as $index) {
            BackupLog::query()->create([
                'filename' => "failed-{$index}.sql.gz.enc",
                'path' => "backups/failed-{$index}.sql.gz.enc",
                'disk' => 'local',
                'status' => BackupLog::STATUS_FAILED,
                'type' => BackupLog::TYPE_MANUAL,
                'completed_at' => now()->subMinutes(30 - $index),
            ]);
        }

        $pending = BackupLog::query()->create([
            'filename' => 'stale-pending.sql.gz.enc',
            'path' => 'backups/stale-pending.sql.gz.enc',
            'disk' => 'local',
            'status' => BackupLog::STATUS_PENDING,
            'type' => BackupLog::TYPE_MANUAL,
        ]);
        $pending->forceFill([
            'created_at' => now()->subMinutes(20),
            'updated_at' => now()->subMinutes(20),
        ])->save();

        $result = app(CheckBackupHealthAction::class)->execute();
        $codes = array_column($result['alerts'], 'code');

        $this->assertContains('consecutive_failures', $codes);
        $this->assertContains('stale_pending', $codes);
    }

    public function test_health_flags_external_copy_stale_when_enabled(): void
    {
        $backup = BackupLog::query()->create([
            'filename' => 'with-external.sql.gz.enc',
            'path' => 'backups/with-external.sql.gz.enc',
            'disk' => 'local',
            'size_bytes' => 10,
            'checksum_sha256' => str_repeat('a', 64),
            'status' => BackupLog::STATUS_SUCCESS,
            'type' => BackupLog::TYPE_MANUAL,
            'completed_at' => now(),
        ]);

        Config::set('backups.external.enabled', true);
        Config::set('backups.alerts.external_stale_after_hours', 26);
        // Destino sintetico valido en %TEMP%: la salud consulta el guard y la
        // copia verificada solo cuenta si HOY el destino es externo valido.
        Config::set('filesystems.disks.backup_external', [
            'driver' => 'local',
            'root' => sys_get_temp_dir().DIRECTORY_SEPARATOR.'s_hospital_external_health_'.bin2hex(random_bytes(6)),
            'throw' => false,
            'report' => false,
        ]);

        DB::table('backup_external_copies')->insert([
            'backup_log_id' => $backup->id,
            'destination_label' => 'externo',
            'relative_path' => 'hospital-backups/with-external.sql.gz.enc',
            'sha256' => str_repeat('c', 64),
            'bytes' => 10,
            'status' => 'verified',
            'copied_at' => now()->subHours(48),
            'verified_at' => now()->subHours(48),
            'created_at' => now()->subHours(48),
            'updated_at' => now()->subHours(48),
        ]);

        $result = app(CheckBackupHealthAction::class)->execute();
        $codes = array_column($result['alerts'], 'code');

        $this->assertContains('external_copy_stale', $codes);
        $this->assertTrue($result['external']['enabled']);
        $this->assertSame(1, $result['external']['verified_copies_count']);
    }

    public function test_health_does_not_count_verified_copies_when_destination_guard_fails(): void
    {
        $backup = BackupLog::query()->create([
            'filename' => 'guard-invalid.sql.gz.enc',
            'path' => 'backups/guard-invalid.sql.gz.enc',
            'disk' => 'local',
            'size_bytes' => 10,
            'checksum_sha256' => str_repeat('a', 64),
            'status' => BackupLog::STATUS_SUCCESS,
            'type' => BackupLog::TYPE_MANUAL,
            'completed_at' => now(),
        ]);

        Config::set('backups.external.enabled', true);
        // Root vaciado despues de verificar: hoy el destino no pasa el guard.
        Config::set('filesystems.disks.backup_external', [
            'driver' => 'local',
            'root' => '',
            'throw' => false,
            'report' => false,
        ]);

        DB::table('backup_external_copies')->insert([
            'backup_log_id' => $backup->id,
            'destination_label' => 'externo',
            'relative_path' => 'hospital-backups/guard-invalid.sql.gz.enc',
            'sha256' => str_repeat('c', 64),
            'bytes' => 10,
            'status' => 'verified',
            'copied_at' => now(),
            'verified_at' => now(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $result = app(CheckBackupHealthAction::class)->execute();

        $this->assertFalse($result['external']['destination_valid']);
        $this->assertNotNull($result['external']['destination_problem']);
        $this->assertSame(0, $result['external']['verified_copies_count']);
        $this->assertContains('external_destination_invalid', array_column($result['alerts'], 'code'));

        // El health no muta el ledger; la degradacion visible la aplica verifyCopy.
        $this->assertSame('verified', (string) DB::table('backup_external_copies')->first()->status);
    }

    public function test_alert_channel_receives_raised_alerts_only_once(): void
    {
        $channel = new class implements AlertChannel
        {
            /** @var list<array<string, mixed>> */
            public array $received = [];

            public function send(array $alert): void
            {
                $this->received[] = $alert;
            }
        };

        app()->instance(AlertChannel::class, $channel);

        app(CheckBackupHealthAction::class)->execute();
        $firstCount = count($channel->received);

        app(CheckBackupHealthAction::class)->execute();

        $this->assertGreaterThan(0, $firstCount);
        $this->assertSame($firstCount, count($channel->received));
        $this->assertSame('backup_stale', $channel->received[0]['code']);
    }

    public function test_health_command_json_and_fail_on_alert(): void
    {
        $exitCode = Artisan::call('hospital:check-backup-health', ['--json' => true]);
        $output = Artisan::output();

        $this->assertSame(0, $exitCode);
        $this->assertStringContainsString('"status":"attention"', $output);
        $this->assertStringContainsString('"code":"backup_stale"', $output);

        $exitCode = Artisan::call('hospital:check-backup-health', ['--fail-on-alert' => true]);

        $this->assertSame(1, $exitCode);
    }

    /**
     * M-W1-BK-01: la senal de alerta no puede depender solo de la cache (que
     * se puede limpiar). El estado persistente (`backup_logs`) es la fuente:
     * tras vaciar la cache, una nueva evaluacion vuelve a detectar el atraso y
     * `--fail-on-alert` sigue devolviendo exit 1.
     */
    public function test_alerts_are_rederived_from_persistent_state_after_cache_flush(): void
    {
        BackupLog::query()->create([
            'filename' => 'stale-persistent.sql.gz.enc',
            'path' => 'backups/stale-persistent.sql.gz.enc',
            'disk' => 'local',
            'size_bytes' => 10,
            'checksum_sha256' => str_repeat('a', 64),
            'status' => BackupLog::STATUS_SUCCESS,
            'type' => BackupLog::TYPE_SCHEDULED,
            'completed_at' => now()->subHours(30),
        ]);

        $first = app(CheckBackupHealthAction::class)->execute();
        $this->assertContains('backup_stale', array_column($first['alerts'], 'code'));
        $this->assertNotSame([], Cache::get(CheckBackupHealthAction::CACHE_KEY_ACTIVE, []));

        Cache::flush();
        $this->assertSame([], Cache::get(CheckBackupHealthAction::CACHE_KEY_ACTIVE, []));

        $second = app(CheckBackupHealthAction::class)->execute();
        $this->assertContains('backup_stale', array_column($second['alerts'], 'code'));

        $exitCode = Artisan::call('hospital:check-backup-health', ['--fail-on-alert' => true]);
        $this->assertSame(1, $exitCode);
    }

    /**
     * M-W1-BK-01-R2 / H-02: la alerta de atraso (`backup_stale`) mira la
     * *creacion* (`completed_at`), pero la copia realmente recuperable solo se
     * actualiza con `hospital:verify-backup --latest` (1 vez al dia). Un
     * respaldo creado hace segundos puede tener una copia verificada de hace
     * ~24 h: la recuperabilidad esta atrasada y debe alertarse igual.
     */
    public function test_health_flags_stale_recoverable_copy_even_when_last_creation_is_recent(): void
    {
        $backup = BackupLog::query()->create([
            'filename' => 'recent-creation-old-verification.sql.gz.enc',
            'path' => 'backups/recent-creation-old-verification.sql.gz.enc',
            'disk' => 'local',
            'size_bytes' => 10,
            'checksum_sha256' => str_repeat('a', 64),
            'status' => BackupLog::STATUS_SUCCESS,
            'type' => BackupLog::TYPE_SCHEDULED,
            'completed_at' => now(),
        ]);
        $backup->forceFill([
            'verify_status' => 'verified',
            'verified_at' => now()->subHours(30)->toDateTimeString(),
        ])->save();

        $result = app(CheckBackupHealthAction::class)->execute();
        $codes = array_column($result['alerts'], 'code');

        // La creacion es reciente: no es un problema de `completed_at`.
        $this->assertNotContains('backup_stale', $codes);

        // La copia recuperable si esta atrasada (~30 h) y debe alertarse.
        $this->assertContains('recovery_stale', $codes);
        $recoverableAlert = null;
        foreach ($result['alerts'] as $alert) {
            if ($alert['code'] === 'recovery_stale') {
                $recoverableAlert = $alert;
            }
        }
        $this->assertNotNull($recoverableAlert);
        $this->assertSame($backup->id, $recoverableAlert['context']['backup_log_id']);
        $this->assertGreaterThanOrEqual(29, (float) $recoverableAlert['context']['age_hours']);
        $this->assertSame(26, $recoverableAlert['context']['stale_after_hours']);
        $this->assertNotNull($result['last_recoverable']);
    }

    public function test_health_does_not_flag_recoverable_copy_when_recent(): void
    {
        $backup = BackupLog::query()->create([
            'filename' => 'recent-verification.sql.gz.enc',
            'path' => 'backups/recent-verification.sql.gz.enc',
            'disk' => 'local',
            'size_bytes' => 10,
            'checksum_sha256' => str_repeat('a', 64),
            'status' => BackupLog::STATUS_SUCCESS,
            'type' => BackupLog::TYPE_SCHEDULED,
            'completed_at' => now(),
        ]);
        $backup->forceFill([
            'verify_status' => 'verified',
            'verified_at' => now()->subHour()->toDateTimeString(),
        ])->save();

        $result = app(CheckBackupHealthAction::class)->execute();

        $this->assertNotContains('recovery_stale', array_column($result['alerts'], 'code'));
        $this->assertSame('ok', $result['status']);
        $this->assertNotNull($result['last_recoverable']);
    }

    public function test_recovery_stale_threshold_is_configurable(): void
    {
        Config::set('backups.alerts.recoverable_stale_after_hours', 3);

        $backup = BackupLog::query()->create([
            'filename' => 'configurable-threshold.sql.gz.enc',
            'path' => 'backups/configurable-threshold.sql.gz.enc',
            'disk' => 'local',
            'size_bytes' => 10,
            'checksum_sha256' => str_repeat('a', 64),
            'status' => BackupLog::STATUS_SUCCESS,
            'type' => BackupLog::TYPE_SCHEDULED,
            'completed_at' => now(),
        ]);
        $backup->forceFill([
            'verify_status' => 'verified',
            'verified_at' => now()->subHours(5)->toDateTimeString(),
        ])->save();

        $result = app(CheckBackupHealthAction::class)->execute();

        $this->assertContains('recovery_stale', array_column($result['alerts'], 'code'));

        foreach ($result['alerts'] as $alert) {
            if ($alert['code'] === 'recovery_stale') {
                $this->assertSame(3, $alert['context']['stale_after_hours']);
            }
        }
    }
}
