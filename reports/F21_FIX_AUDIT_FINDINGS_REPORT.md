# F21 Fix Audit Findings Report

## Baseline

- Rama: `v1.1-critical-hardening-after-offline`.
- HEAD inicial registrado en F21-A: `10912aeee09a2979f5a1359ed6e2e1f338465a71`.
- HEAD final observado: `0dab48f53077c039b084b41f8584d21684348892`.
- No se hizo `git add`, commit, cambio de rama ni rebase desde esta sesion F21-H/I/J. Durante el cierre aparecieron commits concurrentes en la rama; se registran como trabajo externo.

## Estado Git Inicial

F21-A detecto un arbol sucio con cambios concurrentes en backend, frontend, tests, docs y reportes. La decision fue trabajar con parches acotados, sin revertir trabajo ajeno y sin asumir autoria de cambios previos.

## Estado Git Final

El cierre debe revisarse y commitearse solo despues de autorizacion explicita. En el ultimo corte, `git diff --check` global falla por trailing whitespace/CRLF en `catalogo_servicios_inicial.csv`, archivo concurrente no modificado durante F21-H/I/J.

## Cambios Concurrentes Detectados

- Documentos y reportes no rastreados en `docs/` y `reports/`.
- Cambios previos en navegacion, pruebas frontend/backend y rutas.
- Cambios previos de hardening offline, backups, CSP y dependencias.
- Cambios concurrentes finales en catalogo/seeders/rutas: `backend/database/seeders/ServiceCatalogSeeder.php`, `backend/database/seeders/data/catalogo_servicios_inicial.csv`, `catalogo_servicios_inicial.csv`, `database/seed_servicios_iniciales.sql`, `docs/FISCAL_RULES.md`, `frontend/src/routes.ts`.
- Commits concurrentes observados al cierre: `a8705dd4 chore(offline): seeder slug fix, routes entries, reports, OFFLINE plan polish` y `0dab48f5 docs(offline): v1.1 matrix updated to Estado 2.5 cerrado 22 commits`.
- No se sobrescribieron cambios concurrentes; las ediciones finales se limitaron a docs/reportes solicitados y fixes F21 ya identificados.

## Hallazgos Corregidos o Verificados

- P1-001: `GET /api/institutional-receipts/{receipt}/pdf` queda read-only; la auditoria de impresion/reimpresion ocurre mediante `POST /api/institutional-receipts/{receipt}/print-events`.
- P1-002: los servicios de area no se activan como flujo final de facturacion; la ruta legacy `/api/area-services/paid` queda fuera del alcance operativo.
- P2-001: la anulacion directa de pagos asociados a caja cerrada esta bloqueada con error controlado.
- P2-002: `npm audit --audit-level=high` reporta 0 vulnerabilidades.
- P2-003: produccion sirve la SPA por Laravel para aplicar nonce real; el validador de fuentes Docker/CSP pasa.
- P2-004: menu final billing-only sin modulo clinico ni flujo activo de servicios de area.
- P2-005: backups muestran estados `pending`, `success`, `failed`, diagnostico de worker/scheduler y mensajes seguros; restore real queda como validacion de campo.
- P3-001: se ejecuto E2E controlado sobre SQLite descartable y pruebas frontend/backend de pantallas criticas.

## Hallazgos No Cerrados por Falta de Campo

- Segunda PC LAN real.
- Impresora fisica final y papel real.
- Restore final firmado en base descartable aprobada.
- Concurrencia final en entorno real.
- Worker/scheduler de backups instalado y observado en servidor final.
- Configuracion production final con `.env` real, IP LAN, CORS/Sanctum y firewall.

## Archivos Modificados

- `backend/app/Http/Controllers/InstitutionalReceiptController.php`
- `backend/app/Http/Controllers/SystemStatusController.php`
- `backend/database/migrations/2026_06_15_000004_add_offline_check_constraints.php`
- `backend/tests/Feature/InstitutionalReceiptPaymentIntegrationTest.php`
- `backend/tests/Feature/InstitutionalReceiptPdfTest.php`
- `backend/tests/Feature/Offline/OfflineCheckConstraintsMigrationTest.php`
- `backend/tests/Feature/Payments/VoidPaymentAgainstClosedCashSessionTest.php`
- `backend/tests/Feature/SystemStatusTest.php`
- `frontend/e2e/release-gate.spec.ts`
- `frontend/src/App.test.tsx`
- `frontend/src/features/invoices/NewInvoiceView.test.tsx`
- `reports/CURRENT_RELEASE_TRUTH.md`
- `reports/F21_FIX_AUDIT_FINDINGS_REPORT.md`
- `reports/BILLING_OFFLINE_READINESS_REPORT.md`
- `docs/PENDIENTES_VALIDACION_CAMPO.md`
- Nuevos documentos no rastreados en `docs/` y `reports/` del cierre billing-only/offline.
- Cambios concurrentes actuales no atribuibles a F21-H/I/J: catalogo CSV/seeders, `docs/FISCAL_RULES.md` y `frontend/src/routes.ts`.

## Tests Agregados o Ajustados

- Tests de recibo institucional para confirmar que GET PDF no muta auditoria.
- Tests de `POST print-events` para primera impresion, reimpresion con motivo e idempotencia.
- Tests de area legacy para bloquear el flujo fuera del alcance final.
- Tests de anulacion de pago post-cierre.
- Tests de backups/status para worker stale, pending, failed, path traversal y restore no expuesto.
- Tests frontend de backups, navegacion final, estados de error y reimpresion explicita.
- E2E release gate de emision, cobro, recibo y reportes.

## Comandos Ejecutados y Resultados

- `php artisan test --filter=InstitutionalReceiptPaymentIntegrationTest --colors=never`: PASS.
- `php artisan test --filter=InstitutionalReceiptPdfTest --colors=never`: PASS.
- `php artisan test --filter=ServiceCatalogTest --colors=never`: PASS.
- `php artisan test --filter=test_voiding_payment_from_closed_cash_session_is_rejected_without_changing_report_snapshot --colors=never`: PASS, 1 test, 15 assertions.
- `php artisan test --filter=CashPaymentsReceiptTest --colors=never`: PASS, 27 tests, 295 assertions.
- `php artisan test --filter=BackupWorkflowTest --colors=never`: PASS, 20 tests, 106 assertions.
- `php artisan test --filter=SystemStatusTest --colors=never`: PASS, 17 tests, 113 assertions.
- `php artisan test --colors=never`: PASS, 567 passed, 11 skipped, 3667 assertions.
- `vendor/bin/pint --test`: PASS.
- `php -d memory_limit=512M vendor/bin/phpstan analyse`: PASS, 0 errors.
- `composer validate`: NO EJECUTADO, `composer` no esta disponible como comando local.
- `composer audit --no-interaction`: NO EJECUTADO, `composer` no esta disponible como comando local.
- `npm audit --audit-level=high`: PASS, 0 vulnerabilities.
- `npm run typecheck`: PASS.
- `npm run lint`: PASS.
- `npm run test -- BackupsView BackupStatusBadge useBackups App --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000`: PASS, 7 files, 37 tests.
- `npm run test:full:windows`: primer intento TIMEOUT a 180s; segundo intento PASS, 67 files, 297 tests.
- `npm run build`: PASS.
- `npm run e2e`: primer intento FAIL por falta de `E2E_SEED_PASSWORD`; segundo intento con `E2E_SEED_PASSWORD=Password123!` PASS, 1 Playwright test, SQLite descartable.
- `php artisan test --filter=ProductionSpaRouteTest --colors=never`: PASS, 5 tests, 98 assertions.
- `php artisan test --filter=SecurityHeadersTest --colors=never`: PASS, 6 tests, 38 assertions.
- `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/assert_production_docker_sources.ps1`: PASS.
- `docker compose -f docker-compose.prod.yml config`: PASS con variables dummy obligatorias.
- `git diff --check -- reports/F21_FIX_AUDIT_FINDINGS_REPORT.md reports/CURRENT_RELEASE_TRUTH.md reports/BILLING_OFFLINE_READINESS_REPORT.md docs/PENDIENTES_VALIDACION_CAMPO.md`: PASS.
- `git diff --check`: FAIL por `catalogo_servicios_inicial.csv` con trailing whitespace/CRLF en cambio concurrente.

## Evidencia QA Visual/UX

- E2E controlado: `frontend/test-results/release-e2e-report.json`.
- Pantallas cubiertas por pruebas unitarias/integracion frontend: login, shell, dashboard/rutas autenticadas, nueva factura, caja, catalogo, historial, reportes, respaldos, configuracion, usuarios/soporte, 404 y estados de backup.
- No se valida impresora fisica, segunda PC LAN ni responsive real de hardware final en este entorno.

## Riesgos Restantes

- Validacion fisica pendiente.
- Restore real pendiente en base descartable aprobada.
- Worker/scheduler pendiente de observacion en servidor final.
- Configuracion production final pendiente.
- `composer` CLI no disponible en este host; se requiere correr `composer validate` y `composer audit` desde Docker o host con Composer antes de firma final.
- El worktree contiene cambios concurrentes en catalogo/seeders/rutas; revisar antes de staging.
- `git diff --check` global queda bloqueado por `catalogo_servicios_inicial.csv` hasta limpiar ese archivo o excluirlo de este commit.

## Pendientes de Campo

Registrar evidencia firmada en:

- `qa/LAN_CLIENT_VALIDATION_PROOF.md`
- `qa/INSTITUTIONAL_RECEIPT_PRINT_PROOF.md`
- `qa/FINAL_RESTORE_PROOF.md`
- `qa/FINAL_CONCURRENCY_PROOF.md`
- `qa/BACKUP_WORKER_SCHEDULER_PROOF.md`

## Estado Final Permitido

`READY_FOR_REAL_LAN_INSTALLATION_TEST`.

No declarar `PRODUCTION_READY` hasta completar evidencia final en servidor real, segunda PC LAN, impresora fisica, restore final, concurrencia final, worker/scheduler de backups y configuracion production final.

## Recomendacion de Commit

Cuando el usuario autorice staging y commit, se recomienda un commit unico de cierre F21:

`fix(release): harden offline billing audit findings`
