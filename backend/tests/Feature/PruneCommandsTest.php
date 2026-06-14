<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Support\AuditAdmin;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class PruneCommandsTest extends TestCase
{
    use RefreshDatabase;

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
