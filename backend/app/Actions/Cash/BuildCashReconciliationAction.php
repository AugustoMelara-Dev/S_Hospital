<?php

namespace App\Actions\Cash;

use App\Models\CashRegisterSession;
use App\Models\InstitutionalReceipt;
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
     *     pending_amount: string,
     *     missing_institutional_receipt_count: int,
     *     reversed_payments_count: int,
     *     reversed_payments_total: string
     * }
     */
    public function execute(CashRegisterSession $session): array
    {
        return $this->executeForAggregate($session) + [
            'missing_institutional_receipt_count' => $this->missingInstitutionalReceiptCount($session),
        ];
    }

    /**
     * Mismo contrato que `execute()` menos la auditoria de recibos faltantes. El
     * consolidado por caja no expone ese campo y esa consulta correlacionada
     * (`NOT EXISTS` sobre `institutional_receipts`) es la parte mas costosa del
     * reporte (C1-FIN-01). El resto de campos es identico, calculado igual.
     *
     * @return array{
     *     payments_count: int,
     *     payments_total: string,
     *     payments_by_method: array{cash: string, transfer: string, card: string, other: string},
     *     expected_cash_amount: string,
     *     pending_invoice_count: int,
     *     pending_amount: string,
     *     reversed_payments_count: int,
     *     reversed_payments_total: string
     * }
     */
    public function executeForAggregate(CashRegisterSession $session): array
    {
        $paymentsByMethod = $this->zeroMethodTotals();
        $paymentRows = Payment::query()
            ->join('invoices', 'payments.invoice_id', '=', 'invoices.id')
            ->where('payments.cash_session_id', $session->id)
            ->where('payments.status', Payment::STATUS_POSTED)
            ->where('invoices.status', '!=', Invoice::STATUS_VOID)
            ->whereNotNull('payments.amount_cents')
            ->where('payments.amount_cents', '!=', 0)
            ->groupBy('payments.method')
            ->select(
                'payments.method',
                DB::raw('COUNT(*) as payments_count'),
                DB::raw('SUM(payments.amount_cents) as total_cents'),
            )
            ->toBase()
            ->get();

        $paymentsCount = 0;
        $paymentsTotal = Money::zero();

        foreach ($paymentRows as $row) {
            if (! array_key_exists($row->method, $paymentsByMethod)) {
                continue;
            }

            $methodMoney = Money::fromCents((int) $row->total_cents);
            $paymentsByMethod[$row->method] = Money::formatCents($methodMoney->toCents());
            $paymentsCount += (int) $row->payments_count;
            $paymentsTotal = $paymentsTotal->plus($methodMoney);
        }

        $pendingRow = Invoice::query()
            ->whereIn('status', [Invoice::STATUS_ISSUED, Invoice::STATUS_PARTIAL])
            ->where(function ($query) use ($session): void {
                $query
                    ->where('cash_session_id', $session->id)
                    ->orWhereExists(function ($subquery) use ($session): void {
                        $subquery
                            ->selectRaw('1')
                            ->from('payments')
                            ->whereColumn('payments.invoice_id', 'invoices.id')
                            ->where('payments.cash_session_id', $session->id)
                            ->where('payments.status', Payment::STATUS_POSTED);
                    });
            })
            ->selectRaw('COUNT(*) as invoice_count, COALESCE(SUM(balance_due_cents), 0) as total_cents')
            ->toBase()
            ->first();

        $reversedPaymentsQuery = Payment::query()
            ->where('cash_session_id', $session->id)
            ->where('status', Payment::STATUS_VOID)
            ->whereNotNull('amount_cents');
        $reversedPaymentsCount = (clone $reversedPaymentsQuery)->count();
        $reversedPaymentsTotalCents = (int) (clone $reversedPaymentsQuery)->sum('amount_cents');

        $openingCents = Money::parseCents((string) $session->opening_amount, 'opening_amount');
        $cashCents = Money::parseCents($paymentsByMethod[Payment::METHOD_CASH], 'cash_payments');
        $expectedCents = $openingCents + $cashCents;

        return [
            'payments_count' => $paymentsCount,
            'payments_total' => Money::formatCents($paymentsTotal->toCents()),
            'payments_by_method' => $paymentsByMethod,
            'expected_cash_amount' => Money::formatCents($expectedCents),
            'pending_invoice_count' => (int) ($pendingRow->invoice_count ?? 0),
            'pending_amount' => Money::formatCents((int) ($pendingRow->total_cents ?? 0)),
            'reversed_payments_count' => $reversedPaymentsCount,
            'reversed_payments_total' => Money::formatCents($reversedPaymentsTotalCents),
        ];
    }

    /**
     * Auditoria (costosa) de facturas pagadas sin recibo institucional emitido en
     * la sesion. Solo la usan `execute()` y, por tanto, el detalle de sesion y el
     * cierre; el consolidado por caja no la necesita.
     */
    private function missingInstitutionalReceiptCount(CashRegisterSession $session): int
    {
        return (int) Invoice::query()
            ->where('status', Invoice::STATUS_PAID)
            ->where(function ($query) use ($session): void {
                $query
                    ->where('cash_session_id', $session->id)
                    ->orWhereExists(function ($subquery) use ($session): void {
                        $subquery
                            ->selectRaw('1')
                            ->from('payments')
                            ->whereColumn('payments.invoice_id', 'invoices.id')
                            ->where('payments.cash_session_id', $session->id)
                            ->where('payments.status', Payment::STATUS_POSTED);
                    });
            })
            ->whereNotExists(function ($subquery): void {
                $subquery
                    ->selectRaw('1')
                    ->from('institutional_receipts')
                    ->whereColumn('institutional_receipts.invoice_id', 'invoices.id')
                    ->where('institutional_receipts.status', InstitutionalReceipt::STATUS_ISSUED);
            })
            ->count();
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
