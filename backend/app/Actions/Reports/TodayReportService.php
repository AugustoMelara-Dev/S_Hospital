<?php

namespace App\Actions\Reports;

use App\Actions\Reports\Concerns\FormatsReportMoney;
use App\Models\BackupLog;
use App\Models\CashRegisterSession;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\User;
use App\Support\Money;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Generates the operational "today" snapshot used by the cashier
 * dashboard. All values are scoped to the operational timezone
 * (America/Tegucigalpa) so the cashier never sees data from
 * another day even near midnight.
 *
 * The shape is stable and consumed by frontend/src/hooks/useTodayReport
 * (see HOSPITAL FRONTEND CONTRACTS).
 */
class TodayReportService
{
    use FormatsReportMoney;

    public const HOSPITAL_TIMEZONE = 'America/Tegucigalpa';

    public function __construct(private readonly FinancialFactsService $financialFacts) {}

    /**
     * @return array<string, mixed>
     */
    public function report(?Carbon $reference = null, ?User $user = null): array
    {
        $now = ($reference ?? Carbon::now(self::HOSPITAL_TIMEZONE))->copy();
        $today = $now->copy()->startOfDay();
        $end = $now->copy()->endOfDay();
        $filters = $this->filtersForUser($user);
        $isManagerial = empty($filters);

        $facts = $isManagerial
            ? $this->financialFacts->forRange($today, $end)
            : $this->financialFactsForUser($today, $end, (int) $filters['user_id']);

        $methods = $this->zeroMethodTotals();
        $methodCounts = array_fill_keys(array_keys($methods), 0);

        $paymentMethodRows = Payment::query()
            ->join('invoices', 'payments.invoice_id', '=', 'invoices.id')
            ->where('payments.status', Payment::STATUS_POSTED)
            ->where('invoices.status', '!=', Invoice::STATUS_VOID)
            ->whereBetween('payments.paid_at', [$today, $end])
            ->when(! empty($filters['user_id']), function ($query) use ($filters): void {
                $query->where('payments.user_id', $filters['user_id']);
            })
            ->groupBy('payments.method')
            ->select(
                'payments.method',
                DB::raw('COALESCE(SUM(payments.amount_cents), 0) as total_cents'),
                DB::raw('COUNT(*) as total_count'),
            )
            ->get();

        foreach ($paymentMethodRows as $row) {
            /** @var object{method: string, total_cents: int|string, total_count: int|string} $row */
            if (array_key_exists($row->method, $methods)) {
                $methods[$row->method] = $this->centsToMoney($row->total_cents);
                $methodCounts[$row->method] = (int) $row->total_count;
            }
        }

        $openSession = CashRegisterSession::query()
            ->where('status', CashRegisterSession::STATUS_OPEN)
            ->when(! empty($filters['user_id']), function ($query) use ($filters): void {
                $query->where('user_id', $filters['user_id']);
            })
            ->orderByDesc('id')
            ->first();

        $pendingBackupStatuses = [BackupLog::STATUS_PENDING];
        if (defined(BackupLog::class.'::STATUS_RUNNING')) {
            $pendingBackupStatuses[] = BackupLog::STATUS_RUNNING;
        }

        $pendingBackup = BackupLog::query()
            ->whereIn('status', $pendingBackupStatuses)
            ->when(! $user?->can('backups.view'), function ($query): void {
                $query->whereRaw('1 = 0');
            })
            ->orderByDesc('id')
            ->first();

        $voidedInvoices = Invoice::query()
            ->where('status', Invoice::STATUS_VOID)
            ->whereBetween('voided_at', [$today, $end])
            ->when(! empty($filters['user_id']), function ($query) use ($filters): void {
                $query->where('issued_by', $filters['user_id']);
            })
            ->selectRaw('COUNT(*) as cnt')
            ->selectRaw('COALESCE(SUM(total_cents), 0) as total_cents')
            ->first();

        $reversalCount = $isManagerial
            ? DB::table('audit_logs')
                ->where('action', 'invoice.reversed')
                ->whereBetween('created_at', [$today, $end])
                ->count()
            : 0;

        $pendingInvoices = Invoice::query()
            ->whereIn('status', [Invoice::STATUS_ISSUED, Invoice::STATUS_PARTIAL])
            ->whereBetween('issued_at', [$today, $end])
            ->when(! empty($filters['user_id']), function ($query) use ($filters): void {
                $query->where('issued_by', $filters['user_id']);
            })
            ->selectRaw('COUNT(*) as cnt')
            ->selectRaw('COALESCE(SUM(balance_due_cents), 0) as total_cents')
            ->first();

        $invoicesIssued = (int) $facts['invoice_count'];
        $invoicesCollected = (int) $facts['payment_count'];
        $voidedCount = (int) ($voidedInvoices->cnt ?? 0);
        $pendingCount = (int) ($pendingInvoices->cnt ?? 0);

        return [
            'date' => $today->toDateString(),
            'timezone' => self::HOSPITAL_TIMEZONE,
            'server_time' => $now->toIso8601String(),
            'cash_session_open' => $openSession !== null,
            'cash_session_id' => $openSession?->id,
            'cash_session_opened_at' => $openSession?->opened_at?->toIso8601String(),
            'cash_session_opening_amount' => $openSession !== null
                ? $this->centsToMoney(Money::parseCents((string) $openSession->opening_amount, 'cash_session.opening_amount'))
                : null,
            'issued_count' => $invoicesIssued,
            'collected_count' => $invoicesCollected,
            'billed' => $facts['total_billed'],
            'collected' => $facts['total_collected'],
            'pending' => $facts['total_pending'],
            'voided_count' => $voidedCount,
            'voided_amount' => $this->centsToMoney((int) ($voidedInvoices->total_cents ?? 0)),
            'reversal_count' => (int) $reversalCount,
            'pending_invoice_count' => $pendingCount,
            'pending_invoice_amount' => $this->centsToMoney((int) ($pendingInvoices->total_cents ?? 0)),
            'payments_by_method' => $methods,
            'payments_count_by_method' => $methodCounts,
            'backup_pending' => $pendingBackup !== null,
            'backup_pending_age_hours' => $pendingBackup?->created_at
                ? $now->copy()->diffInHours($pendingBackup->created_at)
                : null,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function filtersForUser(?User $user): array
    {
        if ($user === null || $user->can('reports.managerial.view')) {
            return [];
        }

        return ['user_id' => $user->id];
    }

    /**
     * @return array<string, mixed>
     */
    private function financialFactsForUser(Carbon $start, Carbon $end, int $userId): array
    {
        $invoiceFacts = (array) DB::table('invoices')
            ->whereBetween('issued_at', [$start, $end])
            ->where('issued_by', $userId)
            ->selectRaw('COUNT(*) as invoice_count')
            ->selectRaw(
                'COALESCE(SUM(CASE WHEN status != ? THEN total_cents ELSE 0 END), 0) as billed_cents',
                [Invoice::STATUS_VOID],
            )
            ->selectRaw(
                'COALESCE(SUM(CASE WHEN status IN (?, ?) THEN balance_due_cents ELSE 0 END), 0) as pending_cents',
                [Invoice::STATUS_ISSUED, Invoice::STATUS_PARTIAL],
            )
            ->first();

        $paymentFacts = (array) DB::table('payments')
            ->join('invoices', 'payments.invoice_id', '=', 'invoices.id')
            ->where('payments.status', Payment::STATUS_POSTED)
            ->where('payments.user_id', $userId)
            ->where('invoices.status', '!=', Invoice::STATUS_VOID)
            ->whereBetween('payments.paid_at', [$start, $end])
            ->selectRaw('COUNT(*) as payment_count')
            ->selectRaw('COALESCE(SUM(payments.amount_cents), 0) as collected_cents')
            ->first();

        return [
            'total_billed' => $this->centsToMoney((int) ($invoiceFacts['billed_cents'] ?? 0)),
            'total_pending' => $this->centsToMoney((int) ($invoiceFacts['pending_cents'] ?? 0)),
            'total_partial' => '0.00',
            'total_voided' => '0.00',
            'invoice_count' => (int) ($invoiceFacts['invoice_count'] ?? 0),
            'payment_count' => (int) ($paymentFacts['payment_count'] ?? 0),
            'total_collected' => $this->centsToMoney((int) ($paymentFacts['collected_cents'] ?? 0)),
            'payments_by_method' => $this->zeroMethodTotals(),
        ];
    }
}
