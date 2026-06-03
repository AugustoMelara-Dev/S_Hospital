# LAN client validation proof

Estado actual: PENDING_LAN_CLIENT_VALIDATION.

Este archivo es para la validacion final desde una segunda computadora fisica en
la LAN del hospital. No debe reutilizar capturas locales viejas ni rutas de
evidencia que no existan en `qa/`.

## Bloqueantes actuales

- Falta ejecutar la validacion desde una PC cliente distinta al servidor.
- Falta confirmar acceso por IP fija o nombre LAN final, no `localhost`.
- Falta login real sin 419 ni sesion vencida desde el cliente.
- Falta recorrer caja, factura, pago, recibo, historial, reportes y backup desde
  esa PC cliente.
- Falta adjuntar evidencia verificable bajo `qa/`.

## Comando recomendado

```powershell
powershell.exe -ExecutionPolicy Bypass -File scripts\validate_lan_client.ps1 -BaseUrl http://IP_DEL_SERVIDOR:8000 -EvidencePath qa\LAN_CLIENT_VALIDATION_PROOF.md
```

## Resultado operativo

Mientras este archivo siga pendiente, `scripts\production_readiness_preflight.ps1`
debe fallar y cualquier entrega debe quedar como `PRODUCTION_CANDIDATE`, no como
`PRODUCTION_READY`.
