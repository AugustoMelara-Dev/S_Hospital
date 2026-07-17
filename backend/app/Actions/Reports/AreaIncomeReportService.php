<?php

namespace App\Actions\Reports;

use App\Actions\Reports\Concerns\FormatsReportMoney;
use App\Actions\Reports\Concerns\NormalizesReportFilters;
use App\Models\Invoice;
use App\Models\Payment;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class AreaIncomeReportService
{
    use FormatsReportMoney, NormalizesReportFilters;

    /**
     * @param  array{date_from: string, date_to: string, cash_session_id?: int|string, user_id?: int|string, category_id?: int|string, area_id?: int|string, method?: string, status?: string}  $filters
     * @return array<string, mixed>
     */
    public function report(array $filters): array
    {
        $filters = $this->normalizeReportFilters($filters);

        $start = Carbon::createFromFormat('Y-m-d', $filters['date_from'])->startOfDay();
        $end = Carbon::createFromFormat('Y-m-d', $filters['date_to'])->endOfDay();
        $amountBasis = ReportAmountBasis::fromFilters($filters);
        $usesPaymentScope = $amountBasis === ReportAmountBasis::COLLECTED_PRORATED;

        $paymentTotals = DB::table('payments')
            ->join('invoices', 'payments.invoice_id', '=', 'invoices.id')
            ->where('payments.status', Payment::STATUS_POSTED)
            ->whereBetween('payments.paid_at', [$start, $end])
            ->when(! empty($filters['cash_session_id']), function ($query) use ($filters): void {
                $query->where('payments.cash_session_id', $filters['cash_session_id']);
            })
            ->when(! empty($filters['user_id']), function ($query) use ($filters): void {
                $query->where('payments.user_id', $filters['user_id']);
            })
            ->when(! empty($filters['method']), function ($query) use ($filters): void {
                $query->where('payments.method', $filters['method']);
            })
            ->groupBy('payments.invoice_id')
            ->select('payments.invoice_id')
            ->selectRaw('COALESCE(SUM(payments.amount_cents), 0) as collected_cents');

        $areas = DB::table('invoice_items')
            ->join('invoices', 'invoice_items.invoice_id', '=', 'invoices.id')
            ->when($usesPaymentScope, function ($query) use ($paymentTotals): void {
                $query->joinSub($paymentTotals, 'payment_totals', function ($join): void {
                    $join->on('payment_totals.invoice_id', '=', 'invoices.id');
                });
            })
            ->where('invoices.status', '!=', Invoice::STATUS_VOID)
            ->when(! empty($filters['status']) && $filters['status'] !== Invoice::STATUS_VOID, function ($query) use ($filters): void {
                $query->where('invoices.status', $filters['status']);
            })
            ->when(($filters['status'] ?? null) === Invoice::STATUS_VOID, function ($query): void {
                $query->whereRaw('1 = 0');
            })
            ->when(! $usesPaymentScope, function ($query) use ($start, $end): void {
                $query->whereBetween('invoices.issued_at', [$start, $end]);
            })
            ->when(! empty($filters['category_id']), function ($query) use ($filters): void {
                $query->where('invoice_items.category_id', $filters['category_id']);
            })
            ->when(! empty($filters['area_id']), function ($query) use ($filters): void {
                $query->where('invoice_items.area_id', $filters['area_id']);
            })
            ->groupBy('invoice_items.area_id', 'invoice_items.area_name')
            ->orderBy('invoice_items.area_name')
            ->select('invoice_items.area_id', 'invoice_items.area_name')
            ->selectRaw('COUNT(*) as item_count')
            ->selectRaw('COALESCE(SUM(invoice_items.quantity_cents), 0) as quantity_cents')
            ->selectRaw($usesPaymentScope
                ? 'COALESCE(SUM(ROUND(invoice_items.line_total_cents * payment_totals.collected_cents / NULLIF(invoices.total_cents, 0))), 0) as total_cents'
                : 'COALESCE(SUM(invoice_items.line_total_cents), 0) as total_cents')
            ->get()
            ->map(fn (object $row): array => [
                'area_id' => $row->area_id === null ? null : (int) $row->area_id,
                'area' => $row->area_name ?? 'Sin área',
                'item_count' => (int) $row->item_count,
                'quantity' => $this->centsToMoney($row->quantity_cents),
                'total' => $this->centsToMoney($row->total_cents),
            ])
            ->values()
            ->all();

        return [
            'date_from' => $filters['date_from'],
            'date_to' => $filters['date_to'],
            ...ReportAmountBasis::metadata($amountBasis),
            'filters' => [
                'cash_session_id' => $filters['cash_session_id'] ?? null,
                'user_id' => $filters['user_id'] ?? null,
                'category_id' => $filters['category_id'] ?? null,
                'area_id' => $filters['area_id'] ?? null,
                'method' => $filters['method'] ?? null,
                'status' => $filters['status'] ?? null,
            ],
            'areas' => $areas,
        ];
    }
}
