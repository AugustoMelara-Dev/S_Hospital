<?php

namespace App\Actions\Reports;

use App\Actions\Reports\Concerns\FormatsReportMoney;
use App\Models\CashRegisterSession;
use App\Models\InstitutionalReceiptPrintEvent;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\User;
use App\Support\Money;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
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

    public function __construct(private readonly FinancialFactsService $financialFacts) {}

    /**
     * @param  array{date_from: string, date_to: string, cash_session_id?: int|string, user_id?: int|string, category_id?: int|string, area_id?: int|string, method?: string, status?: string}  $filters
     * @return array<string, mixed>
     */
    public function report(array $filters, ?User $requester = null): array
    {
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

        return [
            'period' => [
                'from' => $start->toDateString(),
                'to' => $end->toDateString(),
                'timezone' => self::HOSPITAL_TIMEZONE,
                'days' => $start->diffInDays($end) + 1,
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
            'voids_and_reversals' => $voidsAndReversals,
            'audit_summary' => $auditSummary,
            'can_view_audit' => $canViewAudit,
        ];
    }

    /**
     * @param  array<string, mixed>  $filters
     * @param  array<string, mixed>  $facts
     * @return array<string, mixed>
     */
    private function summary(Carbon $start, Carbon $end, array $filters, array $facts): array
    {
        $billedCents = $this->moneyToCents($facts['total_billed']);
        $collectedCents = $this->moneyToCents($facts['total_collected']);
        $pendingCents = $this->moneyToCents($facts['total_pending']);
        $voidedStats = $this->voidedInvoiceStats($start, $end, $filters);
        $voidedCents = $voidedStats['total_cents'];

        $invoiceCount = (int) ($facts['invoice_count'] ?? 0);
        $receiptCount = (int) DB::table('payments')
            ->join('invoices', 'payments.invoice_id', '=', 'invoices.id')
            ->where('payments.status', Payment::STATUS_POSTED)
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
        $paidCount = (int) ($statusCounts[Invoice::STATUS_PAID] ?? 0);
        $partialCount = (int) ($statusCounts[Invoice::STATUS_PARTIAL] ?? 0);
        $pendingCount = (int) ($statusCounts[Invoice::STATUS_ISSUED] ?? 0) + $partialCount;
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
     * @param  array<string, mixed>  $facts
     * @return array<int, array<string, mixed>>
     */
    private function paymentMethods(Carbon $start, Carbon $end, array $filters, array $facts, int $totalCollectedCents): array
    {
        $methodTotals = $facts['payments_by_method'] ?? $this->zeroMethodTotals();
        $methodCount = (array) DB::table('payments')
            ->join('invoices', 'payments.invoice_id', '=', 'invoices.id')
            ->where('payments.status', Payment::STATUS_POSTED)
            ->where('invoices.status', '!=', Invoice::STATUS_VOID)
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
                'count' => (int) ($methodCount[$key] ?? 0),
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
                'invoice_count' => (int) ($dayFacts['invoice_count'] ?? 0),
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
        $paymentTotals = DB::table('payments')
            ->join('invoices', 'payments.invoice_id', '=', 'invoices.id')
            ->where('payments.status', Payment::STATUS_POSTED)
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
            ->whereBetween('invoices.issued_at', [$start, $end])
            ->tap(fn ($query) => $this->applyInvoiceFilters($query, $filters, $start, $end))
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
                'quantity' => $this->centsToMoney($items->sum('quantity_cents')),
                'total' => $this->centsToMoney($items->sum('total_cents')),
                'collected' => $this->centsToMoney($items->sum('collected_cents')),
                'item_count' => (int) $items->sum('item_count'),
            ])
            ->values()
            ->sortByDesc(fn (array $row): int => $this->moneyToCents($row['total']))
            ->take(10)
            ->all();

        $areaRows = DB::table('invoice_items')
            ->join('invoices', 'invoice_items.invoice_id', '=', 'invoices.id')
            ->where('invoices.status', '!=', Invoice::STATUS_VOID)
            ->whereBetween('invoices.issued_at', [$start, $end])
            ->tap(fn ($query) => $this->applyInvoiceFilters($query, $filters, $start, $end))
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
            $diffCents = (int) ($diffByUser[$row->user_id] ?? 0);
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
                'voided_count' => (int) ($voidedByUser[$row->user_id] ?? 0),
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
            ->with('user')
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
                    'cashier' => $session->user->name ?: 'Sin cajero',
                    'opened_at' => $session->opened_at?->toIso8601String(),
                    'closed_at' => $session->closed_at?->toIso8601String(),
                    'opening_amount' => $this->centsToMoney($openingCents),
                    'expected_cash' => $this->centsToMoney($expectedCents),
                    'counted_cash' => $session->closing_amount !== null ? $this->centsToMoney($countedCents) : null,
                    'difference' => $session->difference_amount !== null ? $this->centsToMoney($diffCents) : null,
                    'status' => $session->status,
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
                $newValues = is_string($row->new_values) ? json_decode($row->new_values, true) : (array) $row->new_values;
                $invoiceNumber = $newValues['invoice_number'] ?? ('#'.((int) $row->invoice_id));

                return [
                    'kind' => 'reversal',
                    'invoice_number' => $invoiceNumber,
                    'patient' => $newValues['patient_name'] ?? null,
                    'amount' => isset($newValues['total']) ? (string) $newValues['total'] : '0.00',
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
                'critical_events' => (int) ($counts['invoice.voided'] ?? 0) + (int) ($counts['invoice.reversed'] ?? 0) + (int) ($counts['payment.voided'] ?? 0),
                'reprints' => (int) ($counts['invoice.reprinted'] ?? 0) + $this->institutionalReceiptReprintCount($start, $end, $filters),
                'fiscal_changes' => (int) ($counts['fiscal.settings.updated'] ?? 0) + (int) ($counts['fiscal.sequence.updated'] ?? 0),
                'cash_differences' => (int) ($counts['cash_session.closed_with_difference'] ?? 0) + (int) ($counts['cash_session.difference'] ?? 0),
                'backup_events' => (int) ($counts['backup.created'] ?? 0) + (int) ($counts['backup.failed'] ?? 0),
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
            'critical_events' => (int) ($invoiceAuditCounts['invoice.voided'] ?? 0) + (int) ($invoiceAuditCounts['invoice.reversed'] ?? 0) + (int) ($paymentAuditCounts['payment.voided'] ?? 0),
            'reprints' => (int) ($invoiceAuditCounts['invoice.reprinted'] ?? 0) + $this->institutionalReceiptReprintCount($start, $end, $filters),
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
        $days = $start->diffInDays($end) + 1;
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
    private function applyInvoiceFilters(mixed $query, array $filters, ?Carbon $paymentStart = null, ?Carbon $paymentEnd = null): void
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
    private function applyPaymentFilters(mixed $query, array $filters): void
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
        $raw = (string) ($value ?? '0');
        $sign = str_starts_with(trim($raw), '-') ? -1 : 1;
        $absolute = ltrim(trim($raw), '+-');

        return $sign * Money::parseCents($absolute, 'cash_session.amount');
    }
}
