<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * F020 / T2-032: zona horaria de conexion (DB_TIMEZONE) y su efecto en fecha
 * de operacion, DATE() y serializacion.
 *
 * - config/database.php define 'timezone' => env('DB_TIMEZONE', '-06:00') para
 *   mysql y mariadb (offset estable de America/Tegucigalpa; sin tz tables
 *   'SET time_zone=America/Tegucigalpa' falla con ERROR 1298).
 * - Las pruebas de sesion/DATE() corren solo en MariaDB/MySQL; las de
 *   configuracion y serializacion corren en cualquier driver.
 * - No se convierten datos ni se renombran columnas.
 */
class DatabaseTimezoneConfigTest extends TestCase
{
    use RefreshDatabase;

    public function test_mysql_and_mariadb_connections_define_the_hospital_timezone(): void
    {
        $expected = getenv('DB_TIMEZONE') ?: '-06:00';

        $this->assertSame($expected, config('database.connections.mysql.timezone'));
        $this->assertSame($expected, config('database.connections.mariadb.timezone'));
    }

    public function test_default_offset_matches_american_tegucigalpa_without_dst(): void
    {
        $timezone = new \DateTimeZone('America/Tegucigalpa');

        foreach (['2026-01-15 12:00:00', '2026-07-15 12:00:00'] as $moment) {
            $offset = $timezone->getOffset(new \DateTimeImmutable($moment, $timezone));
            $this->assertSame(-6 * 3600, $offset, "America/Tegucigalpa debe ser -06:00 todo el ano ({$moment}).");
        }

        $this->assertSame('-06:00', config('database.connections.mysql.timezone'));
        $this->assertSame('America/Tegucigalpa', config('app.timezone'));
    }

    public function test_timestamp_serialization_contract_is_iso8601(): void
    {
        $local = Carbon::parse('2026-09-13 23:30:00', 'America/Tegucigalpa');

        // Laravel serializa Carbon a UTC (Z) por defecto en JSON/API.
        $this->assertSame('2026-09-14T05:30:00.000000Z', $local->toJSON());

        // toIso8601String() conserva el offset local de la instancia.
        $this->assertSame('2026-09-13T23:30:00-06:00', $local->toIso8601String());
    }

    public function test_mariadb_session_timezone_matches_the_configured_value(): void
    {
        $this->skipUnlessMariaDb();

        $connection = DB::getDefaultConnection();
        $configured = (string) config("database.connections.{$connection}.timezone");
        $session = (string) DB::selectOne('SELECT @@session.time_zone AS tz')->tz;

        $this->assertSame($configured, $session);
    }

    public function test_operation_date_uses_the_fixed_connection_timezone(): void
    {
        $this->skipUnlessMariaDb();

        $lateId = $this->insertInvoiceAt('2026-09-13 23:30:00');
        $earlyNextDayId = $this->insertInvoiceAt('2026-09-14 00:30:00');

        // TIMESTAMP escrito y leido en la misma sesion fijada: string estable.
        $this->assertSame('2026-09-13 23:30:00', (string) DB::table('invoices')->where('id', $lateId)->value('issued_at'));

        // DATE() (usado por reportes mensuales) respeta el dia de operacion.
        $this->assertSame('2026-09-13', (string) DB::selectOne('SELECT DATE(issued_at) AS d FROM invoices WHERE id = ?', [$lateId])->d);
        $this->assertSame('2026-09-14', (string) DB::selectOne('SELECT DATE(issued_at) AS d FROM invoices WHERE id = ?', [$earlyNextDayId])->d);

        // Filtro de dia de operacion estilo TodayReportService.
        $start = Carbon::parse('2026-09-13 00:00:00', 'America/Tegucigalpa');
        $end = Carbon::parse('2026-09-13 23:59:59', 'America/Tegucigalpa');

        $this->assertSame(1, DB::table('invoices')->whereBetween('issued_at', [$start, $end])->count());
        $this->assertSame(
            $lateId,
            (int) DB::table('invoices')->whereBetween('issued_at', [$start, $end])->value('id')
        );
    }

    private function skipUnlessMariaDb(): void
    {
        if (! in_array(DB::connection()->getDriverName(), ['mysql', 'mariadb'], true)) {
            $this->markTestSkipped('La sesion de zona horaria solo es verificable en MariaDB/MySQL; la suite SQLite se conserva intacta.');
        }
    }

    private function insertInvoiceAt(string $issuedAt): int
    {
        $user = User::factory()->create();

        $sequenceId = (int) DB::table('fiscal_sequences')->insertGetId([
            'document_type' => 'invoice',
            'prefix' => '000-001-01',
            'min_number' => 1,
            'max_number' => 99999999,
            'current_number' => 0,
            'cai' => 'TEST-TZ-'.uniqid(),
            'valid_until' => now()->addYear()->toDateString(),
            'active' => 0,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return (int) DB::table('invoices')->insertGetId([
            'invoice_number' => 'TZ-'.uniqid(),
            'fiscal_sequence_id' => $sequenceId,
            'patient_name' => 'Paciente Sintetico TZ',
            'subtotal' => '100.00',
            'subtotal_cents' => 10000,
            'tax_amount' => '15.00',
            'tax_amount_cents' => 1500,
            'discount_amount' => '0.00',
            'discount_amount_cents' => 0,
            'total' => '115.00',
            'total_cents' => 11500,
            'paid_amount' => '0.00',
            'paid_amount_cents' => 0,
            'balance_due' => '115.00',
            'balance_due_cents' => 11500,
            'status' => 'issued',
            'issued_by' => $user->id,
            'issued_at' => $issuedAt,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }
}
