<?php

namespace App\Actions\Reports;

use App\Actions\Reports\Concerns\FormatsReportMoney;
use App\Models\Invoice;
use App\Models\Payment;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Carbon;

class IncomeReportService
{
    use FormatsReportMoney;

    public function report(array $filters): array
    {
        $start = Carbon::createFromFormat('Y-m-d', $filters['date_from'])->startOfDay();
        $end = Carbon::createFromFormat('Y-m-d', $filters['date_to'])->endOfDay();

        $base = Payment::query()
            ->join('invoices', 'payments.invoice_id', '=', 'invoices.id')
            ->where('payments.status', Payment::STATUS_POSTED)
            ->where('invoices.status', '!=', Invoice::STATUS_VOID)
            ->when(! empty($filters['status']) && $filters['status'] !== Invoice::STATUS_VOID, function (Builder $query) use ($filters): void {
                $query->where('invoices.status', $filters['status']);
            })
            ->when(($filters['status'] ?? null) === Invoice::STATUS_VOID, function (Builder $query): void {
                $query->whereRaw('1 = 0');
            })
            ->whereBetween('payments.paid_at', [$start, $end])
            ->when(! empty($filters['cash_session_id']), function (Builder $query) use ($filters): void {
                $query->where('payments.cash_session_id', $filters['cash_session_id']);
            })
            ->when(! empty($filters['user_id']), function (Builder $query) use ($filters): void {
                $query->where('payments.user_id', $filters['user_id']);
            })
            ->when(! empty($filters['method']), function (Builder $query) use ($filters): void {
                $query->where('payments.method', $filters['method']);
            })
            ->when(! empty($filters['category_id']), function (Builder $query) use ($filters): void {
                $query->whereExists(function ($subquery) use ($filters): void {
                    $subquery
                        ->selectRaw('1')
                        ->from('invoice_items')
                        ->whereColumn('invoice_items.invoice_id', 'invoices.id')
                        ->where('invoice_items.category_id', $filters['category_id']);
                });
            });

        $collectedExpression = ! empty($filters['category_id'])
            ? 'COALESCE(SUM(ROUND(payments.amount * 100 * (
                SELECT COALESCE(SUM(invoice_items.line_total), 0)
                FROM invoice_items
                WHERE invoice_items.invoice_id = invoices.id
                AND invoice_items.category_id = ?
            ) / NULLIF(invoices.total, 0))), 0) as collected_cents'
            : 'COALESCE(SUM(ROUND(payments.amount * 100)), 0) as collected_cents';
        $collectedBindings = ! empty($filters['category_id']) ? [$filters['category_id']] : [];

        $summary = (clone $base)
            ->selectRaw('COUNT(*) as payment_count')
            ->selectRaw('COUNT(DISTINCT payments.invoice_id) as invoice_count')
            ->selectRaw($collectedExpression, $collectedBindings)
            ->first();

        $methods = $this->zeroMethodTotals();
        (clone $base)
            ->groupBy('payments.method')
            ->select('payments.method')
            ->selectRaw(str_replace(' as collected_cents', ' as total_cents', $collectedExpression), $collectedBindings)
            ->get()
            ->each(function (object $row) use (&$methods): void {
                if (array_key_exists($row->method, $methods)) {
                    $methods[$row->method] = $this->centsToMoney($row->total_cents);
                }
            });

        $billedCents = Invoice::query()
            ->where('status', '!=', Invoice::STATUS_VOID)
            ->whereBetween('issued_at', [$start, $end])
            ->when(! empty($filters['user_id']), function (Builder $query) use ($filters): void {
                $query->where('user_id', $filters['user_id']);
            })
            ->when(! empty($filters['cash_session_id']), function (Builder $query) use ($filters): void {
                $query->where('cash_session_id', $filters['cash_session_id']);
            })
            ->selectRaw('COALESCE(SUM(ROUND(total * 100)), 0) as billed_cents')
            ->value('billed_cents');

        return [
            'date_from' => $filters['date_from'],
            'date_to' => $filters['date_to'],
            'cash_session_id' => $filters['cash_session_id'] ?? null,
            'user_id' => $filters['user_id'] ?? null,
            'filters' => [
                'cash_session_id' => $filters['cash_session_id'] ?? null,
                'user_id' => $filters['user_id'] ?? null,
                'category_id' => $filters['category_id'] ?? null,
                'method' => $filters['method'] ?? null,
                'status' => $filters['status'] ?? null,
            ],
            'total_billed' => $this->centsToMoney($billedCents),
            'total_collected' => $this->centsToMoney($summary?->collected_cents),
            'payments_by_method' => $methods,
            'payment_count' => (int) ($summary?->payment_count ?? 0),
            'invoice_count' => (int) ($summary?->invoice_count ?? 0),
        ];
    }
}
