<?php

namespace App\Actions\Cash;

use App\Events\CashSessionChanged;
use App\Models\CashMovement;
use App\Models\CashRegister;
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
    /**
     * Prefijo del lock nombrado de MariaDB. Se acota por caja para que dos
     * aperturas en cajas distintas no se serialicen entre si; la proteccion
     * global historica se sustituye por una del alcance correcto (mandato §7)
     * sin eliminar el lock.
     */
    private const OPEN_SESSION_LOCK_PREFIX = 's_hospital_open_cash_session';

    /** Caja del modo simple: se usa cuando el cliente no elige caja. */
    public const DEFAULT_REGISTER_CODE = 'principal';

    public function __construct(
        private readonly AuditLogger $auditLogger,
    ) {}

    /**
     * @param  array{opening_amount: string, notes?: ?string, cash_register_id?: int|string|null}  $payload
     */
    public function execute(array $payload, User $user, ?Request $request = null): CashRegisterSession
    {
        $registerId = $this->resolveRegisterId($payload);

        $lockAcquired = $this->acquireOpenSessionLock($registerId);

        try {
            return DB::transaction(function () use ($payload, $user, $request, $registerId): CashRegisterSession {
                User::query()
                    ->whereKey($user->id)
                    ->lockForUpdate()
                    ->firstOrFail();

                // Lock the (stable, existing) cash_registers row instead of a
                // non-existent cash_register_sessions range: a `SELECT ... FOR
                // UPDATE` on a missing row takes a gap lock and two concurrent
                // opens in DISTINCT registers deadlock on the subsequent INSERT
                // (InnoDB 1213). The register row serialises opens of the same
                // register without touching the empty-range gap the other
                // register needs.
                CashRegister::query()
                    ->whereKey($registerId)
                    ->lockForUpdate()
                    ->first();

                // Plain read inside the serialized section: writers of this
                // register already hold the row lock above, and the unique
                // index `(cash_register_id, open_marker)` remains the hard guard.
                $alreadyOpen = CashRegisterSession::query()
                    ->where('cash_register_id', $registerId)
                    ->where('status', CashRegisterSession::STATUS_OPEN)
                    ->exists();

                if ($alreadyOpen) {
                    throw ValidationException::withMessages([
                        'cash_session' => 'Ya existe una sesion de caja abierta en esta caja. Cierre la caja actual antes de abrir otra.',
                    ]);
                }

                $openedAt = now();
                $session = CashRegisterSession::query()->create([
                    'cash_register_id' => $registerId,
                    'open_marker' => CashRegisterSession::OPEN_MARKER,
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
                        'cash_register_id' => $session->cash_register_id,
                        'opening_amount' => $session->opening_amount,
                        'opened_at' => $openedAt->toISOString(),
                    ],
                );

                DB::afterCommit(function () use ($session) {
                    CashSessionChanged::dispatch($session->refresh(), 'opened');
                });

                return $session->load(['user:id,name,username', 'cashRegister:id,code,name']);
            }, 3);
        } catch (QueryException $exception) {
            if ($this->isOpenUserViolation($exception)) {
                throw ValidationException::withMessages([
                    'cash_session' => 'Usted ya tiene una caja abierta. Cierre la caja actual antes de abrir otra.',
                ]);
            }

            if ($this->hasOpenSession($registerId) || $this->isOpenSessionConcurrencyViolation($exception)) {
                throw ValidationException::withMessages([
                    'cash_session' => 'Ya existe una sesion de caja abierta en esta caja. Cierre la caja actual antes de abrir otra.',
                ]);
            }

            throw $exception;
        } finally {
            if ($lockAcquired) {
                $this->releaseOpenSessionLock($registerId);
            }
        }
    }

    /**
     * Resuelve la caja en el servidor. Un ID enviado por el navegador solo se
     * acepta si existe y esta activo; si no viene, se usa la caja `principal`
     * del modo simple. Nunca se confia en el ID sin validarlo (mandato §7).
     *
     * @param  array{cash_register_id?: int|string|null}  $payload
     */
    private function resolveRegisterId(array $payload): int
    {
        $requested = $payload['cash_register_id'] ?? null;

        if ($requested !== null && $requested !== '') {
            $registerId = $this->toIntId(
                CashRegister::query()
                    ->whereKey($requested)
                    ->where('active', true)
                    ->value('id'),
            );

            if ($registerId === null) {
                throw ValidationException::withMessages([
                    'cash_register_id' => 'La caja seleccionada no existe o esta inactiva.',
                ]);
            }

            return $registerId;
        }

        $principalId = $this->toIntId(
            CashRegister::query()
                ->where('code', self::DEFAULT_REGISTER_CODE)
                ->where('active', true)
                ->value('id'),
        );

        if ($principalId === null) {
            throw ValidationException::withMessages([
                'cash_register_id' => 'No hay una caja principal activa configurada.',
            ]);
        }

        return $principalId;
    }

    private function toIntId(mixed $value): ?int
    {
        if (is_int($value)) {
            return $value;
        }

        if (is_string($value) && is_numeric($value)) {
            return (int) $value;
        }

        return null;
    }

    private function lockName(int $registerId): string
    {
        return self::OPEN_SESSION_LOCK_PREFIX.'_'.$registerId;
    }

    private function acquireOpenSessionLock(int $registerId): bool
    {
        if (! in_array(DB::connection()->getDriverName(), ['mysql', 'mariadb'], true)) {
            return false;
        }

        $result = DB::selectOne('SELECT GET_LOCK(?, 10) AS acquired', [$this->lockName($registerId)]);
        $row = (array) $result;
        $acquired = $row['acquired'] ?? null;

        if ($acquired !== 1 && $acquired !== '1') {
            throw ValidationException::withMessages([
                'cash_session' => 'Otra apertura de caja esta en proceso. Intente de nuevo en unos segundos.',
            ]);
        }

        return true;
    }

    private function releaseOpenSessionLock(int $registerId): void
    {
        DB::selectOne('SELECT RELEASE_LOCK(?) AS released', [$this->lockName($registerId)]);
    }

    private function hasOpenSession(int $registerId): bool
    {
        return CashRegisterSession::query()
            ->where('cash_register_id', $registerId)
            ->where('status', CashRegisterSession::STATUS_OPEN)
            ->exists();
    }

    /**
     * `unique(open_user_id)` conservado: distingue "yo ya tengo una caja
     * abierta" de "la caja ya esta ocupada por otro cajero".
     */
    private function isOpenUserViolation(QueryException $exception): bool
    {
        $driverCode = (string) ($exception->errorInfo[1] ?? '');

        if ($driverCode !== '1062') {
            return false;
        }

        return str_contains($exception->getMessage(), 'open_user_id');
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
