<?php

namespace Tests\Unit\Support;

use App\Support\AuditAdmin;
use Illuminate\Support\Facades\DB;
use RuntimeException;
use Tests\TestCase;

class AuditAdminTest extends TestCase
{
    public function test_audit_admin_runs_callback_for_non_mysql_drivers_without_setting_variable(): void
    {
        $driver = DB::connection()->getDriverName();
        if (in_array($driver, ['mysql', 'mariadb'], true)) {
            $this->markTestSkipped('Este test cubre SQLite (CI). En MariaDB real lo cubre PruneCommandsTest::test_prune_command_uses_audit_admin_helper_for_real_driver.');
        }

        $result = AuditAdmin::run(fn () => 'callback-ran');

        $this->assertSame('callback-ran', $result);
    }

    public function test_audit_admin_resets_bypass_flag_after_callback_for_mysql_driver(): void
    {
        $driver = DB::connection()->getDriverName();
        if (! in_array($driver, ['mysql', 'mariadb'], true)) {
            $this->markTestSkipped('Solo aplicable a MariaDB/MySQL.');
        }

        $value = AuditAdmin::run(function (): string {
            $sessionValue = DB::selectOne('SELECT COALESCE(@app_audit_admin_op, 0) AS v');
            $this->assertSame(1, (int) $sessionValue->v, 'La variable de sesion debe estar activa durante el callback.');

            return 'ok';
        });

        $this->assertSame('ok', $value);

        $after = DB::selectOne('SELECT COALESCE(@app_audit_admin_op, 0) AS v');
        $this->assertSame(0, (int) $after->v, 'La variable de sesion debe quedar NULL despues del callback.');
    }

    public function test_audit_admin_resets_bypass_flag_even_when_callback_throws(): void
    {
        $driver = DB::connection()->getDriverName();
        if (! in_array($driver, ['mysql', 'mariadb'], true)) {
            $this->markTestSkipped('Solo aplicable a MariaDB/MySQL.');
        }

        $thrown = false;
        try {
            AuditAdmin::run(function (): void {
                throw new RuntimeException('boom');
            });
        } catch (RuntimeException $exception) {
            $thrown = $exception->getMessage() === 'boom';
        }

        $this->assertTrue($thrown, 'La excepcion del callback debe propagarse.');

        $after = DB::selectOne('SELECT COALESCE(@app_audit_admin_op, 0) AS v');
        $this->assertSame(0, (int) $after->v, 'La variable de sesion debe quedar NULL aun cuando el callback falla.');
    }
}
