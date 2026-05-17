<?php

namespace App\Actions\Reports;

use App\Actions\Reports\Concerns\FormatsReportMoney;
use App\Models\Invoice;
use App\Models\Payment;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

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
            ->whereBetween('payments.paid_at', [$start, $end])
            ->when(! empty($filters['cash_session_id']), function (Builder $query) use ($filters): void {
                $query->where('payments.cash_session_id', $filters['cash_session_id']);
            })
            ->when(! empty($filters['user_id']), function (Builder $query) use ($filters): void {
                $query->where('payments.user_id', $filters['user_id']);
            });

        $summary = (clone $base)
            ->selectRaw('COUNT(*) as payment_count')
            ->selectRaw('COUNT(DISTINCT payments.invoice_id) as invoice_count')
            ->selectRaw('COALESCE(SUM(ROUND(payments.amount * 100)), 0) as collected_cents')
            ->first();

        $methods = $this->zeroMethodTotals();
        (clone $base)
            ->groupBy('payments.method')
            ->select('payments.method', DB::raw('COALESCE(SUM(ROUND(payments.amount * 100)), 0) as total_cents'))
            ->get()
            ->each(function (object $row) use (&$methods): void {
                if (array_key_exists($row->method, $methods)) {
                    $methods[$row->method] = $this->centsToMoney($row->total_cents);
                }
            });

        return [
            'date_from' => $filters['date_from'],
            'date_to' => $filters['date_to'],
            'cash_session_id' => $filters['cash_session_id'] ?? null,
            'user_id' => $filters['user_id'] ?? null,
            'total_collected' => $this->centsToMoney($summary?->collected_cents),
            'payments_by_method' => $methods,
            'payment_count' => (int) ($summary?->payment_count ?? 0),
            'invoice_count' => (int) ($summary?->invoice_count ?? 0),
        ];
    }
}
