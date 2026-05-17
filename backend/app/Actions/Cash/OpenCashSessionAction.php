<?php

namespace App\Actions\Cash;

use App\Models\AuditLog;
use App\Models\CashMovement;
use App\Models\CashRegisterSession;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class OpenCashSessionAction
{
    /**
     * @param  array{opening_amount: string, notes?: ?string}  $payload
     */
    public function execute(array $payload, User $user): CashRegisterSession
    {
        return DB::transaction(function () use ($payload, $user): CashRegisterSession {
            $alreadyOpen = CashRegisterSession::query()
                ->where('user_id', $user->id)
                ->where('status', CashRegisterSession::STATUS_OPEN)
                ->lockForUpdate()
                ->exists();

            if ($alreadyOpen) {
                throw ValidationException::withMessages([
                    'cash_session' => 'El cajero ya tiene una caja abierta.',
                ]);
            }

            $session = CashRegisterSession::query()->create([
                'user_id' => $user->id,
                'opening_amount' => $payload['opening_amount'],
                'status' => CashRegisterSession::STATUS_OPEN,
                'opening_notes' => $payload['notes'] ?? null,
                'opened_at' => now(),
            ]);

            CashMovement::query()->create([
                'cash_session_id' => $session->id,
                'user_id' => $user->id,
                'type' => CashMovement::TYPE_OPENING,
                'method' => CashMovement::TYPE_OPENING,
                'amount' => $payload['opening_amount'],
                'notes' => $payload['notes'] ?? null,
                'occurred_at' => now(),
            ]);

            AuditLog::query()->create([
                'user_id' => $user->id,
                'action' => 'cash_session.opened',
                'entity_type' => CashRegisterSession::class,
                'entity_id' => $session->id,
                'new_values' => [
                    'opening_amount' => $session->opening_amount,
                    'opened_at' => $session->opened_at?->toISOString(),
                ],
            ]);

            return $session->load('user:id,name,username');
        });
    }
}
