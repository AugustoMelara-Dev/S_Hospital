# F21 Fix Audit Findings Report

## Baseline

- Rama: v1.1-critical-hardening-after-offline.
- HEAD inicial solicitado en F21-A: 10912aeee09a2979f5a1359ed6e2e1f338465a71.
- HEAD final observado: bd39cbeaedfed48a5a8f76d01b127d4ec9a53f1b.
- Nota: no se hizo commit, git add ni cambio de rama durante F21. El cambio de HEAD ya estaba presente al observar el cierre; se registra como cambio concurrente/baseline externo, no como commit de este agente.

## Estado Git Inicial

Se detecto arbol sucio con documentos no rastreados y cambios concurrentes en frontend/backend/docs. Se decidio no sobrescribir trabajo ajeno y trabajar con parches acotados.

## Estado Git Final

Quedan cambios sin staging. No se hizo commit por instruccion explicita del usuario.

## Cambios Concurrentes Detectados

- Documentos no rastreados en `docs/` y `reports/`.
- Cambios de alcance/navegacion ya presentes en el baseline actual.
- Cambios de hardening de backups/CSP/dependencias ya presentes en el baseline observado o aplicados antes del cierre de este reporte.

## Hallazgos Corregidos o Verificados

- P1-001: `GET /api/institutional-receipts/{receipt}/pdf` queda read-only. El registro de impresion/reimpresion se hace con `POST /api/institutional-receipts/{receipt}/print-events`.
- P1-002/P2-004: el alcance legacy de servicios de area no esta activo en el flujo final; tests confirman 404 para `/api/area-services/paid`.
- P2-001: la anulacion directa de pagos de caja cerrada esta bloqueada con error controlado.
- P2-002: `npm audit --audit-level=high` queda en 0 vulnerabilidades; Vite subio a 8.0.16 y `ws` queda en 8.21.0.
- P2-003: CSP productiva queda alineada con Laravel sirviendo HTML SPA y nonce real; validador de Docker/CSP pasa.
- P2-005: backups exponen diagnostico de worker/pending/stale y fallos seguros; la validacion final de worker/scheduler real queda pendiente de campo.
- P3-001: se ejecuto E2E controlado sobre SQLite descartable y tests frontend serializados.

## Hallazgos No Cerrados por Falta de Campo

- Segunda PC LAN real.
- Impresora fisica real y papel final.
- Restore final firmado en servidor real o base descartable aprobada.
- Concurrencia final en entorno real.
- Worker/scheduler de backups instalado y observado en servidor final.
- Configuracion production final con `.env` real.

## Archivos Modificados

- `backend/app/Http/Controllers/InstitutionalReceiptController.php`
- `backend/tests/Feature/InstitutionalReceiptPaymentIntegrationTest.php`
- `backend/tests/Feature/InstitutionalReceiptPdfTest.php`
- `frontend/e2e/release-gate.spec.ts`
- `frontend/src/App.test.tsx`
- `frontend/src/features/invoices/NewInvoiceView.test.tsx`
- Archivos formateados por Pint: `backend/app/Http/Controllers/SystemStatusController.php`, `backend/database/migrations/2026_06_15_000004_add_offline_check_constraints.php`, `backend/tests/Feature/Offline/OfflineCheckConstraintsMigrationTest.php`, `backend/tests/Feature/Payments/VoidPaymentAgainstClosedCashSessionTest.php`, `backend/tests/Feature/SystemStatusTest.php`.
- Documentos de alcance y reportes F21 en `docs/` y `reports/`.

## Tests Agregados o Ajustados

- Tests de recibo institucional para confirmar que GET PDF no muta auditoria.
- Tests de POST print-events para primera impresion, reimpresion con motivo e idempotencia.
- Tests frontend/E2E actualizados al flujo de impresion explicita.

## Comandos Ejecutados

- `php artisan test --filter=InstitutionalReceiptPaymentIntegrationTest --colors=never` PASS.
- `php artisan test --filter=InstitutionalReceiptPdfTest --colors=never` PASS.
- `php artisan test --filter=ServiceCatalogTest --colors=never` PASS.
- `php artisan test --colors=never` PASS, 563 passed, 11 skipped.
- `vendor/bin/pint --test` PASS.
- `php -d memory_limit=512M vendor/bin/phpstan analyse` PASS.
- `php artisan route:list` PASS.
- `npm audit --audit-level=high` PASS, 0 vulnerabilities.
- `npm run typecheck` PASS.
- `npm run lint` PASS.
- `npm run test:full:windows` PASS, 67 files / 297 tests.
- `npm run build` PASS.
- `npm run e2e` PASS con `E2E_SEED_PASSWORD=Password123!` y SQLite descartable.
- `scripts/assert_production_docker_sources.ps1` PASS.
- `docker compose -f docker-compose.prod.yml config` PASS con variables dummy; sin variables falla por secretos requeridos.
- `git diff --check` PASS.

## Riesgos Restantes

- No hay evidencia fisica de segunda PC LAN ni impresora real en este entorno.
- No se valido restore final firmado contra servidor real.
- No se observo worker/scheduler de backups corriendo en servidor final.
- `composer` no esta disponible como comando local en este host; se uso el vendor instalado para Pint/PHPStan.

## Pendientes de Campo

Registrar evidencia en:

- `qa/LAN_CLIENT_VALIDATION_PROOF.md`
- `qa/INSTITUTIONAL_RECEIPT_PRINT_PROOF.md`
- `qa/FINAL_RESTORE_PROOF.md`
- `qa/FINAL_CONCURRENCY_PROOF.md`

## Estado Final Permitido

PRODUCTION_CANDIDATE.

No declarar PRODUCTION_READY hasta completar evidencia final en servidor real, segunda PC LAN, impresora fisica, restore final, concurrencia final, worker/scheduler de backups y configuracion production final.

## Recomendacion de Commit

Sugerido, cuando el usuario autorice staging/commit:

`fix(receipts): separate pdf rendering from print audit events`
