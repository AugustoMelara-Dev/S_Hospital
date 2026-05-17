<?php

namespace App\Actions\Reports;

use App\Actions\Reports\Concerns\FormatsReportMoney;
use App\Models\CashRegisterSession;
use App\Models\Invoice;
use App\Models\Payment;
use Illuminate\Support\Facades\DB;

class CashSessionReportService
{
    use FormatsReportMoney;

    public function report(CashRegisterSession $session): array
    {
        $session->load('user:id,name,username');

        $methods = $this->zeroMethodTotals();
        Payment::query()
            ->join('invoices', 'payments.invoice_id', '=', 'invoices.id')
            ->where('payments.cash_session_id', $session->id)
            ->where('payments.status', Payment::STATUS_POSTED)
            ->where('invoices.status', '!=', Invoice::STATUS_VOID)
            ->groupBy('payments.method')
            ->select('payments.method', DB::raw('COALESCE(SUM(CAST(ROUND(payments.amount * 100) AS INTEGER)), 0) as total_cents'))
            ->get()
            ->each(function (object $row) use (&$methods): void {
                if (array_key_exists($row->method, $methods)) {
                    $methods[$row->method] = $this->centsToMoney($row->total_cents);
                }
            });

        $payments = Payment::query()
            ->with([
                'invoice:id,invoice_number,patient_name,status,total,paid_amount,balance_due',
                'user:id,name,username',
            ])
            ->where('cash_session_id', $session->id)
            ->where('status', Payment::STATUS_POSTED)
            ->orderBy('paid_at')
            ->get();

        $movements = $session->movements()
            ->with('user:id,name,username')
            ->orderBy('occurred_at')
            ->get();

        return [
            'cash_session' => [
                'id' => $session->id,
                'status' => $session->status,
                'user' => $session->user,
                'opening_amount' => (string) $session->opening_amount,
                'expected_amount' => $session->expected_amount === null ? null : (string) $session->expected_amount,
                'closing_amount' => $session->closing_amount === null ? null : (string) $session->closing_amount,
                'difference_amount' => $session->difference_amount === null ? null : (string) $session->difference_amount,
                'opened_at' => $session->opened_at,
                'closed_at' => $session->closed_at,
            ],
            'totals_by_method' => $methods,
            'total_cash' => $methods[Payment::METHOD_CASH],
            'total_transfer' => $methods[Payment::METHOD_TRANSFER],
            'total_card' => $methods[Payment::METHOD_CARD],
            'total_other' => $methods[Payment::METHOD_OTHER],
            'payments' => $payments,
            'movements' => $movements,
        ];
    }
}
