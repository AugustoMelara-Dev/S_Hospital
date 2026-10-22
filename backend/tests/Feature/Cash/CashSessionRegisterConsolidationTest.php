<?php

namespace Tests\Feature\Cash;

use App\Actions\Reports\CashSessionReportService;
use App\Models\CashRegister;
use App\Models\CashRegisterSession;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\User;
use App\Support\Money;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Spatie\Permission\Models\Permission;
use Tests\TestCase;

/**
 * M-W2-FIN-02/FIN-03 (mandato §7): conciliacion por caja y total consolidado.
 *
 * Cubre:
 * - H4: la equivalencia `consolidado == suma por caja` se verifica en centavos
 *   enteros (Money), sin floats.
 * - H3: el grupo sin caja (`cash_register_id = null`) es explicito, no se suma
 *   dentro de ninguna caja y si cuenta en el consolidado.
 * - H5: semantica del rango = sesiones con `opened_at` o `closed_at` dentro del
 *   dia operativo (America/Tegucigalpa), con los bordes probados.
 *
 * La superficie visual queda pendiente para el dueno de frontend; aqui se cubre
 * el servicio y el contrato HTTP `GET /api/cash-sessions/consolidated`.
 */
class CashSessionRegisterConsolidationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->withoutMiddleware(ThrottleRequests::class);
        $this->seed(RolesAndPermissionsSeeder::class);
    }

    public function test_consolidated_total_equals_the_sum_of_per_register_totals_in_integer_cents(): void
    {
        $primary = $this->registerId('principal');
        $secondary = $this->registerId('ventanilla');

        $first = $this->cashier();
        $second = $this->cashier();
        $sequenceId = $this->fiscalSequenceId();

        $firstSession = $this->openSession($first, $primary);
        $secondSession = $this->openSession($second, $secondary);

        $this->registerPayment($firstSession, $first, 'cash', 1000, $sequenceId, 'CONS-1');
        $this->registerPayment($secondSession, $second, 'transfer', 2000, $sequenceId, 'CONS-2');

        $result = app(CashSessionReportService::class)
            ->consolidatedByRegister(CashRegisterSession::query()->orderBy('id')->get());

        $consolidated = $result['consolidated'];
        $expectedTotalCents = 1000 + 2000;

        // Dominio monetario unico: centavos enteros, sin floats.
        $this->assertSame($expectedTotalCents, $this->cents($consolidated['payments_total']));
        $this->assertSame(1000, $this->cents($consolidated['payments_by_method']['cash']));
        $this->assertSame(2000, $this->cents($consolidated['payments_by_method']['transfer']));
        $this->assertSame(2, $consolidated['sessions_count']);
        $this->assertSame(2, $consolidated['payments_count']);

        $byRegister = collect($result['registers'])->keyBy('cash_register_id');

        $this->assertCount(2, $byRegister);
        $this->assertSame(1000, $this->cents($byRegister[$primary]['payments_total']));
        $this->assertSame(1000, $this->cents($byRegister[$primary]['payments_by_method']['cash']));
        $this->assertSame(0, $this->cents($byRegister[$primary]['payments_by_method']['transfer']));
        $this->assertSame(2000, $this->cents($byRegister[$secondary]['payments_total']));
        $this->assertSame(2000, $this->cents($byRegister[$secondary]['payments_by_method']['transfer']));
        $this->assertSame(0, $this->cents($byRegister[$secondary]['payments_by_method']['cash']));

        // consolidado == suma por caja, comparado en centavos de extremo a extremo.
        foreach (['payments_total', 'expected_cash_amount', 'pending_amount', 'reversed_payments_total'] as $moneyField) {
            $sumCents = 0;
            foreach ($result['registers'] as $register) {
                $sumCents += $this->cents($register[$moneyField]);
            }

            $this->assertSame(
                $sumCents,
                $this->cents($consolidated[$moneyField]),
                "El consolidado de {$moneyField} debe ser la suma entera de las cajas.",
            );
        }

        foreach (['cash', 'transfer', 'card', 'other'] as $method) {
            $sumCents = 0;
            foreach ($result['registers'] as $register) {
                $sumCents += $this->cents($register['payments_by_method'][$method]);
            }

            $this->assertSame(
                $sumCents,
                $this->cents($consolidated['payments_by_method'][$method]),
                "El consolidado de payments_by_method.{$method} debe ser la suma entera de las cajas.",
            );
        }
    }

    public function test_sessions_without_register_form_an_explicit_unassigned_group(): void
    {
        $primary = $this->registerId('principal');
        $cashier = $this->cashier();
        $sequenceId = $this->fiscalSequenceId();

        $assignedSession = $this->openSession($cashier, $primary);
        $this->registerPayment($assignedSession, $cashier, 'cash', 1500, $sequenceId, 'CONS-ASG');

        // Historico previo al esquema de cajas: sin cash_register_id.
        $legacySession = $this->legacyClosedSessionWithoutRegister($this->cashier());
        $this->registerPayment($legacySession, $this->userOf($legacySession), 'cash', 700, $sequenceId, 'CONS-LEGACY');

        $result = app(CashSessionReportService::class)
            ->consolidatedByRegister(CashRegisterSession::query()->orderBy('id')->get());

        $groups = collect($result['registers'])->keyBy(
            fn (array $register): string => $register['unassigned'] ? 'none' : (string) $register['cash_register_id'],
        );

        $this->assertCount(2, $groups);
        $this->assertArrayHasKey('none', $groups);

        $unassigned = $groups['none'];
        $this->assertTrue($unassigned['unassigned']);
        $this->assertNull($unassigned['cash_register_id']);
        $this->assertNull($unassigned['code']);
        $this->assertNull($unassigned['name']);
        $this->assertSame(1, $unassigned['sessions_count']);
        $this->assertSame(700, $this->cents($unassigned['payments_total']));

        // No se suma dentro de ninguna caja asignada.
        $this->assertSame(1500, $this->cents($groups[(string) $primary]['payments_total']));
        $this->assertFalse($groups[(string) $primary]['unassigned']);
        $this->assertSame(700, $this->cents($unassigned['payments_total']));

        // El consolidado SI la incluye (dinero real) y lo hace explicito.
        $this->assertSame(2200, $this->cents($result['consolidated']['payments_total']));
        $this->assertSame(2, $result['consolidated']['sessions_count']);
        $this->assertFalse($result['consolidated']['unassigned']);
    }

    public function test_range_basis_includes_sessions_opened_or_closed_inside_the_operational_day(): void
    {
        $primary = $this->registerId('principal');
        $secondary = $this->registerId('ventanilla');
        $sequenceId = $this->fiscalSequenceId();
        $day = '2026-07-15';

        // Excluida: abierta y cerrada antes del dia operativo.
        $this->closedSession($this->cashier(), $primary, '2026-07-14 08:00:00', '2026-07-14 20:00:00', 9000, $sequenceId, 'RNG-BEFORE');
        // Incluida por closed_at.
        $this->closedSession($this->cashier(), $primary, '2026-07-14 22:00:00', '2026-07-15 02:00:00', 2000, $sequenceId, 'RNG-LEFT');
        // Incluida por opened_at (cierra despues del rango).
        $this->closedSession($this->cashier(), $primary, '2026-07-15 08:00:00', '2026-07-16 01:00:00', 3000, $sequenceId, 'RNG-RIGHT');
        // Incluida: limite exacto de inicio del dia.
        $this->closedSession($this->cashier(), $primary, '2026-07-15 00:00:00', '2026-07-15 00:30:00', 500, $sequenceId, 'RNG-START');
        // Excluida: limite exacto del dia siguiente.
        $this->closedSession($this->cashier(), $primary, '2026-07-16 00:00:00', '2026-07-16 01:00:00', 8000, $sequenceId, 'RNG-AFTER');
        // Incluida: abierta 23:59:59 y aun abierta (unica abierta de su caja).
        $openCashier = $this->cashier();
        $openSession = $this->openSessionAt($openCashier, $secondary, '2026-07-15 23:59:59');
        $this->registerPayment($openSession, $openCashier, 'cash', 1000, $sequenceId, 'RNG-OPEN');

        $supervisor = $this->supervisor();

        $response = $this->actingAs($supervisor)
            ->getJson("/api/cash-sessions/consolidated?date_from={$day}&date_to={$day}")
            ->assertOk()
            ->assertJsonPath('data.range_basis', 'cash_sessions.opened_at_or_closed_at')
            ->assertJsonPath('data.timezone', (string) config('app.timezone'))
            ->assertJsonPath('data.date_from', $day)
            ->assertJsonPath('data.date_to', $day)
            ->assertJsonPath('data.consolidated.payments_total', Money::formatCents(6500))
            ->assertJsonPath('data.consolidated.sessions_count', 4);

        $registers = collect($response->json('data.registers'))->keyBy('cash_register_id');

        // principal: RNG-LEFT (2000) + RNG-RIGHT (3000) + RNG-START (500).
        $this->assertSame(Money::formatCents(5500), $registers[$primary]['payments_total']);
        $this->assertSame(3, $registers[$primary]['sessions_count']);
        $this->assertSame(Money::formatCents(1000), $registers[$secondary]['payments_total']);
        $this->assertSame(1, $registers[$secondary]['sessions_count']);

        // Excluidas: RNG-BEFORE (9000) y RNG-AFTER (8000) no aparecen.
        $this->assertNotContains(
            9000,
            [$this->cents($registers[$primary]['payments_total']), $this->cents($registers[$secondary]['payments_total'])],
        );
    }

    public function test_consolidated_endpoint_returns_per_register_and_consolidated_totals(): void
    {
        $primary = $this->registerId('principal');
        $secondary = $this->registerId('ventanilla');

        $first = $this->cashier();
        $second = $this->cashier();
        $sequenceId = $this->fiscalSequenceId();
        $firstSession = $this->openSession($first, $primary);
        $secondSession = $this->openSession($second, $secondary);
        $this->registerPayment($firstSession, $first, 'cash', 1250, $sequenceId, 'CONS-HTTP-1');
        $this->registerPayment($secondSession, $second, 'card', 750, $sequenceId, 'CONS-HTTP-2');

        $supervisor = $this->supervisor();

        $today = now()->toDateString();
        $response = $this->actingAs($supervisor)
            ->getJson("/api/cash-sessions/consolidated?date_from={$today}&date_to={$today}")
            ->assertOk()
            ->assertJsonPath('data.consolidated.payments_total', Money::formatCents(2000))
            ->assertJsonPath('data.consolidated.payments_by_method.cash', Money::formatCents(1250))
            ->assertJsonPath('data.consolidated.payments_by_method.card', Money::formatCents(750))
            ->assertJsonPath('data.date_from', $today);

        $registers = collect($response->json('data.registers'))->keyBy('cash_register_id');
        $this->assertSame(Money::formatCents(1250), $registers[$primary]['payments_total']);
        $this->assertSame(Money::formatCents(750), $registers[$secondary]['payments_total']);
    }

    public function test_consolidated_endpoint_requires_managerial_permission(): void
    {
        $cashier = $this->cashier();
        $today = now()->toDateString();

        $this->actingAs($cashier)
            ->getJson("/api/cash-sessions/consolidated?date_from={$today}&date_to={$today}")
            ->assertForbidden();
    }

    /**
     * C1-FIN-01: el rango mide SESIONES y `payments_in_range` mide PAGOS por
     * `paid_at`. Son metricas separadas; no se suman ni se duplican.
     */
    public function test_range_measures_sessions_and_paid_at_metric_is_separate(): void
    {
        config(['app.timezone' => 'America/Tegucigalpa']);
        $primary = $this->registerId('principal');
        $window = $this->registerId('ventanilla');
        $seq = $this->fiscalSequenceId();

        // S1: abierta el 14 a las 22:00, aun abierta; cobra 33.00 el 15 a la 01:00.
        $this->sessionWithPayment($primary, $this->cashier(), '2026-07-14 22:00:00', null, 'cash', 3300, '2026-07-15 01:00:00', $seq, 'C1-S1');
        // S2: abierta el 14, cerrada el 15 02:00; cobra 20.00 el 14 23:00.
        $this->sessionWithPayment($primary, $this->cashier(), '2026-07-14 22:00:00', '2026-07-15 02:00:00', 'cash', 2000, '2026-07-14 23:00:00', $seq, 'C1-S2');
        // S3: abierta el 15, cerrada el 16 01:00; cobra 10.00 el 15 y 5.00 el 16.
        $s3 = $this->sessionRecord($window, $this->cashier(), '2026-07-15 08:00:00', '2026-07-16 01:00:00');
        $c3 = $this->userOf($s3);
        $inv3 = $this->invoiceRecord($c3, $s3, $seq, 'C1-S3', 1500);
        $this->paymentRecord($inv3, $s3, $c3, 'cash', 1000, '2026-07-15 09:00:00');
        $this->paymentRecord($inv3, $s3, $c3, 'cash', 500, '2026-07-16 00:30:00');
        // S4: dia 14 completo; cobra 99.00 el 14 (fuera del 15).
        $this->sessionWithPayment($window, $this->cashier(), '2026-07-14 08:00:00', '2026-07-14 20:00:00', 'cash', 9900, '2026-07-14 10:00:00', $seq, 'C1-S4');
        // S5: abre el 16 00:00 (borde siguiente); su dinero no es del 15.
        $this->sessionWithPayment($primary, $this->cashier(), '2026-07-16 00:00:00', null, 'cash', 7700, '2026-07-16 10:00:00', $seq, 'C1-S5');
        // S6: borde exacto de inicio del 15; cobra 0.01 el 15.
        $this->sessionWithPayment($primary, $this->cashier(), '2026-07-15 00:00:00', '2026-07-15 00:30:00', 'cash', 1, '2026-07-15 00:10:00', $seq, 'C1-S6');
        // S7: borde exacto de fin del 15; aun abierta y sin cobros.
        $this->sessionRecord($primary, $this->cashier(), '2026-07-15 23:59:59', null);

        $supervisor = $this->supervisor();

        $day15 = $this->actingAs($supervisor)
            ->getJson('/api/cash-sessions/consolidated?date_from=2026-07-15&date_to=2026-07-15')
            ->assertOk()
            ->assertJsonPath('data.range_basis', 'cash_sessions.opened_at_or_closed_at')
            ->assertJsonPath('data.range_measures', 'cash_sessions')
            ->assertJsonPath('data.payments_in_range.basis', 'payments.paid_at')
            ->assertJsonPath('data.timezone', 'America/Tegucigalpa');

        // consolidated mide SESIONES que tocan el 15: S2, S3, S6 y S7 (S1 no).
        $this->assertSame(4, $day15->json('data.consolidated.sessions_count'));
        $this->assertSame(Money::formatCents(3501), $day15->json('data.consolidated.payments_total'));

        $reg15 = collect($day15->json('data.registers'))->keyBy('cash_register_id');
        $this->assertSame(Money::formatCents(2001), $reg15[$primary]['payments_total']);
        $this->assertSame(Money::formatCents(1500), $reg15[$window]['payments_total']);

        // payments_in_range mide PAGOS con paid_at el 15: S1(33.00)+S3(10.00)+S6(0.01).
        $this->assertSame(Money::formatCents(4301), $day15->json('data.payments_in_range.payments_total'));
        $this->assertSame(3, $day15->json('data.payments_in_range.payments_count'));

        // El pago del 15 de S1 NO aparece en el consolidado del 15: no hay doble conteo.
        $this->assertNotSame(
            $day15->json('data.consolidated.payments_total'),
            $day15->json('data.payments_in_range.payments_total'),
        );

        // Dia 14: S1 si aparece por su opened_at con su conciliacion completa.
        $day14 = $this->actingAs($supervisor)
            ->getJson('/api/cash-sessions/consolidated?date_from=2026-07-14&date_to=2026-07-14')
            ->assertOk();

        $this->assertSame(3, $day14->json('data.consolidated.sessions_count'));
        $this->assertSame(Money::formatCents(15200), $day14->json('data.consolidated.payments_total'));
        $this->assertSame(Money::formatCents(11900), $day14->json('data.payments_in_range.payments_total'));
    }

    /**
     * C1-FIN-01: pagos parciales y reversos. Un reverso (payment void) no infla
     * `payments_total` ni se resta dos veces.
     */
    public function test_partial_payments_and_reversals_do_not_double_count(): void
    {
        config(['app.timezone' => 'America/Tegucigalpa']);
        $primary = $this->registerId('principal');
        $window = $this->registerId('ventanilla');
        $seq = $this->fiscalSequenceId();
        $cashier = $this->cashier();

        // Principal: 40.00 + 30.00 posteados (parciales de la misma factura) y 20.00 anulado.
        $p = $this->sessionRecord($primary, $cashier, '2026-07-15 08:00:00', '2026-07-15 20:00:00');
        $invP = $this->invoiceRecord($cashier, $p, $seq, 'C1-PART-P', 7000);
        $this->paymentRecord($invP, $p, $cashier, 'cash', 4000, '2026-07-15 09:00:00');
        $this->paymentRecord($invP, $p, $cashier, 'transfer', 3000, '2026-07-15 10:00:00');
        $this->paymentRecord($invP, $p, $cashier, 'cash', 2000, '2026-07-15 09:30:00', Payment::STATUS_VOID);

        // Ventanilla: 10.00 posteado y 3.00 anulado.
        $v = $this->sessionRecord($window, $cashier, '2026-07-15 08:00:00', '2026-07-15 20:00:00');
        $invV = $this->invoiceRecord($cashier, $v, $seq, 'C1-PART-V', 1000);
        $this->paymentRecord($invV, $v, $cashier, 'card', 1000, '2026-07-15 11:00:00');
        $this->paymentRecord($invV, $v, $cashier, 'cash', 300, '2026-07-15 11:30:00', Payment::STATUS_VOID);

        $supervisor = $this->supervisor();
        $response = $this->actingAs($supervisor)
            ->getJson('/api/cash-sessions/consolidated?date_from=2026-07-15&date_to=2026-07-15')
            ->assertOk();

        // Solo posteados: 70.00 + 10.00 = 80.00. Ni 90.00 (inflado) ni 50.00 (restado dos veces).
        $this->assertSame(Money::formatCents(8000), $response->json('data.consolidated.payments_total'));
        $this->assertSame(3, $response->json('data.consolidated.payments_count'));
        $this->assertSame(Money::formatCents(4000), $response->json('data.consolidated.payments_by_method.cash'));
        $this->assertSame(Money::formatCents(3000), $response->json('data.consolidated.payments_by_method.transfer'));
        $this->assertSame(Money::formatCents(1000), $response->json('data.consolidated.payments_by_method.card'));

        // Los anulados se reportan aparte y no tocan payments_total.
        $this->assertSame(2, $response->json('data.consolidated.reversed_payments_count'));
        $this->assertSame(Money::formatCents(2300), $response->json('data.consolidated.reversed_payments_total'));

        // La metrica por paid_at tampoco infla ni resta dos veces.
        $this->assertSame(Money::formatCents(8000), $response->json('data.payments_in_range.payments_total'));
        $this->assertSame(3, $response->json('data.payments_in_range.payments_count'));
    }

    /**
     * C1-FIN-01: aritmetica exacta en centavos, con importes no redondos y el
     * grupo `unassigned`. `consolidated == suma de los grupos`, sin floats.
     */
    public function test_exact_cent_arithmetic_and_unassigned_group_have_no_rounding_loss(): void
    {
        config(['app.timezone' => 'America/Tegucigalpa']);
        $primary = $this->registerId('principal');
        $window = $this->registerId('ventanilla');
        $seq = $this->fiscalSequenceId();
        $cashier = $this->cashier();

        $p = $this->sessionRecord($primary, $cashier, '2026-07-15 08:00:00', '2026-07-15 20:00:00');
        $invP = $this->invoiceRecord($cashier, $p, $seq, 'C1-CENTS-P', 124566);
        $this->paymentRecord($invP, $p, $cashier, 'cash', 1, '2026-07-15 09:00:00');
        $this->paymentRecord($invP, $p, $cashier, 'transfer', 99, '2026-07-15 09:10:00');
        $this->paymentRecord($invP, $p, $cashier, 'card', 123456, '2026-07-15 09:20:00');
        $this->paymentRecord($invP, $p, $cashier, 'other', 1010, '2026-07-15 09:30:00');

        $v = $this->sessionRecord($window, $cashier, '2026-07-15 08:00:00', '2026-07-15 20:00:00');
        $invV = $this->invoiceRecord($cashier, $v, $seq, 'C1-CENTS-V', 2556);
        $this->paymentRecord($invV, $v, $cashier, 'cash', 2001, '2026-07-15 10:00:00');
        $this->paymentRecord($invV, $v, $cashier, 'transfer', 555, '2026-07-15 10:10:00');

        // Grupo historico sin caja (no se atribuye a una caja inventada).
        $legacyUser = $this->cashier();
        $legacy = $this->sessionRecord(null, $legacyUser, '2026-07-15 08:00:00', '2026-07-15 16:00:00');
        $invL = $this->invoiceRecord($legacyUser, $legacy, $seq, 'C1-CENTS-L', 7);
        $this->paymentRecord($invL, $legacy, $legacyUser, 'cash', 7, '2026-07-15 12:00:00');

        $result = app(CashSessionReportService::class)
            ->consolidatedByRegister(CashRegisterSession::query()->orderBy('id')->get());

        $consolidated = $result['consolidated'];
        $this->assertSame(127129, $this->cents($consolidated['payments_total']));
        $this->assertSame(2009, $this->cents($consolidated['payments_by_method']['cash']));
        $this->assertSame(654, $this->cents($consolidated['payments_by_method']['transfer']));
        $this->assertSame(123456, $this->cents($consolidated['payments_by_method']['card']));
        $this->assertSame(1010, $this->cents($consolidated['payments_by_method']['other']));

        foreach (['payments_total', 'expected_cash_amount', 'pending_amount', 'reversed_payments_total'] as $field) {
            $sum = 0;
            foreach ($result['registers'] as $register) {
                $sum += $this->cents($register[$field]);
            }

            $this->assertSame($sum, $this->cents($consolidated[$field]), "consolidated.{$field} debe ser la suma entera.");
        }

        foreach (['cash', 'transfer', 'card', 'other'] as $method) {
            $sum = 0;
            foreach ($result['registers'] as $register) {
                $sum += $this->cents($register['payments_by_method'][$method]);
            }

            $this->assertSame($sum, $this->cents($consolidated['payments_by_method'][$method]), "metodo {$method}");
        }

        $groups = collect($result['registers'])->keyBy(
            fn (array $register): string => $register['unassigned'] ? 'none' : (string) $register['cash_register_id'],
        );

        $this->assertTrue($groups['none']['unassigned']);
        $this->assertNull($groups['none']['cash_register_id']);
        $this->assertNull($groups['none']['code']);
        $this->assertSame(7, $this->cents($groups['none']['payments_total']));
        $this->assertSame(124566, $this->cents($groups[(string) $primary]['payments_total']));
        $this->assertSame(2556, $this->cents($groups[(string) $window]['payments_total']));

        // La metrica por paid_at cuadra con la suma de los tres grupos (mismo dinero, otra unidad).
        $start = Carbon::parse('2026-07-15', 'America/Tegucigalpa')->startOfDay();
        $end = Carbon::parse('2026-07-15', 'America/Tegucigalpa')->endOfDay();
        $paidAt = app(CashSessionReportService::class)->paymentsByPaidAt($start, $end);
        $this->assertSame(127129, $this->cents($paidAt['payments_total']));
        $this->assertSame(7, $paidAt['payments_count']);
    }

    /**
     * C1-FIN-01: el total cubre TODO el filtro autorizado, no una pagina visible
     * (no hay paginacion en el contrato; se ancla para no introducirla sin aviso).
     */
    public function test_consolidated_covers_every_session_in_the_filter_without_pagination(): void
    {
        config(['app.timezone' => 'America/Tegucigalpa']);
        $seq = $this->fiscalSequenceId();
        $cashier = $this->cashier();

        $registers = [];
        foreach (['principal', 'ventanilla', 'caja_3', 'caja_4', 'caja_5'] as $code) {
            $registers[$code] = $this->registerId($code);
        }

        $sessionsPerRegister = 6;

        foreach ($registers as $code => $registerId) {
            for ($i = 1; $i <= $sessionsPerRegister; $i++) {
                $this->sessionWithPayment(
                    $registerId,
                    $cashier,
                    '2026-07-15 08:00:00',
                    '2026-07-15 09:00:00',
                    'cash',
                    100,
                    '2026-07-15 08:30:00',
                    $seq,
                    'C1-PAGE-'.$code.'-'.$i,
                );
            }
        }

        $supervisor = $this->supervisor();
        $response = $this->actingAs($supervisor)
            ->getJson('/api/cash-sessions/consolidated?date_from=2026-07-15&date_to=2026-07-15')
            ->assertOk();

        $totalSessions = count($registers) * $sessionsPerRegister;
        $this->assertSame($totalSessions, $response->json('data.consolidated.sessions_count'));
        $this->assertSame($totalSessions, $response->json('data.consolidated.payments_count'));
        $this->assertSame(Money::formatCents($totalSessions * 100), $response->json('data.consolidated.payments_total'));

        $byRegister = collect($response->json('data.registers'))->keyBy('cash_register_id');
        $this->assertCount(count($registers), $byRegister);

        foreach ($registers as $registerId) {
            $this->assertSame($sessionsPerRegister, $byRegister[$registerId]['sessions_count']);
        }
    }

    public function test_range_is_capped_at_31_days(): void
    {
        $supervisor = $this->supervisor();

        $this->actingAs($supervisor)
            ->getJson('/api/cash-sessions/consolidated?date_from=2026-07-01&date_to=2026-07-31')
            ->assertOk();

        $this->actingAs($supervisor)
            ->getJson('/api/cash-sessions/consolidated?date_from=2026-07-01&date_to=2026-08-01')
            ->assertStatus(422)
            ->assertJsonValidationErrors('date_to');
    }

    /**
     * C1-FIN-01: bordes exactos del dia operativo en America/Tegucigalpa, con
     * fechas fijas (sin depender del reloj ni de la zona del navegador).
     */
    public function test_operational_day_boundaries_use_hospital_timezone(): void
    {
        config(['app.timezone' => 'America/Tegucigalpa']);
        $primary = $this->registerId('principal');
        $seq = $this->fiscalSequenceId();

        // Cruza medianoche hacia el 15: incluida por closed_at = 00:00:00.
        $this->sessionWithPayment($primary, $this->cashier(), '2026-07-14 23:59:59', '2026-07-15 00:00:00', 'cash', 111, '2026-07-15 00:00:00', $seq, 'C1-BND-A');
        // Borde exacto 00:00:00 del 15.
        $this->sessionWithPayment($primary, $this->cashier(), '2026-07-15 00:00:00', '2026-07-15 00:30:00', 'cash', 222, '2026-07-15 00:10:00', $seq, 'C1-BND-B');
        // Borde exacto 23:59:59 del 15, aun abierta.
        $this->sessionWithPayment($primary, $this->cashier(), '2026-07-15 23:59:59', null, 'cash', 333, '2026-07-15 23:59:59', $seq, 'C1-BND-C');
        // Excluida: abre 00:00:00 del 16.
        $this->sessionWithPayment($primary, $this->cashier(), '2026-07-16 00:00:00', null, 'cash', 444, '2026-07-16 00:00:00', $seq, 'C1-BND-D');
        // Excluida: abierta y cerrada 23:59:59 del 14.
        $this->sessionWithPayment($primary, $this->cashier(), '2026-07-14 23:59:59', '2026-07-14 23:59:59', 'cash', 555, '2026-07-14 23:59:59', $seq, 'C1-BND-E');

        $supervisor = $this->supervisor();
        $response = $this->actingAs($supervisor)
            ->getJson('/api/cash-sessions/consolidated?date_from=2026-07-15&date_to=2026-07-15')
            ->assertOk()
            ->assertJsonPath('data.timezone', 'America/Tegucigalpa');

        $this->assertSame(3, $response->json('data.consolidated.sessions_count'));
        $this->assertSame(Money::formatCents(666), $response->json('data.consolidated.payments_total'));
        $this->assertSame(Money::formatCents(666), $response->json('data.payments_in_range.payments_total'));
    }

    private function cents(string $money): int
    {
        return Money::parseCents($money, 'test_money');
    }

    /**
     * Fixture de sesion de caja con fechas explicitas. `open_marker` queda NULL
     * a proposito: estos datasets agregados pueden tener varias sesiones con
     * `status = open` en la misma caja y el guard real de "una abierta por caja"
     * vive en el indice unico `(cash_register_id, open_marker)`, cubierto por su
     * propia suite; aqui solo se ejerce la agregacion.
     */
    private function sessionRecord(?int $registerId, User $user, string $openedAt, ?string $closedAt = null): int
    {
        $isOpen = $closedAt === null;

        return (int) DB::table('cash_register_sessions')->insertGetId([
            'cash_register_id' => $registerId,
            'open_marker' => null,
            'user_id' => $user->id,
            'open_user_id' => $isOpen ? $user->id : null,
            'opening_amount' => '0.00',
            'status' => $isOpen ? CashRegisterSession::STATUS_OPEN : CashRegisterSession::STATUS_CLOSED,
            'opened_at' => $openedAt,
            'closed_at' => $closedAt,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function invoiceRecord(
        User $user,
        int $sessionId,
        int $sequenceId,
        string $number,
        int $totalCents,
        ?int $paidCents = null,
    ): int {
        $paidCents ??= $totalCents;
        $balanceCents = $totalCents - $paidCents;

        return (int) DB::table('invoices')->insertGetId([
            'invoice_number' => $number,
            'fiscal_sequence_id' => $sequenceId,
            'patient_name' => 'Contrato C1',
            'subtotal' => Money::formatCents($totalCents),
            'subtotal_cents' => $totalCents,
            'tax_amount' => '0.00',
            'tax_amount_cents' => 0,
            'discount_amount' => '0.00',
            'discount_amount_cents' => 0,
            'total' => Money::formatCents($totalCents),
            'total_cents' => $totalCents,
            'paid_amount' => Money::formatCents($paidCents),
            'paid_amount_cents' => $paidCents,
            'balance_due' => Money::formatCents($balanceCents),
            'balance_due_cents' => $balanceCents,
            'status' => $balanceCents > 0 ? Invoice::STATUS_PARTIAL : Invoice::STATUS_PAID,
            'cash_session_id' => $sessionId,
            'issued_by' => $user->id,
            'issued_at' => now(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function paymentRecord(
        int $invoiceId,
        int $sessionId,
        User $user,
        string $method,
        int $amountCents,
        string $paidAt,
        string $status = Payment::STATUS_POSTED,
    ): int {
        return (int) DB::table('payments')->insertGetId([
            'invoice_id' => $invoiceId,
            'cash_session_id' => $sessionId,
            'user_id' => $user->id,
            'method' => $method,
            'amount' => Money::formatCents($amountCents),
            'amount_cents' => $amountCents,
            'status' => $status,
            'paid_at' => $paidAt,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function sessionWithPayment(
        ?int $registerId,
        User $user,
        string $openedAt,
        ?string $closedAt,
        string $method,
        int $amountCents,
        string $paidAt,
        int $sequenceId,
        string $invoiceNumber,
        string $paymentStatus = Payment::STATUS_POSTED,
    ): int {
        $sessionId = $this->sessionRecord($registerId, $user, $openedAt, $closedAt);
        $invoiceId = $this->invoiceRecord($user, $sessionId, $sequenceId, $invoiceNumber, $amountCents);
        $this->paymentRecord($invoiceId, $sessionId, $user, $method, $amountCents, $paidAt, $paymentStatus);

        return $sessionId;
    }

    private function registerId(string $code): int
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

    private function userOf(int $sessionId): User
    {
        $userId = (int) DB::table('cash_register_sessions')->where('id', $sessionId)->value('user_id');

        return User::query()->findOrFail($userId);
    }

    private function supervisor(): User
    {
        $supervisor = User::factory()->create();
        $supervisor->givePermissionTo(Permission::findOrCreate('reports.managerial.view', 'web'));

        return $supervisor->refresh();
    }

    private function openSession(User $user, int $registerId): int
    {
        return $this->openSessionAt($user, $registerId, now()->toDateTimeString());
    }

    private function openSessionAt(User $user, int $registerId, string $openedAt): int
    {
        return (int) DB::table('cash_register_sessions')->insertGetId([
            'cash_register_id' => $registerId,
            'open_marker' => 1,
            'user_id' => $user->id,
            'open_user_id' => $user->id,
            'opening_amount' => '0.00',
            'status' => CashRegisterSession::STATUS_OPEN,
            'opened_at' => $openedAt,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function closedSession(
        User $user,
        int $registerId,
        string $openedAt,
        string $closedAt,
        int $paymentCents,
        int $sequenceId,
        string $invoiceNumber,
    ): int {
        $sessionId = (int) DB::table('cash_register_sessions')->insertGetId([
            'cash_register_id' => $registerId,
            'open_marker' => null,
            'user_id' => $user->id,
            'open_user_id' => null,
            'opening_amount' => '0.00',
            'status' => CashRegisterSession::STATUS_CLOSED,
            'opened_at' => $openedAt,
            'closed_at' => $closedAt,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->registerPayment($sessionId, $user, 'cash', $paymentCents, $sequenceId, $invoiceNumber);

        return $sessionId;
    }

    private function legacyClosedSessionWithoutRegister(User $user): int
    {
        return (int) DB::table('cash_register_sessions')->insertGetId([
            'cash_register_id' => null,
            'open_marker' => null,
            'user_id' => $user->id,
            'open_user_id' => null,
            'opening_amount' => '0.00',
            'status' => CashRegisterSession::STATUS_CLOSED,
            'opened_at' => '2026-06-01 08:00:00',
            'closed_at' => '2026-06-01 16:00:00',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function registerPayment(
        int $sessionId,
        User $user,
        string $method,
        int $amountCents,
        int $sequenceId,
        string $invoiceNumber,
    ): void {
        $amount = Money::formatCents($amountCents);

        $invoiceId = (int) DB::table('invoices')->insertGetId([
            'invoice_number' => $invoiceNumber,
            'fiscal_sequence_id' => $sequenceId,
            'patient_name' => 'Consolidacion',
            'subtotal' => $amount,
            'subtotal_cents' => $amountCents,
            'tax_amount' => '0.00',
            'tax_amount_cents' => 0,
            'discount_amount' => '0.00',
            'discount_amount_cents' => 0,
            'total' => $amount,
            'total_cents' => $amountCents,
            'paid_amount' => $amount,
            'paid_amount_cents' => $amountCents,
            'balance_due' => '0.00',
            'balance_due_cents' => 0,
            'status' => 'paid',
            'cash_session_id' => $sessionId,
            'issued_by' => $user->id,
            'issued_at' => now(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('payments')->insert([
            'invoice_id' => $invoiceId,
            'cash_session_id' => $sessionId,
            'user_id' => $user->id,
            'method' => $method,
            'amount' => $amount,
            'amount_cents' => $amountCents,
            'status' => 'posted',
            'paid_at' => now(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function fiscalSequenceId(): int
    {
        $existing = DB::table('fiscal_sequences')->where('prefix', 'CONS')->value('id');

        if ($existing !== null) {
            return (int) $existing;
        }

        return (int) DB::table('fiscal_sequences')->insertGetId([
            'document_type' => 'invoice',
            'prefix' => 'CONS',
            'min_number' => 1,
            'max_number' => 99999999,
            'current_number' => 0,
            'cai' => 'CONS-CAI',
            'valid_until' => now()->addYear()->toDateString(),
            'active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }
}
