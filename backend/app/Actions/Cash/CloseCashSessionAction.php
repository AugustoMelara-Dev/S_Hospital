<?php

namespace App\Actions\Cash;

use App\Events\CashSessionChanged;
use App\Models\AuditLog;
use App\Models\CashMovement;
use App\Models\CashRegisterSession;
use App\Models\User;
use App\Support\Money;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class CloseCashSessionAction
{
    public function __construct(private readonly BuildCashReconciliationAction $buildCashReconciliation) {}

    /**
     * @param  array{closing_amount: string, notes?: ?string}  $payload
     *
     * @throws AuthorizationException
     */
    public function execute(CashRegisterSession $session, array $payload, User $user): CashRegisterSession
    {
        return DB::transaction(function () use ($session, $payload, $user): CashRegisterSession {
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

            $reconciliation = $this->buildCashReconciliation->execute($lockedSession);
            $pendingInvoiceCount = $reconciliation['pending_invoice_count'];

            if ($pendingInvoiceCount > 0) {
                throw ValidationException::withMessages([
                    'cash_session' => "No se puede cerrar la caja con {$pendingInvoiceCount} factura(s) pendientes o parciales por L. {$reconciliation['pending_amount']}. Revise los cobros antes de cerrar.",
                ]);
            }

            $expectedCents = Money::parseCents($reconciliation['expected_cash_amount'], 'expected_cash_amount');
            $closingCents = Money::parseCents($payload['closing_amount'], 'closing_amount');
            $differenceCents = $closingCents - $expectedCents;
            $notes = trim((string) ($payload['notes'] ?? ''));

            if ($differenceCents !== 0 && $notes === '') {
                throw ValidationException::withMessages([
                    'notes' => 'Explique la diferencia de caja antes de cerrar.',
                ]);
            }

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
                'closing_notes' => $notes === '' ? null : $notes,
                'closed_at' => now(),
            ])->save();

            CashMovement::query()->create([
                'cash_session_id' => $lockedSession->id,
                'user_id' => $user->id,
                'type' => CashMovement::TYPE_CLOSING,
                'method' => CashMovement::TYPE_CLOSING,
                'amount' => Money::formatCents($closingCents),
                'notes' => $notes === '' ? null : $notes,
                'occurred_at' => now(),
            ]);

            AuditLog::query()->create([
                'user_id' => $user->id,
                'action' => 'cash_session.closed',
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
                ],
            ]);

            DB::afterCommit(function () use ($lockedSession) {
                CashSessionChanged::dispatch($lockedSession->fresh(), 'closed');
            });

            return $lockedSession->load('user:id,name,username');
        });
    }
}
