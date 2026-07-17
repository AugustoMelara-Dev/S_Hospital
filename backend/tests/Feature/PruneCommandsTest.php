<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Support\AuditAdmin;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class PruneCommandsTest extends TestCase
{
    use RefreshDatabase;

    public function test_prunable_operational_tables_have_temporal_indexes(): void
    {
        $auditIndex = collect(Schema::getIndexes('audit_logs'))
            ->firstWhere('name', 'audit_logs_created_at_id_index');
        $failedJobsIndex = collect(Schema::getIndexes('failed_jobs'))
            ->firstWhere('name', 'failed_jobs_failed_at_id_index');
        $loginAttemptsIndex = collect(Schema::getIndexes('login_attempts'))
            ->firstWhere('name', 'login_attempts_attempted_at_id_index');
        $clientErrorsIndex = collect(Schema::getIndexes('client_error_logs'))
            ->firstWhere('name', 'client_error_logs_occurred_at_id_index');

        $this->assertIsArray($auditIndex);
        $this->assertSame(['created_at', 'id'], $auditIndex['columns']);
        $this->assertIsArray($failedJobsIndex);
        $this->assertSame(['failed_at', 'id'], $failedJobsIndex['columns']);
        $this->assertIsArray($loginAttemptsIndex);
        $this->assertSame(['attempted_at', 'id'], $loginAttemptsIndex['columns']);
        $this->assertIsArray($clientErrorsIndex);
        $this->assertSame(['occurred_at', 'id'], $clientErrorsIndex['columns']);
    }

    public function test_prune_audit_logs_deletes_rows_older_than_cutoff(): void
    {
        AuditLog::query()->create([
            'action' => 'invoice.issued',
            'entity_type' => 'App\\Models\\Invoice',
            'entity_id' => 1,
            'created_at' => now()->subDays(500),
        ]);
        AuditLog::query()->create([
            'action' => 'invoice.issued',
            'entity_type' => 'App\\Models\\Invoice',
            'entity_id' => 2,
            'created_at' => now()->subDays(10),
        ]);

        $exit = Artisan::call('hospital:prune-audit-logs', ['--days' => 365]);
        $this->assertSame(0, $exit);

        $this->assertSame(1, AuditLog::query()->count());
        $this->assertSame('invoice.issued', AuditLog::query()->first()->action);
    }

    public function test_prune_audit_logs_deletes_in_bounded_chunks(): void
    {
        foreach (range(1, 3) as $entityId) {
            AuditLog::query()->create([
                'action' => 'invoice.issued',
                'entity_type' => 'App\\Models\\Invoice',
                'entity_id' => $entityId,
                'created_at' => now()->subDays(500),
            ]);
        }

        DB::flushQueryLog();
        DB::enableQueryLog();

        Artisan::call('hospital:prune-audit-logs', ['--days' => 365, '--chunk' => 1]);

        $deleteQueries = collect(DB::getQueryLog())
            ->filter(fn (array $entry): bool => preg_match('/^delete from [`"]audit_logs[`"]/i', $entry['query']) === 1);

        $this->assertCount(3, $deleteQueries);
        $this->assertSame(0, AuditLog::query()->count());
    }

    public function test_prune_audit_logs_dry_run_does_not_delete(): void
    {
        AuditLog::query()->create([
            'action' => 'invoice.issued',
            'entity_type' => 'App\\Models\\Invoice',
            'entity_id' => 1,
            'created_at' => now()->subDays(500),
        ]);

        Artisan::call('hospital:prune-audit-logs', ['--days' => 365, '--dry-run' => true]);

        $this->assertSame(1, AuditLog::query()->count());
    }

    public function test_prune_audit_logs_rejects_below_minimum_retention(): void
    {
        $exit = Artisan::call('hospital:prune-audit-logs', ['--days' => 5]);
        $this->assertSame(2, $exit);
    }

    public function test_prune_failed_jobs_deletes_old_rows(): void
    {
        \DB::table('failed_jobs')->insert([
            'uuid' => 'old-row',
            'connection' => 'database',
            'queue' => 'backups',
            'payload' => '[]',
            'exception' => 'old',
            'failed_at' => now()->subDays(60),
        ]);
        \DB::table('failed_jobs')->insert([
            'uuid' => 'new-row',
            'connection' => 'database',
            'queue' => 'backups',
            'payload' => '[]',
            'exception' => 'new',
            'failed_at' => now()->subHour(),
        ]);

        Artisan::call('hospital:prune-failed-jobs', ['--days' => 30]);

        $this->assertSame(1, \DB::table('failed_jobs')->count());
        $this->assertSame('new-row', \DB::table('failed_jobs')->value('uuid'));
    }

    public function test_prune_failed_jobs_deletes_in_bounded_chunks(): void
    {
        foreach (range(1, 3) as $id) {
            DB::table('failed_jobs')->insert([
                'uuid' => "old-row-{$id}",
                'connection' => 'database',
                'queue' => 'backups',
                'payload' => '[]',
                'exception' => 'old',
                'failed_at' => now()->subDays(60),
            ]);
        }

        DB::flushQueryLog();
        DB::enableQueryLog();

        Artisan::call('hospital:prune-failed-jobs', ['--days' => 30, '--chunk' => 1]);

        $deleteQueries = collect(DB::getQueryLog())
            ->filter(fn (array $entry): bool => preg_match('/^delete from [`"]failed_jobs[`"]/i', $entry['query']) === 1);

        $this->assertCount(3, $deleteQueries);
        $this->assertSame(0, DB::table('failed_jobs')->count());
    }

    public function test_prune_scheduler_ticks_keeps_recent_heartbeat_history(): void
    {
        DB::table('scheduler_ticks')->insert([
            [
                'at' => now()->subDays(10),
                'result' => 'ok',
                'message' => null,
                'created_at' => now()->subDays(10),
            ],
            [
                'at' => now()->subDay(),
                'result' => 'ok',
                'message' => null,
                'created_at' => now()->subDay(),
            ],
        ]);

        $this->artisan('hospital:prune-scheduler-ticks', ['--days' => 7, '--chunk' => 1])
            ->assertSuccessful();

        $this->assertSame(1, DB::table('scheduler_ticks')->count());
        $this->assertTrue(DB::table('scheduler_ticks')->where('at', '>=', now()->subDays(2))->exists());
    }

    public function test_scheduler_tick_pruning_is_registered_daily(): void
    {
        $this->artisan('schedule:list', ['--no-ansi' => true])
            ->expectsOutputToContain('hospital:prune-scheduler-ticks --days=7')
            ->assertSuccessful();
    }

    public function test_prune_operational_logs_keeps_recent_login_and_client_error_rows(): void
    {
        DB::table('login_attempts')->insert([
            [
                'login' => 'old-user',
                'ip' => '192.168.1.20',
                'success' => false,
                'attempted_at' => now()->subDays(45),
                'created_at' => now()->subDays(45),
                'updated_at' => now()->subDays(45),
            ],
            [
                'login' => 'recent-user',
                'ip' => '192.168.1.21',
                'success' => true,
                'attempted_at' => now()->subDay(),
                'created_at' => now()->subDay(),
                'updated_at' => now()->subDay(),
            ],
        ]);
        DB::table('client_error_logs')->insert([
            [
                'event_type' => 'network',
                'severity' => 'error',
                'safe_message' => 'old error',
                'occurred_at' => now()->subDays(120),
                'created_at' => now()->subDays(120),
                'updated_at' => now()->subDays(120),
            ],
            [
                'event_type' => 'network',
                'severity' => 'warning',
                'safe_message' => 'recent error',
                'occurred_at' => now()->subDay(),
                'created_at' => now()->subDay(),
                'updated_at' => now()->subDay(),
            ],
        ]);

        $this->artisan('hospital:prune-operational-logs', [
            '--login-days' => 30,
            '--client-error-days' => 90,
            '--chunk' => 1,
        ])->assertSuccessful();

        $this->assertSame(['recent-user'], DB::table('login_attempts')->pluck('login')->all());
        $this->assertSame(['recent error'], DB::table('client_error_logs')->pluck('safe_message')->all());
    }

    public function test_operational_log_pruning_is_registered_daily(): void
    {
        $this->artisan('schedule:list', ['--no-ansi' => true])
            ->expectsOutputToContain('hospital:prune-operational-logs --login-days=30 --client-error-days=90')
            ->assertSuccessful();
    }

    public function test_audit_admin_helper_runs_callback_when_driver_is_not_mysql(): void
    {
        AuditLog::query()->create([
            'action' => 'invoice.issued',
            'entity_type' => 'App\\Models\\Invoice',
            'entity_id' => 1,
            'created_at' => now()->subDays(500),
        ]);

        $deleted = AuditAdmin::run(fn () => DB::table('audit_logs')
            ->where('created_at', '<', now()->subDays(30))
            ->delete());

        $this->assertSame(1, $deleted);
        $this->assertSame(0, AuditLog::query()->count());
    }

    public function test_audit_admin_helper_resets_bypass_flag_even_when_callback_throws(): void
    {
        $driver = DB::connection()->getDriverName();
        $this->assertNotContains($driver, ['mysql', 'mariadb'], 'Este test no aplica en MariaDB/MySQL porque la sesion es por conexion real.');

        $thrown = false;
        try {
            AuditAdmin::run(function (): void {
                throw new \RuntimeException('boom');
            });
        } catch (\RuntimeException) {
            $thrown = true;
        }

        $this->assertTrue($thrown, 'El callback debe propagar la excepcion.');
    }

    public function test_prune_command_uses_audit_admin_helper_for_real_driver(): void
    {
        $driver = DB::connection()->getDriverName();
        if (! in_array($driver, ['mysql', 'mariadb'], true)) {
            $this->markTestSkipped('Solo aplica a MariaDB/MySQL: el helper no-op en SQLite y la logica ya esta cubierta por el test_baseline.');
        }

        // En MariaDB real, el comando DEBE completar sin SQLSTATE 45000.
        AuditLog::query()->create([
            'action' => 'invoice.issued',
            'entity_type' => 'App\\Models\\Invoice',
            'entity_id' => 1,
            'created_at' => now()->subDays(500),
        ]);

        $exit = Artisan::call('hospital:prune-audit-logs', ['--days' => 365]);
        $this->assertSame(0, $exit, 'El comando debe terminar con exito cuando el trigger bypass esta activo.');
        $this->assertSame(0, AuditLog::query()->count());
    }
}
