<?php

namespace App\Actions\Cash;

use App\Events\CashSessionChanged;
use App\Models\AuditLog;
use App\Models\CashMovement;
use App\Models\CashRegisterSession;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\User;
use App\Support\Money;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class CloseCashSessionAction
{
    private const MIN_DIFFERENCE_NOTE_LENGTH = 5;

    /** @var list<int> */
    private const BILL_DENOMINATIONS = [500, 200, 100, 50, 20, 10, 5, 2, 1];

    public function __construct(private readonly BuildCashReconciliationAction $buildCashReconciliation) {}

    /**
     * @param  array{closing_amount: string, notes?: ?string, closing_breakdown?: array<string, mixed>}  $payload
     *
     * @throws AuthorizationException
     */
    public function execute(CashRegisterSession $session, array $payload, User $user, ?Request $request = null): CashRegisterSession
    {
        return DB::transaction(function () use ($session, $payload, $user, $request): CashRegisterSession {
            $lockedSession = CashRegisterSession::query()
                ->whereKey($session->id)
                ->lockForUpdate()
                ->firstOrFail();

            if ($lockedSession->user_id !== $user->id && ! $user->can('cash.close_any')) {
                throw new AuthorizationException('No puede cerrar la caja de otro usuario.');
            }

            if ($lockedSession->status !== CashRegisterSession::STATUS_OPEN) {
                throw ValidationException::withMessages([
                    'cash_session' => 'La caja ya esta cerrada.',
                ]);
            }

            // Lock invoices and payments for this session to prevent concurrent modification
            Invoice::query()->where('cash_session_id', $lockedSession->id)->lockForUpdate()->pluck('id');
            Payment::query()->where('cash_session_id', $lockedSession->id)->lockForUpdate()->pluck('id');

            $reconciliation = $this->buildCashReconciliation->execute($lockedSession);
            $pendingInvoiceCount = $reconciliation['pending_invoice_count'];

            if ($pendingInvoiceCount > 0) {
                throw ValidationException::withMessages([
                    'cash_session' => "No se puede cerrar la caja con {$pendingInvoiceCount} factura(s) pendientes o parciales por L. {$reconciliation['pending_amount']}. Revise los cobros antes de cerrar.",
                ]);
            }

            $missingInstitutionalReceiptCount = $reconciliation['missing_institutional_receipt_count'];

            if ($missingInstitutionalReceiptCount > 0) {
                throw ValidationException::withMessages([
                    'cash_session' => "No se puede cerrar la caja con {$missingInstitutionalReceiptCount} factura(s) pagadas sin recibo institucional emitido. Genere el recibo institucional pendiente antes de cerrar.",
                ]);
            }

            $expectedCents = Money::parseCents($reconciliation['expected_cash_amount'], 'expected_cash_amount');
            $closingCents = Money::parseCents($payload['closing_amount'], 'closing_amount');
            $closingBreakdown = $this->normalizeClosingBreakdown($payload['closing_breakdown'] ?? null);

            if ($closingBreakdown !== null && $this->breakdownTotalCents($closingBreakdown) !== $closingCents) {
                throw ValidationException::withMessages([
                    'closing_breakdown' => 'El total del conteo por denominaciones debe coincidir con el monto contado.',
                ]);
            }

            $differenceCents = $closingCents - $expectedCents;
            $notes = trim((string) ($payload['notes'] ?? ''));

            if ($differenceCents !== 0 && $notes === '') {
                throw ValidationException::withMessages([
                    'notes' => 'Explique la diferencia de caja antes de cerrar.',
                ]);
            }

            if ($differenceCents !== 0 && mb_strlen($notes) < self::MIN_DIFFERENCE_NOTE_LENGTH) {
                throw ValidationException::withMessages([
                    'notes' => 'Explique la diferencia de caja con al menos 5 caracteres.',
                ]);
            }

            CashMovement::query()->create([
                'cash_session_id' => $lockedSession->id,
                'user_id' => $user->id,
                'type' => CashMovement::TYPE_CLOSING,
                'method' => CashMovement::TYPE_CLOSING,
                'amount' => Money::formatCents($closingCents),
                'notes' => $notes === '' ? null : $notes,
                'occurred_at' => now(),
            ]);
            $lockedSession->forceFill([
                'closing_amount' => Money::formatCents($closingCents),
                'expected_amount' => Money::formatCents($expectedCents),
                'difference_amount' => Money::formatCents($differenceCents),
                'payments_count_snapshot' => $reconciliation['payments_count'],
                'payments_total_snapshot' => $reconciliation['payments_total'],
                'method_totals_snapshot' => $reconciliation['payments_by_method'],
                'pending_invoice_count_snapshot' => $pendingInvoiceCount,
                'pending_amount_snapshot' => $reconciliation['pending_amount'],
                'status' => CashRegisterSession::STATUS_CLOSED,
                'open_user_id' => null,
                'closed_by_user_id' => $user->id,
                'closing_notes' => $notes === '' ? null : $notes,
                'closing_breakdown' => $closingBreakdown,
                'closed_at' => now(),
            ])->save();

            AuditLog::query()->create([
                'user_id' => $user->id,
                'action' => 'cash_session.closed',
                'result' => 'success',
                'entity_type' => CashRegisterSession::class,
                'entity_id' => $lockedSession->id,
                'new_values' => [
                    'closing_amount' => $lockedSession->closing_amount,
                    'expected_amount' => $lockedSession->expected_amount,
                    'difference_amount' => $lockedSession->difference_amount,
                    'payments_by_method' => $reconciliation['payments_by_method'],
                    'payments_total' => $reconciliation['payments_total'],
                    'payments_count' => $reconciliation['payments_count'],
                    'pending_invoice_count' => $pendingInvoiceCount,
                    'pending_amount' => $reconciliation['pending_amount'],
                    'closed_by_user_id' => $user->id,
                    'closing_breakdown' => $closingBreakdown,
                ],
                'reason' => $notes === '' ? null : $notes,
                'ip_address' => $request?->ip(),
                'ip' => $request?->ip(),
                'user_agent' => $request?->userAgent(),
                'url' => $request?->fullUrl(),
                'http_method' => $request?->method(),
            ]);

            if ($differenceCents !== 0) {
                AuditLog::query()->create([
                    'user_id' => $user->id,
                    'action' => 'cash_session.difference',
                    'result' => 'success',
                    'entity_type' => CashRegisterSession::class,
                    'entity_id' => $lockedSession->id,
                    'new_values' => [
                        'closing_amount' => $lockedSession->closing_amount,
                        'expected_amount' => $lockedSession->expected_amount,
                        'difference_amount' => $lockedSession->difference_amount,
                    ],
                    'reason' => $notes,
                    'ip_address' => $request?->ip(),
                    'ip' => $request?->ip(),
                    'user_agent' => $request?->userAgent(),
                    'url' => $request?->fullUrl(),
                    'http_method' => $request?->method(),
                ]);
            }

            DB::afterCommit(function () use ($lockedSession) {
                CashSessionChanged::dispatch($lockedSession->refresh(), 'closed');
            });

            return $lockedSession->load(['user:id,name,username', 'closedBy:id,name,username']);
        });
    }

    /**
     * @param  array<string, mixed>|null  $breakdown
     * @return array{bills: array<int, int>, other_amount: string}|null
     */
    private function normalizeClosingBreakdown(?array $breakdown): ?array
    {
        if ($breakdown === null) {
            return null;
        }

        $providedBills = is_array($breakdown['bills'] ?? null) ? $breakdown['bills'] : [];
        $bills = [];

        foreach (self::BILL_DENOMINATIONS as $denomination) {
            $bills[$denomination] = (int) ($providedBills[$denomination] ?? 0);
        }

        $otherCents = Money::parseCents((string) ($breakdown['other_amount'] ?? '0.00'), 'closing_breakdown.other_amount');

        return [
            'bills' => $bills,
            'other_amount' => Money::formatCents($otherCents),
        ];
    }

    /**
     * @param  array{bills: array<int, int>, other_amount: string}  $breakdown
     */
    private function breakdownTotalCents(array $breakdown): int
    {
        $totalCents = Money::parseCents($breakdown['other_amount'], 'closing_breakdown.other_amount');

        foreach (self::BILL_DENOMINATIONS as $denomination) {
            $totalCents += $denomination * 100 * $breakdown['bills'][$denomination];
        }

        return $totalCents;
    }
}
