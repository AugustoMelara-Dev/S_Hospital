<?php

declare(strict_types=1);

namespace App\Actions\Reports;

use App\Actions\Cash\BuildCashReconciliationAction;
use App\Models\CashRegisterSession;
use App\Models\Invoice;
use App\Models\Payment;
use Illuminate\Support\Facades\DB;

class CashSessionReportService
{
    public function __construct(private readonly BuildCashReconciliationAction $buildCashReconciliation) {}

    /**
     * @return array<string, mixed>
     */
    public function report(CashRegisterSession $session): array
    {
        $snapshot = $this->closedSnapshot($session);

        if ($snapshot !== null) {
            $session->load('user:id,name,username');
            $methods = $snapshot['payments_by_method'];
            $paymentsCount = $snapshot['payments_count'];
            $paymentsTotal = $snapshot['payments_total'];
            $expectedCashAmount = $snapshot['expected_cash_amount'];
            $pendingInvoiceCount = $snapshot['pending_invoice_count'];
            $pendingAmount = $snapshot['pending_amount'];

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

            return $this->formatReport(
                $session,
                $methods,
                $paymentsCount,
                $paymentsTotal,
                $expectedCashAmount,
                $pendingInvoiceCount,
                $pendingAmount,
                $payments,
                $movements,
            );
        }

        $lockedSession = DB::transaction(function () use ($session): CashRegisterSession {
            return CashRegisterSession::query()
                ->whereKey($session->id)
                ->sharedLock()
                ->firstOrFail();
        });

        $reconciliation = $this->buildCashReconciliation->execute($lockedSession);
        $methods = $reconciliation['payments_by_method'];
        $paymentsCount = $reconciliation['payments_count'];
        $paymentsTotal = $reconciliation['payments_total'];
        $expectedCashAmount = $reconciliation['expected_cash_amount'];
        $pendingInvoiceCount = $reconciliation['pending_invoice_count'];
        $pendingAmount = $reconciliation['pending_amount'];

        $payments = Payment::query()
            ->join('invoices', 'payments.invoice_id', '=', 'invoices.id')
            ->with([
                'invoice:id,invoice_number,patient_name,status,total,paid_amount,balance_due',
                'user:id,name,username',
            ])
            ->where('payments.cash_session_id', $lockedSession->id)
            ->where('payments.status', Payment::STATUS_POSTED)
            ->where('invoices.status', '!=', Invoice::STATUS_VOID)
            ->orderBy('payments.paid_at')
            ->select('payments.*')
            ->get();

        $movements = $lockedSession->movements()
            ->with('user:id,name,username')
            ->orderBy('occurred_at')
            ->get();

        return $this->formatReport(
            $lockedSession,
            $methods,
            $paymentsCount,
            $paymentsTotal,
            $expectedCashAmount,
            $pendingInvoiceCount,
            $pendingAmount,
            $payments,
            $movements,
        );
    }

    /**
     * @param  array{cash: string, transfer: string, card: string, other: string}  $methods
     * @param  \Illuminate\Support\Collection<int, Payment>  $payments
     * @param  \Illuminate\Support\Collection<int, \App\Models\CashMovement>  $movements
     * @return array<string, mixed>
     */
    private function formatReport(
        CashRegisterSession $session,
        array $methods,
        int $paymentsCount,
        string $paymentsTotal,
        string $expectedCashAmount,
        int $pendingInvoiceCount,
        string $pendingAmount,
        $payments,
        $movements,
    ): array {
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
