# Billing Offline Readiness Report

## Dictamen

S_Hospital queda cerrado como producto tecnico de caja/facturacion hospitalaria offline LAN. No se cierra como producto clinico ni como HIS/EMR.

Estado final permitido de este cierre: `READY_FOR_REAL_LAN_INSTALLATION_TEST`.

La evidencia tecnica disponible cubre documentacion de alcance, navegacion final, suite backend completa, gates frontend, build y E2E release local. No se declara `PRODUCTION_READY` porque aun falta evidencia fisica final en servidor real, segunda PC LAN, impresora, backup worker/tarea programada, restore final, concurrencia final y configuracion production.

## Modulos revisados

- Login y sesion local.
- Nueva factura.
- Caja y pagos.
- Recibos institucionales.
- Historial y reimpresion.
- Reportes administrativos/financieros.
- Catalogo de servicios facturables.
- Usuarios y permisos.
- Configuracion fiscal/hospitalaria y de recibos.
- Respaldos locales.
- Ayuda/soporte operativo.

## Navegacion final verificada

El menu lateral final queda restringido a: Inicio, Nueva factura, Caja, Catalogo, Historial, Reportes, Respaldos, Configuracion, Usuarios y Ayuda.

Se removio la ruta SPA visible `/area-services` y el cliente frontend de `/api/area-services/paid`. La API backend de area queda como legado protegido y fuera del menu final.

## Contradicciones corregidas

- Se retiro la ruta visible de Servicios pagados por area del menu final.
- Se retiro la ruta SPA `/area-services` del cierre visible.
- Se retiro el cliente frontend de `/api/area-services/paid` y la vista asociada del flujo frontend.
- Se documento que areas/reportes por area son legado interno o fuera del menu final, no modulos clinicos.
- Se corrigio documentacion offline que hablaba de pacientes/citas como datos migrables activos.
- Se corrigio el prompt maestro para no pedir exportacion de citas ni guia de enfermeria.
- Se normalizo el setup inicial para usar Medicamentos como concepto facturable, no hospitalizacion como modulo.
- El runner E2E release queda validado con `E2E_SEED_PASSWORD=Password123!` y SQLite descartable.
- Se normalizo la semilla activa del catalogo facturable: la categoria `Hospitalizacion y Emergencia` queda como `Servicios generales`, `Cita` queda como `Registro administrativo` e `Internamiento` queda como `Estancia administrativa`.
- Se alineo el listado legado `frontend/src/routes.ts` con el menu final de 10 opciones.

## Gates ejecutados

| Gate | Resultado | Nota |
|---|---|---|
| `git diff --check -- reports/F21_FIX_AUDIT_FINDINGS_REPORT.md reports/CURRENT_RELEASE_TRUTH.md reports/BILLING_OFFLINE_READINESS_REPORT.md docs/PENDIENTES_VALIDACION_CAMPO.md` | PASS | Los docs/reportes F21 editados no tienen whitespace errors. |
| `git diff --check` | PASS | Sin whitespace errors despues de normalizar los CSV de catalogo. |
| `composer validate` | NO EJECUTADO | `composer` no esta disponible como comando local en este host. |
| `composer audit --no-interaction` | NO EJECUTADO | `composer` no esta disponible como comando local en este host. |
| `php artisan test --colors=never` | PASS | 567 passed, 11 skipped, 3667 assertions. |
| `php artisan test tests/Feature/InstitutionalReceiptPdfTest.php tests/Feature/InstitutionalReceiptPaymentIntegrationTest.php` | PASS | 15 tests, 161 assertions. |
| `php artisan test tests/Feature/Payments/VoidPaymentAgainstClosedCashSessionTest.php` | PASS | 2 tests, 10 assertions. |
| `php artisan test tests/Feature/ServiceCatalogTest.php` | PASS | 30 tests, 187 assertions despues de normalizar catalogo facturable. |
| `php artisan test --filter=BackupWorkflowTest --colors=never` | PASS | 20 tests, 106 assertions. |
| `php artisan test --filter=SystemStatusTest --colors=never` | PASS | 17 tests, 113 assertions. |
| `vendor/bin/pint --test` | PASS | Sin cambios de formato requeridos. |
| `vendor/bin/phpstan analyse` | NO USAR 128M | 128M puede ser insuficiente en este host. |
| `vendor/bin/phpstan analyse --memory-limit=512M` | PASS | 0 errors. |
| `npm audit --audit-level=high` | PASS | 0 vulnerabilities. |
| `npm run typecheck` | PASS | TypeScript OK. |
| `npm run lint` | PASS | ESLint OK. |
| `npm run test -- BackupsView BackupStatusBadge useBackups App --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | PASS | 7 files, 37 tests. |
| `npm run test -- appNavigation` | PASS | 1 file, 3 tests; defiende el menu final autorizado. |
| `npm run test:full:windows` | PASS | Primer intento timeout a 180s; segundo intento con 420s: 67 files, 297 tests. |
| `npm run build` | PASS | Vite 8.0.16 build OK. |
| `npm run e2e` | PASS | Primer intento sin `E2E_SEED_PASSWORD` fallo; segundo con `E2E_SEED_PASSWORD=Password123!` paso sobre SQLite descartable. |
| `scripts/assert_production_docker_sources.ps1` | PASS | Nginx SPA compatible con nonce Laravel. |
| `docker compose -f docker-compose.prod.yml config` | PASS | Ejecutado con variables dummy obligatorias; no valida `.env` final. |

## F21-H Backups

- El endpoint de restore no esta expuesto.
- Descargas requieren permiso y solo sirven backups registrados/existentes.
- Path traversal queda bloqueado.
- Fallos de backup se muestran con mensaje seguro para operador.
- UI muestra `pending`, `success`, `failed`, worker reciente/stale y diagnostico avanzado.
- Scheduler/worker real quedan pendientes de observacion en servidor final.

## F21-I QA Visual/UX

- E2E release gate cubrio emision, cobro, recibo y reportes en navegador controlado.
- Tests frontend cubren login, shell, catalogo, backups, soporte, 404, lazy routes, estados de error y permisos.
- No se hizo validacion fisica de impresora ni segunda PC LAN.
- No se ejecuto smoke visual mutante contra un servidor real; ese script requiere credenciales y target autorizado con `VISUAL_SMOKE_ALLOW_MUTATIONS=1`.

## Bloqueantes

No quedan bloqueantes tecnicos para demo/UAT ni para iniciar prueba de instalacion LAN real. Los bloqueantes restantes son de campo fisico.

## Pendientes de campo

- Segunda PC LAN real.
- Impresora fisica y papel final.
- Backup worker/tarea programada en servidor real.
- Restore final en base descartable.
- Configuracion production final y paquete offline/manifest actualizado.
- Concurrencia final con usuarios reales o simulacion aprobada sobre servidor final.

## Criterio para subir estado

- `PRODUCTION_CANDIDATE`: instalacion real ejecutada y aceptacion operativa en curso.
- `PRODUCTION_READY`: solo con evidencia fisica final de servidor, segunda PC LAN, impresora, backup worker/scheduler, restore, concurrencia y production config.
