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
        $period = ReportDate::month($month);
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
        $issued = ['count' => 0, 'total' => '0.00'];
        $partial = ['count' => 0, 'total' => '0.00'];
        $paid = ['count' => 0, 'total' => '0.00'];

        Invoice::query()
            ->whereBetween('issued_at', [$start, $end])
            ->where('status', '!=', Invoice::STATUS_VOID)
            ->groupBy('status')
            ->select('status')
            ->selectRaw('COUNT(*) as count')
            ->selectRaw('COALESCE(SUM(total_cents), 0) as total_cents')
            ->toBase()
            ->get()
            ->each(function (object $row) use (&$issued, &$partial, &$paid): void {
                $summary = [
                    'count' => (int) $row->count,
                    'total' => $this->centsToMoney($row->total_cents),
                ];

                match ($row->status) {
                    Invoice::STATUS_ISSUED => $issued = $summary,
                    Invoice::STATUS_PARTIAL => $partial = $summary,
                    Invoice::STATUS_PAID => $paid = $summary,
                    default => null,
                };
            });

        $voided = Invoice::query()
            ->where('status', Invoice::STATUS_VOID)
            ->whereBetween('voided_at', [$start, $end])
            ->selectRaw('COUNT(*) as count')
            ->selectRaw('COALESCE(SUM(total_cents), 0) as total_cents')
            ->first();

        return [
            Invoice::STATUS_ISSUED => $issued,
            Invoice::STATUS_PARTIAL => $partial,
            Invoice::STATUS_PAID => $paid,
            Invoice::STATUS_VOID => [
                'count' => (int) ($voided->count ?? 0),
                'total' => $this->centsToMoney($voided->total_cents ?? 0),
            ],
        ];
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function dailyTotals(Carbon $start, Carbon $end): array
    {
        $dates = $this->activityDates($start, $end);

        return array_values($dates
            ->map(function (string $date): array {
                $day = ReportDate::day($date);
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
            ->all());
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
