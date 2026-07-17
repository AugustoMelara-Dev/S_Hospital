<?php

namespace App\Actions\Reports;

use App\Actions\Reports\Concerns\FormatsReportMoney;
use App\Models\Invoice;
use App\Models\Payment;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class MonthlyReportService
{
    use FormatsReportMoney;

    public function __construct(private readonly FinancialFactsService $financialFacts) {}

    /**
     * @return array<string, mixed>
     */
    public function report(string $month): array
    {
        $period = Carbon::createFromFormat('Y-m', $month)->startOfMonth();
        $start = $period->copy()->startOfMonth();
        $end = $period->copy()->endOfMonth();
        $facts = $this->financialFacts->forRange($start, $end);

        return [
            'month' => $period->format('Y-m'),
            'date_from' => $start->toDateString(),
            'date_to' => $end->toDateString(),
            'total_billed' => $facts['total_billed'],
            'total_collected' => $facts['total_collected'],
            'total_pending' => $facts['total_pending'],
            'total_partial' => $facts['total_partial'],
            'total_voided' => $facts['total_voided'],
            'invoice_count' => $facts['invoice_count'],
            'payment_count' => $facts['payment_count'],
            'payments_by_method' => $facts['payments_by_method'],
            'invoices_by_status' => $this->invoicesByStatus($start, $end),
            'daily_totals' => $this->dailyTotals($start, $end),
        ];
    }

    /**
     * @return array{issued: array{count: int, total: string}, partial: array{count: int, total: string}, paid: array{count: int, total: string}, void: array{count: int, total: string}}
     */
    private function invoicesByStatus(Carbon $start, Carbon $end): array
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
            ->where('status', '!=', Invoice::STATUS_VOID)
            ->groupBy('status')
            ->select('status')
            ->selectRaw('COUNT(*) as count')
            ->selectRaw('COALESCE(SUM(total_cents), 0) as total_cents')
            ->toBase()
            ->get()
            ->each(function (object $row) use (&$statuses): void {
                $statuses[$row->status] = [
                    'count' => (int) $row->count,
                    'total' => $this->centsToMoney($row->total_cents),
                ];
            });

        $voided = Invoice::query()
            ->where('status', Invoice::STATUS_VOID)
            ->whereBetween('voided_at', [$start, $end])
            ->selectRaw('COUNT(*) as count')
            ->selectRaw('COALESCE(SUM(total_cents), 0) as total_cents')
            ->first();

        $statuses[Invoice::STATUS_VOID] = [
            'count' => (int) ($voided->count ?? 0),
            'total' => $this->centsToMoney($voided->total_cents ?? 0),
        ];

        return $statuses;
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function dailyTotals(Carbon $start, Carbon $end): array
    {
        $dates = $this->activityDates($start, $end);

        return $dates
            ->map(function (string $date): array {
                $day = Carbon::createFromFormat('Y-m-d', $date);
                $facts = $this->financialFacts->forRange($day->copy()->startOfDay(), $day->copy()->endOfDay());

                return [
                    'date' => $date,
                    'total_billed' => $facts['total_billed'],
                    'total_collected' => $facts['total_collected'],
                    'total_pending' => $facts['total_pending'],
                    'total_partial' => $facts['total_partial'],
                    'total_voided' => $facts['total_voided'],
                    'invoice_count' => $facts['invoice_count'],
                    'payment_count' => $facts['payment_count'],
                ];
            })
            ->values()
            ->all();
    }

    /** @return Collection<int, string> */
    private function activityDates(Carbon $start, Carbon $end): Collection
    {
        $invoiceDates = Invoice::query()
            ->whereBetween('issued_at', [$start, $end])
            ->selectRaw($this->dateExpression('issued_at').' as report_date')
            ->pluck('report_date');

        $voidedDates = Invoice::query()
            ->where('status', Invoice::STATUS_VOID)
            ->whereBetween('voided_at', [$start, $end])
            ->selectRaw($this->dateExpression('voided_at').' as report_date')
            ->pluck('report_date');

        $paymentDates = Payment::query()
            ->join('invoices', 'payments.invoice_id', '=', 'invoices.id')
            ->where('payments.status', Payment::STATUS_POSTED)
            ->where('invoices.status', '!=', Invoice::STATUS_VOID)
            ->whereBetween('payments.paid_at', [$start, $end])
            ->selectRaw($this->dateExpression('payments.paid_at').' as report_date')
            ->pluck('report_date');

        return $invoiceDates
            ->merge($voidedDates)
            ->merge($paymentDates)
            ->filter()
            ->unique()
            ->sort()
            ->values();
    }

    private function dateExpression(string $column): string
    {
        $driver = DB::connection()->getDriverName();

        if ($driver === 'sqlite') {
            return "strftime('%Y-%m-%d', {$column})";
        }

        return "DATE({$column})";
    }
}
