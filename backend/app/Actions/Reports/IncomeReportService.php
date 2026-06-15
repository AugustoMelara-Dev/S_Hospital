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

    public function __construct(private readonly FinancialFactsService $financialFacts) {}

    public function report(array $filters): array
    {
        $start = Carbon::createFromFormat('Y-m-d', $filters['date_from'])->startOfDay();
        $end = Carbon::createFromFormat('Y-m-d', $filters['date_to'])->endOfDay();
        $facts = $this->financialFacts->forRange($start, $end, $filters);

        return [
            'date_from' => $filters['date_from'],
            'date_to' => $filters['date_to'],
            'cash_session_id' => $filters['cash_session_id'] ?? null,
            'user_id' => $filters['user_id'] ?? null,
            'filters' => [
                'cash_session_id' => $filters['cash_session_id'] ?? null,
                'user_id' => $filters['user_id'] ?? null,
                'category_id' => $filters['category_id'] ?? null,
                'area_id' => $filters['area_id'] ?? null,
                'method' => $filters['method'] ?? null,
                'status' => $filters['status'] ?? null,
            ],
            'total_billed' => $facts['total_billed'],
            'total_collected' => $facts['total_collected'],
            'total_pending' => $facts['total_pending'],
            'total_balance_due' => $facts['total_pending'],
            'total_partial' => $facts['total_partial'],
            'total_voided' => $facts['total_voided'],
            'payments_by_method' => $facts['payments_by_method'],
            'invoices_by_status' => $this->invoicesByStatus($start, $end, $filters),
            'payment_count' => (int) ($facts['payment_count'] ?? 0),
            'invoice_count' => $this->usesPaymentScope($filters)
                ? $this->paymentScopedInvoiceCount($start, $end, $filters)
                : (int) ($facts['invoice_count'] ?? 0),
        ];
    }

    /**
     * @param  array<string, mixed>  $filters
     */
    private function usesPaymentScope(array $filters): bool
    {
        return ! empty($filters['cash_session_id'])
            || ! empty($filters['user_id'])
            || ! empty($filters['method']);
    }

    /**
     * @param  array<string, mixed>  $filters
     */
    private function paymentScopedInvoiceCount(Carbon $start, Carbon $end, array $filters): int
    {
        return (int) Payment::query()
            ->join('invoices', 'payments.invoice_id', '=', 'invoices.id')
            ->where('payments.status', Payment::STATUS_POSTED)
            ->where('invoices.status', '!=', Invoice::STATUS_VOID)
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
            ->when(! empty($filters['status']) && $filters['status'] !== Invoice::STATUS_VOID, function (Builder $query) use ($filters): void {
                $query->where('invoices.status', $filters['status']);
            })
            ->when(($filters['status'] ?? null) === Invoice::STATUS_VOID, function (Builder $query): void {
                $query->whereRaw('1 = 0');
            })
            ->when(! empty($filters['category_id']), function (Builder $query) use ($filters): void {
                $query->whereExists(function ($subquery) use ($filters): void {
                    $subquery
                        ->selectRaw('1')
                        ->from('invoice_items')
                        ->whereColumn('invoice_items.invoice_id', 'invoices.id')
                        ->where('invoice_items.category_id', $filters['category_id']);
                });
            })
            ->when(! empty($filters['area_id']), function (Builder $query) use ($filters): void {
                $query->whereExists(function ($subquery) use ($filters): void {
                    $subquery
                        ->selectRaw('1')
                        ->from('invoice_items')
                        ->whereColumn('invoice_items.invoice_id', 'invoices.id')
                        ->where('invoice_items.area_id', $filters['area_id']);
                });
            })
            ->distinct('payments.invoice_id')
            ->count('payments.invoice_id');
    }

    /**
     * @param  array<string, mixed>  $filters
     * @return array<string, array{count: int, total: string}>
     */
    private function invoicesByStatus(Carbon $start, Carbon $end, array $filters): array
    {
        $statuses = collect([
            Invoice::STATUS_ISSUED,
            Invoice::STATUS_PARTIAL,
            Invoice::STATUS_PAID,
            Invoice::STATUS_VOID,
        ])->mapWithKeys(fn (string $status): array => [
            $status => ['count' => 0, 'total' => '0.00'],
        ])->all();

        Invoice::query()
            ->whereBetween('issued_at', [$start, $end])
            ->when(! empty($filters['user_id']), function (Builder $query) use ($filters): void {
                $query->where('issued_by', $filters['user_id']);
            })
            ->when(! empty($filters['cash_session_id']), function (Builder $query) use ($filters): void {
                $query->where('cash_session_id', $filters['cash_session_id']);
            })
            ->when(! empty($filters['status']), function (Builder $query) use ($filters): void {
                $query->where('status', $filters['status']);
            })
            ->when(! empty($filters['method']), function (Builder $query) use ($filters, $start, $end): void {
                $query->whereExists(function ($subquery) use ($filters, $start, $end): void {
                    $subquery
                        ->selectRaw('1')
                        ->from('payments')
                        ->whereColumn('payments.invoice_id', 'invoices.id')
                        ->where('payments.status', Payment::STATUS_POSTED)
                        ->where('payments.method', $filters['method'])
                        ->whereBetween('payments.paid_at', [$start, $end]);
                });
            })
            ->when(! empty($filters['category_id']), function (Builder $query) use ($filters): void {
                $query->whereExists(function ($subquery) use ($filters): void {
                    $subquery
                        ->selectRaw('1')
                        ->from('invoice_items')
                        ->whereColumn('invoice_items.invoice_id', 'invoices.id')
                        ->where('invoice_items.category_id', $filters['category_id']);
                });
            })
            ->when(! empty($filters['area_id']), function (Builder $query) use ($filters): void {
                $query->whereExists(function ($subquery) use ($filters): void {
                    $subquery
                        ->selectRaw('1')
                        ->from('invoice_items')
                        ->whereColumn('invoice_items.invoice_id', 'invoices.id')
                        ->where('invoice_items.area_id', $filters['area_id']);
                });
            })
            ->groupBy('status')
            ->select('status', DB::raw('COUNT(*) as count'), DB::raw('COALESCE(SUM(total_cents), 0) as total_cents'))
            ->get()
            ->each(function (object $row) use (&$statuses): void {
                /** @var object{status: string, count: int|string, total_cents: int|string} $row */
                $statuses[$row->status] = [
                    'count' => (int) $row->count,
                    'total' => $this->centsToMoney($row->total_cents),
                ];
            });

        return $statuses;
    }
}
