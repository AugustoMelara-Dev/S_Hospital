# Production readiness audit - 2026-05-18

## Decision

`BLOQUEADO PARA PRODUCTION_READY`

Sistema de Caja Hospitalaria no puede declararse `PRODUCTION_READY` hasta tener evidencia
real de entorno final, cliente LAN fisico, impresora termica fisica, herramientas
MySQL/dump, worker persistente y backup/restore validado.

Este documento acompana el frente `production-readiness-preflight`. No declara
produccion lista; documenta por que la barrera debe seguir fallando hasta cerrar
las pruebas fisicas y operativas.

## Required blockers before PRODUCTION_READY

1. Configuracion final fuera de Git:
   - `APP_ENV=production`.
   - `APP_DEBUG=false`.
   - `APP_URL` con IP fija o nombre LAN final.
   - `SANCTUM_STATEFUL_DOMAINS` con host/IP LAN final.
   - `CORS_ALLOWED_ORIGINS` explicito o vacio para same-origin, nunca `*`.

2. Evidencia LAN fisica:
   - Segunda computadora cliente real.
   - Login por IP/nombre LAN, no `localhost`.
   - `/up`, `/login`, `/verify-email`, assets, login, caja, factura, pago, recibo, historial, reportes y backup.
   - Guardar evidencia completa en `qa/LAN_CLIENT_VALIDATION_PROOF.md`.

3. Evidencia impresora termica fisica:
   - Impresora real 80mm/58mm.
   - Driver, navegador, factura usada y resultado por ancho.
   - Reimpresion desde historial.
   - Guardar evidencia completa en `qa/INSTITUTIONAL_RECEIPT_PRINT_PROOF.md`.

4. Herramientas y backups:
   - `mysql` disponible en PATH.
   - `mysqldump` o `mariadb-dump` disponible en PATH.
   - Worker `backups` instalado como tarea/servicio persistente.
   - Backup UI comprobado de `pending` a `success`.
   - Restore probado en base descartable con checksum/conteos.

5. Admin real:
   - Crear admin con `php artisan auth:create-initial-admin`.
   - No usar seeders demo ni usuarios demo en produccion.

## Preflight expectations

`scripts/production_readiness_preflight.ps1` debe fallar cuando falte cualquiera
de los puntos anteriores. La evidencia fisica es obligatoria por defecto.

El override `-AllowMissingPhysicalProof` solo permite una corrida parcial de
entorno para diagnostico. Cualquier salida con ese override mantiene
`PRODUCTION_READY: NO` y termina con codigo no cero para que no pueda usarse
como gate automatico de produccion.

## Negative validation expected locally

En esta maquina de desarrollo se espera que el preflight falle por razones
correctas, como:

- `APP_ENV` local.
- `APP_DEBUG` true.
- ausencia de `mysql`.
- ausencia de `mysqldump` o `mariadb-dump`.
- ausencia de `qa/LAN_CLIENT_VALIDATION_PROOF.md`.
- ausencia de `qa/INSTITUTIONAL_RECEIPT_PRINT_PROOF.md`.
- evidencia incompleta o con placeholders.
- `CORS_ALLOWED_ORIGINS=*`.

## Scope of this PR

Incluido:

- endurecer el preflight de produccion;
- evitar sobrescritura silenciosa de tareas Windows;
- documentar instalacion, actualizacion, estado y desinstalacion de tareas;
- mejorar plantillas de evidencia;
- reforzar el gap report como bloqueo de `PRODUCTION_READY`.

No incluido:

- screenshots generados de QA;
- cambios de visual smoke;
- cambios de facturacion, caja, pagos, reportes o permisos;
- declaracion de `PRODUCTION_READY`.
