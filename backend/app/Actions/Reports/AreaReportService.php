<?php

namespace App\Actions\Reports;

use App\Actions\Reports\Concerns\FormatsReportMoney;
use App\Actions\Reports\Concerns\NormalizesReportFilters;
use App\Models\Invoice;
use App\Models\Payment;
use Illuminate\Support\Facades\DB;

class AreaReportService
{
    use FormatsReportMoney, NormalizesReportFilters;

    /**
     * @param  array{date_from: string, date_to: string, cash_session_id?: int|string, user_id?: int|string, category_id?: int|string, area_id?: int|string, method?: string, status?: string}  $filters
     * @return array<string, mixed>
     */
    public function report(array $filters): array
    {
        $filters = $this->normalizeReportFilters($filters);

        $start = ReportDate::day($filters['date_from'])->startOfDay();
        $end = ReportDate::day($filters['date_to'])->endOfDay();
        $usesPaymentScope = ! empty($filters['cash_session_id'])
            || ! empty($filters['user_id'])
            || ! empty($filters['method']);

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

        $rows = DB::table('invoice_items')
            ->join('invoices', 'invoice_items.invoice_id', '=', 'invoices.id')
            ->when($usesPaymentScope, function ($query) use ($paymentTotals): void {
                $query->joinSub($paymentTotals, 'payment_totals', function ($join): void {
                    $join->on('payment_totals.invoice_id', '=', 'invoices.id');
                });
            }, function ($query) use ($paymentTotals): void {
                $query->leftJoinSub($paymentTotals, 'payment_totals', function ($join): void {
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
            ->whereBetween('invoices.issued_at', [$start, $end])
            ->when(! empty($filters['category_id']), function ($query) use ($filters): void {
                $query->where('invoice_items.category_id', $filters['category_id']);
            })
            ->when(! empty($filters['area_id']), function ($query) use ($filters): void {
                $query->where('invoice_items.service_area_id', $filters['area_id']);
            })
            ->groupBy('invoice_items.service_area_id', 'invoice_items.service_area_name')
            ->orderBy('invoice_items.service_area_name')
            ->select('invoice_items.service_area_id', 'invoice_items.service_area_name')
            ->selectRaw('COUNT(*) as item_count')
            ->selectRaw('COUNT(DISTINCT invoices.id) as invoice_count')
            ->selectRaw('COALESCE(SUM(invoice_items.quantity_cents), 0) as quantity_cents')
            ->selectRaw('COALESCE(SUM(invoice_items.line_subtotal_cents), 0) as subtotal_cents')
            ->selectRaw('COALESCE(SUM(invoice_items.tax_amount_cents), 0) as tax_cents')
            ->selectRaw('COALESCE(SUM(invoice_items.line_total_cents), 0) as total_cents')
            ->selectRaw('COALESCE(SUM(ROUND(invoice_items.line_total_cents * COALESCE(payment_totals.collected_cents, 0) / NULLIF(invoices.total_cents, 0))), 0) as collected_cents')
            ->get()
            ->map(function (object $row): array {
                $totalCents = (int) $row->total_cents;
                $collectedCents = min($totalCents, (int) $row->collected_cents);

                return [
                    'area_id' => $row->service_area_id !== null ? (int) $row->service_area_id : null,
                    'area' => $row->service_area_name ?? 'Sin área',
                    'item_count' => (int) $row->item_count,
                    'invoice_count' => (int) $row->invoice_count,
                    'quantity' => $this->centsToMoney($row->quantity_cents),
                    'subtotal' => $this->centsToMoney($row->subtotal_cents),
                    'tax_amount' => $this->centsToMoney($row->tax_cents),
                    'total' => $this->centsToMoney($totalCents),
                    'collected' => $this->centsToMoney($collectedCents),
                    'balance_due' => $this->centsToMoney(max(0, $totalCents - $collectedCents)),
                ];
            })
            ->values()
            ->all();

        return [
            'date_from' => $filters['date_from'],
            'date_to' => $filters['date_to'],
            'filters' => [
                'cash_session_id' => $filters['cash_session_id'] ?? null,
                'user_id' => $filters['user_id'] ?? null,
                'category_id' => $filters['category_id'] ?? null,
                'area_id' => $filters['area_id'] ?? null,
                'method' => $filters['method'] ?? null,
                'status' => $filters['status'] ?? null,
            ],
            'areas' => $rows,
        ];
    }
}
