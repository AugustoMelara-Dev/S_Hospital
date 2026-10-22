<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Explicit guard for F006: the MariaDB CI job must never silently fall back
 * to SQLite.
 *
 * - Without HOSPITAL_TEST_ALLOW_EXTERNAL_DB=1 the fast SQLite suite keeps
 *   working unchanged and this test is skipped.
 * - With HOSPITAL_TEST_ALLOW_EXTERNAL_DB=1 the active connection must be a
 *   real MySQL/MariaDB server; if the driver resolves to sqlite (or anything
 *   else) the test fails loudly instead of reporting a green MariaDB run.
 */
class DatabaseDriverGuardTest extends TestCase
{
    public function test_external_database_flag_requires_a_real_mysql_or_mariadb_server(): void
    {
        if (getenv('HOSPITAL_TEST_ALLOW_EXTERNAL_DB') !== '1') {
            $this->markTestSkipped('SQLite fast path: HOSPITAL_TEST_ALLOW_EXTERNAL_DB is not enabled.');
        }

        $driver = DB::connection()->getDriverName();

        $this->assertContains(
            $driver,
            ['mysql', 'mariadb'],
            "HOSPITAL_TEST_ALLOW_EXTERNAL_DB=1 but the active driver is '{$driver}'. The MariaDB job must not run on SQLite.",
        );

        $version = (string) (DB::selectOne('select version() as version')->version ?? '');

        $this->assertMatchesRegularExpression(
            '/mariadb|mysql/i',
            $version,
            "HOSPITAL_TEST_ALLOW_EXTERNAL_DB=1 but the server reports: {$version}",
        );
    }
}
