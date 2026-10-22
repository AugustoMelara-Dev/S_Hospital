<?php

namespace App\Actions\Backups\Alerts;

/**
 * Contrato de canal de alertas de respaldos (HS-BK-ALERT).
 *
 * El sistema entrega alertas locales verificables (auditoria + cache) y este
 * contrato permite conectar un canal externo en el futuro. El unico canal
 * provisto por defecto es {@see NullAlertChannel}: no se declara ningun envio
 * externo desplegado mientras no exista un destino real configurado y
 * verificado por el operador.
 */
interface AlertChannel
{
    /**
     * Entrega una alerta. La implementacion debe ser tolerante a fallos: un
     * canal caido no puede impedir que la alerta local quede registrada.
     *
     * @param  array{code: string, severity: string, context: array<string, mixed>, raised_at: string}  $alert
     */
    public function send(array $alert): void;
}
