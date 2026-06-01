# Production readiness gap report - Fase 11

Fecha: 2026-05-17

## Decision

Estado final: PRODUCTION_CANDIDATE.

Estado operativo actual: BLOQUEADO PARA PRODUCTION_READY.

No declarar `PRODUCTION_READY` hasta cerrar todos los bloqueantes de entorno y hardware con evidencia real.

## Gaps bloqueantes

| Gap | Estado | Evidencia actual | Accion obligatoria |
|---|---|---|---|
| Cliente LAN fisico | PENDING_LAN_CLIENT_VALIDATION | Rutas por IP validadas desde servidor; operador mostro login cargando por IP, pero falta checklist completo desde otra PC | Probar desde cliente real `/up`, `/login`, `/verify-email`, assets, login, caja, factura, pago, recibo, historial, reportes y backup pending |
| Impresora institucional fisica | PENDING_HARDWARE_VALIDATION | UI/recibo media carta/carta/A5/80mm/58mm y E2E local existen; no hay impresion fisica documentada | Probar media carta, carta, A5, 80mm y 58mm con escala 100%, margenes minimos y reimpresion desde historial |
| Configuracion production real | PENDING_ENVIRONMENT_VALIDATION | `.env` actual es local/debug para validacion | Cambiar en servidor final a `APP_ENV=production`, `APP_DEBUG=false`, admin real, sin seeders demo, `config:cache` |
| Worker continuo de backups | PENDING_ENVIRONMENT_VALIDATION | Worker `--once` proceso job; restore con PATH de XAMPP genero backup success | Crear tarea/servicio Windows con PATH correcto para `mysqldump`/`mariadb-dump` |
| CORS/Sanctum LAN final | PENDING_ENVIRONMENT_VALIDATION | Validado localmente con host de desarrollo; falta IP/dominio final | Configurar `APP_URL`, `SANCTUM_STATEFUL_DOMAINS` y CORS con IP fija/dominio LAN real |
| Preflight final ejecutable | READY_TO_RUN | `scripts/production_readiness_preflight.ps1` verifica env production, build, rutas, herramientas de dump, backup writable y pruebas fisicas documentadas obligatorias por defecto | Ejecutarlo en el servidor final sin override de evidencia fisica |

## Gaps cerrados en Fase 11

| Gap | Estado | Evidencia |
|---|---|---|
| Restore real MySQL/MariaDB en base descartable | VALIDATED | `scripts/validate_restore_mysql.sh` restauro `hospital-backup-20260517-204322-lcsexyiz.sql` en `hospital_restore_validation_test` |
| Concurrencia real HTTP/Laravel/MySQL local | VALIDATED | `scripts/validate_mysql_concurrency.sh` valido doble apertura de caja, doble emision y doble pago con `RUN_ID=concurrency-validation-20260517T20435` en entorno local/descartable |
| Rutas LAN desde servidor por IP | VALIDATED | `/up`, `/login`, `/verify-email` y asset JS respondieron 200 por `http://192.168.1.7:8000` |
| API auth CSRF LAN | VALIDATED | Login API con cookie/CSRF respondio 200 despues de configurar Sanctum stateful LAN y header `X-XSRF-TOKEN` |

## Riesgos si se opera sin cerrar gaps

- Sin cliente LAN fisico completo, podria haber firewall, DNS local, cache de navegador o ruta de assets fallando en cajas reales.
- Sin impresora fisica, el recibo puede salir con escala incorrecta o como hoja carta.
- Sin `APP_ENV=production` y admin real, se corre riesgo de entregar credenciales demo o debug activo.
- Sin worker continuo y PATH de dump correcto, backups manuales desde UI pueden quedarse en `pending` o `failed`.

## Acciones para pasar a PRODUCTION_READY

1. Preparar servidor final con MySQL/MariaDB y PATH de dump confirmado.
2. Configurar `.env` real con `APP_ENV=production`, `APP_DEBUG=false`, `APP_URL` LAN final y secretos locales.
3. Crear admin real con `php artisan auth:create-initial-admin`.
4. Ejecutar `php artisan migrate --force` solo con migraciones aprobadas; no usar `migrate:fresh`.
5. Ejecutar `php artisan config:cache --no-ansi`.
6. Levantar worker de backups como tarea/servicio Windows.
7. Configurar CORS/Sanctum con IP fija/dominio LAN real.
8. Validar restore en base descartable del servidor final y guardar checksum/conteos.
9. Validar concurrencia en base descartable/snapshot del servidor final.
10. Validar desde otra computadora cliente en LAN.
11. Validar impresora fisica media carta/carta/A5/80mm/58mm.
12. Ejecutar `scripts/production_readiness_preflight.ps1` sin `-AllowMissingPhysicalProof`.

Sin LAN fisica desde segunda PC, impresora fisica, `.env` production, MySQL tools, worker persistente y backup/restore real, produccion sigue bloqueada.

## Estado de alcance

No se agregaron modulos clinicos, inventario, dashboard complejo, cloud sync, restore UI ni PDF avanzado. No se cambiaron reglas de facturacion, caja ni pagos.
