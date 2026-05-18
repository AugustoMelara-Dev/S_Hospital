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

    public function report(string $date): array
    {
        $day = Carbon::createFromFormat('Y-m-d', $date);
        $start = $day->copy()->startOfDay();
        $end = $day->copy()->endOfDay();

        $invoiceSummary = Invoice::query()
            ->whereBetween('issued_at', [$start, $end])
            ->selectRaw('COUNT(*) as invoice_count')
            ->selectRaw('COALESCE(SUM(CASE WHEN status != ? THEN ROUND(total * 100) ELSE 0 END), 0) as billed_cents', [Invoice::STATUS_VOID])
            ->first();

        $paymentSummary = Payment::query()
            ->join('invoices', 'payments.invoice_id', '=', 'invoices.id')
            ->where('payments.status', Payment::STATUS_POSTED)
            ->where('invoices.status', '!=', Invoice::STATUS_VOID)
            ->whereBetween('payments.paid_at', [$start, $end])
            ->selectRaw('COUNT(*) as payment_count')
            ->selectRaw('COALESCE(SUM(ROUND(payments.amount * 100)), 0) as collected_cents')
            ->first();

        $methods = $this->zeroMethodTotals();
        Payment::query()
            ->join('invoices', 'payments.invoice_id', '=', 'invoices.id')
            ->where('payments.status', Payment::STATUS_POSTED)
            ->where('invoices.status', '!=', Invoice::STATUS_VOID)
            ->whereBetween('payments.paid_at', [$start, $end])
            ->groupBy('payments.method')
            ->select('payments.method', DB::raw('COALESCE(SUM(ROUND(payments.amount * 100)), 0) as total_cents'))
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
            ->groupBy('status')
            ->select('status', DB::raw('COUNT(*) as count'), DB::raw('COALESCE(SUM(ROUND(total * 100)), 0) as total_cents'))
            ->get()
            ->each(function (object $row) use (&$statuses): void {
                $statuses[$row->status] = [
                    'count' => (int) $row->count,
                    'total' => $this->centsToMoney($row->total_cents),
                ];
            });

        return [
            'date' => $date,
            'total_billed' => $this->centsToMoney($invoiceSummary?->billed_cents),
            'total_collected' => $this->centsToMoney($paymentSummary?->collected_cents),
            'invoice_count' => (int) ($invoiceSummary?->invoice_count ?? 0),
            'payment_count' => (int) ($paymentSummary?->payment_count ?? 0),
            'payments_by_method' => $methods,
            'invoices_by_status' => $statuses,
        ];
    }
}
