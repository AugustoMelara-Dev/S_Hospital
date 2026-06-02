<?php

namespace App\Actions\Reports;

use App\Actions\Reports\Concerns\FormatsReportMoney;
use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Models\Payment;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Generates a dashboard overview report with:
 * - Last 7 days daily trend
 * - Current month summary
 * - Today's payments by method
 * - Top 10 services for the current month
 * - Cashier summaries for today
 */
class DashboardReportService
{
    use FormatsReportMoney;

    public function __construct(private readonly FinancialFactsService $financialFacts) {}

    /**
     * @return array<string, mixed>
     */
    public function report(): array
    {
        $now = Carbon::now();
        $today = $now->copy()->startOfDay();

        return [
            'last_7_days' => $this->last7Days($now),
            'current_month' => $this->currentMonth($now),
            'payments_by_method' => $this->paymentsByMethodToday($today),
            'top_services' => $this->topServices($now),
            'cashiers_summary' => $this->cashiersSummary($today),
        ];
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function last7Days(Carbon $now): array
    {
        $days = [];

        for ($i = 6; $i >= 0; $i--) {
            $date = $now->copy()->subDays($i);
            $start = $date->copy()->startOfDay();
            $end = $date->copy()->endOfDay();
            $facts = $this->financialFacts->forRange($start, $end);

            $days[] = [
                'date' => $date->toDateString(),
                'total_billed' => $facts['total_billed'],
                'total_collected' => $facts['total_collected'],
                'total_pending' => $facts['total_pending'],
                'total_partial' => $facts['total_partial'],
                'total_voided' => $facts['total_voided'],
                'invoice_count' => $facts['invoice_count'],
                'payment_count' => $facts['payment_count'],
            ];
        }

        return $days;
    }

    /**
     * @return array<string, mixed>
     */
    private function currentMonth(Carbon $now): array
    {
        $start = $now->copy()->startOfMonth();
        $end = $now->copy()->endOfMonth();
        $facts = $this->financialFacts->forRange($start, $end);

        return [
            'total_billed' => $facts['total_billed'],
            'total_collected' => $facts['total_collected'],
            'total_pending' => $facts['total_pending'],
            'total_partial' => $facts['total_partial'],
            'total_voided' => $facts['total_voided'],
            'invoice_count' => $facts['invoice_count'],
            'payment_count' => $facts['payment_count'],
        ];
    }

    /**
     * @return array<string, string>
     */
    private function paymentsByMethodToday(Carbon $today): array
    {
        $end = $today->copy()->endOfDay();
        $methods = $this->zeroMethodTotals();

        Payment::query()
            ->join('invoices', 'payments.invoice_id', '=', 'invoices.id')
            ->where('payments.status', Payment::STATUS_POSTED)
            ->where('invoices.status', '!=', Invoice::STATUS_VOID)
            ->whereBetween('payments.paid_at', [$today, $end])
            ->groupBy('payments.method')
            ->select('payments.method', DB::raw('COALESCE(SUM(payments.amount_cents), 0) as total_cents'))
            ->get()
            ->each(function (object $row) use (&$methods): void {
                if (array_key_exists($row->method, $methods)) {
                    $methods[$row->method] = $this->centsToMoney($row->total_cents);
                }
            });

        return $methods;
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function topServices(Carbon $now): array
    {
        $start = $now->copy()->startOfMonth();
        $end = $now->copy()->endOfMonth();

        return InvoiceItem::query()
            ->join('invoices', 'invoice_items.invoice_id', '=', 'invoices.id')
            ->where('invoices.status', '!=', Invoice::STATUS_VOID)
            ->whereBetween('invoices.issued_at', [$start, $end])
            ->groupBy('invoice_items.service_name', 'invoice_items.category_name')
            ->select(
                'invoice_items.service_name',
                'invoice_items.category_name',
            )
            ->selectRaw('COALESCE(SUM(invoice_items.quantity_cents), 0) as quantity_cents')
            ->selectRaw('COALESCE(SUM(invoice_items.line_total_cents), 0) as total_cents')
            ->orderByDesc('total_cents')
            ->limit(10)
            ->get()
            ->map(fn (object $row): array => [
                'service_name' => $row->service_name,
                'category_name' => $row->category_name,
                'quantity' => number_format((int) $row->quantity_cents / 100, 2, '.', ''),
                'total' => $this->centsToMoney($row->total_cents),
            ])
            ->values()
            ->all();
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function cashiersSummary(Carbon $today): array
    {
        $end = $today->copy()->endOfDay();

        return Payment::query()
            ->join('invoices', 'payments.invoice_id', '=', 'invoices.id')
            ->join('users', 'payments.user_id', '=', 'users.id')
            ->where('payments.status', Payment::STATUS_POSTED)
            ->where('invoices.status', '!=', Invoice::STATUS_VOID)
            ->whereBetween('payments.paid_at', [$today, $end])
            ->groupBy('payments.user_id', 'users.name', 'users.username')
            ->orderByDesc('collected_cents')
            ->select('payments.user_id', 'users.name', 'users.username')
            ->selectRaw('COUNT(*) as payment_count')
            ->selectRaw('COALESCE(SUM(payments.amount_cents), 0) as collected_cents')
            ->get()
            ->map(fn (object $row): array => [
                'user_id' => (int) $row->user_id,
                'name' => $row->name,
                'username' => $row->username,
                'payment_count' => (int) $row->payment_count,
                'total_collected' => $this->centsToMoney($row->collected_cents),
            ])
            ->values()
            ->all();
    }
}
