<?php

declare(strict_types=1);

namespace App\Actions\Reports;

use App\Actions\Reports\Concerns\FormatsReportMoney;
use App\Models\Invoice;
use App\Models\Payment;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class FinancialFactsService
{
    use FormatsReportMoney;

    /**
     * @param  array<string, mixed>  $filters
     * @return array<string, mixed>
     */
    public function forRange(Carbon $start, Carbon $end, array $filters = []): array
    {
        $invoiceFacts = $this->invoiceFacts($start, $end, $filters);
        $paymentFacts = $this->paymentFacts($start, $end, $filters);

        return [
            'total_billed' => $this->centsToMoney($invoiceFacts->billed_cents ?? 0),
            'total_pending' => $this->centsToMoney($invoiceFacts->pending_cents ?? 0),
            'total_partial' => $this->centsToMoney($invoiceFacts->partial_cents ?? 0),
            'total_voided' => $this->centsToMoney($invoiceFacts->voided_cents ?? 0),
            'invoice_count' => (int) ($invoiceFacts->invoice_count ?? 0),
            'payment_count' => (int) ($paymentFacts['payment_count'] ?? 0),
            'total_collected' => $this->centsToMoney($paymentFacts['collected_cents'] ?? 0),
            'payments_by_method' => $paymentFacts['payments_by_method'],
        ];
    }

    /**
     * @param  array<string, mixed>  $filters
     */
    private function invoiceFacts(Carbon $start, Carbon $end, array $filters): object
    {
        if ($this->usesPaymentScope($filters)) {
            return $this->paymentScopedInvoiceFacts($start, $end, $filters);
        }

        if ($this->hasItemFilter($filters)) {
            return $this->itemScopedInvoiceFacts($start, $end, $filters);
        }

        return Invoice::query()
            ->whereBetween('issued_at', [$start, $end])
            ->tap(fn (Builder $query) => $this->applyInvoiceFilters($query, $filters))
            ->selectRaw('COUNT(*) as invoice_count')
            ->selectRaw(
                'COALESCE(SUM(CASE WHEN status != ? THEN total_cents ELSE 0 END), 0) as billed_cents',
                [Invoice::STATUS_VOID],
            )
            ->selectRaw(
                'COALESCE(SUM(CASE WHEN status IN (?, ?) THEN balance_due_cents ELSE 0 END), 0) as pending_cents',
                [Invoice::STATUS_ISSUED, Invoice::STATUS_PARTIAL],
            )
            ->selectRaw(
                'COALESCE(SUM(CASE WHEN status = ? THEN total_cents ELSE 0 END), 0) as partial_cents',
                [Invoice::STATUS_PARTIAL],
            )
            ->selectRaw(
                'COALESCE(SUM(CASE WHEN status = ? THEN total_cents ELSE 0 END), 0) as voided_cents',
                [Invoice::STATUS_VOID],
            )
            ->first() ?? (object) [];
    }

    /**
     * @param  array<string, mixed>  $filters
     */
    private function paymentScopedInvoiceFacts(Carbon $start, Carbon $end, array $filters): object
    {
        if ($this->hasItemFilter($filters)) {
            return $this->paymentScopedItemInvoiceFacts($start, $end, $filters);
        }

        return Invoice::query()
            ->joinSub($this->paymentScopedInvoiceIdsSubquery($start, $end, $filters), 'payment_scope', function ($join): void {
                $join->on('payment_scope.invoice_id', '=', 'invoices.id');
            })
            ->whereBetween('invoices.issued_at', [$start, $end])
            ->selectRaw('COUNT(*) as invoice_count')
            ->selectRaw(
                'COALESCE(SUM(CASE WHEN invoices.status != ? THEN invoices.total_cents ELSE 0 END), 0) as billed_cents',
                [Invoice::STATUS_VOID],
            )
            ->selectRaw(
                'COALESCE(SUM(CASE WHEN invoices.status IN (?, ?) THEN invoices.balance_due_cents ELSE 0 END), 0) as pending_cents',
                [Invoice::STATUS_ISSUED, Invoice::STATUS_PARTIAL],
            )
            ->selectRaw(
                'COALESCE(SUM(CASE WHEN invoices.status = ? THEN invoices.total_cents ELSE 0 END), 0) as partial_cents',
                [Invoice::STATUS_PARTIAL],
            )
            ->selectRaw(
                'COALESCE(SUM(CASE WHEN invoices.status = ? THEN invoices.total_cents ELSE 0 END), 0) as voided_cents',
                [Invoice::STATUS_VOID],
            )
            ->first() ?? (object) [];
    }

    /**
     * @param  array<string, mixed>  $filters
     */
    private function paymentScopedItemInvoiceFacts(Carbon $start, Carbon $end, array $filters): object
    {
        return Invoice::query()
            ->joinSub($this->paymentScopedInvoiceIdsSubquery($start, $end, $filters, includeItemFilters: false), 'payment_scope', function ($join): void {
                $join->on('payment_scope.invoice_id', '=', 'invoices.id');
            })
            ->joinSub($this->itemTotalsSubquery($filters), 'filtered_items', function ($join): void {
                $join->on('filtered_items.invoice_id', '=', 'invoices.id');
            })
            ->whereBetween('invoices.issued_at', [$start, $end])
            ->selectRaw('COUNT(*) as invoice_count')
            ->selectRaw(
                'COALESCE(SUM(CASE WHEN invoices.status != ? THEN filtered_items.item_total_cents ELSE 0 END), 0) as billed_cents',
                [Invoice::STATUS_VOID],
            )
            ->selectRaw(
                'COALESCE(SUM(CASE WHEN invoices.status IN (?, ?) THEN ROUND(invoices.balance_due_cents * filtered_items.item_total_cents / NULLIF(invoices.total_cents, 0)) ELSE 0 END), 0) as pending_cents',
                [Invoice::STATUS_ISSUED, Invoice::STATUS_PARTIAL],
            )
            ->selectRaw(
                'COALESCE(SUM(CASE WHEN invoices.status = ? THEN filtered_items.item_total_cents ELSE 0 END), 0) as partial_cents',
                [Invoice::STATUS_PARTIAL],
            )
            ->selectRaw(
                'COALESCE(SUM(CASE WHEN invoices.status = ? THEN filtered_items.item_total_cents ELSE 0 END), 0) as voided_cents',
                [Invoice::STATUS_VOID],
            )
            ->first() ?? (object) [];
    }

    /**
     * @param  array<string, mixed>  $filters
     */
    private function itemScopedInvoiceFacts(Carbon $start, Carbon $end, array $filters): object
    {
        return Invoice::query()
            ->joinSub($this->itemTotalsSubquery($filters), 'filtered_items', function ($join): void {
                $join->on('filtered_items.invoice_id', '=', 'invoices.id');
            })
            ->whereBetween('invoices.issued_at', [$start, $end])
            ->tap(fn (Builder $query) => $this->applyInvoiceFilters($query, $filters, includeItemFilters: false))
            ->selectRaw('COUNT(*) as invoice_count')
            ->selectRaw(
                'COALESCE(SUM(CASE WHEN invoices.status != ? THEN filtered_items.item_total_cents ELSE 0 END), 0) as billed_cents',
                [Invoice::STATUS_VOID],
            )
            ->selectRaw(
                'COALESCE(SUM(CASE WHEN invoices.status IN (?, ?) THEN ROUND(invoices.balance_due_cents * filtered_items.item_total_cents / NULLIF(invoices.total_cents, 0)) ELSE 0 END), 0) as pending_cents',
                [Invoice::STATUS_ISSUED, Invoice::STATUS_PARTIAL],
            )
            ->selectRaw(
                'COALESCE(SUM(CASE WHEN invoices.status = ? THEN filtered_items.item_total_cents ELSE 0 END), 0) as partial_cents',
                [Invoice::STATUS_PARTIAL],
            )
            ->selectRaw(
                'COALESCE(SUM(CASE WHEN invoices.status = ? THEN filtered_items.item_total_cents ELSE 0 END), 0) as voided_cents',
                [Invoice::STATUS_VOID],
            )
            ->first() ?? (object) [];
    }

    /**
     * @param  array<string, mixed>  $filters
     * @return array{payment_count: int, collected_cents: int, payments_by_method: array<string, string>}
     */
    private function paymentFacts(Carbon $start, Carbon $end, array $filters): array
    {
        $hasItemFilter = $this->hasItemFilter($filters);
        $amountExpression = $hasItemFilter
            ? 'ROUND(payments.amount_cents * filtered_items.item_total_cents / NULLIF(invoices.total_cents, 0))'
            : 'payments.amount_cents';

        $base = Payment::query()
            ->join('invoices', 'payments.invoice_id', '=', 'invoices.id')
            ->when($hasItemFilter, function (Builder $query) use ($filters): void {
                $query->joinSub($this->itemTotalsSubquery($filters), 'filtered_items', function ($join): void {
                    $join->on('filtered_items.invoice_id', '=', 'invoices.id');
                });
            })
            ->where('payments.status', Payment::STATUS_POSTED)
            ->where('invoices.status', '!=', Invoice::STATUS_VOID)
            ->whereBetween('payments.paid_at', [$start, $end])
            ->tap(fn (Builder $query) => $this->applyPaymentFilters($query, $filters, includeItemFilters: ! $hasItemFilter));

        $summary = (clone $base)
            ->selectRaw('COUNT(*) as payment_count')
            ->selectRaw("COALESCE(SUM({$amountExpression}), 0) as collected_cents")
            ->first();

        $methodCents = array_fill_keys(array_keys($this->zeroMethodTotals()), 0);

        (clone $base)
            ->groupBy('payments.method')
            ->select('payments.method', DB::raw("COALESCE(SUM({$amountExpression}), 0) as total_cents"))
            ->get()
            ->each(function (object $row) use (&$methodCents): void {
                if (array_key_exists($row->method, $methodCents)) {
                    $methodCents[$row->method] = (int) $row->total_cents;
                }
            });

        $methods = $this->zeroMethodTotals();
        foreach ($methodCents as $method => $cents) {
            $methods[$method] = $this->centsToMoney($cents);
        }

        return [
            'payment_count' => (int) ($summary?->payment_count ?? 0),
            'collected_cents' => (int) ($summary?->collected_cents ?? 0),
            'payments_by_method' => $methods,
        ];
    }

    /**
     * @param  Builder<Invoice>  $query
     * @param  array<string, mixed>  $filters
     */
    private function applyInvoiceFilters(Builder $query, array $filters, bool $includeItemFilters = true): void
    {
        $query
            ->when(! empty($filters['user_id']), function (Builder $query) use ($filters): void {
                $query->where('issued_by', $filters['user_id']);
            })
            ->when(! empty($filters['cash_session_id']), function (Builder $query) use ($filters): void {
                $query->where('cash_session_id', $filters['cash_session_id']);
            })
            ->when($includeItemFilters && ! empty($filters['category_id']), function (Builder $query) use ($filters): void {
                $query->whereExists(function ($subquery) use ($filters): void {
                    $subquery
                        ->selectRaw('1')
                        ->from('invoice_items')
                        ->whereColumn('invoice_items.invoice_id', 'invoices.id')
                        ->where('invoice_items.category_id', $filters['category_id']);
                });
            })
            ->when($includeItemFilters && ! empty($filters['area_id']), function (Builder $query) use ($filters): void {
                $query->whereExists(function ($subquery) use ($filters): void {
                    $subquery
                        ->selectRaw('1')
                        ->from('invoice_items')
                        ->whereColumn('invoice_items.invoice_id', 'invoices.id')
                        ->where('invoice_items.area_id', $filters['area_id']);
                });
            })
            ->when(! empty($filters['status']), function (Builder $query) use ($filters): void {
                $query->where('status', $filters['status']);
            });
    }

    /**
     * @param  Builder<Payment>  $query
     * @param  array<string, mixed>  $filters
     */
    private function applyPaymentFilters(Builder $query, array $filters, bool $includeItemFilters = true): void
    {
        $query
            ->when(! empty($filters['user_id']), function (Builder $query) use ($filters): void {
                $query->where('payments.user_id', $filters['user_id']);
            })
            ->when(! empty($filters['cash_session_id']), function (Builder $query) use ($filters): void {
                $query->where('payments.cash_session_id', $filters['cash_session_id']);
            })
            ->when(! empty($filters['method']), function (Builder $query) use ($filters): void {
                $query->where('payments.method', $filters['method']);
            })
            ->when(! empty($filters['status']), function (Builder $query) use ($filters): void {
                $query->where('invoices.status', $filters['status']);
            })
            ->when($includeItemFilters && ! empty($filters['category_id']), function (Builder $query) use ($filters): void {
                $query->whereExists(function ($subquery) use ($filters): void {
                    $subquery
                        ->selectRaw('1')
                        ->from('invoice_items')
                        ->whereColumn('invoice_items.invoice_id', 'invoices.id')
                        ->where('invoice_items.category_id', $filters['category_id']);
                });
            })
            ->when($includeItemFilters && ! empty($filters['area_id']), function (Builder $query) use ($filters): void {
                $query->whereExists(function ($subquery) use ($filters): void {
                    $subquery
                        ->selectRaw('1')
                        ->from('invoice_items')
                        ->whereColumn('invoice_items.invoice_id', 'invoices.id')
                        ->where('invoice_items.area_id', $filters['area_id']);
                });
            });
    }

    /**
     * @param  array<string, mixed>  $filters
     */
    private function hasItemFilter(array $filters): bool
    {
        return ! empty($filters['category_id']) || ! empty($filters['area_id']);
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
    private function paymentScopedInvoiceIdsSubquery(
        Carbon $start,
        Carbon $end,
        array $filters,
        bool $includeItemFilters = true,
    ): \Illuminate\Database\Query\Builder {
        return DB::table('payments')
            ->join('invoices', 'payments.invoice_id', '=', 'invoices.id')
            ->select('payments.invoice_id')
            ->where('payments.status', Payment::STATUS_POSTED)
            ->where('invoices.status', '!=', Invoice::STATUS_VOID)
            ->whereBetween('payments.paid_at', [$start, $end])
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
            ->when($includeItemFilters && ! empty($filters['category_id']), function ($query) use ($filters): void {
                $query->whereExists(function ($subquery) use ($filters): void {
                    $subquery
                        ->selectRaw('1')
                        ->from('invoice_items')
                        ->whereColumn('invoice_items.invoice_id', 'invoices.id')
                        ->where('invoice_items.category_id', $filters['category_id']);
                });
            })
            ->when($includeItemFilters && ! empty($filters['area_id']), function ($query) use ($filters): void {
                $query->whereExists(function ($subquery) use ($filters): void {
                    $subquery
                        ->selectRaw('1')
                        ->from('invoice_items')
                        ->whereColumn('invoice_items.invoice_id', 'invoices.id')
                        ->where('invoice_items.area_id', $filters['area_id']);
                });
            })
            ->distinct();
    }

    /**
     * @param  array<string, mixed>  $filters
     */
    private function itemTotalsSubquery(array $filters): \Illuminate\Database\Query\Builder
    {
        return DB::table('invoice_items')
            ->select('invoice_items.invoice_id')
            ->selectRaw('COALESCE(SUM(invoice_items.line_total_cents), 0) as item_total_cents')
            ->when(! empty($filters['category_id']), function ($query) use ($filters): void {
                $query->where('invoice_items.category_id', $filters['category_id']);
            })
            ->when(! empty($filters['area_id']), function ($query) use ($filters): void {
                $query->where('invoice_items.area_id', $filters['area_id']);
            })
            ->groupBy('invoice_items.invoice_id');
    }
}
