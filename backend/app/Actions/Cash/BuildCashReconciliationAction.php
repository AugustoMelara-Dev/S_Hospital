<?php

namespace App\Actions\Cash;

use App\Models\CashRegisterSession;
use App\Models\Invoice;
use App\Models\Payment;
use App\Support\Money;
use Illuminate\Support\Facades\DB;

class BuildCashReconciliationAction
{
    /**
     * @return array{
     *     payments_count: int,
     *     payments_total: string,
     *     payments_by_method: array{cash: string, transfer: string, card: string, other: string},
     *     expected_cash_amount: string,
     *     pending_invoice_count: int,
     *     pending_amount: string
     * }
     */
    public function execute(CashRegisterSession $session): array
    {
        $paymentsByMethod = $this->zeroMethodTotals();
        $paymentRows = Payment::query()
            ->join('invoices', 'payments.invoice_id', '=', 'invoices.id')
            ->where('payments.cash_session_id', $session->id)
            ->where('payments.status', Payment::STATUS_POSTED)
            ->where('invoices.status', '!=', Invoice::STATUS_VOID)
            ->whereNotNull('payments.amount_cents')
            ->groupBy('payments.method')
            ->select(
                'payments.method',
                DB::raw('COUNT(*) as payments_count'),
                DB::raw('SUM(payments.amount_cents) as total_cents'),
            )
            ->get();

        $paymentsCount = 0;
        $paymentsTotalCents = 0;

        foreach ($paymentRows as $row) {
            if (! array_key_exists($row->method, $paymentsByMethod)) {
                continue;
            }

            $methodCents = (int) $row->total_cents;
            $paymentsByMethod[$row->method] = Money::formatCents($methodCents);
            $paymentsCount += (int) $row->payments_count;
            $paymentsTotalCents += $methodCents;
        }

        $pendingRow = Invoice::query()
            ->where('cash_session_id', $session->id)
            ->whereIn('status', [Invoice::STATUS_ISSUED, Invoice::STATUS_PARTIAL])
            ->selectRaw('COUNT(*) as invoice_count, COALESCE(SUM(ROUND(balance_due * 100)), 0) as total_cents')
            ->first();

        $openingCents = Money::parseCents((string) $session->opening_amount, 'opening_amount');
        $cashCents = Money::parseCents($paymentsByMethod[Payment::METHOD_CASH], 'cash_payments');

        return [
            'payments_count' => $paymentsCount,
            'payments_total' => Money::formatCents($paymentsTotalCents),
            'payments_by_method' => $paymentsByMethod,
            'expected_cash_amount' => Money::formatCents($openingCents + $cashCents),
            'pending_invoice_count' => (int) ($pendingRow?->invoice_count ?? 0),
            'pending_amount' => Money::formatCents((int) ($pendingRow?->total_cents ?? 0)),
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
