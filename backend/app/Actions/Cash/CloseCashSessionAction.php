<?php

namespace App\Actions\Cash;

use App\Models\AuditLog;
use App\Models\CashMovement;
use App\Models\CashRegisterSession;
use App\Models\Payment;
use App\Models\User;
use App\Support\Money;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class CloseCashSessionAction
{
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

            $openingCents = Money::parseCents((string) $lockedSession->opening_amount, 'opening_amount');
            $cashPaymentCents = Payment::query()
                ->where('cash_session_id', $lockedSession->id)
                ->where('method', Payment::METHOD_CASH)
                ->where('status', Payment::STATUS_POSTED)
                ->get()
                ->sum(fn (Payment $payment): int => Money::parseCents((string) $payment->amount, 'payments'));
            $expectedCents = $openingCents + $cashPaymentCents;
            $closingCents = Money::parseCents($payload['closing_amount'], 'closing_amount');
            $differenceCents = $closingCents - $expectedCents;

            $lockedSession->forceFill([
                'closing_amount' => Money::formatCents($closingCents),
                'expected_amount' => Money::formatCents($expectedCents),
                'difference_amount' => Money::formatCents($differenceCents),
                'status' => CashRegisterSession::STATUS_CLOSED,
                'closing_notes' => $payload['notes'] ?? null,
                'closed_at' => now(),
            ])->save();

            CashMovement::query()->create([
                'cash_session_id' => $lockedSession->id,
                'user_id' => $user->id,
                'type' => CashMovement::TYPE_CLOSING,
                'method' => CashMovement::TYPE_CLOSING,
                'amount' => Money::formatCents($closingCents),
                'notes' => $payload['notes'] ?? null,
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
                ],
            ]);

            return $lockedSession->load('user:id,name,username');
        });
    }
}
