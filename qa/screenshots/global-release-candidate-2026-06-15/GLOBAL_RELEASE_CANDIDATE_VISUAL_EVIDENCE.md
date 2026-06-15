# Evidencia visual release candidate - 2026-06-15

- Rama: hardening/global-release-candidate-2026-06-15
- URL auditada: http://127.0.0.1:5177
- Usuario QA: admin.validacion
- Modo: navegacion read-only; no emite facturas, pagos, respaldos ni cambios de configuracion.
- Generado: 2026-06-15T05:31:34.039Z
- Capturas: 15
- Incidencias de consola HTTP/pageerror: 0
- Bloqueantes visuales: 0
- Advertencias visuales: 0

## Pantallas capturadas

| Pantalla | Ruta | Viewport | Evidencia |
| --- | --- | --- | --- |
| login | /login | 1440x960 | login.png |
| dashboard | /dashboard | 1440x960 | dashboard.png |
| new-invoice-pos | /billing/new | 1440x960 | new-invoice-pos.png |
| cashbox | /cashbox | 1440x960 | cashbox.png |
| invoice-history | /invoices | 1440x960 | invoice-history.png |
| reports | /reports | 1440x960 | reports.png |
| settings-fiscal | /settings/fiscal | 1440x960 | settings-fiscal.png |
| settings-institutional-receipts | /settings/institutional-receipts | 1440x960 | settings-institutional-receipts.png |
| backups | /backups | 1440x960 | backups.png |
| users-roles | /admin/users | 1440x960 | users-roles.png |
| help-manuals | /help | 1440x960 | help-manuals.png |
| about | /about | 1440x960 | about.png |
| server-status | /about | 1440x960 | server-status.png |
| mobile-new-invoice-pos | /billing/new | 390x844 | mobile-new-invoice-pos.png |
| tablet-dashboard | /dashboard | 820x1180 | tablet-dashboard.png |

## Resultado

No se capturaron pantallas en loading ni errores HTTP 5xx/429/pageerror. Las pantallas principales quedaron en estado cargado o estado vacio operativo.

## Pendientes fuera de esta evidencia

- Validacion fisica de impresora real del hospital.
- Validacion LAN/concurrencia real con hardware disponible.
