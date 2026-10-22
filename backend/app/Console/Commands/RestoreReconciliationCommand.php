<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Support\RestoreReconciliation;
use Illuminate\Console\Command;
use JsonException;
use Throwable;

/**
 * HS-RESTORE-SEQUENCE: control de correlativos post-restore.
 *
 * `start` lo invoca el procedimiento de restore (hs-recovery/hs-install) de
 * inmediato despues de reemplazar la base con un respaldo. Mientras el estado
 * este pendiente, `GenerateFiscalNumberAction` y
 * `ReserveInstitutionalReceiptNumberAction` fallan cerrado y no consumen
 * numeros. `confirm` valida un manifiesto externo verificable (producido por
 * hs-backups a partir de la custodia externa) y aplica solo avance.
 */
class RestoreReconciliationCommand extends Command
{
    protected $signature = 'hospital:restore-reconciliation
        {action : status, start o confirm}
        {--json : Emitir JSON para automatizacion local}
        {--reason= : Motivo (obligatorio en start y confirm)}
        {--manifest= : Ruta del manifiesto JSON externo (confirm)}
        {--phrase= : Frase literal RECONCILIAR (confirm)}
        {--authorized-by= : Identidad del responsable que autoriza (confirm)}';

    protected $description = 'Bloquea la emision de correlativos hasta reconciliar un restore con evidencia externa verificada (HS-RESTORE-SEQUENCE).';

    protected $help = <<<'HELP'
Reconciliacion de correlativos despues de restaurar un respaldo antiguo.

Flujo esperado:
  1. hs-recovery/hs-install restaura la copia y ejecuta
     `php artisan hospital:restore-reconciliation start --reason="..."`
     (la emision queda bloqueada, sin consumir numeros).
  2. hs-backups produce el manifiesto externo desde la custodia fuera del host
     y se confirma con un segundo responsable:
     `php artisan hospital:restore-reconciliation confirm \
        --manifest=/ruta/manifiesto.json --phrase=RECONCILIAR \
        --reason="..." --authorized-by="..."`.
  3. `status --json` reporta pendiente/no, maximos actuales de la base y el
     ultimo manifiesto aplicado.

Manifiesto (schema_version 1), JSON canonico con claves ordenadas:
{
  "schema_version": 1,
  "generated_at": "2026-09-13T20:00:00Z",
  "backup": {
    "id": 12,
    "sha256": "<64 hex minusculas>",
    "verified_at": "2026-09-13T19:59:00Z",
    "destination_label": "USB-HOSPITAL-1",
    "relative_path": "copies/backup-20260913.sql.enc",
    "external_copy_id": 7,
    "bytes": 123456
  },
  "max_invoice_number": 1234,
  "max_receipt_number": 87,
  "hash": "<sha256 del JSON canonico sin el campo hash>"
}

Sin manifiesto verificado el comando falla cerrado: sin evidencia externa no
se reanuda la emision. El ledger backup_external_copies es obligatorio: si la
tabla no existe (base restaurada anterior a la migracion 2026_09_13_200001)
el confirm rechaza; aplique migraciones y reintente con evidencia verificada.
Los maximos del manifiesto solo avanzan correlativos, nunca los retroceden, y
deben caber en el rango autorizado vigente. Si el manifiesto declara numeros
usados (>0) y no hay secuencia/serie activa donde aplicarlos, el confirm
rechaza y el bloqueo permanece hasta corregir la configuracion.
HELP;

    public function handle(RestoreReconciliation $reconciliation): int
    {
        $action = strtolower(trim((string) $this->argument('action')));

        return match ($action) {
            'status' => $this->showStatus($reconciliation),
            'start' => $this->startReconciliation($reconciliation),
            'confirm' => $this->confirmReconciliation($reconciliation),
            default => $this->reportFailure(
                'ACCION_INVALIDA',
                sprintf('Accion "%s" invalida. Use status, start o confirm.', $action),
            ),
        };
    }

    private function showStatus(RestoreReconciliation $reconciliation): int
    {
        $status = $reconciliation->status();

        if ($this->option('json')) {
            return $this->emit(['status' => 'ok'] + $status);
        }

        $this->line('Reconciliacion post-restore: '.($status['pending'] ? 'PENDIENTE' : 'SIN PENDIENTES'));

        if ($status['pending']) {
            $state = $status['pending_state'];
            $this->line('  Origen: '.$this->scalarLabel($state['source']));
            $this->line('  Iniciada: '.$this->scalarLabel($state['started_at']));
            $this->line('  Motivo: '.$this->scalarLabel($state['reason']));
        }

        $invoice = $status['max_invoice_number'];
        $this->line($invoice === null
            ? '  Facturas: sin secuencia activa.'
            : sprintf('  Facturas: %s actual=%d max=%d.', $invoice['prefix'], $invoice['current_number'], $invoice['max_number']));

        $receipt = $status['max_receipt_number'];
        $this->line($receipt === null
            ? '  Recibos: sin serie activa.'
            : sprintf('  Recibos: %s actual=%d max=%d emitidos=%d.', $receipt['series'], $receipt['current_number'], $receipt['max_number'], $receipt['max_issued_receipt_number']));

        $manifest = $status['last_manifest'];
        if ($manifest === null) {
            $this->line('  Ultimo manifiesto: ninguno.');
        } else {
            $backup = $manifest['backup'] ?? null;
            $backupId = is_array($backup) ? ($backup['id'] ?? '?') : '?';
            $this->line('  Ultimo manifiesto: backup='.$this->scalarLabel($backupId).' hash='.$this->scalarLabel($manifest['hash'] ?? '?'));
        }

        return self::SUCCESS;
    }

    private function startReconciliation(RestoreReconciliation $reconciliation): int
    {
        $reason = trim((string) $this->option('reason'));

        try {
            $state = $reconciliation->start($reason, $this->invokedBy());
        } catch (Throwable $exception) {
            return $this->reportFailure('START_RECHAZADO', $exception->getMessage());
        }

        if ($this->option('json')) {
            return $this->emit(['status' => 'ok'] + $state);
        }

        $this->info('Reconciliacion post-restore PENDIENTE. La emision de facturas y recibos queda bloqueada sin consumir numeros.');
        $this->line('  Iniciada: '.$state['started_at']);
        $this->line('  Motivo: '.$state['reason']);

        return self::SUCCESS;
    }

    private function confirmReconciliation(RestoreReconciliation $reconciliation): int
    {
        $manifest = trim((string) $this->option('manifest'));

        if ($manifest === '') {
            return $this->reportFailure(
                'MANIFIESTO_REQUERIDO',
                'Sin --manifest no hay evidencia externa verificable y no se reanuda la emision. Produzca el manifiesto desde la custodia externa (handoff hs-backups) antes de confirmar.',
            );
        }

        try {
            $result = $reconciliation->confirm(
                $manifest,
                (string) $this->option('phrase'),
                (string) $this->option('reason'),
                (string) $this->option('authorized-by'),
                $this->invokedBy(),
            );
        } catch (Throwable $exception) {
            return $this->reportFailure('CONFIRMACION_RECHAZADA', $exception->getMessage());
        }

        if ($this->option('json')) {
            return $this->emit(['status' => 'ok'] + $result);
        }

        $this->info('Reconciliacion CONFIRMADA. El bloqueo post-restore fue liberado.');
        $this->line('  Manifiesto: '.$result['manifest_hash']);
        $this->line('  Facturas: '.$this->advanceLabel($result['invoice_advance']));
        $this->line('  Recibos: '.$this->advanceLabel($result['receipt_advance']));

        return self::SUCCESS;
    }

    /**
     * @param  array<string, mixed>  $advance
     */
    private function advanceLabel(array $advance): string
    {
        if (($advance['applied'] ?? false) === true) {
            return sprintf(
                'avance de %s a %s',
                $this->scalarLabel($advance['from'] ?? null),
                $this->scalarLabel($advance['to'] ?? null),
            );
        }

        return 'sin avance ('.$this->scalarLabel($advance['reason'] ?? 'sin datos').')';
    }

    private function scalarLabel(mixed $value): string
    {
        return is_scalar($value) ? (string) $value : '?';
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    private function emit(array $payload): int
    {
        try {
            $this->line(json_encode($payload, JSON_THROW_ON_ERROR));
        } catch (JsonException) {
            return $this->reportFailure('JSON_INVALIDO', 'No se pudo serializar la salida JSON.');
        }

        return self::SUCCESS;
    }

    private function reportFailure(string $code, string $message): int
    {
        if ($this->option('json')) {
            try {
                $this->line(json_encode([
                    'status' => 'failed',
                    'code' => $code,
                    'message' => $message,
                ], JSON_THROW_ON_ERROR));
            } catch (JsonException) {
                $this->error($message);
            }
        } else {
            $this->error($message);
        }

        return self::FAILURE;
    }

    private function invokedBy(): string
    {
        foreach (['USERNAME', 'USER'] as $variable) {
            $value = getenv($variable);

            if (is_string($value) && trim($value) !== '') {
                return trim($value);
            }
        }

        return 'cli';
    }
}
