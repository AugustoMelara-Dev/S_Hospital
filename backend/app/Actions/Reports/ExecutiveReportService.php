<?php

namespace App\Actions\Reports;

use App\Actions\Reports\Concerns\FormatsReportMoney;
use App\Models\CashRegisterSession;
use App\Models\InstitutionalReceipt;
use App\Models\InstitutionalReceiptPrintEvent;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\Service;
use App\Models\User;
use App\Support\Money;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * @phpstan-import-type FinancialFacts from FinancialFactsService
 *
 * @phpstan-type ExecutiveSummary array{
 *     billed_total: string,
 *     collected_total: string,
 *     collected_total_cents: int,
 *     pending_total: string,
 *     voided_total: string,
 *     reversed_total: string,
 *     invoice_count: int,
 *     receipt_count: int,
 *     paid_count: int,
 *     partial_count: int,
 *     pending_count: int,
 *     voided_count: int,
 *     average_ticket: string
 * }
 *
 * Generates the institutional executive report consumed by the
 * /reports screen. Designed to feel like a "Power BI-like" view
 * for accounting: a single, self-contained payload that the
 * frontend can render without additional server round-trips.
 *
 * Definitions (locked to the existing backend semantics):
 * - Billed: invoices issued, voided excluded.
 * - Collected: posted payments, voided excluded, invoice not voided.
 * - Pending: balance_due of issued/partial invoices.
 * - Voided: invoices in status=void, NOT part of net income.
 * - Reversed: payment reversals (audit) – NOT part of net income.
 * - Cash: only method=cash – feeds expected cash.
 * - Transfer / Card / Other: separate from expected cash.
 */
class ExecutiveReportService
{
    use FormatsReportMoney;

    public const HOSPITAL_TIMEZONE = 'America/Tegucigalpa';

    public const MAX_RANGE_DAYS = 92;

    /** Tope defensivo por tabla para no reventar memoria en rangos de 92 dias. */
    public const MAX_TABLE_ROWS = 5000;

    /**
     * T-BE-02: `invoice_items` ya persiste `unit_price_registered_cents` y
     * `rule_adjustment_cents`. El reporte marca esta bandera en `true` cuando
     * al menos una linea gratuita leyó su ajuste de la fila persistida (no
     * inferido). Los historicos backfilleados quedan con ajuste 0.00 para no
     * inventar un valor que nunca se guardo.
     */
    private bool $gratuityAdjustmentPersisted = false;

    public function __construct(private readonly FinancialFactsService $financialFacts) {}

    /**
     * @param  array{date_from: string, date_to: string, cash_session_id?: int|string, user_id?: int|string, category_id?: int|string, area_id?: int|string, method?: string, status?: string}  $filters
     * @return array<string, mixed>
     */
    public function report(array $filters, ?User $requester = null, bool $completeExport = false): array
    {
        $this->gratuityAdjustmentPersisted = false;

        $start = ReportDate::day($filters['date_from'])->startOfDay();
        $end = ReportDate::day($filters['date_to'])->endOfDay();

        $facts = $this->financialFacts->forRange($start, $end, $filters);

        $summary = $this->summary($start, $end, $filters, $facts);
        $paymentMethods = $this->paymentMethods($start, $end, $filters, $facts, $summary['collected_total_cents']);
        $dailyTrend = $this->dailyTrend($start, $end, $filters);
        $services = $this->services($start, $end, $filters);
        $cashiers = $this->cashiers($start, $end, $filters);
        $cashSessions = $this->cashSessions($start, $end, $filters);
        $pendingAging = $this->pendingAging($start, $end, $filters);
        $canViewAudit = $requester?->can('audit.view') === true;
        $voidsAndReversals = $canViewAudit ? $this->voidsAndReversals($start, $end, $filters) : [];
        $auditSummary = $canViewAudit ? $this->auditSummary($start, $end, $filters) : $this->emptyAuditSummary();
        $comparison = $this->comparison($start, $end, $filters);

        // MANDATO_DEV §14: una tabla por proposito, sobre la MISMA cohorte de
        // filtros que el resumen. Emision (Operaciones/Detalle/Gratuidades),
        // cobro real (Cobros) y saldo al corte (Operaciones) se separan.
        $operations = $this->operations($start, $end, $filters, $completeExport);
        $detail = $this->detail($start, $end, $filters, $completeExport);
        $collections = $this->collections($start, $end, $filters, $completeExport);
        $gratuities = $this->gratuities($start, $end, $filters, $completeExport);

        $summary['without_charge_count'] = $facts['without_charge_count'];
        $summary['gratuity_item_count'] = count($gratuities);
        $summary['gratuity_adjustment_total'] = $this->centsToMoney(
            $this->monetaryValue($this->sumGratuityAdjustmentCents($gratuities)),
        );
        $summary['gratuity_adjustment_persisted'] = $this->gratuityAdjustmentPersisted;

        return [
            'period' => [
                'from' => $start->toDateString(),
                'to' => $end->toDateString(),
                'timezone' => self::HOSPITAL_TIMEZONE,
                'days' => $this->inclusiveDays($start, $end),
            ],
            'filters' => [
                'cash_session_id' => $filters['cash_session_id'] ?? null,
                'user_id' => $filters['user_id'] ?? null,
                'category_id' => $filters['category_id'] ?? null,
                'area_id' => $filters['area_id'] ?? null,
                'method' => $filters['method'] ?? null,
                'status' => $filters['status'] ?? null,
            ],
            'accounting_policy' => [
                'scope' => 'operational_cash',
                'expenses_supported' => false,
                'exclusions_already_applied' => true,
                'billed_definition' => 'Facturas emitidas no anuladas. Las facturas anuladas ya estan excluidas.',
                'collected_definition' => 'Pagos posteados no reversados en facturas no anuladas. Reversos y anulaciones ya estan excluidos.',
            ],
            'comparison' => $comparison,
            'summary' => $summary,
            'payment_methods' => $paymentMethods,
            'daily_trend' => $dailyTrend,
            'services' => $services,
            'cashiers' => $cashiers,
            'cash_sessions' => $cashSessions,
            'pending_aging' => $pendingAging,
            'operations' => $operations,
            'detail' => $detail,
            'collections' => $collections,
            'gratuities' => $gratuities,
            'voids_and_reversals' => $voidsAndReversals,
            'audit_summary' => $auditSummary,
            'can_view_audit' => $canViewAudit,
        ];
    }

    /**
     * @param  array<string, mixed>  $filters
     * @param  FinancialFacts  $facts
     * @return ExecutiveSummary
     */
    private function summary(Carbon $start, Carbon $end, array $filters, array $facts): array
    {
        $billedCents = $this->moneyToCents($facts['total_billed']);
        $collectedCents = $this->moneyToCents($facts['total_collected']);
        $pendingCents = $this->moneyToCents($facts['total_pending']);
        $voidedStats = $this->voidedInvoiceStats($start, $end, $filters);
        $voidedCents = $voidedStats['total_cents'];

        $invoiceCount = $facts['invoice_count'];
        // MANDATO_DEV §8: una emision sin cobro no produce recibo/cobro real.
        // Los pagos historicos de importe 0 no cuentan como recibos.
        $receiptCount = (int) DB::table('payments')
            ->join('invoices', 'payments.invoice_id', '=', 'invoices.id')
            ->where('payments.status', Payment::STATUS_POSTED)
            ->where('payments.amount_cents', '!=', 0)
            ->whereBetween('payments.paid_at', [$start, $end])
            ->tap(fn ($query) => $this->applyPaymentFilters($query, $filters))
            ->count();

        $statusCountsQuery = DB::table('invoices')
            ->whereBetween('issued_at', [$start, $end])
            ->tap(fn ($query) => $this->applyInvoiceFilters($query, $filters, $start, $end));
        $statusCounts = (clone $statusCountsQuery)
            ->groupBy('invoices.status')
            ->select('invoices.status', DB::raw('COUNT(*) as cnt'))
            ->pluck('cnt', 'status');
        // MANDATO_DEV §8/§14: `paid_count` cuenta SOLO cobros reales. Una
        // emision sin cobro (`free_by_rule`/`zero_price`) conserva
        // `status=paid` para no romper recibo/anulacion, pero se reporta en
        // `without_charge_count`; no debe sumar como operacion cobrada.
        $paidCount = $this->countValue(
            (clone $statusCountsQuery)
                ->where('invoices.status', Invoice::STATUS_PAID)
                ->whereNotIn('invoices.settlement', [
                    Invoice::SETTLEMENT_FREE_BY_RULE,
                    Invoice::SETTLEMENT_ZERO_PRICE,
                ])
                ->count(),
        );
        $partialCount = $this->countValue($statusCounts[Invoice::STATUS_PARTIAL] ?? null);
        $pendingCount = $this->countValue($statusCounts[Invoice::STATUS_ISSUED] ?? null) + $partialCount;
        $voidedCount = $voidedStats['count'];

        $averageTicketCents = $invoiceCount > 0
            ? intdiv($billedCents, $invoiceCount)
            : 0;

        return [
            'billed_total' => $this->centsToMoney($billedCents),
            'collected_total' => $this->centsToMoney($collectedCents),
            'collected_total_cents' => $collectedCents,
            'pending_total' => $this->centsToMoney($pendingCents),
            'voided_total' => $this->centsToMoney($voidedCents),
            'reversed_total' => $this->centsToMoney($this->reversedTotalCents($start, $end, $filters)),
            'invoice_count' => $invoiceCount,
            'receipt_count' => $receiptCount,
            'paid_count' => $paidCount,
            'partial_count' => $partialCount,
            'pending_count' => $pendingCount,
            'voided_count' => $voidedCount,
            'average_ticket' => $this->centsToMoney($averageTicketCents),
        ];
    }

    /**
     * @param  array<string, mixed>  $filters
     * @param  FinancialFacts  $facts
     * @return array<int, array<string, mixed>>
     */
    private function paymentMethods(Carbon $start, Carbon $end, array $filters, array $facts, int $totalCollectedCents): array
    {
        $methodTotals = $facts['payments_by_method'];
        // Los importes por metodo ya vienen de FinancialFactsService (que
        // excluye `amount_cents = 0`); el conteo debe usar el mismo criterio
        // para no contar un cobro ficticio historico en `other`.
        $methodCount = (array) DB::table('payments')
            ->join('invoices', 'payments.invoice_id', '=', 'invoices.id')
            ->where('payments.status', Payment::STATUS_POSTED)
            ->where('invoices.status', '!=', Invoice::STATUS_VOID)
            ->where('payments.amount_cents', '!=', 0)
            ->whereBetween('payments.paid_at', [$start, $end])
            ->tap(fn ($query) => $this->applyPaymentFilters($query, $filters))
            ->groupBy('payments.method')
            ->select('payments.method', DB::raw('COUNT(*) as cnt'))
            ->pluck('cnt', 'method')
            ->all();

        $labels = [
            'cash' => 'Efectivo',
            'transfer' => 'Transferencia',
            'card' => 'Tarjeta',
            'other' => 'Otro',
        ];

        $methods = [];
        foreach ($labels as $key => $label) {
            $cents = $this->moneyToCents($methodTotals[$key] ?? '0.00');
            $methods[] = [
                'method' => $key,
                'label' => $label,
                'amount' => $this->centsToMoney($cents),
                'count' => $this->countValue($methodCount[$key] ?? null),
                'percentage' => $totalCollectedCents > 0
                    ? round(($cents / $totalCollectedCents) * 100, 2)
                    : 0.0,
            ];
        }

        return $methods;
    }

    /**
     * @param  array<string, mixed>  $filters
     * @return array<int, array<string, mixed>>
     */
    private function dailyTrend(Carbon $start, Carbon $end, array $filters): array
    {
        $trend = [];
        $cursor = $start->copy();
        while ($cursor->lessThanOrEqualTo($end)) {
            $dayStart = $cursor->copy()->startOfDay();
            $dayEnd = $cursor->copy()->endOfDay();
            $dayFacts = $this->financialFacts->forRange($dayStart, $dayEnd, $filters);

            $voidedDay = $this->voidedInvoiceStats($dayStart, $dayEnd, $filters)['count'];

            $trend[] = [
                'date' => $cursor->toDateString(),
                'billed' => $dayFacts['total_billed'],
                'collected' => $dayFacts['total_collected'],
                'pending' => $dayFacts['total_pending'],
                'voided_count' => $voidedDay,
                'invoice_count' => $dayFacts['invoice_count'],
            ];
            $cursor->addDay();
        }

        return $trend;
    }

    /**
     * @param  array<string, mixed>  $filters
     * @return array{count: int, total_cents: int}
     */
    private function voidedInvoiceStats(Carbon $start, Carbon $end, array $filters): array
    {
        $row = DB::table('invoices')
            ->where('status', Invoice::STATUS_VOID)
            ->whereBetween('voided_at', [$start, $end])
            ->tap(fn ($query) => $this->applyInvoiceFilters($query, $filters, $start, $end))
            ->selectRaw('COUNT(*) as count')
            ->selectRaw('COALESCE(SUM(total_cents), 0) as total_cents')
            ->first();

        return [
            'count' => (int) ($row->count ?? 0),
            'total_cents' => (int) ($row->total_cents ?? 0),
        ];
    }

    /**
     * @param  array<string, mixed>  $filters
     * @return array<string, array<int, array<string, mixed>>>
     */
    private function services(Carbon $start, Carbon $end, array $filters): array
    {
        // Alcance unico del bloque: pagos reales del periodo. La fecha de
        // emision no se vuelve a intersectar porque ocultaria cobros de
        // operaciones emitidas antes. Las lineas sin importe cobrable quedan en
        // Detalle/Gratuidades y no se presentan como unidades cobradas.
        $paymentTotals = DB::table('payments')
            ->join('invoices', 'payments.invoice_id', '=', 'invoices.id')
            ->where('payments.status', Payment::STATUS_POSTED)
            ->where('payments.amount_cents', '!=', 0)
            ->whereBetween('payments.paid_at', [$start, $end])
            ->tap(fn ($query) => $this->applyPaymentFilters($query, $filters))
            ->groupBy('payments.invoice_id')
            ->select('payments.invoice_id', DB::raw('COALESCE(SUM(payments.amount_cents), 0) as collected_cents'));

        $rows = DB::table('invoice_items')
            ->join('invoices', 'invoice_items.invoice_id', '=', 'invoices.id')
            ->joinSub($paymentTotals, 'payment_totals', function ($join): void {
                $join->on('payment_totals.invoice_id', '=', 'invoices.id');
            })
            ->where('invoices.status', '!=', Invoice::STATUS_VOID)
            ->where('invoice_items.line_total_cents', '>', 0)
            ->when(! empty($filters['category_id']), function ($query) use ($filters): void {
                $query->where('invoice_items.category_id', $filters['category_id']);
            })
            ->when(! empty($filters['area_id']), function ($query) use ($filters): void {
                $query->where('invoice_items.area_id', $filters['area_id']);
            })
            ->groupBy('invoice_items.service_name', 'invoice_items.category_name')
            ->select(
                'invoice_items.service_name',
                'invoice_items.category_name',
            )
            ->selectRaw('COUNT(*) as item_count')
            ->selectRaw('COALESCE(SUM(invoice_items.quantity_cents), 0) as quantity_cents')
            ->selectRaw('COALESCE(SUM(invoice_items.line_total_cents), 0) as total_cents')
            ->selectRaw('COALESCE(SUM(ROUND(invoice_items.line_total_cents * payment_totals.collected_cents / NULLIF(invoices.total_cents, 0))), 0) as collected_cents')
            ->get();

        $byAmount = (clone $rows)->sortByDesc('total_cents')->take(10)->values()->map(fn (object $row): array => [
            'service' => $row->service_name,
            'category' => $row->category_name,
            'item_count' => (int) $row->item_count,
            'quantity' => $this->centsToMoney($row->quantity_cents),
            'total' => $this->centsToMoney($row->total_cents),
            'collected' => $this->centsToMoney($row->collected_cents),
        ])->all();

        $byQuantity = (clone $rows)->sortByDesc('quantity_cents')->take(10)->values()->map(fn (object $row): array => [
            'service' => $row->service_name,
            'category' => $row->category_name,
            'item_count' => (int) $row->item_count,
            'quantity' => $this->centsToMoney($row->quantity_cents),
            'total' => $this->centsToMoney($row->total_cents),
        ])->all();

        $categoryRows = (clone $rows)
            ->groupBy('category_name')
            ->map(fn ($items, $category): array => [
                'category' => $category,
                'quantity' => $this->centsToMoney($this->monetaryValue($items->sum('quantity_cents'))),
                'total' => $this->centsToMoney($this->monetaryValue($items->sum('total_cents'))),
                'collected' => $this->centsToMoney($this->monetaryValue($items->sum('collected_cents'))),
                'item_count' => $this->countValue($items->sum('item_count')),
            ])
            ->values()
            ->sortByDesc(fn (array $row): int => $this->moneyToCents($row['total']))
            ->take(10)
            ->all();

        $areaRows = DB::table('invoice_items')
            ->join('invoices', 'invoice_items.invoice_id', '=', 'invoices.id')
            ->joinSub($paymentTotals, 'payment_totals', function ($join): void {
                $join->on('payment_totals.invoice_id', '=', 'invoices.id');
            })
            ->where('invoices.status', '!=', Invoice::STATUS_VOID)
            ->where('invoice_items.line_total_cents', '>', 0)
            ->when(! empty($filters['category_id']), function ($query) use ($filters): void {
                $query->where('invoice_items.category_id', $filters['category_id']);
            })
            ->when(! empty($filters['area_id']), function ($query) use ($filters): void {
                $query->where('invoice_items.area_id', $filters['area_id']);
            })
            ->groupBy('invoice_items.area_id', 'invoice_items.area_name')
            ->select(
                'invoice_items.area_id',
                'invoice_items.area_name',
            )
            ->selectRaw('COUNT(*) as item_count')
            ->selectRaw('COALESCE(SUM(invoice_items.quantity_cents), 0) as quantity_cents')
            ->selectRaw('COALESCE(SUM(invoice_items.line_total_cents), 0) as total_cents')
            ->orderByDesc('total_cents')
            ->limit(10)
            ->get()
            ->map(fn (object $row): array => [
                'area_id' => $row->area_id !== null ? (int) $row->area_id : null,
                'area' => $row->area_name ?? 'Sin área',
                'item_count' => (int) $row->item_count,
                'quantity' => $this->centsToMoney($row->quantity_cents),
                'total' => $this->centsToMoney($row->total_cents),
            ])
            ->all();

        return [
            'top_by_amount' => $byAmount,
            'top_by_quantity' => $byQuantity,
            'by_category' => $categoryRows,
            'by_area' => $areaRows,
        ];
    }

    /**
     * @param  array<string, mixed>  $filters
     * @return array<int, array<string, mixed>>
     */
    private function cashiers(Carbon $start, Carbon $end, array $filters): array
    {
        $rows = DB::table('payments')
            ->join('invoices', 'payments.invoice_id', '=', 'invoices.id')
            ->join('users', 'payments.user_id', '=', 'users.id')
            ->where('payments.status', Payment::STATUS_POSTED)
            ->where('invoices.status', '!=', Invoice::STATUS_VOID)
            // Un pago historico de 0.00 no es un cobro del cajero.
            ->where('payments.amount_cents', '!=', 0)
            ->whereBetween('payments.paid_at', [$start, $end])
            ->tap(fn ($query) => $this->applyPaymentFilters($query, $filters))
            ->groupBy('payments.user_id', 'users.name', 'users.username')
            ->select('payments.user_id', 'users.name', 'users.username')
            ->selectRaw('COUNT(*) as payment_count')
            ->selectRaw('COALESCE(SUM(payments.amount_cents), 0) as collected_cents')
            ->selectRaw("COALESCE(SUM(CASE WHEN payments.method = 'cash' THEN payments.amount_cents ELSE 0 END), 0) as cash_cents")
            ->selectRaw("COALESCE(SUM(CASE WHEN payments.method = 'transfer' THEN payments.amount_cents ELSE 0 END), 0) as transfer_cents")
            ->selectRaw("COALESCE(SUM(CASE WHEN payments.method = 'card' THEN payments.amount_cents ELSE 0 END), 0) as card_cents")
            ->selectRaw("COALESCE(SUM(CASE WHEN payments.method = 'other' THEN payments.amount_cents ELSE 0 END), 0) as other_cents")
            ->orderByDesc('collected_cents')
            ->get();

        $voidedByUser = DB::table('invoices')
            ->where('status', Invoice::STATUS_VOID)
            ->whereBetween('issued_at', [$start, $end])
            ->tap(fn ($query) => $this->applyInvoiceFilters($query, $filters, $start, $end))
            ->groupBy('issued_by')
            ->select('issued_by', DB::raw('COUNT(*) as cnt'))
            ->pluck('cnt', 'issued_by');

        $diffByUser = DB::table('cash_register_sessions')
            ->whereNotNull('difference_amount')
            ->whereBetween('closed_at', [$start, $end])
            ->when(! empty($filters['user_id']), function ($query) use ($filters): void {
                $query->where('user_id', $filters['user_id']);
            })
            ->when(! empty($filters['cash_session_id']), function ($query) use ($filters): void {
                $query->where('id', $filters['cash_session_id']);
            })
            ->groupBy('user_id')
            ->select('user_id', DB::raw('SUM(CAST(difference_amount AS DECIMAL(12,2)) * 100) as diff_cents'))
            ->pluck('diff_cents', 'user_id');

        return $rows->map(function (object $row) use ($start, $end, $filters, $voidedByUser, $diffByUser): array {
            $diffCents = $this->signedIntegerValue($diffByUser[$row->user_id] ?? null);
            $invoiceCountQuery = DB::table('invoices')
                ->where('issued_by', $row->user_id)
                ->whereBetween('issued_at', [$start, $end])
                ->where('status', '!=', Invoice::STATUS_VOID)
                ->tap(fn ($query) => $this->applyInvoiceFilters($query, array_merge($filters, ['user_id' => $row->user_id]), $start, $end));

            return [
                'user_id' => (int) $row->user_id,
                'name' => $row->name,
                'username' => $row->username,
                'invoice_count' => (int) $invoiceCountQuery->count(),
                'payment_count' => (int) $row->payment_count,
                'collected' => $this->centsToMoney($row->collected_cents),
                'cash' => $this->centsToMoney($row->cash_cents),
                'transfer' => $this->centsToMoney($row->transfer_cents),
                'card' => $this->centsToMoney($row->card_cents),
                'other' => $this->centsToMoney($row->other_cents),
                'voided_count' => $this->countValue($voidedByUser[$row->user_id] ?? null),
                'difference_total' => $this->centsToMoney($diffCents),
            ];
        })->all();
    }

    /**
     * @param  array<string, mixed>  $filters
     * @return array<int, array<string, mixed>>
     */
    private function cashSessions(Carbon $start, Carbon $end, array $filters): array
    {
        $sessions = CashRegisterSession::query()
            ->with(['user:id,name,username', 'cashRegister:id,code,name'])
            ->where(function ($query) use ($start, $end): void {
                $query->whereBetween('opened_at', [$start, $end])
                    ->orWhereBetween('closed_at', [$start, $end]);
            })
            ->when(! empty($filters['cash_session_id']), function ($query) use ($filters): void {
                $query->where('id', $filters['cash_session_id']);
            })
            ->when(! empty($filters['user_id']), function ($query) use ($filters): void {
                $query->where('user_id', $filters['user_id']);
            })
            ->orderByDesc('id')
            ->limit(50)
            ->get();

        $openSessionIds = $sessions
            ->where('status', CashRegisterSession::STATUS_OPEN)
            ->pluck('id')
            ->all();

        $liveCashBySession = $openSessionIds === []
            ? collect()
            : Payment::query()
                ->join('invoices', 'payments.invoice_id', '=', 'invoices.id')
                ->whereIn('payments.cash_session_id', $openSessionIds)
                ->where('payments.status', Payment::STATUS_POSTED)
                ->where('payments.method', Payment::METHOD_CASH)
                ->where('invoices.status', '!=', Invoice::STATUS_VOID)
                ->selectRaw('payments.cash_session_id as session_id, COALESCE(SUM(payments.amount_cents), 0) as cash_cents')
                ->groupBy('payments.cash_session_id')
                ->pluck('cash_cents', 'session_id');

        return $sessions
            ->map(function (CashRegisterSession $session) use ($liveCashBySession): array {
                $openingCents = $this->signedCents($session->opening_amount);
                $expectedCents = $session->status === CashRegisterSession::STATUS_OPEN
                    ? $openingCents + (int) $liveCashBySession->get($session->id, 0)
                    : $this->signedCents($session->expected_amount ?? '0');
                $countedCents = $session->closing_amount !== null
                    ? $this->signedCents($session->closing_amount)
                    : 0;
                $diffCents = $this->signedCents($session->difference_amount ?? '0');

                return [
                    'id' => (int) $session->id,
                    'cash_register_id' => $session->cash_register_id !== null ? (int) $session->cash_register_id : null,
                    'cash_register_code' => $session->cashRegister?->code,
                    'cash_register_name' => $session->cashRegister?->name,
                    'cashier' => $session->user?->name ?: 'Sin cajero',
                    'opened_at' => $session->opened_at?->toIso8601String(),
                    'closed_at' => $session->closed_at?->toIso8601String(),
                    'opening_amount' => $this->centsToMoney($openingCents),
                    'expected_cash' => $this->centsToMoney($expectedCents),
                    'counted_cash' => $session->closing_amount !== null ? $this->centsToMoney($countedCents) : null,
                    'difference' => $session->difference_amount !== null ? $this->centsToMoney($diffCents) : null,
                    'status' => $session->status,
                    'status_label' => match ($session->status) {
                        CashRegisterSession::STATUS_OPEN => 'Abierta',
                        CashRegisterSession::STATUS_CLOSED => 'Cerrada',
                        default => 'Desconocido',
                    },
                    'closure_note' => $session->closing_notes,
                ];
            })
            ->all();
    }

    /**
     * @param  array<string, mixed>  $filters
     * @return array<string, mixed>
     */
    private function pendingAging(Carbon $start, Carbon $end, array $filters): array
    {
        $now = Carbon::now();

        $rows = DB::table('invoices')
            ->whereIn('status', [Invoice::STATUS_ISSUED, Invoice::STATUS_PARTIAL])
            ->whereBetween('issued_at', [$start, $end])
            ->tap(fn ($query) => $this->applyInvoiceFilters($query, $filters, $start, $end))
            ->select('id', 'invoice_number', 'patient_name', 'total_cents', 'balance_due_cents', 'issued_at')
            ->get();

        $aging = [
            '0_7_days' => ['count' => 0, 'amount_cents' => 0],
            '8_30_days' => ['count' => 0, 'amount_cents' => 0],
            '31_plus_days' => ['count' => 0, 'amount_cents' => 0],
        ];

        $items = [];
        foreach ($rows as $row) {
            $days = $now->diffInDays(Carbon::parse($row->issued_at));
            $balance = (int) $row->balance_due_cents;
            $bucket = $days <= 7 ? '0_7_days' : ($days <= 30 ? '8_30_days' : '31_plus_days');
            $aging[$bucket]['count']++;
            $aging[$bucket]['amount_cents'] += $balance;

            if (count($items) < 20) {
                $items[] = [
                    'invoice_number' => $row->invoice_number,
                    'patient' => $row->patient_name,
                    'total' => $this->centsToMoney($row->total_cents),
                    'balance_due' => $this->centsToMoney($balance),
                    'issued_at' => $row->issued_at,
                    'age_days' => (int) $days,
                    'bucket' => $bucket,
                ];
            }
        }

        return [
            '0_7_days' => [
                'count' => $aging['0_7_days']['count'],
                'amount' => $this->centsToMoney($aging['0_7_days']['amount_cents']),
            ],
            '8_30_days' => [
                'count' => $aging['8_30_days']['count'],
                'amount' => $this->centsToMoney($aging['8_30_days']['amount_cents']),
            ],
            '31_plus_days' => [
                'count' => $aging['31_plus_days']['count'],
                'amount' => $this->centsToMoney($aging['31_plus_days']['amount_cents']),
            ],
            'items' => $items,
        ];
    }

    /**
     * Tabla de operaciones emitidas en el rango (cohorte de emision).
     *
     * @param  array<string, mixed>  $filters
     * @return array<int, array<string, mixed>>
     */
    private function operations(Carbon $start, Carbon $end, array $filters, bool $completeExport): array
    {
        $rows = DB::table('invoices')
            ->leftJoin('cash_register_sessions as sessions', 'invoices.cash_session_id', '=', 'sessions.id')
            ->leftJoin('cash_registers as registers', 'sessions.cash_register_id', '=', 'registers.id')
            ->leftJoin('users as issuers', 'invoices.issued_by', '=', 'issuers.id')
            ->whereBetween('invoices.issued_at', [$start, $end])
            ->tap(fn ($query) => $this->applyInvoiceFilters($query, $filters, $start, $end))
            ->select([
                'invoices.invoice_number',
                'invoices.patient_name',
                'invoices.issued_at',
                'invoices.total_cents',
                'invoices.paid_amount_cents',
                'invoices.balance_due_cents',
                'invoices.status',
                'invoices.settlement',
                'invoices.cash_session_id',
                'registers.name as cash_register_name',
                'registers.code as cash_register_code',
                'issuers.name as cashier_name',
            ])
            ->selectRaw(
                '(SELECT ir.receipt_number_full FROM institutional_receipts ir WHERE ir.invoice_id = invoices.id AND ir.status = ? ORDER BY ir.id DESC LIMIT 1) as receipt_number',
                [InstitutionalReceipt::STATUS_ISSUED],
            )
            ->orderByDesc('invoices.issued_at')
            ->orderByDesc('invoices.id')
            ->when(! $completeExport, fn (Builder $query) => $query->limit(self::MAX_TABLE_ROWS))
            ->get();

        return $rows->map(fn (object $row): array => [
            'date' => $row->issued_at,
            'invoice_number' => (string) $row->invoice_number,
            'patient' => (string) $row->patient_name,
            'cash_session_id' => $row->cash_session_id !== null ? (int) $row->cash_session_id : null,
            'cash_session_label' => $this->cashSessionLabel($row->cash_register_name, $row->cash_register_code, $row->cash_session_id),
            'cashier' => $this->nullableString($row->cashier_name),
            'total' => $this->centsToMoney((int) $row->total_cents),
            'paid' => $this->centsToMoney((int) $row->paid_amount_cents),
            'balance' => $this->centsToMoney((int) $row->balance_due_cents),
            'status' => (string) $row->status,
            'status_label' => $this->invoiceStatusLabel($row->status, $row->settlement),
            'settlement' => (string) $row->settlement,
            'settlement_label' => $this->settlementLabel($row->settlement),
            'receipt_document' => $this->nullableString($row->receipt_number),
        ])->all();
    }

    /**
     * Detalle por linea (cohorte de emision). Incluye paciente y gratuidad.
     *
     * @param  array<string, mixed>  $filters
     * @return array<int, array<string, mixed>>
     */
    private function detail(Carbon $start, Carbon $end, array $filters, bool $completeExport): array
    {
        $rows = DB::table('invoice_items')
            ->join('invoices', 'invoice_items.invoice_id', '=', 'invoices.id')
            ->whereBetween('invoices.issued_at', [$start, $end])
            ->tap(fn ($query) => $this->applyInvoiceFilters($query, $filters, $start, $end))
            ->when(! empty($filters['category_id']), function ($query) use ($filters): void {
                $query->where('invoice_items.category_id', $filters['category_id']);
            })
            ->when(! empty($filters['area_id']), function ($query) use ($filters): void {
                $query->where('invoice_items.area_id', $filters['area_id']);
            })
            ->select([
                'invoices.invoice_number',
                'invoices.patient_name',
                'invoices.issued_at',
                'invoices.settlement',
                'invoice_items.service_name',
                'invoice_items.category_name',
                'invoice_items.area_name',
                'invoice_items.quantity_cents',
                'invoice_items.unit_price_cents',
                'invoice_items.unit_price_registered_cents',
                'invoice_items.rule_adjustment_cents',
                'invoice_items.tax_amount_cents',
                'invoice_items.line_subtotal_cents',
                'invoice_items.line_total_cents',
                'invoice_items.special_rule_code',
                'invoice_items.special_rule_applied',
            ])
            ->orderByDesc('invoices.issued_at')
            ->orderBy('invoices.id')
            ->orderBy('invoice_items.id')
            ->when(! $completeExport, fn (Builder $query) => $query->limit(self::MAX_TABLE_ROWS))
            ->get();

        return $rows->map(function (object $row): array {
            $isFree = (bool) $row->special_rule_applied;
            $registeredCents = $this->nullableInt($row->unit_price_registered_cents ?? null);
            $effectiveCents = $this->nullableInt($row->unit_price_cents ?? null);
            $adjustmentCents = $this->nullableInt($row->rule_adjustment_cents ?? null);
            // MANDATO_DEV §8/§14: el 0 backfilleado en un historico no es un
            // ajuste medido. La procedencia se deriva de la evidencia inmutable
            // de la linea (precio registrado > precio efectivo), nunca del
            // catalogo vigente. Ver LineRuleProvenance.
            $adjustmentRecorded = LineRuleProvenance::adjustmentRecorded($isFree, $registeredCents, $effectiveCents);
            if ($isFree && $adjustmentRecorded) {
                $this->gratuityAdjustmentPersisted = true;
            }

            return [
                'date' => $row->issued_at,
                'invoice_number' => (string) $row->invoice_number,
                'patient' => (string) $row->patient_name,
                'service' => (string) $row->service_name,
                'category' => $this->nullableString($row->category_name),
                'area' => $this->nullableString($row->area_name),
                'quantity' => $this->centsToMoney((int) $row->quantity_cents),
                'unit_price' => $this->centsToMoney($registeredCents ?? (int) $row->unit_price_cents),
                'tax' => $this->centsToMoney((int) $row->tax_amount_cents),
                'line_total' => $this->centsToMoney((int) $row->line_total_cents),
                'rule_adjustment' => $this->centsToMoney($adjustmentCents ?? 0),
                'rule_adjustment_persisted' => $adjustmentRecorded,
                'is_free' => $isFree,
                'rule_code' => $this->nullableString($row->special_rule_code),
                'rule_label' => $isFree ? $this->ruleLabel($row->special_rule_code) : null,
                'settlement' => (string) $row->settlement,
            ];
        })->all();
    }

    /**
     * Cobros reales por fecha de pago (independiente de la cohorte de emision).
     *
     * @param  array<string, mixed>  $filters
     * @return array<int, array<string, mixed>>
     */
    private function collections(Carbon $start, Carbon $end, array $filters, bool $completeExport): array
    {
        // Cobros reales por fecha de pago: los pagos historicos de 0.00 quedan
        // trazables por `settlement=free_by_rule`/`zero_price` y la seccion
        // Gratuidades, nunca como cobro.
        $rows = DB::table('payments')
            ->join('invoices', 'payments.invoice_id', '=', 'invoices.id')
            ->leftJoin('cash_register_sessions as sessions', 'payments.cash_session_id', '=', 'sessions.id')
            ->leftJoin('cash_registers as registers', 'sessions.cash_register_id', '=', 'registers.id')
            ->leftJoin('users as collectors', 'payments.user_id', '=', 'collectors.id')
            ->where('payments.amount_cents', '!=', 0)
            ->whereBetween('payments.paid_at', [$start, $end])
            ->tap(fn ($query) => $this->applyPaymentFilters($query, $filters))
            ->select([
                'payments.paid_at',
                'payments.method',
                'payments.reference',
                'payments.amount_cents',
                'payments.status as payment_status',
                'invoices.invoice_number',
                'invoices.patient_name',
                'payments.cash_session_id',
                'registers.name as cash_register_name',
                'registers.code as cash_register_code',
                'collectors.name as cashier_name',
            ])
            ->orderByDesc('payments.paid_at')
            ->orderByDesc('payments.id')
            ->when(! $completeExport, fn (Builder $query) => $query->limit(self::MAX_TABLE_ROWS))
            ->get();

        return $rows->map(fn (object $row): array => [
            'paid_at' => $row->paid_at,
            'invoice_number' => (string) $row->invoice_number,
            'patient' => (string) $row->patient_name,
            'cash_session_id' => $row->cash_session_id !== null ? (int) $row->cash_session_id : null,
            'cash_session_label' => $this->cashSessionLabel($row->cash_register_name, $row->cash_register_code, $row->cash_session_id),
            'cashier' => $this->nullableString($row->cashier_name),
            'method' => (string) $row->method,
            'method_label' => $this->paymentMethodLabel($row->method),
            'reference' => $this->nullableString($row->reference),
            'amount' => $this->centsToMoney((int) $row->amount_cents),
            'status' => (string) $row->payment_status,
            'status_label' => $row->payment_status === Payment::STATUS_VOID ? 'Reversado' : 'Cobrado',
        ])->all();
    }

    /**
     * Gratuidades por linea (cantidad entregada sin cobro, nunca unidades cobradas).
     *
     * @param  array<string, mixed>  $filters
     * @return array<int, array<string, mixed>>
     */
    private function gratuities(Carbon $start, Carbon $end, array $filters, bool $completeExport): array
    {
        $rows = DB::table('invoice_items')
            ->join('invoices', 'invoice_items.invoice_id', '=', 'invoices.id')
            ->where('invoice_items.special_rule_applied', true)
            ->whereBetween('invoices.issued_at', [$start, $end])
            ->tap(fn ($query) => $this->applyInvoiceFilters($query, $filters, $start, $end))
            ->select([
                'invoices.invoice_number',
                'invoices.patient_name',
                'invoices.issued_at',
                'invoices.settlement',
                'invoice_items.service_name',
                'invoice_items.category_name',
                'invoice_items.quantity_cents',
                'invoice_items.unit_price_cents',
                'invoice_items.unit_price_registered_cents',
                'invoice_items.rule_adjustment_cents',
                'invoice_items.line_total_cents',
                'invoice_items.special_rule_code',
            ])
            ->orderByDesc('invoices.issued_at')
            ->orderBy('invoices.id')
            ->when(! $completeExport, fn (Builder $query) => $query->limit(self::MAX_TABLE_ROWS))
            ->get();

        return $rows->map(function (object $row): array {
            $registeredCents = $this->nullableInt($row->unit_price_registered_cents ?? null);
            $effectiveCents = $this->nullableInt($row->unit_price_cents ?? null);
            $adjustmentCents = $this->nullableInt($row->rule_adjustment_cents ?? null);
            // La consulta ya filtro `special_rule_applied = true`: cada fila es
            // una gratuidad. La procedencia del ajuste sale de la evidencia de
            // la linea; un historico backfilleado queda como no registrado.
            $adjustmentRecorded = LineRuleProvenance::adjustmentRecorded(true, $registeredCents, $effectiveCents);
            if ($adjustmentRecorded) {
                $this->gratuityAdjustmentPersisted = true;
            }

            return [
                'date' => $row->issued_at,
                'invoice_number' => (string) $row->invoice_number,
                'patient' => (string) $row->patient_name,
                'service' => (string) $row->service_name,
                'category' => $this->nullableString($row->category_name),
                'quantity' => $this->centsToMoney((int) $row->quantity_cents),
                'unit_price' => $this->centsToMoney($registeredCents ?? (int) $row->unit_price_cents),
                'line_total' => $this->centsToMoney((int) $row->line_total_cents),
                'adjustment_value' => $this->centsToMoney($adjustmentCents ?? 0),
                'adjustment_persisted' => $adjustmentRecorded,
                'rule_code' => $this->nullableString($row->special_rule_code),
                'reason' => $this->ruleLabel($row->special_rule_code),
                'settlement' => (string) $row->settlement,
            ];
        })->all();
    }

    /**
     * @param  array<int, array<string, mixed>>  $gratuities
     */
    private function sumGratuityAdjustmentCents(array $gratuities): int
    {
        $total = 0;
        foreach ($gratuities as $row) {
            if (($row['adjustment_persisted'] ?? false) === true) {
                $total += $this->moneyToCents($row['adjustment_value'] ?? '0.00');
            }
        }

        return $total;
    }

    private function cashSessionLabel(mixed $registerName, mixed $registerCode, mixed $sessionId): ?string
    {
        $name = $this->nullableString($registerName);
        $code = $this->nullableString($registerCode);
        $label = $name !== null && $name !== ''
            ? $name.($code !== null && $code !== '' ? ' ('.$code.')' : '')
            : ($code !== null && $code !== '' ? $code : null);

        if ($label !== null) {
            return $label;
        }

        return $sessionId !== null ? 'Sesion #'.(int) $sessionId : null;
    }

    private function invoiceStatusLabel(mixed $status, mixed $settlement): string
    {
        if ($status === Invoice::STATUS_VOID) {
            return 'Anulada';
        }

        return match ($settlement) {
            Invoice::SETTLEMENT_FREE_BY_RULE => 'Emitida sin cobro (regla)',
            Invoice::SETTLEMENT_ZERO_PRICE => 'Emitida sin cobro (precio cero)',
            default => match ($status) {
                Invoice::STATUS_PAID => 'Pagada',
                Invoice::STATUS_PARTIAL => 'Parcial',
                Invoice::STATUS_ISSUED => 'Pendiente de cobro',
                default => $this->nullableString($status) ?? 'Desconocido',
            },
        };
    }

    private function settlementLabel(mixed $settlement): string
    {
        return match ($settlement) {
            Invoice::SETTLEMENT_PAID => 'Cobrada',
            Invoice::SETTLEMENT_FREE_BY_RULE => 'Gratuita por regla',
            Invoice::SETTLEMENT_ZERO_PRICE => 'Precio cero',
            default => 'Pendiente de cobro',
        };
    }

    private function paymentMethodLabel(mixed $method): string
    {
        return match ($method) {
            Payment::METHOD_CASH => 'Efectivo',
            Payment::METHOD_TRANSFER => 'Transferencia',
            Payment::METHOD_CARD => 'Tarjeta',
            Payment::METHOD_OTHER => 'Otro',
            default => $this->nullableString($method) ?? 'Otro',
        };
    }

    private function ruleLabel(mixed $ruleCode): string
    {
        return match ($ruleCode) {
            Service::ERYTHROPOIETIN_RULE => 'Receta de dialisis (EPO por linea)',
            null, '' => 'Gratuidad por regla',
            default => (string) $ruleCode,
        };
    }

    private function nullableInt(mixed $value): ?int
    {
        if (is_int($value)) {
            return $value;
        }

        return is_string($value) && preg_match('/^-?\d+$/', $value) === 1 ? (int) $value : null;
    }

    /**
     * @param  array<string, mixed>  $filters
     * @return array<int, array<string, mixed>>
     */
    private function voidsAndReversals(Carbon $start, Carbon $end, array $filters): array
    {
        $voids = DB::table('invoices')
            ->leftJoin('users as issuer', 'invoices.issued_by', '=', 'issuer.id')
            ->leftJoin('users as voider', 'invoices.voided_by', '=', 'voider.id')
            ->where('invoices.status', Invoice::STATUS_VOID)
            ->whereBetween('invoices.voided_at', [$start, $end])
            ->tap(fn ($query) => $this->applyInvoiceFilters($query, $filters, $start, $end))
            ->select(
                'invoices.invoice_number',
                'invoices.patient_name as patient',
                'invoices.total_cents',
                'invoices.void_reason as reason',
                'invoices.voided_at as created_at',
                'issuer.name as issuer_name',
                'voider.name as authorizer_name',
            )
            ->get()
            ->map(fn (object $row): array => [
                'kind' => 'void',
                'invoice_number' => $row->invoice_number,
                'patient' => $row->patient,
                'amount' => $this->centsToMoney($row->total_cents),
                'reason' => $row->reason,
                'user' => $row->issuer_name,
                'authorized_by' => $row->authorizer_name,
                'created_at' => $row->created_at,
            ])
            ->all();

        $reversals = DB::table('audit_logs')
            ->join('invoices', function ($join): void {
                $join->on('audit_logs.entity_id', '=', 'invoices.id')
                    ->where('audit_logs.entity_type', Invoice::class);
            })
            ->leftJoin('users', 'audit_logs.user_id', '=', 'users.id')
            ->where('audit_logs.action', 'invoice.reversed')
            ->whereBetween('audit_logs.created_at', [$start, $end])
            ->tap(fn ($query) => $this->applyInvoiceFilters($query, $filters, $start, $end))
            ->select(
                'audit_logs.entity_id as invoice_id',
                'audit_logs.reason',
                'audit_logs.created_at',
                'users.name as user_name',
                'audit_logs.new_values',
            )
            ->get()
            ->map(function (object $row): array {
                $decodedValues = is_string($row->new_values) ? json_decode($row->new_values, true) : $row->new_values;
                $newValues = is_array($decodedValues) ? $decodedValues : [];
                $invoiceNumber = $this->stringValue(
                    $newValues['invoice_number'] ?? null,
                    '#'.$this->countValue($row->invoice_id),
                );

                return [
                    'kind' => 'reversal',
                    'invoice_number' => $invoiceNumber,
                    'patient' => $this->nullableString($newValues['patient_name'] ?? null),
                    'amount' => $this->moneyString($newValues['total'] ?? null),
                    'reason' => $row->reason,
                    'user' => $row->user_name,
                    'authorized_by' => $row->user_name,
                    'created_at' => $row->created_at,
                ];
            })
            ->all();

        $combined = array_merge($voids, $reversals);

        usort($combined, fn (array $a, array $b): int => strcmp((string) ($b['created_at'] ?? ''), (string) ($a['created_at'] ?? '')));

        return array_slice($combined, 0, 50);
    }

    /**
     * @param  array<string, mixed>  $filters
     * @return array<string, int>
     */
    private function auditSummary(Carbon $start, Carbon $end, array $filters): array
    {
        if (! $this->hasScopedFilters($filters)) {
            $counts = DB::table('audit_logs')
                ->whereBetween('created_at', [$start, $end])
                ->groupBy('action')
                ->select('action', DB::raw('COUNT(*) as cnt'))
                ->pluck('cnt', 'action')
                ->all();

            return [
                'critical_events' => $this->countValue($counts['invoice.voided'] ?? null) + $this->countValue($counts['invoice.reversed'] ?? null) + $this->countValue($counts['payment.voided'] ?? null),
                'reprints' => $this->countValue($counts['invoice.reprinted'] ?? null) + $this->institutionalReceiptReprintCount($start, $end, $filters),
                'fiscal_changes' => $this->countValue($counts['fiscal.settings.updated'] ?? null) + $this->countValue($counts['fiscal.sequence.updated'] ?? null),
                'cash_differences' => $this->countValue($counts['cash_session.closed_with_difference'] ?? null) + $this->countValue($counts['cash_session.difference'] ?? null),
                'backup_events' => $this->countValue($counts['backup.created'] ?? null) + $this->countValue($counts['backup.failed'] ?? null),
            ];
        }

        $invoiceAuditCounts = DB::table('audit_logs')
            ->join('invoices', function ($join): void {
                $join->on('audit_logs.entity_id', '=', 'invoices.id')
                    ->where('audit_logs.entity_type', Invoice::class);
            })
            ->whereBetween('audit_logs.created_at', [$start, $end])
            ->whereIn('audit_logs.action', ['invoice.voided', 'invoice.reversed', 'invoice.reprinted'])
            ->tap(fn ($query) => $this->applyInvoiceFilters($query, $filters, $start, $end))
            ->groupBy('audit_logs.action')
            ->select('audit_logs.action', DB::raw('COUNT(*) as cnt'))
            ->pluck('cnt', 'action')
            ->all();

        $paymentAuditCounts = DB::table('audit_logs')
            ->join('payments', function ($join): void {
                $join->on('audit_logs.entity_id', '=', 'payments.id')
                    ->where('audit_logs.entity_type', Payment::class);
            })
            ->join('invoices', 'payments.invoice_id', '=', 'invoices.id')
            ->whereBetween('audit_logs.created_at', [$start, $end])
            ->where('audit_logs.action', 'payment.voided')
            ->tap(fn ($query) => $this->applyPaymentFilters($query, $filters))
            ->groupBy('audit_logs.action')
            ->select('audit_logs.action', DB::raw('COUNT(*) as cnt'))
            ->pluck('cnt', 'action')
            ->all();

        $cashDifferenceCount = DB::table('audit_logs')
            ->join('cash_register_sessions', function ($join): void {
                $join->on('audit_logs.entity_id', '=', 'cash_register_sessions.id')
                    ->where('audit_logs.entity_type', CashRegisterSession::class);
            })
            ->whereBetween('audit_logs.created_at', [$start, $end])
            ->whereIn('audit_logs.action', ['cash_session.closed_with_difference', 'cash_session.difference'])
            ->when(! empty($filters['user_id']), function ($query) use ($filters): void {
                $query->where('cash_register_sessions.user_id', $filters['user_id']);
            })
            ->when(! empty($filters['cash_session_id']), function ($query) use ($filters): void {
                $query->where('cash_register_sessions.id', $filters['cash_session_id']);
            })
            ->count();

        return [
            'critical_events' => $this->countValue($invoiceAuditCounts['invoice.voided'] ?? null) + $this->countValue($invoiceAuditCounts['invoice.reversed'] ?? null) + $this->countValue($paymentAuditCounts['payment.voided'] ?? null),
            'reprints' => $this->countValue($invoiceAuditCounts['invoice.reprinted'] ?? null) + $this->institutionalReceiptReprintCount($start, $end, $filters),
            'fiscal_changes' => 0,
            'cash_differences' => (int) $cashDifferenceCount,
            'backup_events' => 0,
        ];
    }

    /**
     * @param  array<string, mixed>  $filters
     */
    private function institutionalReceiptReprintCount(Carbon $start, Carbon $end, array $filters): int
    {
        $query = DB::table('institutional_receipt_print_events')
            ->where('institutional_receipt_print_events.event_type', InstitutionalReceiptPrintEvent::TYPE_REPRINT)
            ->whereBetween('institutional_receipt_print_events.created_at', [$start, $end]);

        if ($this->hasScopedFilters($filters)) {
            $query
                ->join('institutional_receipts', 'institutional_receipt_print_events.institutional_receipt_id', '=', 'institutional_receipts.id')
                ->join('invoices', 'institutional_receipts.invoice_id', '=', 'invoices.id')
                ->tap(fn ($query) => $this->applyInvoiceFilters($query, $filters, $start, $end));
        }

        return (int) $query->count();
    }

    /**
     * @return array<string, int>
     */
    private function emptyAuditSummary(): array
    {
        return [
            'critical_events' => 0,
            'reprints' => 0,
            'fiscal_changes' => 0,
            'cash_differences' => 0,
            'backup_events' => 0,
        ];
    }

    /**
     * @param  array<string, mixed>  $filters
     * @return array<string, array<string, mixed>>
     */
    private function comparison(Carbon $start, Carbon $end, array $filters): array
    {
        $days = $this->inclusiveDays($start, $end);
        $previousEnd = $start->copy()->subDay()->endOfDay();
        $previousStart = $previousEnd->copy()->subDays($days - 1)->startOfDay();

        $currentFacts = $this->financialFacts->forRange($start, $end, $filters);
        $previousFacts = $this->financialFacts->forRange($previousStart, $previousEnd, $filters);

        $currentBilledCents = $this->moneyToCents($currentFacts['total_billed']);
        $previousBilledCents = $this->moneyToCents($previousFacts['total_billed']);
        $currentCollectedCents = $this->moneyToCents($currentFacts['total_collected']);
        $previousCollectedCents = $this->moneyToCents($previousFacts['total_collected']);

        return [
            'billed' => [
                'current' => $currentFacts['total_billed'],
                'previous' => $previousFacts['total_billed'],
                'delta_cents' => $currentBilledCents - $previousBilledCents,
                'delta_percentage' => $previousBilledCents > 0
                    ? round((($currentBilledCents - $previousBilledCents) / $previousBilledCents) * 100, 2)
                    : null,
            ],
            'collected' => [
                'current' => $currentFacts['total_collected'],
                'previous' => $previousFacts['total_collected'],
                'delta_cents' => $currentCollectedCents - $previousCollectedCents,
                'delta_percentage' => $previousCollectedCents > 0
                    ? round((($currentCollectedCents - $previousCollectedCents) / $previousCollectedCents) * 100, 2)
                    : null,
            ],
            'previous_period' => [
                'from' => $previousStart->toDateString(),
                'to' => $previousEnd->toDateString(),
            ],
        ];
    }

    private function inclusiveDays(Carbon $start, Carbon $end): int
    {
        return (int) round($start->copy()->startOfDay()->diffInDays($end->copy()->startOfDay())) + 1;
    }

    /** @param array<string, mixed> $filters */
    private function reversedTotalCents(Carbon $start, Carbon $end, array $filters): int
    {
        return (int) DB::table('payments')
            ->join('invoices', 'payments.invoice_id', '=', 'invoices.id')
            ->where('payments.status', Payment::STATUS_VOID)
            ->whereBetween('payments.voided_at', [$start, $end])
            ->tap(fn ($query) => $this->applyPaymentFilters($query, $filters))
            ->sum('payments.amount_cents');
    }

    /**
     * @param  array<string, mixed>  $filters
     */
    private function hasScopedFilters(array $filters): bool
    {
        foreach (['user_id', 'cash_session_id', 'category_id', 'area_id', 'method', 'status'] as $key) {
            if (! empty($filters[$key])) {
                return true;
            }
        }

        return false;
    }

    /**
     * @param  array<string, mixed>  $filters
     */
    private function applyInvoiceFilters(Builder $query, array $filters, ?Carbon $paymentStart = null, ?Carbon $paymentEnd = null): void
    {
        $query
            ->when(! empty($filters['user_id']), function ($query) use ($filters): void {
                $query->where('invoices.issued_by', $filters['user_id']);
            })
            ->when(! empty($filters['cash_session_id']), function ($query) use ($filters): void {
                $query->where('invoices.cash_session_id', $filters['cash_session_id']);
            })
            ->when(! empty($filters['status']), function ($query) use ($filters): void {
                $query->where('invoices.status', $filters['status']);
            })
            ->when(! empty($filters['category_id']), function ($query) use ($filters): void {
                $query->whereExists(function ($subquery) use ($filters): void {
                    $subquery
                        ->selectRaw('1')
                        ->from('invoice_items')
                        ->whereColumn('invoice_items.invoice_id', 'invoices.id')
                        ->where('invoice_items.category_id', $filters['category_id']);
                });
            })
            ->when(! empty($filters['area_id']), function ($query) use ($filters): void {
                $query->whereExists(function ($subquery) use ($filters): void {
                    $subquery
                        ->selectRaw('1')
                        ->from('invoice_items')
                        ->whereColumn('invoice_items.invoice_id', 'invoices.id')
                        ->where('invoice_items.area_id', $filters['area_id']);
                });
            })
            ->when(! empty($filters['method']), function ($query) use ($filters, $paymentStart, $paymentEnd): void {
                $query->whereExists(function ($subquery) use ($filters, $paymentStart, $paymentEnd): void {
                    $subquery
                        ->selectRaw('1')
                        ->from('payments')
                        ->whereColumn('payments.invoice_id', 'invoices.id')
                        ->where('payments.status', Payment::STATUS_POSTED)
                        ->where('payments.method', $filters['method'])
                        ->when($paymentStart !== null && $paymentEnd !== null, function ($paymentQuery) use ($paymentStart, $paymentEnd): void {
                            $paymentQuery->whereBetween('payments.paid_at', [$paymentStart, $paymentEnd]);
                        });
                });
            });
    }

    /**
     * @param  array<string, mixed>  $filters
     */
    private function applyPaymentFilters(Builder $query, array $filters): void
    {
        $query
            ->when(! empty($filters['user_id']), function ($query) use ($filters): void {
                $query->where('payments.user_id', $filters['user_id']);
            })
            ->when(! empty($filters['cash_session_id']), function ($query) use ($filters): void {
                $query->where('payments.cash_session_id', $filters['cash_session_id']);
            })
            ->when(! empty($filters['method']), function ($query) use ($filters): void {
                $query->where('payments.method', $filters['method']);
            })
            ->when(! empty($filters['status']), function ($query) use ($filters): void {
                $query->where('invoices.status', $filters['status']);
            })
            ->when(! empty($filters['category_id']), function ($query) use ($filters): void {
                $query->whereExists(function ($subquery) use ($filters): void {
                    $subquery
                        ->selectRaw('1')
                        ->from('invoice_items')
                        ->whereColumn('invoice_items.invoice_id', 'invoices.id')
                        ->where('invoice_items.category_id', $filters['category_id']);
                });
            })
            ->when(! empty($filters['area_id']), function ($query) use ($filters): void {
                $query->whereExists(function ($subquery) use ($filters): void {
                    $subquery
                        ->selectRaw('1')
                        ->from('invoice_items')
                        ->whereColumn('invoice_items.invoice_id', 'invoices.id')
                        ->where('invoice_items.area_id', $filters['area_id']);
                });
            });
    }

    private function signedCents(mixed $value): int
    {
        $raw = is_int($value) || is_string($value) ? (string) $value : '0';
        $sign = str_starts_with(trim($raw), '-') ? -1 : 1;
        $absolute = ltrim(trim($raw), '+-');

        return $sign * Money::parseCents($absolute, 'cash_session.amount');
    }

    private function countValue(mixed $value): int
    {
        if (is_int($value)) {
            return max(0, $value);
        }

        return is_string($value) && ctype_digit($value) ? (int) $value : 0;
    }

    private function signedIntegerValue(mixed $value): int
    {
        if (is_int($value)) {
            return $value;
        }

        return is_string($value) && preg_match('/^[+-]?\d+$/', $value) === 1 ? (int) $value : 0;
    }

    private function monetaryValue(mixed $value): int|string|null
    {
        return is_int($value) || (is_string($value) && is_numeric($value)) ? $value : null;
    }

    private function nullableString(mixed $value): ?string
    {
        return is_string($value) ? $value : null;
    }

    private function stringValue(mixed $value, string $default = ''): string
    {
        return $this->nullableString($value) ?? $default;
    }

    private function moneyString(mixed $value): string
    {
        return is_string($value) && is_numeric($value) ? $value : '0.00';
    }
}
