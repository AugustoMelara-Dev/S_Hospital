<?php

declare(strict_types=1);

namespace App\Support;

use App\Models\AuditLog;
use App\Models\FiscalSequence;
use App\Models\InstitutionalReceipt;
use App\Models\InstitutionalReceiptSeries;
use Illuminate\Contracts\Cache\Repository;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use RuntimeException;
use Throwable;

/**
 * HS-RESTORE-SEQUENCE: estado durable + bloqueo fail-closed + reconciliacion
 * de correlativos despues de restaurar un respaldo antiguo.
 *
 * Problema: el restore reemplaza la base con una copia anterior a recibos ya
 * emitidos/impresos. La DB restaurada no conoce esos numeros, por lo que
 * reanudar la emision duplicaria correlativos.
 *
 * Control:
 *   - `start()` marca la reconciliacion como pendiente (almacen durable) y la
 *     audita. Lo invoca el procedimiento de restore (hs-recovery/hs-install).
 *   - `assertEmissionAllowed()` bloquea `GenerateFiscalNumberAction` y
 *     `ReserveInstitutionalReceiptNumberAction` antes de consumir numeros.
 *   - `confirm()` valida un manifiesto externo (RestoreReconciliationManifest),
 *     lo contrasta con el ledger `backup_external_copies` (T2-010/T2-025),
 *     aplica solo avance de correlativos y limpia el pendiente con auditoria.
 *     El ledger es obligatorio: si la tabla no existe (base restaurada anterior
 *     a la migracion 2026_09_13_200001) se rechaza sin cambios; no hay escape.
 *     Si el manifiesto declara numeros usados (>0) y no existe secuencia/serie
 *     activa donde aplicarlos, tambien se rechaza y el bloqueo permanece.
 *
 * Almacen durable: la tabla `cache` (store `database` de Laravel, migracion
 * base existente) guarda el marcador con `forever()`. No se agregan columnas
 * ni tablas. Como defensa adicional fail-closed, `isPending()` tambien
 * considera pendiente cuando el ultimo evento de auditoria es
 * `restore_reconciliation.started` sin un `confirmed` posterior: asi un
 * `cache:clear` accidental no desbloquea la emision en silencio.
 *
 * Riesgo residual operativo (TOCTOU): `isPending()` no toma lock. El
 * procedimiento de restore debe invocar `start()` antes de reabrir writers;
 * si un writer ya estaba emitiendo durante el restore, la verificacion de
 * numeros queda fuera del alcance de este control.
 */
final class RestoreReconciliation
{
    public const CACHE_KEY = 'hospital.restore_reconciliation.pending';

    public const CONFIRM_PHRASE = 'RECONCILIAR';

    public const MIN_REASON_LENGTH = 5;

    public const AUDIT_ENTITY = 'restore_reconciliation';

    public const AUDIT_STARTED = 'restore_reconciliation.started';

    public const AUDIT_CONFIRMED = 'restore_reconciliation.confirmed';

    public const AUDIT_REJECTED = 'restore_reconciliation.confirmation_rejected';

    /**
     * Se invoca al inicio de las acciones que consumen correlativos.
     *
     * @throws RestoreReconciliationPendingException
     */
    public function assertEmissionAllowed(string $documentLabel): void
    {
        if ($this->isPending()) {
            throw RestoreReconciliationPendingException::forDocument($documentLabel);
        }
    }

    public function isPending(): bool
    {
        if ($this->readMarker() !== null) {
            return true;
        }

        $last = $this->lastEvent();

        return $last !== null && $last['action'] === self::AUDIT_STARTED;
    }

    /**
     * @return array{pending: bool, source: string|null, status: string|null, started_at: string|null, reason: string|null, invoked_by: string|null, recorded_at: string|null}
     */
    public function pendingState(): array
    {
        $marker = $this->readMarker();

        if ($marker !== null) {
            return [
                'pending' => true,
                'source' => 'database_cache',
                'status' => self::stringOrNull($marker['status'] ?? null) ?? 'pending',
                'started_at' => self::stringOrNull($marker['started_at'] ?? null),
                'reason' => self::stringOrNull($marker['reason'] ?? null),
                'invoked_by' => self::stringOrNull($marker['invoked_by'] ?? null),
                'recorded_at' => self::stringOrNull($marker['recorded_at'] ?? null),
            ];
        }

        $last = $this->lastEvent();

        if ($last !== null && $last['action'] === self::AUDIT_STARTED) {
            return [
                'pending' => true,
                'source' => 'audit_fallback',
                'status' => 'pending',
                'started_at' => self::stringOrNull($last['new_values']['started_at'] ?? null) ?? $last['created_at'],
                'reason' => self::stringOrNull($last['new_values']['reason'] ?? null),
                'invoked_by' => self::stringOrNull($last['new_values']['invoked_by'] ?? null),
                'recorded_at' => $last['created_at'],
            ];
        }

        return [
            'pending' => false,
            'source' => null,
            'status' => null,
            'started_at' => null,
            'reason' => null,
            'invoked_by' => null,
            'recorded_at' => null,
        ];
    }

    private static function stringOrNull(mixed $value): ?string
    {
        return is_string($value) && trim($value) !== '' ? $value : null;
    }

    /**
     * Marca la reconciliacion como pendiente. Idempotente: si ya estaba
     * pendiente conserva `started_at` y actualiza el motivo.
     *
     * @return array{status: string, started_at: string, reason: string, invoked_by: string|null, recorded_at: string, pending: bool, marker_stored: bool}
     */
    public function start(string $reason, ?string $invokedBy = null): array
    {
        $reason = trim($reason);

        if (mb_strlen($reason) < self::MIN_REASON_LENGTH) {
            throw new RuntimeException('El motivo del bloqueo debe tener al menos '.self::MIN_REASON_LENGTH.' caracteres.');
        }

        $previous = $this->pendingState();
        $startedAt = is_string($previous['started_at'])
            ? $previous['started_at']
            : now()->toIso8601String();

        $state = [
            'status' => 'pending',
            'started_at' => $startedAt,
            'reason' => $reason,
            'invoked_by' => $invokedBy,
            'recorded_at' => now()->toIso8601String(),
        ];

        $stored = $this->storeMarker($state);

        AuditLog::query()->create([
            'user_id' => null,
            'action' => self::AUDIT_STARTED,
            'result' => 'success',
            'entity_type' => self::AUDIT_ENTITY,
            'entity_id' => null,
            'old_values' => $previous['pending'] === true
                ? ['started_at' => $previous['started_at']]
                : null,
            'new_values' => [
                'reason' => $reason,
                'invoked_by' => $invokedBy,
                'started_at' => $startedAt,
                'marker_stored' => $stored,
            ],
            'reason' => $reason,
            'created_at' => now(),
        ]);

        return $state + ['pending' => true, 'marker_stored' => $stored];
    }

    /**
     * Estado para el comando `hospital:restore-reconciliation status`.
     *
     * @return array{
     *     pending: bool,
     *     pending_state: array{pending: bool, source: string|null, status: string|null, started_at: string|null, reason: string|null, invoked_by: string|null, recorded_at: string|null},
     *     max_invoice_number: array{sequence_id: int, prefix: string, min_number: int, current_number: int, max_number: int}|null,
     *     max_receipt_number: array{series_id: int, series: string, min_number: int, current_number: int, max_number: int, max_issued_receipt_number: int}|null,
     *     last_manifest: array<array-key, mixed>|null
     * }
     */
    public function status(): array
    {
        $invoiceSequence = $this->selectInvoiceSequence(lock: false);
        $receiptSeries = $this->selectActiveReceiptSeries(lock: false);
        $lastConfirmed = AuditLog::query()
            ->where('action', self::AUDIT_CONFIRMED)
            ->orderByDesc('id')
            ->first();
        $lastManifest = $lastConfirmed?->new_values['manifest'] ?? null;
        $maxIssuedReceipt = $receiptSeries === null
            ? null
            : InstitutionalReceipt::query()
                ->where('series_id', $receiptSeries->id)
                ->max('receipt_number');

        return [
            'pending' => $this->isPending(),
            'pending_state' => $this->pendingState(),
            'max_invoice_number' => $invoiceSequence === null ? null : [
                'sequence_id' => $invoiceSequence->id,
                'prefix' => $invoiceSequence->prefix,
                'min_number' => $invoiceSequence->min_number,
                'current_number' => $invoiceSequence->current_number,
                'max_number' => $invoiceSequence->max_number,
            ],
            'max_receipt_number' => $receiptSeries === null ? null : [
                'series_id' => $receiptSeries->id,
                'series' => $receiptSeries->series,
                'min_number' => $receiptSeries->min_number,
                'current_number' => $receiptSeries->current_number,
                'max_number' => $receiptSeries->max_number,
                'max_issued_receipt_number' => is_numeric($maxIssuedReceipt) ? (int) $maxIssuedReceipt : 0,
            ],
            'last_manifest' => is_array($lastManifest) ? $lastManifest : null,
        ];
    }

    /**
     * Confirma la reconciliacion con un manifiesto externo verificado.
     *
     * Reglas fail-closed:
     *   - requiere estado pendiente, frase literal, motivo y responsable;
     *   - exige manifiesto con esquema y hash validos;
     *   - exige la tabla `backup_external_copies` y una copia externa
     *     `verified` que coincida con el manifiesto;
     *   - jamas retrocede un correlativo; solo avanza hacia el maximo del
     *     manifiesto y dentro del rango autorizado de la secuencia/serie;
     *   - si el manifiesto declara numeros usados (>0) y no hay
     *     secuencia/serie activa, rechaza y no limpia el bloqueo.
     *
     * @return array{
     *     status: string,
     *     confirmed_at: string,
     *     manifest_hash: string,
     *     ledger_verification: array{status: string, external_copy_id: int, destination_label: string, verified_at: string},
     *     invoice_advance: array<string, mixed>,
     *     receipt_advance: array<string, mixed>
     * }
     */
    public function confirm(
        string $manifestPath,
        string $phrase,
        string $reason,
        string $authorizedBy,
        ?string $invokedBy = null,
    ): array {
        $reason = trim($reason);
        $authorizedBy = trim($authorizedBy);

        try {
            if (trim($phrase) !== self::CONFIRM_PHRASE) {
                throw new RuntimeException('Frase de confirmacion incorrecta. Escriba exactamente '.self::CONFIRM_PHRASE.'.');
            }

            if (mb_strlen($reason) < self::MIN_REASON_LENGTH) {
                throw new RuntimeException('El motivo de reconciliacion debe tener al menos '.self::MIN_REASON_LENGTH.' caracteres.');
            }

            if ($authorizedBy === '') {
                throw new RuntimeException('--authorized-by es obligatorio: registre quien autoriza la reconciliacion (doble control).');
            }

            if (! $this->isPending()) {
                throw new RuntimeException('No hay reconciliacion post-restore pendiente; no se aplica ningun cambio.');
            }

            $manifest = RestoreReconciliationManifest::fromFile($manifestPath);
            $ledger = $this->assertLedgerEvidence($manifest);
            $confirmedAt = now()->toIso8601String();

            $result = DB::transaction(function () use ($manifest, $ledger, $reason, $authorizedBy, $invokedBy, $confirmedAt): array {
                $invoiceSequence = $this->selectInvoiceSequence(lock: true);
                $receiptSeries = $this->selectActiveReceiptSeries(lock: true);

                $invoiceAdvance = $this->advanceInvoiceSequence($invoiceSequence, $manifest->maxInvoiceNumber());
                $receiptAdvance = $this->advanceReceiptSeries($receiptSeries, $manifest->maxReceiptNumber());

                AuditLog::query()->create([
                    'user_id' => null,
                    'action' => self::AUDIT_CONFIRMED,
                    'result' => 'success',
                    'entity_type' => self::AUDIT_ENTITY,
                    'entity_id' => null,
                    'old_values' => null,
                    'new_values' => [
                        'authorized_by' => $authorizedBy,
                        'invoked_by' => $invokedBy,
                        'reason' => $reason,
                        'manifest' => $manifest->auditEvidence(),
                        'ledger_verification' => $ledger,
                        'invoice_advance' => $invoiceAdvance,
                        'receipt_advance' => $receiptAdvance,
                        'confirmed_at' => $confirmedAt,
                    ],
                    'reason' => $reason,
                    'created_at' => now(),
                ]);

                return [
                    'status' => 'confirmed',
                    'confirmed_at' => $confirmedAt,
                    'manifest_hash' => $manifest->hash(),
                    'ledger_verification' => $ledger,
                    'invoice_advance' => $invoiceAdvance,
                    'receipt_advance' => $receiptAdvance,
                ];
            });

            // Solo despues del commit: si el marcador no se puede borrar, el
            // estado sigue pendiente (fail-closed) y un re-run es idempotente.
            $this->clearMarker();

            return $result;
        } catch (Throwable $exception) {
            $this->auditRejected($reason, $authorizedBy, $invokedBy, $exception);

            throw $exception;
        }
    }

    /**
     * @return array<string, mixed>
     */
    private function advanceInvoiceSequence(?FiscalSequence $sequence, int $maxUsed): array
    {
        if ($sequence === null) {
            if ($maxUsed > 0) {
                throw new RuntimeException(sprintf(
                    'El manifiesto declara facturas usadas hasta %d pero no hay una secuencia activa para facturas. Active o cree la secuencia con el rango correcto antes de confirmar; el bloqueo post-restore permanece.',
                    $maxUsed,
                ));
            }

            return ['applied' => false, 'reason' => 'no_active_sequence'];
        }

        if ($maxUsed > $sequence->max_number) {
            throw new RuntimeException(sprintf(
                'El manifiesto declara la factura %d fuera del rango autorizado (%d-%d); no se avanza por encima del maximo legal.',
                $maxUsed,
                $sequence->min_number,
                $sequence->max_number,
            ));
        }

        $current = (int) $sequence->current_number;

        if ($maxUsed <= $current) {
            return [
                'applied' => false,
                'reason' => 'manifest_not_ahead',
                'sequence_id' => $sequence->id,
                'current_number' => $current,
                'manifest_max' => $maxUsed,
            ];
        }

        $sequence->forceFill(['current_number' => $maxUsed])->save();

        return [
            'applied' => true,
            'sequence_id' => $sequence->id,
            'prefix' => $sequence->prefix,
            'from' => $current,
            'to' => $maxUsed,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function advanceReceiptSeries(?InstitutionalReceiptSeries $series, int $maxUsed): array
    {
        if ($series === null) {
            if ($maxUsed > 0) {
                throw new RuntimeException(sprintf(
                    'El manifiesto declara recibos usados hasta %d pero no hay una serie activa para recibos institucionales. Active o cree la serie con el rango correcto antes de confirmar; el bloqueo post-restore permanece.',
                    $maxUsed,
                ));
            }

            return ['applied' => false, 'reason' => 'no_active_series'];
        }

        if ($maxUsed > $series->max_number) {
            throw new RuntimeException(sprintf(
                'El manifiesto declara el recibo %d fuera del rango autorizado (%d-%d); no se avanza por encima del maximo legal.',
                $maxUsed,
                $series->min_number,
                $series->max_number,
            ));
        }

        $current = (int) $series->current_number;

        if ($maxUsed <= $current) {
            return [
                'applied' => false,
                'reason' => 'manifest_not_ahead',
                'series_id' => $series->id,
                'current_number' => $current,
                'manifest_max' => $maxUsed,
            ];
        }

        $series->forceFill(['current_number' => $maxUsed])->save();

        return [
            'applied' => true,
            'series_id' => $series->id,
            'series' => $series->series,
            'from' => $current,
            'to' => $maxUsed,
        ];
    }

    /**
     * Verifica la copia externa en el ledger T2-010/T2-025.
     *
     * Fail-closed: sin la tabla del ledger no hay anclaje externo real; una
     * base restaurada anterior a la migracion 2026_09_13_200001 se rechaza en
     * vez de aceptar el manifiesto con `ledger_verification: unavailable`.
     *
     * @return array{status: string, external_copy_id: int, destination_label: string, verified_at: string}
     */
    private function assertLedgerEvidence(RestoreReconciliationManifest $manifest): array
    {
        $backup = $manifest->backup();

        if (! Schema::hasTable('backup_external_copies')) {
            throw new RuntimeException(
                'El ledger backup_external_copies no existe en esta base (falta la migracion 2026_09_13_200001). Sin anclaje externo verificable no se reanuda la emision: actualice el sistema y aplique migraciones, luego reintente el confirm con un manifiesto verificado.'
            );
        }

        $query = DB::table('backup_external_copies');

        if (isset($backup['external_copy_id'])) {
            $query->where('id', $backup['external_copy_id']);
        } else {
            $query->where('backup_log_id', $backup['id'])
                ->where('destination_label', $backup['destination_label'])
                ->where('sha256', $backup['sha256']);
        }

        $row = $query->orderByDesc('id')->first();

        if ($row === null) {
            throw new RuntimeException(
                'El manifiesto no coincide con ninguna copia externa registrada en el ledger backup_external_copies. Sin evidencia externa verificable no se reanuda la emision.'
            );
        }

        $ledgerBackupId = $row->backup_log_id ?? null;
        if (! is_numeric($ledgerBackupId) || (int) $ledgerBackupId !== $backup['id']) {
            throw new RuntimeException('backup.id del manifiesto no coincide con el backup_log_id de la copia externa registrada.');
        }

        $ledgerStatus = $row->status ?? null;
        if (! is_string($ledgerStatus) || $ledgerStatus !== 'verified') {
            throw new RuntimeException('La copia externa del manifiesto no esta verificada en el ledger (status distinto de verified).');
        }

        $ledgerVerifiedAt = $row->verified_at ?? null;
        if (! is_string($ledgerVerifiedAt) || trim($ledgerVerifiedAt) === '') {
            throw new RuntimeException('La copia externa del manifiesto no tiene verified_at en el ledger.');
        }

        $ledgerSha = $row->sha256 ?? null;
        if (! is_string($ledgerSha) || strtolower($ledgerSha) !== $backup['sha256']) {
            throw new RuntimeException('El sha256 del manifiesto no coincide con el de la copia externa registrada.');
        }

        $ledgerLabel = $row->destination_label ?? null;
        if (! is_string($ledgerLabel) || $ledgerLabel !== $backup['destination_label']) {
            throw new RuntimeException('destination_label del manifiesto no coincide con la copia externa registrada.');
        }

        $ledgerBytes = $row->bytes ?? null;
        if (array_key_exists('bytes', $backup) && is_numeric($ledgerBytes) && (int) $ledgerBytes !== $backup['bytes']) {
            throw new RuntimeException('bytes del manifiesto no coincide con los de la copia externa registrada.');
        }

        $ledgerId = $row->id ?? null;
        if (! is_numeric($ledgerId)) {
            throw new RuntimeException('La copia externa registrada no tiene un identificador valido.');
        }

        return [
            'status' => 'verified',
            'external_copy_id' => (int) $ledgerId,
            'destination_label' => $ledgerLabel,
            'verified_at' => $ledgerVerifiedAt,
        ];
    }

    /**
     * Replica la seleccion de `GenerateFiscalNumberAction` (secuencia
     * especifica unica o, en su defecto, la unica legacy) sin consumir numero.
     */
    private function selectInvoiceSequence(bool $lock): ?FiscalSequence
    {
        $query = FiscalSequence::query()
            ->where('document_type', 'invoice')
            ->where('active', true)
            ->orderBy('id');

        if ($lock) {
            $query->lockForUpdate();
        }

        $sequences = $query->get();

        $specific = $sequences
            ->filter(fn (FiscalSequence $sequence): bool => $sequence->active_document_type === 'invoice')
            ->values();
        $legacy = $sequences
            ->filter(fn (FiscalSequence $sequence): bool => $sequence->active_document_type === null)
            ->values();

        if ($specific->count() > 1 || $legacy->count() > 1) {
            throw new RuntimeException('Configuracion fiscal inconsistente: mas de una secuencia activa para facturas; no se reconcilia ni se emite.');
        }

        /** @var FiscalSequence|null $sequence */
        $sequence = $specific->first() ?? $legacy->first();

        return $sequence;
    }

    private function selectActiveReceiptSeries(bool $lock): ?InstitutionalReceiptSeries
    {
        $query = InstitutionalReceiptSeries::query()
            ->where('document_type', InstitutionalReceiptSeries::DOCUMENT_TYPE)
            ->where('active', true)
            ->orderBy('id');

        if ($lock) {
            $query->lockForUpdate();
        }

        /** @var InstitutionalReceiptSeries|null $series */
        $series = $query->first();

        return $series;
    }

    /**
     * @return array{action: string, created_at: ?string, new_values: array<string, mixed>}|null
     */
    private function lastEvent(): ?array
    {
        $row = AuditLog::query()
            ->whereIn('action', [self::AUDIT_STARTED, self::AUDIT_CONFIRMED])
            ->orderByDesc('id')
            ->first();

        if ($row === null) {
            return null;
        }

        return [
            'action' => (string) $row->action,
            'created_at' => $row->created_at?->toIso8601String(),
            'new_values' => is_array($row->new_values) ? $row->new_values : [],
        ];
    }

    /**
     * @return array<string, mixed>|null
     */
    private function readMarker(): ?array
    {
        try {
            $value = $this->cache()->get(self::CACHE_KEY);
        } catch (Throwable) {
            return null;
        }

        return is_array($value) && ($value['status'] ?? null) === 'pending' ? $value : null;
    }

    /**
     * @param  array<string, mixed>  $state
     */
    private function storeMarker(array $state): bool
    {
        try {
            $this->cache()->forever(self::CACHE_KEY, $state);

            return true;
        } catch (Throwable) {
            return false;
        }
    }

    private function clearMarker(): bool
    {
        try {
            return $this->cache()->forget(self::CACHE_KEY);
        } catch (Throwable) {
            return false;
        }
    }

    private function cache(): Repository
    {
        try {
            return Cache::store('database');
        } catch (Throwable) {
            return Cache::store();
        }
    }

    private function auditRejected(string $reason, string $authorizedBy, ?string $invokedBy, Throwable $exception): void
    {
        try {
            AuditLog::query()->create([
                'user_id' => null,
                'action' => self::AUDIT_REJECTED,
                'result' => 'failed',
                'entity_type' => self::AUDIT_ENTITY,
                'entity_id' => null,
                'old_values' => null,
                'new_values' => [
                    'authorized_by' => $authorizedBy,
                    'invoked_by' => $invokedBy,
                    'reason' => $reason,
                    'error' => OperationalMessageSanitizer::message($exception->getMessage()),
                ],
                'reason' => $reason,
                'created_at' => now(),
            ]);
        } catch (Throwable) {
            // La auditoria del rechazo es best-effort: nunca ocultar la excepcion original.
        }
    }
}
