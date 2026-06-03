<?php

declare(strict_types=1);

namespace App\Actions\Cash;

use App\Events\CashSessionChanged;
use App\Models\AuditLog;
use App\Models\CashMovement;
use App\Models\CashRegisterSession;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class OpenCashSessionAction
{
    /**
     * @param  array{opening_amount: string, notes?: ?string}  $payload
     */
    public function execute(array $payload, User $user): CashRegisterSession
    {
        try {
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
                    'open_user_id' => $user->id,
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
                        'opened_at' => $session->opened_at->toISOString(),
                    ],
                ]);

                DB::afterCommit(function () use ($session) {
                    CashSessionChanged::dispatch($session->fresh(), 'opened');
                });

                return $session->load('user:id,name,username');
            });
        } catch (QueryException $exception) {
            if ($this->isOpenSessionUniqueViolation($exception)) {
                throw ValidationException::withMessages([
                    'cash_session' => 'El cajero ya tiene una caja abierta.',
                ]);
            }

            throw $exception;
        }
    }

    private function isOpenSessionUniqueViolation(QueryException $exception): bool
    {
        return str_contains($exception->getMessage(), 'cash_register_sessions_open_user_id_unique');
    }
}
