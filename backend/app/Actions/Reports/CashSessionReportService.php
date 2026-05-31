<?php

namespace App\Actions\Reports;

use App\Actions\Cash\BuildCashReconciliationAction;
use App\Models\CashRegisterSession;
use App\Models\Invoice;
use App\Models\Payment;

class CashSessionReportService
{
    public function __construct(private readonly BuildCashReconciliationAction $buildCashReconciliation) {}

    public function report(CashRegisterSession $session): array
    {
        $session->load('user:id,name,username');
        $reconciliation = $this->buildCashReconciliation->execute($session);
        $methods = $reconciliation['payments_by_method'];

        $payments = Payment::query()
            ->join('invoices', 'payments.invoice_id', '=', 'invoices.id')
            ->with([
                'invoice:id,invoice_number,patient_name,status,total,paid_amount,balance_due',
                'user:id,name,username',
            ])
            ->where('payments.cash_session_id', $session->id)
            ->where('payments.status', Payment::STATUS_POSTED)
            ->where('invoices.status', '!=', Invoice::STATUS_VOID)
            ->orderBy('payments.paid_at')
            ->select('payments.*')
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
            'payments_count' => $reconciliation['payments_count'],
            'payments_total' => $reconciliation['payments_total'],
            'expected_cash_amount' => $reconciliation['expected_cash_amount'],
            'pending_invoice_count' => $reconciliation['pending_invoice_count'],
            'pending_amount' => $reconciliation['pending_amount'],
            'payments' => $payments,
            'movements' => $movements,
        ];
    }
}
