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
        $snapshot = $this->closedSnapshot($session);
        $methods = $snapshot['payments_by_method'] ?? $reconciliation['payments_by_method'];
        $paymentsCount = $snapshot['payments_count'] ?? $reconciliation['payments_count'];
        $paymentsTotal = $snapshot['payments_total'] ?? $reconciliation['payments_total'];
        $expectedCashAmount = $snapshot['expected_cash_amount'] ?? $reconciliation['expected_cash_amount'];
        $pendingInvoiceCount = $snapshot['pending_invoice_count'] ?? $reconciliation['pending_invoice_count'];
        $pendingAmount = $snapshot['pending_amount'] ?? $reconciliation['pending_amount'];

        $payments = Payment::query()
            ->join('invoices', 'payments.invoice_id', '=', 'invoices.id')
            ->with([
                'invoice:id,invoice_number,patient_name,status,total,paid_amount,balance_due',
                'user:id,name,username',
            ])
            ->where('payments.cash_session_id', $session->id)
            ->where('payments.status', Payment::STATUS_POSTED)
            ->where(function ($query) use ($session): void {
                $query->where('invoices.status', '!=', Invoice::STATUS_VOID);

                if ($session->closed_at !== null) {
                    $query
                        ->orWhere(function ($query) use ($session): void {
                            $query
                                ->where('invoices.status', Invoice::STATUS_VOID)
                                ->where('invoices.voided_at', '>', $session->closed_at);
                        });
                }
            })
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
            'payments_count' => $paymentsCount,
            'payments_total' => $paymentsTotal,
            'expected_cash_amount' => $expectedCashAmount,
            'pending_invoice_count' => $pendingInvoiceCount,
            'pending_amount' => $pendingAmount,
            'payments' => $payments,
            'movements' => $movements,
        ];
    }

    /**
     * @return null|array{
     *     payments_count: int,
     *     payments_total: string,
     *     payments_by_method: array{cash: string, transfer: string, card: string, other: string},
     *     expected_cash_amount: string,
     *     pending_invoice_count: int,
     *     pending_amount: string
     * }
     */
    private function closedSnapshot(CashRegisterSession $session): ?array
    {
        if (
            $session->status !== CashRegisterSession::STATUS_CLOSED
            || $session->method_totals_snapshot === null
            || $session->payments_count_snapshot === null
            || $session->payments_total_snapshot === null
            || $session->expected_amount === null
            || $session->pending_invoice_count_snapshot === null
            || $session->pending_amount_snapshot === null
        ) {
            return null;
        }

        $methods = array_merge($this->zeroMethodTotals(), array_intersect_key(
            $session->method_totals_snapshot,
            $this->zeroMethodTotals(),
        ));

        return [
            'payments_count' => $session->payments_count_snapshot,
            'payments_total' => (string) $session->payments_total_snapshot,
            'payments_by_method' => [
                Payment::METHOD_CASH => (string) $methods[Payment::METHOD_CASH],
                Payment::METHOD_TRANSFER => (string) $methods[Payment::METHOD_TRANSFER],
                Payment::METHOD_CARD => (string) $methods[Payment::METHOD_CARD],
                Payment::METHOD_OTHER => (string) $methods[Payment::METHOD_OTHER],
            ],
            'expected_cash_amount' => (string) $session->expected_amount,
            'pending_invoice_count' => $session->pending_invoice_count_snapshot,
            'pending_amount' => (string) $session->pending_amount_snapshot,
        ];
    }

    /**
     * @return array{cash: string, transfer: string, card: string, other: string}
     */
    private function zeroMethodTotals(): array
    {
        return [
            Payment::METHOD_CASH => '0.00',
            Payment::METHOD_TRANSFER => '0.00',
            Payment::METHOD_CARD => '0.00',
            Payment::METHOD_OTHER => '0.00',
        ];
    }
}
