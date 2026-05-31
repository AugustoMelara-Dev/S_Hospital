<?php

namespace App\Actions\Cash;

use App\Actions\Backups\CreateBackupAction;
use App\Jobs\RunBackupJob;
use App\Models\AuditLog;
use App\Models\BackupLog;
use App\Models\CashMovement;
use App\Models\CashRegisterSession;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\User;
use App\Support\AuditLogger;
use App\Support\Money;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;

class CloseCashSessionAction
{
    public function __construct(
        private readonly AuditLogger $auditLogger,
    ) {}

    /**
     * @param  array{closing_amount: string, notes?: ?string}  $payload
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

            $pendingInvoiceCount = Invoice::query()
                ->where('cash_session_id', $lockedSession->id)
                ->whereIn('status', [Invoice::STATUS_ISSUED, Invoice::STATUS_PARTIAL])
                ->count();

            if ($pendingInvoiceCount > 0) {
                throw ValidationException::withMessages([
                    'cash_session' => 'No se puede cerrar la caja con facturas pendientes o parciales. Revise los cobros antes de cerrar.',
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
                ],
            ]);

            if ($differenceCents !== 0) {
                $this->auditLogger->log(
                    action: 'cash_session.difference',
                    entity: $lockedSession,
                    user: $user,
                    request: $request,
                    newValues: [
                        'closing_amount' => $lockedSession->closing_amount,
                        'expected_amount' => $lockedSession->expected_amount,
                        'difference_amount' => $lockedSession->difference_amount,
                    ],
                    reason: $notes,
                );
            }

            DB::afterCommit(function () use ($user): void {
                try {
                    $backupLog = app(CreateBackupAction::class)->createPending($user, BackupLog::TYPE_SCHEDULED);
                    RunBackupJob::dispatch($backupLog->id);
                } catch (\Throwable $exception) {
                    Log::warning('No se pudo programar respaldo al cerrar caja.', [
                        'user_id' => $user->id,
                        'message' => $exception->getMessage(),
                    ]);
                }
            });

            return $lockedSession->load('user:id,name,username');
        });
    }
}
