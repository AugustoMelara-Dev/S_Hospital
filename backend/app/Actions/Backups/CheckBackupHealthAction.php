<?php

namespace App\Actions\Backups;

use App\Actions\Backups\Alerts\AlertChannel;
use App\Actions\Backups\Alerts\NullAlertChannel;
use App\Models\AuditLog;
use App\Models\BackupLog;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Throwable;

/**
 * Evaluacion server-side de salud de respaldos (HS-BK-ALERT).
 *
 * Detecta respaldos atrasados (creacion), atraso de la ultima copia verificada
 * recuperable (`recovery_stale`, senal de RPO distinta a `backup_stale`),
 * fallos consecutivos, pendientes vencidos, ausencia de copia verificada y
 * estado de la copia externa. Las alertas se
 * registran localmente de forma idempotente (auditoria + cache) y se entregan
 * al canal configurado; por defecto {@see NullAlertChannel} no envia nada
 * fuera del servidor: no se afirma un despliegue externo inexistente.
 *
 * Fail-closed externo (T3-009): si el destino configurado HOY no pasa el guard
 * de {@see ExternalBackupCopyAction}, ninguna copia del ledger cuenta como
 * verificada y la salud alerta la causa raiz (`external_destination_invalid`)
 * aunque el ledger aun conserve filas `verified` de una verificacion previa.
 */
class CheckBackupHealthAction
{
    public const CACHE_KEY_ACTIVE = 'hospital:backup-health:active-alerts';

    public function __construct(
        private readonly LastRecoverableBackupAction $lastRecoverable,
        private readonly AlertChannel $channel = new NullAlertChannel,
        private readonly ExternalBackupCopyAction $externalCopy = new ExternalBackupCopyAction,
    ) {}

    /**
     * @return array{
     *     status: string,
     *     alerts: list<array{code: string, severity: string, context: array<string, mixed>}>,
     *     external: array<string, mixed>,
     *     last_recoverable: array<string, mixed>|null,
     *     generated_at: string
     * }
     */
    public function execute(): array
    {
        $alerts = $this->detectAlerts();
        $this->syncLocalAlerts($alerts);

        return [
            'status' => $alerts === [] ? 'ok' : 'attention',
            'alerts' => $alerts,
            'external' => $this->externalStatus(),
            'last_recoverable' => $this->lastRecoverable->execute(),
            'generated_at' => now()->toIso8601String(),
        ];
    }

    /**
     * @return list<array{code: string, severity: string, context: array<string, mixed>}>
     */
    private function detectAlerts(): array
    {
        $alerts = [];

        $lastSuccess = BackupLog::query()
            ->where('status', BackupLog::STATUS_SUCCESS)
            ->orderByDesc('completed_at')
            ->orderByDesc('id')
            ->first();

        foreach (array_merge(
            $this->staleBackupAlerts($lastSuccess),
            $this->failureAlerts($lastSuccess),
            $this->stalePendingAlerts(),
            $this->recoverabilityAlerts($lastSuccess),
            $this->externalAlerts($lastSuccess),
        ) as $alert) {
            $alerts[] = $alert;
        }

        return $alerts;
    }

    /**
     * @return list<array{code: string, severity: string, context: array<string, mixed>}>
     */
    private function staleBackupAlerts(?BackupLog $lastSuccess): array
    {
        $staleAfterHours = max(1, $this->configInt('backups.alerts.stale_after_hours', 12));
        $lastCompletedAt = $this->completedAt($lastSuccess);

        if ($lastCompletedAt === null) {
            return [[
                'code' => 'backup_stale',
                'severity' => 'warning',
                'context' => [
                    'reason' => 'sin_respaldo_exitoso',
                    'stale_after_hours' => $staleAfterHours,
                ],
            ]];
        }

        $ageHours = (float) $lastCompletedAt->diffInHours(now(), true);

        if ($ageHours <= $staleAfterHours) {
            return [];
        }

        return [[
            'code' => 'backup_stale',
            'severity' => 'warning',
            'context' => [
                'reason' => 'respaldo_atrasado',
                'age_hours' => round($ageHours, 1),
                'stale_after_hours' => $staleAfterHours,
                'backup_log_id' => $lastSuccess?->id,
            ],
        ]];
    }

    /**
     * @return list<array{code: string, severity: string, context: array<string, mixed>}>
     */
    private function failureAlerts(?BackupLog $lastSuccess): array
    {
        $threshold = max(1, $this->configInt('backups.alerts.consecutive_failures', 3));
        $lastCompletedAt = $this->completedAt($lastSuccess);
        $lastId = $lastSuccess?->id;

        $query = BackupLog::query()->where('status', BackupLog::STATUS_FAILED);

        if ($lastCompletedAt !== null) {
            $query->where(function ($query) use ($lastCompletedAt, $lastId): void {
                $query
                    ->where('completed_at', '>', $lastCompletedAt)
                    ->orWhere(function ($query) use ($lastCompletedAt, $lastId): void {
                        $query
                            ->where('completed_at', $lastCompletedAt)
                            ->where('id', '>', $lastId);
                    });
            });
        }

        $failedCount = $query->count();

        if ($failedCount < $threshold) {
            return [];
        }

        return [[
            'code' => 'consecutive_failures',
            'severity' => 'warning',
            'context' => [
                'failed_count' => $failedCount,
                'threshold' => $threshold,
                'last_success_backup_id' => $lastId,
            ],
        ]];
    }

    /**
     * @return list<array{code: string, severity: string, context: array<string, mixed>}>
     */
    private function stalePendingAlerts(): array
    {
        $thresholdMinutes = ReconcileStaleBackupLogsAction::STALE_AFTER_MINUTES;

        $stalePendingCount = BackupLog::query()
            ->where('status', BackupLog::STATUS_PENDING)
            ->where('created_at', '<=', now()->subMinutes($thresholdMinutes))
            ->count();

        if ($stalePendingCount === 0) {
            return [];
        }

        return [[
            'code' => 'stale_pending',
            'severity' => 'warning',
            'context' => [
                'stale_pending_count' => $stalePendingCount,
                'threshold_minutes' => $thresholdMinutes,
            ],
        ]];
    }

    /**
     * Recuperabilidad verificada (HS-BK-VERIFY / HS-BK-RPO).
     *
     * La verificacion completa (`verify-backup --latest`) solo corre una vez al
     * dia, por lo que la edad de la ultima copia verificada es un RPO distinto
     * al de creacion: puede llegar a ~24 h aunque el ultimo respaldo sea
     * reciente. `backup_stale` mira `completed_at`; aqui se alerta la edad de
     * `last_recoverable` para no sobreestimar la proteccion.
     *
     * @return list<array{code: string, severity: string, context: array<string, mixed>}>
     */
    private function recoverabilityAlerts(?BackupLog $lastSuccess): array
    {
        if ($lastSuccess === null) {
            return [];
        }

        $lastRecoverable = $this->lastRecoverable->execute();

        if ($lastRecoverable === null) {
            return [[
                'code' => 'recovery_unverified',
                'severity' => 'warning',
                'context' => [
                    'reason' => 'ninguna_copia_verificada',
                    'last_success_backup_id' => $lastSuccess->id,
                ],
            ]];
        }

        $staleAfterHours = max(1, $this->configInt('backups.alerts.recoverable_stale_after_hours', 26));
        $ageHours = $lastRecoverable['age_seconds'] / 3600;

        if ($ageHours <= $staleAfterHours) {
            return [];
        }

        return [[
            'code' => 'recovery_stale',
            'severity' => 'warning',
            'context' => [
                'reason' => 'copia_recuperable_atrasada',
                'age_hours' => round($ageHours, 1),
                'stale_after_hours' => $staleAfterHours,
                'last_recoverable_backup_id' => $lastRecoverable['id'],
                'backup_log_id' => $lastRecoverable['id'],
                'last_recoverable_verified_at' => $lastRecoverable['verified_at'],
                'last_success_backup_id' => $lastSuccess->id,
            ],
        ]];
    }

    /**
     * @return list<array{code: string, severity: string, context: array<string, mixed>}>
     */
    private function externalAlerts(?BackupLog $lastSuccess): array
    {
        if (! (bool) config('backups.external.enabled', false) || $lastSuccess === null) {
            return [];
        }

        if (! Schema::hasTable('backup_external_copies')) {
            return [[
                'code' => 'external_schema_missing',
                'severity' => 'warning',
                'context' => ['reason' => 'tabla_backup_external_copies_ausente'],
            ]];
        }

        $destinationProblem = $this->externalCopy->destinationProblem();

        if ($destinationProblem !== null) {
            // Fail-closed (T3-009): sin destino valido HOY, ninguna fila del
            // ledger es evidencia recuperable; se alerta la causa raiz.
            return [[
                'code' => 'external_destination_invalid',
                'severity' => 'warning',
                'context' => [
                    'reason' => 'destino_externo_no_valido',
                    'destination_problem' => $destinationProblem,
                ],
            ]];
        }

        $row = DB::table('backup_external_copies')
            ->where('backup_log_id', $lastSuccess->id)
            ->orderByDesc('id')
            ->first();

        if ($row === null) {
            return [[
                'code' => 'external_copy_missing',
                'severity' => 'warning',
                'context' => ['backup_log_id' => $lastSuccess->id],
            ]];
        }

        $status = is_string($row->status) ? $row->status : '';

        if ($status === ExternalBackupCopyAction::STATUS_FAILED) {
            return [[
                'code' => 'external_copy_failed',
                'severity' => 'warning',
                'context' => [
                    'copy_id' => is_numeric($row->id) ? (int) $row->id : 0,
                    'backup_log_id' => $lastSuccess->id,
                ],
            ]];
        }

        $reference = $row->verified_at ?? $row->copied_at ?? $row->created_at;
        $referenceAt = is_string($reference) && $reference !== '' ? Carbon::parse($reference) : null;

        if ($referenceAt === null) {
            return [];
        }

        $staleAfterHours = max(1, $this->configInt('backups.alerts.external_stale_after_hours', 26));
        $ageHours = (float) $referenceAt->diffInHours(now(), true);

        if ($status === ExternalBackupCopyAction::STATUS_PENDING || $ageHours > $staleAfterHours) {
            return [[
                'code' => 'external_copy_stale',
                'severity' => 'warning',
                'context' => [
                    'copy_id' => is_numeric($row->id) ? (int) $row->id : 0,
                    'copy_status' => $status,
                    'age_hours' => round($ageHours, 1),
                    'stale_after_hours' => $staleAfterHours,
                ],
            ]];
        }

        return [];
    }

    /**
     * @return array<string, mixed>
     */
    private function externalStatus(): array
    {
        $enabled = (bool) config('backups.external.enabled', false);
        $configuredDisk = config('backups.external.disk', 'backup_external');
        $status = [
            'enabled' => $enabled,
            'disk' => is_string($configuredDisk) && $configuredDisk !== '' ? $configuredDisk : 'backup_external',
            'destination_valid' => null,
            'destination_problem' => null,
            'last_copy_status' => null,
            'last_copy_verified_at' => null,
            'verified_copies_count' => 0,
        ];

        if (! $enabled || ! Schema::hasTable('backup_external_copies')) {
            return $status;
        }

        $destinationProblem = $this->externalCopy->destinationProblem();
        $status['destination_valid'] = $destinationProblem === null;
        $status['destination_problem'] = $destinationProblem;

        $lastCopy = DB::table('backup_external_copies')->orderByDesc('id')->first();
        $status['last_copy_status'] = $lastCopy?->status;
        $status['last_copy_verified_at'] = $lastCopy?->verified_at;

        // Fail-closed (T3-009): una fila `verified` de una verificacion previa
        // no se cuenta si HOY el destino no pasa el guard (root vaciado/roto):
        // sin destino valido la copia no es re-verificable ni recuperable
        // desde el ledger.
        if ($destinationProblem === null) {
            $status['verified_copies_count'] = (int) DB::table('backup_external_copies')
                ->where('status', ExternalBackupCopyAction::STATUS_VERIFIED)
                ->count();
        }

        return $status;
    }

    /**
     * Registra transiciones locales de alerta de forma idempotente.
     *
     * @param  list<array{code: string, severity: string, context: array<string, mixed>}>  $alerts
     */
    private function syncLocalAlerts(array $alerts): void
    {
        $active = Cache::get(self::CACHE_KEY_ACTIVE, []);
        if (! is_array($active)) {
            $active = [];
        }

        $nowIso = now()->toIso8601String();
        $current = [];

        foreach ($alerts as $alert) {
            $code = (string) $alert['code'];
            $previous = $active[$code] ?? null;
            $since = is_array($previous) && is_string($previous['since'] ?? null)
                ? (string) $previous['since']
                : $nowIso;

            $current[$code] = [
                'since' => $since,
                'last_seen' => $nowIso,
                'severity' => (string) $alert['severity'],
                'context' => $alert['context'],
            ];

            if ($previous === null) {
                $this->auditAlert('backup.alert_raised', 'failed', $current[$code], $code);

                try {
                    $this->channel->send([
                        'code' => $code,
                        'severity' => (string) $alert['severity'],
                        'context' => $alert['context'],
                        'raised_at' => $nowIso,
                    ]);
                } catch (Throwable) {
                    // Un canal externo caido no puede impedir el registro local.
                }
            }
        }

        foreach (array_keys($active) as $code) {
            if (! is_string($code) || array_key_exists($code, $current)) {
                continue;
            }

            $this->auditAlert('backup.alert_resolved', 'success', ['resolved_at' => $nowIso], $code);
        }

        Cache::put(self::CACHE_KEY_ACTIVE, $current, now()->addDay());
    }

    /**
     * @param  array<string, mixed>  $context
     */
    private function auditAlert(string $action, string $result, array $context, string $code): void
    {
        AuditLog::query()->create([
            'user_id' => null,
            'action' => $action,
            'result' => $result,
            'entity_type' => 'backup_health',
            'entity_id' => null,
            'old_values' => null,
            'new_values' => array_merge(['code' => $code], $context),
            'created_at' => now(),
        ]);
    }

    private function completedAt(?BackupLog $backupLog): ?Carbon
    {
        if (! $backupLog instanceof BackupLog) {
            return null;
        }

        $value = $backupLog->completed_at ?? $backupLog->created_at;

        return $value instanceof \DateTimeInterface ? Carbon::instance($value) : null;
    }

    private function configInt(string $key, int $default): int
    {
        $value = config($key, $default);

        if (is_int($value)) {
            return $value;
        }

        if (is_float($value)) {
            return (int) $value;
        }

        if (is_string($value) && is_numeric($value)) {
            return (int) $value;
        }

        return $default;
    }
}
