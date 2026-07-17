<?php

namespace App\Actions\Cash;

use App\Events\CashSessionChanged;
use App\Models\CashMovement;
use App\Models\CashRegisterSession;
use App\Models\User;
use App\Support\AuditLogger;
use App\Support\Money;
use Illuminate\Database\QueryException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class OpenCashSessionAction
{
    private const OPEN_SESSION_LOCK_NAME = 's_hospital_open_cash_session';

    public function __construct(
        private readonly AuditLogger $auditLogger,
    ) {}

    /**
     * @param  array{opening_amount: string, notes?: ?string}  $payload
     */
    public function execute(array $payload, User $user, ?Request $request = null): CashRegisterSession
    {
        $lockAcquired = $this->acquireOpenSessionLock();

        try {
            return DB::transaction(function () use ($payload, $user, $request): CashRegisterSession {
                User::query()
                    ->whereKey($user->id)
                    ->lockForUpdate()
                    ->firstOrFail();

                $alreadyOpen = CashRegisterSession::query()
                    ->where('status', CashRegisterSession::STATUS_OPEN)
                    ->lockForUpdate()
                    ->exists();

                if ($alreadyOpen) {
                    throw ValidationException::withMessages([
                        'cash_session' => 'Ya existe una caja abierta en esta terminal. Cierre la caja actual antes de abrir otra.',
                    ]);
                }

                $openedAt = now();
                $session = CashRegisterSession::query()->create([
                    'user_id' => $user->id,
                    'open_user_id' => $user->id,
                    'opening_amount' => $payload['opening_amount'],
                    'status' => CashRegisterSession::STATUS_OPEN,
                    'opening_notes' => $payload['notes'] ?? null,
                    'opened_at' => $openedAt,
                ]);

                if (Money::parseCents($payload['opening_amount'], 'opening_amount') > 0) {
                    CashMovement::query()->create([
                        'cash_session_id' => $session->id,
                        'user_id' => $user->id,
                        'type' => CashMovement::TYPE_OPENING,
                        'method' => CashMovement::TYPE_OPENING,
                        'amount' => $payload['opening_amount'],
                        'notes' => $payload['notes'] ?? null,
                        'occurred_at' => now(),
                    ]);
                }

                $this->auditLogger->log(
                    action: 'cash_session.opened',
                    entity: $session,
                    user: $user,
                    request: $request,
                    newValues: [
                        'opening_amount' => $session->opening_amount,
                        'opened_at' => $openedAt->toISOString(),
                    ],
                );

                DB::afterCommit(function () use ($session) {
                    CashSessionChanged::dispatch($session->refresh(), 'opened');
                });

                return $session->load('user:id,name,username');
            });
        } catch (QueryException $exception) {
            if ($this->hasOpenSession() || $this->isOpenSessionConcurrencyViolation($exception)) {
                throw ValidationException::withMessages([
                    'cash_session' => 'Ya existe una caja abierta en esta terminal. Cierre la caja actual antes de abrir otra.',
                ]);
            }

            throw $exception;
        } finally {
            if ($lockAcquired) {
                $this->releaseOpenSessionLock();
            }
        }
    }

    private function acquireOpenSessionLock(): bool
    {
        if (DB::connection()->getDriverName() !== 'mysql') {
            return false;
        }

        $result = DB::selectOne('SELECT GET_LOCK(?, 10) AS acquired', [self::OPEN_SESSION_LOCK_NAME]);
        $row = (array) $result;

        if ((int) ($row['acquired'] ?? 0) !== 1) {
            throw ValidationException::withMessages([
                'cash_session' => 'Otra apertura de caja esta en proceso. Intente de nuevo en unos segundos.',
            ]);
        }

        return true;
    }

    private function releaseOpenSessionLock(): void
    {
        DB::selectOne('SELECT RELEASE_LOCK(?) AS released', [self::OPEN_SESSION_LOCK_NAME]);
    }

    private function hasOpenSession(): bool
    {
        return CashRegisterSession::query()
            ->where('status', CashRegisterSession::STATUS_OPEN)
            ->exists();
    }

    private function isOpenSessionConcurrencyViolation(QueryException $exception): bool
    {
        $message = $exception->getMessage();
        $sqlState = (string) ($exception->errorInfo[0] ?? '');
        $driverCode = (string) ($exception->errorInfo[1] ?? '');

        if (in_array($driverCode, ['1062', '1205', '1213'], true)) {
            return true;
        }

        if ($sqlState === '23000') {
            return str_contains($message, 'cash_register_sessions')
                || str_contains($message, 'open_user_id')
                || str_contains($message, 'Duplicate entry');
        }

        return false;
    }
}
