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

        $payments = (clone $base)
            ->select('payments.*')
            ->with(['invoice.items'])
            ->get();

        $totalCents = 0;
        $paymentCount = $payments->count();
        $invoiceIds = [];
        $methods = $this->zeroMethodTotals();
        $methodCents = array_fill_keys(array_keys($methods), 0);

        foreach ($payments as $payment) {
            $invoiceIds[] = $payment->invoice_id;
            $invoice = $payment->invoice;
            $paymentAmountCents = $this->moneyToCents($payment->amount);

            if (! empty($filters['category_id'])) {
                $categoryTotalCents = 0;
                if ($invoice) {
                    foreach ($invoice->items as $item) {
                        if ((int) $item->category_id === (int) $filters['category_id']) {
                            $categoryTotalCents += $this->moneyToCents($item->line_total);
                        }
                    }
                    $collectedCents = $this->allocateProportionalCents(
                        $paymentAmountCents,
                        $categoryTotalCents,
                        $this->moneyToCents($invoice->total),
                    );
                } else {
                    $collectedCents = 0;
                }
            } else {
                $collectedCents = $paymentAmountCents;
            }

            $totalCents += $collectedCents;

            if (array_key_exists($payment->method, $methodCents)) {
                $methodCents[$payment->method] += $collectedCents;
            }
        }

        foreach ($methodCents as $method => $cents) {
            if (array_key_exists($method, $methods)) {
                $methods[$method] = $this->centsToMoney($cents);
            }
        }

        $invoiceCount = count(array_unique($invoiceIds));

        $billedCents = Invoice::query()
            ->where('status', '!=', Invoice::STATUS_VOID)
            ->whereBetween('issued_at', [$start, $end])
            ->when(! empty($filters['user_id']), function (Builder $query) use ($filters): void {
                $query->where('issued_by', $filters['user_id']);
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
            'total_collected' => $this->centsToMoney($totalCents),
            'payments_by_method' => $methods,
            'payment_count' => (int) ($paymentCount ?? 0),
            'invoice_count' => (int) ($invoiceCount ?? 0),
        ];
    }
}
