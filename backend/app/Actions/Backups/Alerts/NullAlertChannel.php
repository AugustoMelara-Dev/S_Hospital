<?php

namespace App\Actions\Backups\Alerts;

/**
 * Canal nulo: registra la alerta solo en el ambito local (auditoria/cache).
 * Es el valor por defecto y evita afirmar envios externos inexistentes.
 */
class NullAlertChannel implements AlertChannel
{
    public function send(array $alert): void
    {
        // Sin destino externo: la alerta local ya fue registrada por el
        // llamador. No se realiza ninguna llamada de red.
    }
}
