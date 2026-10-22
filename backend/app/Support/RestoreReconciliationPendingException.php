<?php

declare(strict_types=1);

namespace App\Support;

use RuntimeException;

/**
 * Excepcion de dominio para el bloqueo fail-closed de emision mientras la
 * reconciliacion post-restore (HS-RESTORE-SEQUENCE) sigue pendiente.
 *
 * Se lanza ANTES de tocar secuencias o series, de modo que ningun correlativo
 * se consume mientras la base restaurada no fue reconciliada con evidencia
 * externa verificada.
 */
class RestoreReconciliationPendingException extends RuntimeException
{
    public static function forDocument(string $documentLabel): self
    {
        return new self(sprintf(
            'Reconciliacion post-restore pendiente: la emision de %s esta bloqueada hasta confirmar los correlativos con evidencia externa verificada (hospital:restore-reconciliation confirm).',
            $documentLabel,
        ));
    }
}
