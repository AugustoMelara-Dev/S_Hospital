<?php

namespace App\Actions\Cash;

use App\Events\CashSessionChanged;
use App\Models\CashMovement;
use App\Models\CashRegisterSession;
use App\Models\User;
use App\Support\AuditLogger;
use Illuminate\Database\QueryException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class OpenCashSessionAction
{
    public function __construct(
        private readonly AuditLogger $auditLogger,
    ) {}

    /**
     * @param  array{opening_amount: string, notes?: ?string}  $payload
     */
    public function execute(array $payload, User $user, ?Request $request = null): CashRegisterSession
    {
        try {
            return DB::transaction(function () use ($payload, $user, $request): CashRegisterSession {
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

                $this->auditLogger->log(
                    action: 'cash_session.opened',
                    entity: $session,
                    user: $user,
                    request: $request,
                    newValues: [
                        'opening_amount' => $session->opening_amount,
                        'opened_at' => $session->opened_at->toISOString(),
                    ],
                );

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
