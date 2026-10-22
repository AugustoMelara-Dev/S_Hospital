<?php

namespace Tests\Feature\Cash;

use App\Models\CashRegister;
use App\Models\CashRegisterSession;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\User;
use App\Support\Money;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\DB;
use Spatie\Permission\Models\Permission;
use Tests\TestCase;

/**
 * C1-FIN-01 (mandato §21): medicion reproducible del consolidado por caja.
 *
 * NO corre por defecto (se salta salvo `CONSOLIDATED_PERF=1`) para no cargar la
 * suite de hs-qa. Dataset sintetico declarado: R cajas x N sesiones, 1 pago por
 * sesion, todas abiertas/cerradas dentro de un mismo dia fijo. Mide por llamada
 * al endpoint `GET /api/cash-sessions/consolidated`:
 *   - consultas SQL ejecutadas (DB::listen),
 *   - tiempo de pared (ms),
 *   - pico de memoria del proceso (bytes),
 * y reporta p50/p95 sobre `iters` iteraciones del tamano grande (dataset fijo).
 *
 * Salida: JSON en `CONSOLIDATED_PERF_OUT` (si viene) y una linea compacta por
 * STDERR. No optimiza nada: solo mide.
 *
 * Uso:
 *   $env:CONSOLIDATED_PERF='1'
 *   $env:CONSOLIDATED_PERF_OUT='...\\evidencia\\C1-FIN-01\\perf-<db>.json'
 *   php vendor/bin/phpunit --filter CashSessionConsolidatedPerformanceTest
 */
class CashSessionConsolidatedPerformanceTest extends TestCase
{
    use RefreshDatabase;

    private const PAYMENT_CENTS = 100;

    private int $queryCount = 0;

    /** @var array<string, array{count: int, ms: float}> */
    private array $queryTimeByShape = [];

    protected function setUp(): void
    {
        parent::setUp();

        if (getenv('CONSOLIDATED_PERF') !== '1') {
            $this->markTestSkipped('Medicion de rendimiento opt-in: defina CONSOLIDATED_PERF=1.');
        }

        $this->withoutMiddleware(ThrottleRequests::class);
        $this->seed(RolesAndPermissionsSeeder::class);

        DB::listen(function ($query): void {
            $this->queryCount++;

            $shape = preg_replace('/\s+/', ' ', substr($query->sql, 0, 110)) ?? $query->sql;
            $this->queryTimeByShape[$shape] ??= ['count' => 0, 'ms' => 0.0];
            $this->queryTimeByShape[$shape]['count']++;
            $this->queryTimeByShape[$shape]['ms'] += (float) $query->time;
        });
    }

    public function test_consolidated_endpoint_query_cost_scales_with_session_count(): void
    {
        $registers = $this->intEnv('CONSOLIDATED_PERF_REGISTERS', 5);
        $small = $this->intEnv('CONSOLIDATED_PERF_SMALL', 10);
        $large = $this->intEnv('CONSOLIDATED_PERF_LARGE', 40);
        $iters = $this->intEnv('CONSOLIDATED_PERF_ITERS', 5);
        $day = '2026-07-15';

        $registerIds = [];
        for ($i = 1; $i <= $registers; $i++) {
            $registerIds[] = $this->register('perf_'.$i);
        }

        $supervisor = $this->supervisor();
        $cashier = $this->cashier();
        $seq = $this->fiscalSequenceId();

        // Fase 1: dataset pequeno fijo.
        $this->seedSessions($registerIds, $small, 'S', 0, $cashier, $seq, $day);
        $smallRun = $this->measureEndpoint($registerIds, $small, $supervisor, $day);

        // Fase 2: crecer al dataset grande UNA vez y medir iteraciones sobre el fijo.
        $this->seedSessions($registerIds, $large - $small, 'L', $small, $cashier, $seq, $day);

        $timings = [];
        $largeRun = null;
        for ($i = 0; $i < $iters; $i++) {
            $largeRun = $this->measureEndpoint($registerIds, $large, $supervisor, $day);
            $timings[] = $largeRun['wall_ms'];
        }

        $serverVersion = DB::connection()->getDriverName() === 'sqlite'
            ? (string) DB::selectOne('select sqlite_version() as version')->version
            : (string) DB::selectOne('select version() as version')->version;

        $report = [
            'measured_at_utc' => now()->toIso8601String(),
            'driver' => DB::connection()->getDriverName(),
            'server_version' => $serverVersion,
            'database' => (string) DB::connection()->getDatabaseName(),
            'php_version' => PHP_VERSION,
            'dataset' => [
                'registers' => $registers,
                'small_sessions_per_register' => $small,
                'large_sessions_per_register' => $large,
                'payments_per_session' => 1,
                'iterations_large' => $iters,
                'operational_day' => $day,
            ],
            'small' => $smallRun,
            'large' => array_merge($largeRun ?? [], [
                'wall_ms_p50' => $this->percentile($timings, 50),
                'wall_ms_p95' => $this->percentile($timings, 95),
            ]),
            'query_growth_ratio' => $smallRun['queries'] > 0
                ? round($largeRun['queries'] / $smallRun['queries'], 3)
                : null,
            'session_growth_ratio' => $small > 0 ? round($large / $small, 3) : null,
        ];

        $out = getenv('CONSOLIDATED_PERF_OUT');
        if (is_string($out) && $out !== '') {
            @file_put_contents($out, json_encode($report, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
        }

        fwrite(STDERR, PHP_EOL.'[CONSOLIDATED_PERF] '.json_encode([
            'driver' => $report['driver'],
            'small' => $smallRun,
            'large' => $report['large'],
            'query_growth_ratio' => $report['query_growth_ratio'],
            'session_growth_ratio' => $report['session_growth_ratio'],
        ]).PHP_EOL);

        // Correctitud a escala: el total cubre TODO el filtro, sin paginacion.
        $expectedSessions = $registers * $large;
        $this->assertSame($expectedSessions, $largeRun['sessions_count']);
        $this->assertSame($expectedSessions, $largeRun['payments_count']);
        $this->assertSame($expectedSessions * self::PAYMENT_CENTS, $largeRun['consolidated_total_cents']);
    }

    /**
     * @param  list<int>  $registerIds
     */
    private function seedSessions(
        array $registerIds,
        int $perRegister,
        string $batch,
        int $startIndex,
        User $cashier,
        int $seq,
        string $day,
    ): void {
        foreach ($registerIds as $registerId) {
            for ($i = 0; $i < $perRegister; $i++) {
                $index = $startIndex + $i;

                $sessionId = (int) DB::table('cash_register_sessions')->insertGetId([
                    'cash_register_id' => $registerId,
                    'open_marker' => null,
                    'user_id' => $cashier->id,
                    'open_user_id' => null,
                    'opening_amount' => '0.00',
                    'status' => CashRegisterSession::STATUS_CLOSED,
                    'opened_at' => $day.' 08:00:00',
                    'closed_at' => $day.' 09:00:00',
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);

                $invoiceId = (int) DB::table('invoices')->insertGetId([
                    'invoice_number' => 'PERF-'.$batch.'-'.$registerId.'-'.$index,
                    'fiscal_sequence_id' => $seq,
                    'patient_name' => 'Perf C1',
                    'subtotal' => Money::formatCents(self::PAYMENT_CENTS),
                    'subtotal_cents' => self::PAYMENT_CENTS,
                    'tax_amount' => '0.00',
                    'tax_amount_cents' => 0,
                    'discount_amount' => '0.00',
                    'discount_amount_cents' => 0,
                    'total' => Money::formatCents(self::PAYMENT_CENTS),
                    'total_cents' => self::PAYMENT_CENTS,
                    'paid_amount' => Money::formatCents(self::PAYMENT_CENTS),
                    'paid_amount_cents' => self::PAYMENT_CENTS,
                    'balance_due' => '0.00',
                    'balance_due_cents' => 0,
                    'status' => Invoice::STATUS_PAID,
                    'cash_session_id' => $sessionId,
                    'issued_by' => $cashier->id,
                    'issued_at' => now(),
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);

                DB::table('payments')->insert([
                    'invoice_id' => $invoiceId,
                    'cash_session_id' => $sessionId,
                    'user_id' => $cashier->id,
                    'method' => Payment::METHOD_CASH,
                    'amount' => Money::formatCents(self::PAYMENT_CENTS),
                    'amount_cents' => self::PAYMENT_CENTS,
                    'status' => Payment::STATUS_POSTED,
                    'paid_at' => $day.' 08:30:00',
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        }
    }

    /**
     * @param  list<int>  $registerIds
     * @return array<string, mixed>
     */
    private function measureEndpoint(array $registerIds, int $sessionsPerRegister, User $supervisor, string $day): array
    {
        $this->queryCount = 0;
        $this->queryTimeByShape = [];
        $memoryBefore = memory_get_usage(true);
        $startedAt = microtime(true);

        $response = $this->actingAs($supervisor)
            ->getJson('/api/cash-sessions/consolidated?date_from='.$day.'&date_to='.$day)
            ->assertOk();

        $wallMs = (microtime(true) - $startedAt) * 1000;
        $peakMemory = memory_get_peak_usage(true);
        $totalSessions = count($registerIds) * $sessionsPerRegister;

        return [
            'sessions' => $totalSessions,
            'queries' => $this->queryCount,
            'queries_per_session' => $totalSessions > 0 ? round($this->queryCount / $totalSessions, 3) : null,
            'wall_ms' => round($wallMs, 2),
            'peak_memory_bytes' => $peakMemory,
            'memory_delta_bytes' => $peakMemory - $memoryBefore,
            'sessions_count' => $response->json('data.consolidated.sessions_count'),
            'payments_count' => $response->json('data.consolidated.payments_count'),
            'consolidated_total_cents' => Money::parseCents(
                (string) $response->json('data.consolidated.payments_total'),
                'consolidated_total',
            ),
            'top_queries' => $this->topQueries(8),
        ];
    }

    /**
     * @return list<array{ms: float, count: int, sql: string}>
     */
    private function topQueries(int $limit): array
    {
        $rows = [];
        foreach ($this->queryTimeByShape as $sql => $stats) {
            $rows[] = [
                'ms' => round($stats['ms'], 2),
                'count' => $stats['count'],
                'sql' => $sql,
            ];
        }

        usort($rows, static fn (array $a, array $b): int => $b['ms'] <=> $a['ms']);

        return array_slice($rows, 0, $limit);
    }

    /**
     * @param  list<float>  $values
     */
    private function percentile(array $values, int $percentile): float
    {
        if ($values === []) {
            return 0.0;
        }

        sort($values);
        $index = (int) ceil(($percentile / 100) * count($values)) - 1;
        $index = max(0, min($index, count($values) - 1));

        return round($values[$index], 2);
    }

    private function intEnv(string $key, int $default): int
    {
        $raw = getenv($key);

        if (! is_string($raw) || ! is_numeric($raw)) {
            return $default;
        }

        return max(1, (int) $raw);
    }

    private function register(string $code): int
    {
        $existing = CashRegister::query()->where('code', $code)->value('id');

        if ($existing !== null) {
            return (int) $existing;
        }

        return (int) CashRegister::query()->create([
            'code' => $code,
            'name' => 'Caja '.$code,
            'active' => true,
        ])->id;
    }

    private function cashier(): User
    {
        $cashier = User::factory()->create();
        $cashier->assignRole('cajero');

        return $cashier->refresh();
    }

    private function supervisor(): User
    {
        $supervisor = User::factory()->create();
        $supervisor->givePermissionTo(Permission::findOrCreate('reports.managerial.view', 'web'));

        return $supervisor->refresh();
    }

    private function fiscalSequenceId(): int
    {
        $existing = DB::table('fiscal_sequences')->where('prefix', 'PERF')->value('id');

        if ($existing !== null) {
            return (int) $existing;
        }

        return (int) DB::table('fiscal_sequences')->insertGetId([
            'document_type' => 'invoice',
            'prefix' => 'PERF',
            'min_number' => 1,
            'max_number' => 99999999,
            'current_number' => 0,
            'cai' => 'PERF-CAI',
            'valid_until' => now()->addYear()->toDateString(),
            'active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }
}
