<?php

namespace App\Actions\Reports;

use App\Actions\Cash\BuildCashReconciliationAction;
use App\Models\CashRegisterSession;
use App\Models\Invoice;
use App\Models\Payment;
use App\Support\Money;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use LogicException;

/**
 * @phpstan-type AggregateTotals array{
 *     sessions_count: int,
 *     payments_count: int,
 *     payments_total_cents: int,
 *     method_cents: array{cash: int, transfer: int, card: int, other: int},
 *     expected_cash_cents: int,
 *     pending_invoice_count: int,
 *     pending_amount_cents: int,
 *     reversed_payments_count: int,
 *     reversed_payments_total_cents: int
 * }
 * @phpstan-type RegisterEntry array{
 *     cash_register_id: int|null,
 *     unassigned: bool,
 *     code: string|null,
 *     name: string|null,
 *     totals: AggregateTotals
 * }
 */
class CashSessionReportService
{
    public function __construct(private readonly BuildCashReconciliationAction $buildCashReconciliation) {}

    /** @return array<string, mixed> */
    public function report(CashRegisterSession $session): array
    {
        $session->load(['user:id,name,username', 'closedBy:id,name,username']);
        $reconciliation = $this->buildCashReconciliation->execute($session);
        $totals = $this->selectedTotals($session, $reconciliation);
        /** @var array{cash: string, transfer: string, card: string, other: string} $methods */
        $methods = $totals['totals_by_method'];
        $paymentsCount = $totals['payments_count'];
        $paymentsTotal = $totals['payments_total'];
        $expectedCashAmount = $totals['expected_cash_amount'];
        $pendingInvoiceCount = $totals['pending_invoice_count'];
        $pendingAmount = $totals['pending_amount'];

        $payments = Payment::query()
            ->join('invoices', 'payments.invoice_id', '=', 'invoices.id')
            ->with([
                'invoice:id,invoice_number,patient_name,status,total,paid_amount,balance_due',
                'user:id,name,username',
            ])
            ->where('payments.cash_session_id', $session->id)
            ->where('payments.status', Payment::STATUS_POSTED)
            ->where(function ($query) use ($session): void {
                $query->where('invoices.status', '!=', Invoice::STATUS_VOID);

                if ($session->closed_at !== null) {
                    $query
                        ->orWhere(function ($query) use ($session): void {
                            $query
                                ->where('invoices.status', Invoice::STATUS_VOID)
                                ->where('invoices.voided_at', '>', $session->closed_at);
                        });
                }
            })
            ->orderBy('payments.paid_at')
            ->select('payments.*')
            ->get();

        $movements = $session->movements()
            ->with('user:id,name,username')
            ->orderBy('occurred_at')
            ->get();

        return [
            'cash_session' => [
                'id' => $session->id,
                'status' => $session->status,
                'user' => $session->user,
                'closed_by' => $session->closedBy,
                'opening_amount' => (string) $session->opening_amount,
                'expected_amount' => $session->expected_amount === null ? null : (string) $session->expected_amount,
                'closing_amount' => $session->closing_amount === null ? null : (string) $session->closing_amount,
                'difference_amount' => $session->difference_amount === null ? null : (string) $session->difference_amount,
                'closing_notes' => $session->closing_notes,
                'closing_breakdown' => $session->closing_breakdown,
                'opened_at' => $session->opened_at,
                'closed_at' => $session->closed_at,
            ],
            'totals_by_method' => $methods,
            'total_cash' => $methods[Payment::METHOD_CASH],
            'total_transfer' => $methods[Payment::METHOD_TRANSFER],
            'total_card' => $methods[Payment::METHOD_CARD],
            'total_other' => $methods[Payment::METHOD_OTHER],
            'payments_count' => $paymentsCount,
            'payments_total' => $paymentsTotal,
            'expected_cash_amount' => $expectedCashAmount,
            'pending_invoice_count' => $pendingInvoiceCount,
            'pending_amount' => $pendingAmount,
            'missing_institutional_receipt_count' => $reconciliation['missing_institutional_receipt_count'],
            'reversed_payments_count' => $totals['reversed_payments_count'],
            'reversed_payments_total' => $totals['reversed_payments_total'],
            'payments' => $payments,
            'movements' => $movements,
        ];
    }

    /**
     * Regla UNICA de seleccion de totales de una sesion: snapshot congelado si la
     * sesion esta cerrada y lo tiene; conciliacion viva si no. `reversed_*` es
     * siempre vivo (el snapshot no congela reversos), igual que en la version
     * original de `report()`.
     *
     * Compartida por `report()` (detalle de sesion) y `consolidatedByRegister()`
     * (agregado): evita que el agregado hidrate pagos/movimientos y a la vez que
     * ambas rutas diverjan en la aritmetica.
     *
     * @param  array<string, mixed>  $reconciliation
     * @return array<string, mixed>
     */
    private function selectedTotals(CashRegisterSession $session, array $reconciliation): array
    {
        $snapshot = $this->closedSnapshot($session);

        return [
            'payments_count' => $snapshot['payments_count'] ?? $reconciliation['payments_count'],
            'payments_total' => $snapshot['payments_total'] ?? $reconciliation['payments_total'],
            'totals_by_method' => $snapshot['payments_by_method'] ?? $reconciliation['payments_by_method'],
            'expected_cash_amount' => $snapshot['expected_cash_amount'] ?? $reconciliation['expected_cash_amount'],
            'pending_invoice_count' => $snapshot['pending_invoice_count'] ?? $reconciliation['pending_invoice_count'],
            'pending_amount' => $snapshot['pending_amount'] ?? $reconciliation['pending_amount'],
            'reversed_payments_count' => $reconciliation['reversed_payments_count'],
            'reversed_payments_total' => $reconciliation['reversed_payments_total'],
        ];
    }

    /**
     * M-W2-FIN-02/M-C1-FIN-01 (mandato §7): total consolidado por caja/registro.
     *
     * QUE MIDE ESTA SALIDA: **sesiones de caja**. Recibe exactamente las sesiones
     * ya seleccionadas por el rango (ver `CashSessionController::consolidated()`,
     * `range_basis = cash_sessions.opened_at_or_closed_at`) y suma, por caja, la
     * conciliacion **completa** de cada sesion incluida (snapshot congelado si la
     * sesion esta cerrada; conciliacion viva si sigue abierta). No mide
     * movimientos ni cobros por fecha de pago: una sesion abierta antes del rango
     * y con pagos dentro aporta su conciliacion entera en el rango que cubre su
     * `opened_at`/`closed_at`, no el importe de los pagos del dia.
     *
     * NO HAY DOBLE CONTEO: cada `payments` pertenece a una sola
     * `cash_register_sessions` (`payments.cash_session_id` es FK no nula) y cada
     * sesion aparece una sola vez en la consulta del rango; por tanto sumar
     * `registers` no duplica dinero y `consolidated == suma(registers)` en
     * centavos enteros. Los campos `reversed_payments_*` son informativos (pagos
     * con `status = void`) y **no** se restan ni se suman a `payments_total`.
     *
     * METRICA POR FECHA DE PAGO (M-C1-FIN-01): para responder "cobrado en el
     * periodo" existe `paymentsByPaidAt()` (campo `payments_in_range` en la
     * respuesta), que mide `payments.paid_at` y es una unidad SEPARADA. Nunca debe
     * sumarse `payments_in_range` con `consolidated`: son dos metricas distintas
     * sobre el mismo dinero.
     *
     * Semantica del grupo sin caja (M-W2-FIN-03 H3): las sesiones con
     * `cash_register_id = null` (historico previo al esquema M-W2-DB-01 que no
     * pudo backfillearse, o filas insertadas por fuera del flujo) forman su propio
     * grupo con `unassigned = true`, `code`/`name` nulos y
     * `cash_register_id = null`. Sus totales NO se suman dentro de ninguna caja y
     * SI se incluyen en `consolidated`, porque representan dinero real; excluirlas
     * escondería recaudacion. El consumidor puede aislarlas filtrando
     * `unassigned === true` (el grupo aparece una sola vez en `registers`).
     *
     * @param  iterable<CashRegisterSession>  $sessions
     * @return array{
     *     registers: list<array<string, mixed>>,
     *     consolidated: array<string, mixed>
     * }
     */
    public function consolidatedByRegister(iterable $sessions): array
    {
        /** @var array<string, RegisterEntry> $groups */
        $groups = [];
        $consolidated = $this->zeroAggregate();

        foreach ($sessions as $session) {
            $session->loadMissing('cashRegister:id,code,name');

            $registerId = $session->cash_register_id === null ? null : (int) $session->cash_register_id;
            $key = $registerId === null ? 'none' : (string) $registerId;

            if (! isset($groups[$key])) {
                $groups[$key] = [
                    'cash_register_id' => $registerId,
                    'unassigned' => $registerId === null,
                    'code' => $session->cashRegister?->code,
                    'name' => $session->cashRegister?->name,
                    'totals' => $this->zeroAggregate(),
                ];
            }

            // C1-FIN-01: el agregado solo necesita los totales escalares; usa la
            // misma regla que `report()` (snapshot/viva) sin hidratar la lista de
            // pagos/movimientos ni cargar user/closedBy. La aritmetica es identica.
            $reconciliation = $this->buildCashReconciliation->executeForAggregate($session);
            $totals = $this->reportTotals($this->selectedTotals($session, $reconciliation));
            $groups[$key]['totals'] = $this->addAggregates($groups[$key]['totals'], $totals);
            $consolidated = $this->addAggregates($consolidated, $totals);
        }

        $registers = [];
        foreach ($groups as $group) {
            $registers[] = $this->publicAggregate(
                $group['totals'],
                $group['cash_register_id'],
                $group['unassigned'],
                $group['code'],
                $group['name'],
            );
        }

        return [
            'registers' => $registers,
            'consolidated' => $this->publicAggregate($consolidated, null, false, null, null),
        ];
    }

    /**
     * M-C1-FIN-01 (mandato §7/§11): metrica ADICIONAL y separada de dinero por
     * fecha de pago.
     *
     * Mide los pagos realmente cobrados (`payments.status = posted`, factura no
     * anulada, `amount_cents` presente) cuyo `payments.paid_at` cae en
     * `[start, end]`, agrupados por metodo. Su unidad es el PAGO, no la sesion;
     * por eso NO se suma con `consolidatedByRegister()` y la respuesta la publica
     * bajo `payments_in_range` con `basis = payments.paid_at`.
     *
     * Con `cashRegisterId` se restringe a los pagos de sesiones de esa caja
     * (`payments.cash_session_id` es FK no nula). Sin filtro incluye tambien los
     * pagos de sesiones `cash_register_id = null` (grupo `unassigned` del
     * consolidado), que representan dinero real. Los pagos anulados no se restan:
     * quedan fuera de `payments_total` (no estaban incluidos) y el consolidado
     * por sesion los reporta aparte en `reversed_payments_*`.
     *
     * @return array{
     *     basis: string,
     *     payments_count: int,
     *     payments_total: string,
     *     payments_by_method: array{cash: string, transfer: string, card: string, other: string}
     * }
     */
    public function paymentsByPaidAt(Carbon $start, Carbon $end, ?int $cashRegisterId = null): array
    {
        $methodCents = $this->zeroMethodCents();
        $paymentsCount = 0;

        $rows = Payment::query()
            ->join('invoices', 'payments.invoice_id', '=', 'invoices.id')
            ->when($cashRegisterId !== null, function ($query) use ($cashRegisterId): void {
                $query
                    ->join('cash_register_sessions', 'payments.cash_session_id', '=', 'cash_register_sessions.id')
                    ->where('cash_register_sessions.cash_register_id', $cashRegisterId);
            })
            ->where('payments.status', Payment::STATUS_POSTED)
            ->where('invoices.status', '!=', Invoice::STATUS_VOID)
            ->whereBetween('payments.paid_at', [$start, $end])
            ->whereNotNull('payments.amount_cents')
            ->groupBy('payments.method')
            ->select(
                'payments.method',
                DB::raw('COUNT(*) as payments_count'),
                DB::raw('SUM(payments.amount_cents) as total_cents'),
            )
            ->toBase()
            ->get();

        foreach ($rows as $row) {
            if (! array_key_exists($row->method, $methodCents)) {
                continue;
            }

            $methodCents[$row->method] += (int) $row->total_cents;
            $paymentsCount += (int) $row->payments_count;
        }

        $totalCents = 0;
        foreach ($methodCents as $cents) {
            $totalCents += $cents;
        }

        return [
            'basis' => 'payments.paid_at',
            'payments_count' => $paymentsCount,
            'payments_total' => Money::formatCents($totalCents),
            'payments_by_method' => [
                Payment::METHOD_CASH => Money::formatCents($methodCents[Payment::METHOD_CASH]),
                Payment::METHOD_TRANSFER => Money::formatCents($methodCents[Payment::METHOD_TRANSFER]),
                Payment::METHOD_CARD => Money::formatCents($methodCents[Payment::METHOD_CARD]),
                Payment::METHOD_OTHER => Money::formatCents($methodCents[Payment::METHOD_OTHER]),
            ],
        ];
    }

    /**
     * Extrae en centavos enteros los totales monetarios del reporte de una sesion.
     * `report()` declara `array<string, mixed>`; aqui cada campo se afina con
     * comprobaciones reales para no castear `mixed` ni usar floats.
     *
     * @param  array<string, mixed>  $report
     * @return AggregateTotals
     */
    private function reportTotals(array $report): array
    {
        $methodTotals = $report['totals_by_method'] ?? null;
        if (! is_array($methodTotals)) {
            $methodTotals = [];
        }

        return [
            'sessions_count' => 1,
            'payments_count' => $this->intFromReport($report['payments_count'] ?? null, 'payments_count'),
            'payments_total_cents' => $this->centsFromReport($report['payments_total'] ?? null, 'payments_total'),
            'method_cents' => [
                Payment::METHOD_CASH => $this->centsFromReport($methodTotals[Payment::METHOD_CASH] ?? null, 'totals_by_method.cash'),
                Payment::METHOD_TRANSFER => $this->centsFromReport($methodTotals[Payment::METHOD_TRANSFER] ?? null, 'totals_by_method.transfer'),
                Payment::METHOD_CARD => $this->centsFromReport($methodTotals[Payment::METHOD_CARD] ?? null, 'totals_by_method.card'),
                Payment::METHOD_OTHER => $this->centsFromReport($methodTotals[Payment::METHOD_OTHER] ?? null, 'totals_by_method.other'),
            ],
            'expected_cash_cents' => $this->centsFromReport($report['expected_cash_amount'] ?? null, 'expected_cash_amount'),
            'pending_invoice_count' => $this->intFromReport($report['pending_invoice_count'] ?? null, 'pending_invoice_count'),
            'pending_amount_cents' => $this->centsFromReport($report['pending_amount'] ?? null, 'pending_amount'),
            'reversed_payments_count' => $this->intFromReport($report['reversed_payments_count'] ?? null, 'reversed_payments_count'),
            'reversed_payments_total_cents' => $this->centsFromReport($report['reversed_payments_total'] ?? null, 'reversed_payments_total'),
        ];
    }

    private function intFromReport(mixed $value, string $field): int
    {
        if (is_int($value)) {
            return $value;
        }

        if (is_string($value) && is_numeric($value)) {
            return (int) $value;
        }

        throw new LogicException("Reporte de caja: '{$field}' no es un entero valido.");
    }

    private function centsFromReport(mixed $value, string $field): int
    {
        if (is_int($value)) {
            return $value;
        }

        if (is_string($value)) {
            return Money::parseCents($value, $field);
        }

        throw new LogicException("Reporte de caja: '{$field}' no es un monto valido.");
    }

    /**
     * @param  AggregateTotals  $left
     * @param  AggregateTotals  $right
     * @return AggregateTotals
     */
    private function addAggregates(array $left, array $right): array
    {
        return [
            'sessions_count' => $left['sessions_count'] + $right['sessions_count'],
            'payments_count' => $left['payments_count'] + $right['payments_count'],
            'payments_total_cents' => $left['payments_total_cents'] + $right['payments_total_cents'],
            'method_cents' => [
                Payment::METHOD_CASH => $left['method_cents'][Payment::METHOD_CASH] + $right['method_cents'][Payment::METHOD_CASH],
                Payment::METHOD_TRANSFER => $left['method_cents'][Payment::METHOD_TRANSFER] + $right['method_cents'][Payment::METHOD_TRANSFER],
                Payment::METHOD_CARD => $left['method_cents'][Payment::METHOD_CARD] + $right['method_cents'][Payment::METHOD_CARD],
                Payment::METHOD_OTHER => $left['method_cents'][Payment::METHOD_OTHER] + $right['method_cents'][Payment::METHOD_OTHER],
            ],
            'expected_cash_cents' => $left['expected_cash_cents'] + $right['expected_cash_cents'],
            'pending_invoice_count' => $left['pending_invoice_count'] + $right['pending_invoice_count'],
            'pending_amount_cents' => $left['pending_amount_cents'] + $right['pending_amount_cents'],
            'reversed_payments_count' => $left['reversed_payments_count'] + $right['reversed_payments_count'],
            'reversed_payments_total_cents' => $left['reversed_payments_total_cents'] + $right['reversed_payments_total_cents'],
        ];
    }

    /**
     * @return AggregateTotals
     */
    private function zeroAggregate(): array
    {
        return [
            'sessions_count' => 0,
            'payments_count' => 0,
            'payments_total_cents' => 0,
            'method_cents' => [
                Payment::METHOD_CASH => 0,
                Payment::METHOD_TRANSFER => 0,
                Payment::METHOD_CARD => 0,
                Payment::METHOD_OTHER => 0,
            ],
            'expected_cash_cents' => 0,
            'pending_invoice_count' => 0,
            'pending_amount_cents' => 0,
            'reversed_payments_count' => 0,
            'reversed_payments_total_cents' => 0,
        ];
    }

    /**
     * @param  AggregateTotals  $aggregate
     * @return array<string, mixed>
     */
    private function publicAggregate(
        array $aggregate,
        ?int $cashRegisterId,
        bool $unassigned,
        ?string $code,
        ?string $name,
    ): array {
        return [
            'sessions_count' => $aggregate['sessions_count'],
            'payments_count' => $aggregate['payments_count'],
            'payments_total' => Money::formatCents($aggregate['payments_total_cents']),
            'payments_by_method' => [
                Payment::METHOD_CASH => Money::formatCents($aggregate['method_cents'][Payment::METHOD_CASH]),
                Payment::METHOD_TRANSFER => Money::formatCents($aggregate['method_cents'][Payment::METHOD_TRANSFER]),
                Payment::METHOD_CARD => Money::formatCents($aggregate['method_cents'][Payment::METHOD_CARD]),
                Payment::METHOD_OTHER => Money::formatCents($aggregate['method_cents'][Payment::METHOD_OTHER]),
            ],
            'expected_cash_amount' => Money::formatCents($aggregate['expected_cash_cents']),
            'pending_invoice_count' => $aggregate['pending_invoice_count'],
            'pending_amount' => Money::formatCents($aggregate['pending_amount_cents']),
            'reversed_payments_count' => $aggregate['reversed_payments_count'],
            'reversed_payments_total' => Money::formatCents($aggregate['reversed_payments_total_cents']),
            'cash_register_id' => $cashRegisterId,
            'unassigned' => $unassigned,
            'code' => $code,
            'name' => $name,
        ];
    }

    /**
     * @return null|array{
     *     payments_count: int,
     *     payments_total: string,
     *     payments_by_method: array{cash: string, transfer: string, card: string, other: string},
     *     expected_cash_amount: string,
     *     pending_invoice_count: int,
     *     pending_amount: string
     * }
     */
    private function closedSnapshot(CashRegisterSession $session): ?array
    {
        if (
            $session->status !== CashRegisterSession::STATUS_CLOSED
            || $session->method_totals_snapshot === null
            || $session->payments_count_snapshot === null
            || $session->payments_total_snapshot === null
            || $session->expected_amount === null
            || $session->pending_invoice_count_snapshot === null
            || $session->pending_amount_snapshot === null
        ) {
            return null;
        }

        $methods = array_merge($this->zeroMethodTotals(), array_intersect_key(
            $session->method_totals_snapshot,
            $this->zeroMethodTotals(),
        ));

        return [
            'payments_count' => $session->payments_count_snapshot,
            'payments_total' => (string) $session->payments_total_snapshot,
            'payments_by_method' => [
                Payment::METHOD_CASH => $this->snapshotMethodTotal($methods, Payment::METHOD_CASH),
                Payment::METHOD_TRANSFER => $this->snapshotMethodTotal($methods, Payment::METHOD_TRANSFER),
                Payment::METHOD_CARD => $this->snapshotMethodTotal($methods, Payment::METHOD_CARD),
                Payment::METHOD_OTHER => $this->snapshotMethodTotal($methods, Payment::METHOD_OTHER),
            ],
            'expected_cash_amount' => (string) $session->expected_amount,
            'pending_invoice_count' => $session->pending_invoice_count_snapshot,
            'pending_amount' => (string) $session->pending_amount_snapshot,
        ];
    }

    /**
     * @param  array<string, mixed>  $methods
     */
    private function snapshotMethodTotal(array $methods, string $method): string
    {
        $value = $methods[$method] ?? null;
        if (! is_string($value)) {
            throw new LogicException("El snapshot de caja contiene un total invalido para {$method}.");
        }

        return Money::formatCents(Money::parseCents($value, "method_totals_snapshot.{$method}"));
    }

    /**
     * @return array{cash: string, transfer: string, card: string, other: string}
     */
    private function zeroMethodTotals(): array
    {
        return [
            Payment::METHOD_CASH => '0.00',
            Payment::METHOD_TRANSFER => '0.00',
            Payment::METHOD_CARD => '0.00',
            Payment::METHOD_OTHER => '0.00',
        ];
    }

    /**
     * @return array{cash: int, transfer: int, card: int, other: int}
     */
    private function zeroMethodCents(): array
    {
        return [
            Payment::METHOD_CASH => 0,
            Payment::METHOD_TRANSFER => 0,
            Payment::METHOD_CARD => 0,
            Payment::METHOD_OTHER => 0,
        ];
    }
}
