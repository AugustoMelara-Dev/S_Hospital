<?php

namespace App\Actions\Reports;

use App\Actions\Reports\Concerns\FormatsReportMoney;
use App\Models\Invoice;
use App\Models\Payment;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class DailyReportService
{
    use FormatsReportMoney;

    public function __construct(private readonly FinancialFactsService $financialFacts) {}

    public function report(string $date): array
    {
        $day = Carbon::createFromFormat('Y-m-d', $date);
        $start = $day->copy()->startOfDay();
        $end = $day->copy()->endOfDay();
        $facts = $this->financialFacts->forRange($start, $end);

        $methods = $this->zeroMethodTotals();
        Payment::query()
            ->join('invoices', 'payments.invoice_id', '=', 'invoices.id')
            ->where('payments.status', Payment::STATUS_POSTED)
            ->where('invoices.status', '!=', Invoice::STATUS_VOID)
            ->whereBetween('payments.paid_at', [$start, $end])
            ->groupBy('payments.method')
            ->select('payments.method', DB::raw('COALESCE(SUM(payments.amount_cents), 0) as total_cents'))
            ->toBase()
            ->get()
            ->each(function (object $row) use (&$methods): void {
                if (array_key_exists($row->method, $methods)) {
                    $methods[$row->method] = $this->centsToMoney($row->total_cents);
                }
            });

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
            ->select('status', DB::raw('COUNT(*) as count'), DB::raw('COALESCE(SUM(total_cents), 0) as total_cents'))
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

        return [
            'date' => $date,
            'total_billed' => $facts['total_billed'],
            'total_collected' => $facts['total_collected'],
            'total_pending' => $facts['total_pending'],
            'total_balance_due' => $facts['total_pending'],
            'total_partial' => $facts['total_partial'],
            'total_voided' => $facts['total_voided'],
            'invoice_count' => $facts['invoice_count'],
            'payment_count' => $facts['payment_count'],
            'payments_by_method' => $methods,
            'invoices_by_status' => $statuses,
        ];
    }
}
