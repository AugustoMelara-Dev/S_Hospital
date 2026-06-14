# F7 Operational Release Gate Report

Fecha: 2026-06-14  
Rama: `fix/f7-operational-release-gate`  
Commit inicial auditado: `0f25a76c189d9947b7e82b4d43c9eae1faf03184`  
Commit final: `0a3c77129e98453b0cfcf8c6b999c41db318799e`

## Veredicto

`F7_CONDITIONALLY_READY`

Estado permitido: `READY_FOR_REAL_LAN_OFFLINE_INSTALLATION_TEST`

No se declara `PRODUCTION_READY`.

Motivo: los bloqueadores P0/P1 corregidos en esta fase tienen evidencia de codigo, pruebas y runtime Docker productivo healthy. Sin embargo, el gate E2E final no paso completo: `npm run test:e2e` no existe y el equivalente `npm run e2e` fallo/agotó timeout contra el entorno local por datos/seed de backend no preparados para esos flujos.

## Estado inicial

- `git status --short`: limpio al iniciar.
- `git branch --show-current`: `main`.
- `git rev-parse HEAD`: `0f25a76c189d9947b7e82b4d43c9eae1faf03184`.
- Rama creada desde main: `fix/f7-operational-release-gate`.

## Commits realizados

| Commit | Mensaje |
| --- | --- |
| `e58270ff` | `fix(deploy): harden production scheduler and offline release gate` |
| `18d02c7a` | `fix(security): protect realtime and auth audit` |
| `f0a92230` | `fix(billing): harden invoice reversal and idempotency` |
| `4ed62ecb` | `fix(frontend): stabilize operational form flows` |
| `2cf7a76d` | `fix(backups): harden dumps and receipt reprints` |
| `33133c25` | `fix(deploy): use resolvable soketi image` |
| `2db532a7` | `fix(deploy): repair production runtime healthchecks` |
| `59f9dd68` | `test(security): assert restricted realtime csp` |
| `0a3c7712` | `style(backend): satisfy pint release gate` |

## Hallazgos corregidos

| ID | Estado | Evidencia |
| --- | --- | --- |
| P0-001 docker-compose prod sin variables Soketi/Pusher | Corregido | `docker compose -f docker-compose.prod.yml --env-file .env config --quiet` paso con secretos efimeros. |
| P0-002 offline no guarda todas las imagenes prod | Corregido | `config --images`: `quay.io/soketi/soketi:1.6-16-alpine`, `s_hospital-backend`, `nginx`, `mariadb`, `queue-worker`, `scheduler`; `assert_production_docker_sources.ps1` paso. |
| P0-003 scheduler productivo mal montado | Corregido | `scheduler` usa imagen Laravel y `schedule:list` funciona; logs muestran `Scheduler tick recorded` y ejecucion `hospital:backup --type=scheduled`. |
| P1-009 scripts start/repair sin scheduler/soketi | Corregido | Scripts Windows incluyen `backend`, `nginx`, `mysql`, `queue-worker`, `scheduler`, `soketi`. |
| P1-011 backup automatico silencioso | Corregido | Deploy self-test paso; scheduler runtime ejecuta backup programado y registra tick OK. Consulta directa a `backup_logs` en contenedor: NO VERIFICADO por quoting de shell, no por error app. |
| P1-001 realtime publico con PII | Corregido | Eventos migrados a `PrivateChannel`, payload minimo; `BroadcastingWiringTest` paso 9 tests. |
| P1-010 CSP efectiva | Corregido | `curl -I /` y `/api/system/setup-status` muestran `Content-Security-Policy`; `SecurityHeadersTest` paso. |
| P2-005 fallbacks inseguros Pusher/Soketi prod | Corregido | Config prod falla si faltan `PUSHER_APP_ID`, `PUSHER_APP_KEY`, `PUSHER_APP_SECRET`; imagen Soketi resolvible en Quay. |
| P2-006 lockout por IP LAN | Corregido | `LoginLockoutTest` paso; lockout por usuario+IP. |
| P2-004 auditoria auth/logout/password | Corregido | `AuditLogTest` paso; IP, user-agent, request metadata y sujetos registrados. |
| P1-002 eritropoyetina gratis | Corregido | `InvoiceDialysisPrescriptionTest` paso. |
| P1-003 facturas L.0 trazables | Corregido | `CashPaymentsReceiptTest` incluye factura gratis receiptable sin pago artificial. |
| P1-004 carrera async al anular | Corregido | `InvoiceHistoryView.test.tsx` paso. |
| P1-005 reversa factura pagada frontend | Corregido | `InvoiceHistoryView.test.tsx` paso; backend `InvoiceReverseTest` paso en suite completa. |
| P1-006 idempotencia path real | Corregido | `IdempotencyKeyTest` paso, incluido mismo key en rutas diferentes. |
| P1-007 locks pago/cierre | Corregido/verificado | `DoublePaymentTest`, `CashPaymentsReceiptTest`, `CloseCashSessionTest` pasan. |
| P1-008 dashboard stale | Corregido | React Query invalidation unificada; tests frontend pasan. |
| P2-011 errores frontend incompletos | Corregido parcial | Tests de errores API en vistas criticas pasan. |
| P2-012 doble submit login | Corregido | `useHospitalSession.test.tsx` paso. |
| P2-014 validacion fiscal Zod | Corregido | `FiscalSettingsForm.test.ts` paso. |
| P2-001 lock backups distribuido | Corregido/verificado | `CACHE_STORE=database`, `onOneServer`, `withoutOverlapping`, `BackupRestoreRoundtripTest` paso 4 y skip MySQL por falta de dump local. |
| P2-002 reimpresion vs anulacion/reversa | Corregido | Reprint valida estado dentro de lock transaccional; `ReprintDoesNotMutateTest` paso. |
| P2-008 controles descarga backups | Corregido/verificado | `BackupWorkflowTest` paso permisos/path traversal/failed logs. |
| P2-009 evitar `MYSQL_PWD` | Corregido | App y scripts usan defaults file temporal; `rg "MYSQL_PWD\\s*=" scripts backend/app backend/docker` sin usos ejecutables. |
| P3-008 motivo reimpresion | Corregido | `ReprintReceiptRequest` exige motivo; `ReprintDoesNotMutateTest` paso. |

## Evidencia Docker/runtime

- `docker compose -p s_hospital_f7_verify -f docker-compose.prod.yml --env-file .env up -d --build`: paso con `APP_PORT=18080`, `SOKETI_PORT=16001`, secretos Pusher efimeros.
- `docker compose ... ps`: `backend`, `mysql`, `nginx`, `queue-worker`, `scheduler`, `soketi` en `healthy`.
- `docker compose ... ps scheduler queue-worker soketi`: los tres en `healthy`.
- `docker compose ... exec -T backend php artisan route:list --path=api`: 61 rutas.
- `docker compose ... exec -T backend php artisan migrate:status`: todas las migraciones `Ran`.
- `docker compose ... exec -T backend php artisan schedule:list`: backups y prune jobs visibles.
- `docker compose ... logs scheduler --tail=100`: ticks OK y backups programados ejecutados.
- `curl.exe -I http://127.0.0.1:18080/`: `200 OK`, CSP y headers de seguridad.
- `curl.exe -I http://127.0.0.1:18080/assets/`: `403 Forbidden` esperado para directorio sin index, con CSP/headers.
- `curl.exe -I http://127.0.0.1:18080/api/system/setup-status`: `200 OK`, CSP efectiva.

Advertencia recurrente: Docker imprime `Error loading config file: open C:\Users\melar\.docker\config.json: Access is denied`, pero los comandos afectados salieron `0`.

## Tests y quality gates

| Comando | Resultado |
| --- | --- |
| `php artisan test` | PASS: 461 passed, 10 skipped, 2985 assertions. |
| `vendor/bin/pint --test` | PASS. |
| `vendor/bin/phpstan analyse` | PASS: no errors. |
| `npm run typecheck` | PASS. |
| `npm run lint` | PASS. |
| `npm run test` | PASS: 60 files, 261 tests. |
| `npm run build` | PASS. |
| `docker compose ... exec backend php artisan test` | NO APLICABLE en imagen prod: comando `test` no existe por install `--no-dev`. Cubierto por suite local. |
| `docker compose ... exec backend vendor/bin/pint --test` | NO APLICABLE en imagen prod: `vendor/bin/pint` no existe por install `--no-dev`. Cubierto local. |
| `docker compose ... exec backend vendor/bin/phpstan analyse` | NO APLICABLE en imagen prod: `vendor/bin/phpstan` no existe por install `--no-dev`. Cubierto local. |
| `npm run test:e2e` | FAIL: script inexistente. Script disponible: `npm run e2e`. |
| `npm run e2e` | FAIL/timeout: 11/16 pasaron en primera corrida; al apuntar `VITE_DEV_API_PROXY_TARGET=http://127.0.0.1:18080`, varios flujos fallaron por base productiva sin seed/usuarios esperados y el comando agotó timeout. |
| `bash -n scripts/validate_restore_mysql.sh` | NO VERIFICADO: `bash.exe` apunta a WSL sin distro instalada. |

## Riesgos restantes

- E2E operativo no esta verde. Antes de instalar en LAN real, crear un script reproducible para preparar datos de prueba no productivos o una config E2E dedicada contra Docker.
- `npm run test:e2e` no existe; el gate documentado debe alinearse a `npm run e2e` o agregarse alias.
- La imagen productiva no incluye dev tools. Esto es correcto para produccion, pero los comandos QA Docker deben ejecutarse contra una imagen/dev compose con dependencias dev, o documentarse como gates locales.
- La consulta directa a `backup_logs` del stack Docker no quedo capturada por quoting de shell; se cuenta con evidencia de scheduler logs, pero falta una consulta SQL limpia en el reporte final de instalacion LAN.
- `curl -I /assets/` devuelve 403 porque es directorio sin index; los headers estan presentes. Si el gate espera 200, debe apuntar a un asset real generado.

## Veredicto final

`F7_CONDITIONALLY_READY`

P0/P1 corregidos y runtime productivo Docker healthy. Queda pendiente cerrar el gate E2E y documentar una prueba LAN/offline real con datos controlados antes de elevar a `F7_OPERATIONAL_RELEASE_GATE_PASS`.
