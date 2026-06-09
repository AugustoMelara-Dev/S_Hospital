# Plan de 7 Fases — S_Hospital a Producción

**Fecha:** 2026-06-09
**Rama:** `codex/p2-audit-completion`
**Auditor:** opencode
**Base:** 3 pasadas de auditoría (explore paralelos) sobre 6 frentes (instalador, branding/docs, backend/datos, frontend/UX, recibos/impresión, QA final).

## Inventario de bugs conocidos

| ID | Severidad | Frente | Descripción |
|----|-----------|--------|-------------|
| BUG-DB-01 | ALTA | Backend | `backend/.env` versionado con secretos dev (DB_PASSWORD=hospital_dev, IPs hardcoded, HOSPITAL_DUMP_BINARY ruta XAMPP, REDIS_PASSWORD=null) |
| BUG-DB-02 | ALTA | Backend | `AppServiceProvider` vacío (24 líneas, sin Gate::policy()) |
| BUG-DB-03 | MEDIA | Backend | `CalculateInvoiceTotalsAction::26` usa `intdiv(...+50,100)` redondeo sesgado |
| BUG-SEC-01 | ALTA | Backend | `LicenseHelper::11` SECRET_SALT hardcoded `'Hospital_OS_LAN_Secured_2026_Key'` |
| BUG-SEC-02 | ALTA | Backend | `docker-compose.prod.yml` PUSHER_APP_KEY=`hospital-key` (default público) |
| BUG-SEC-03 | ALTA | Backend | `docker/entrypoint.sh` regenera APP_KEY sin prefijo `base64:` (visible en `ps`) |
| BUG-SEC-04 | ALTA | Backend | `CreateInvoiceAction` regla L.25 eritropoyetina con flag `dialysis_prescription` (cualquiera la puede tildar) |
| BUG-BA-22 | ALTA | Backend | `RegisterPaymentAction::111` reasigna `cash_session_id` de factura |
| BUG-P2-11 | ALTA | Backend | `BuildCashReconciliationAction::35,56` reintroduce `ROUND(amount*100)` |
| BUG-P2-19 | MEDIA | Backend | `CloseCashSessionAction::107-117` dispatcha RunBackupJob por cada cierre |
| BUG-P3-42 a 47 | BLOQUEANTE | Backend | 8 endpoints referencian archivos inexistentes → 500 en toda API |
| BUG-RPT-01 | ALTA | Backend | `PdfExportService::316,795` sin `setPaper()` |
| BUG-OPS-01 | MEDIA | Scripts | `check-branding.ps1` solo funciona con `rg` instalado |
| BUG-OPS-02 | MEDIA | Scripts | `refresh_lan_ip.ps1` llama scripts inexistentes (`_lib_env_helpers.ps1`, `_lib_lan_ip.ps1`) y usa sintaxis PS7 (`??`) |
| BUG-OPS-03 | ALTA | nginx | `nginx/default.conf` y `nginx/hospital-common.conf` no enrutan `/api/` antes del SPA fallback |
| BUG-P2-22 | ALTA | CHANGELOG | CHANGELOG.md miente: CSP nonce, ROUND eliminado, Policies/, AppServiceProvider, hospital:prune-*, LicenseHelper |
| BUG-FE-01 | ALTA | Frontend | `posMath.ts` duplica fiscalidad como fuente de verdad |
| BUG-FE-02 | ALTA | Frontend | `PaymentModal::160-176` sin `max` en input monto |
| BUG-P3-03 | ALTA | Frontend | `useHospitalSession::43-52` logout no desconecta Echo |
| BUG-P3-04 | ALTA | Frontend | `useHospitalSession::107-115` no invalida CSRF en 401 |
| BUG-P3-14 | BAJA | Frontend | `vite.config.ts` `manualChunks` con `lucide-react@1.16.0` (viejo) |
| BUG-P3-15 | BAJA | Frontend | `playwright.config.ts:22` usa `npm.cmd` |
| BUG-RECEIPT-01 | MEDIA | Backend | `GenerateReceiptDataAction::40` copy_label "Original" hardcoded |
| BUG-RECEIPT-02 | MEDIA | Backend | `PdfExportService` no respeta 80mm/58mm configurable |
| BUG-FE-LIGHT-01 | BAJA | Frontend | `useHospitalSession` no dark-mode en Login |
| BUG-BRAND-01 | MEDIA | Branding | APP_NAME antiguo en backend/.env (corregido en disco) |

## Convenciones

- Conventional Commits.
- Una fase o subfase por commit.
- Backend con tests Feature/Unit antes de commit; Frontend con tests Vitest + Playwright.
- Backend: `vendor/bin/pint --test`, `vendor/bin/phpstan analyse`, `php artisan test`.
- Frontend: `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`.
- Offline LAN: docker compose prod; backup diario + manual desde admin.
- Cada fase con criterios de aceptación verificables.

---

## FASE 0 — Estabilización del working tree (30 min)

**Objetivo:** limpiar el working tree para empezar el plan con base limpia.

**Alcance:**
- `git stash` con cambios no auditados (refactor frontend a lazy loading).
- Confirmar que el repo compila con backend tests verdes.
- Crear rama `plan/fase-0-7-rc` desde `codex/p2-audit-completion`.

**Archivos esperados:**
- (sin cambios a código, solo operación git)

**Pruebas:**
- `docker compose exec backend php artisan test --testsuite=Feature,Unit` debe pasar 380/380.

**Riesgos:** pérdida de trabajo si el stash no se recupera. Bajo si se etiqueta bien.

**Criterios de aceptación:**
- Working tree muestra solo los 3 archivos modificados intencionalmente (nginx, scripts).
- Tests backend verdes.
- Rama creada.

---

## FASE 1 — Branding & scripts de auditoría (1-2 h)

**Objetivo:** garantizar que el check de branding y los scripts auxiliares funcionan en cualquier máquina Windows con PowerShell 5.1, sin requerir ripgrep.

**Alcance:**
- Reescribir `scripts/check-branding.ps1` con fallback portable a `Select-String` (ya está, refinar).
- Aplicar mismo patrón a versión `offline-release/scripts/check-branding.ps1` (se regenera por `make_offline_release.ps1`).
- Añadir a `make_offline_release.ps1` la copia del fix de branding al bundle.
- Corregir `backend/.env` APP_NAME → `Sistema de Caja Hospitalaria` (ya hecho en disco).
- Documentar en `docs/CI.md` cómo correr el check localmente.

**Archivos esperados:**
- `scripts/check-branding.ps1` (refinar: usar `@()` en vez de ArrayList, evitar bug de scope).
- `scripts/make_offline_release.ps1` (asegurar copia de branding check).
- `docs/CI.md` (ampliar sección branding).
- `backend/.env` (sin cambios, ya corregido — verificar solo).

**Pruebas:**
- Sin `rg` en PATH, `pwsh -File scripts/check-branding.ps1` retorna EXIT=0.
- Con `rg` en PATH, mismo comando retorna EXIT=0.
- El script detecta correctamente un string prohibido (test manual inyectando el nombre antiguo en archivo de prueba).

**Riesgos:** falso negativo (no detecta branding prohibido) si el regex se rompe. Mitigado con prueba manual.

**Criterios de aceptación:**
- `scripts/check-branding.ps1` corre sin error y EXIT=0 sin rg.
- Mismo con rg.
- Detecta inyección manual del nombre antiguo en archivo de prueba.

**Commit:** `fix(ci): portable Select-String fallback for branding checks`

---

## FASE 2 — Secretos & configuración segura (2-3 h)

**Objetivo:** eliminar secretos del repo, validar uso de env vars, y garantizar que `.env` dev nunca se commitea por accidente.

**Alcance:**
- Eliminar `backend/.env` del repo (ya está en .gitignore; verificar que `.env.example` cubre todas las claves).
- Crear `backend/.env.example` si no existe, con placeholders seguros.
- Sanitizar `docker-compose.prod.yml` (PUSHER_APP_KEY por env var, no default).
- `docker/entrypoint.sh`: regenerar APP_KEY con `base64:` prefix o fallar si no está.
- Añadir `git pre-commit hook` que escanea `.env` accidental (opcional).
- `LicenseHelper`: usar `config('hospital.license_salt')` en vez de hardcoded; documentar en `docs/SECRETS.md`.

**Archivos esperados:**
- `backend/.env.example` (crear o completar).
- `docker-compose.prod.yml` (PUSHER_KEY a env var).
- `backend/docker/entrypoint.sh` (validación APP_KEY con `base64:`).
- `backend/app/Support/LicenseHelper.php` (salt desde config).
- `backend/config/hospital.php` (nuevo: `license_salt`).
- `docs/SECRETS.md` (actualizar con nueva rotación de salt).

**Pruebas:**
- `php artisan test` Feature+Unit verde.
- `docker compose config` no muestra secretos por defecto.
- Rotación manual de salt: `php artisan tinker` → `config('hospital.license_salt')` retorna valor.

**Riesgos:** si se elimina `.env` del repo y no hay `.env.example`, devs nuevos no pueden arrancar. Mitigado con `.env.example` completo.

**Criterios de aceptación:**
- `git log -- backend/.env` no muestra commits después del actual (ya ignorado).
- `docker compose -f docker-compose.prod.yml config` no imprime PUSHER_APP_KEY=hospital-key.
- `LicenseHelper` lee salt desde config; test unitario lo confirma.
- `docs/SECRETS.md` documenta cómo rotar.

**Commits:**
1. `chore(security): rotate LicenseHelper salt to config-driven value`
2. `chore(compose): require PUSHER_APP_KEY from env, no defaults`
3. `chore(docker): validate APP_KEY base64 prefix in entrypoint`
4. `docs(security): document license salt rotation`

---

## FASE 3 — Backend: arreglar 8 endpoints rotos y reglas de dinero (3-4 h)

**Objetivo:** que la API no devuelva 500 en ninguna ruta, y que el cálculo monetario use siempre enteros (centavos).

**Alcance:**
- Crear controllers/actions faltantes: `LoginLockout` middleware, `PatientInvoiceController`, `HealthController`, `CspReportController`, `EchoConfigController`, `InvoiceAuditController`, `InvoiceController::reverse`, `ReverseInvoiceAction`.
- Reemplazar `BuildCashReconciliationAction::35,56` de `ROUND(amount*100)` a operaciones con enteros.
- `CalculateInvoiceTotalsAction::26`: cambiar `intdiv(...+50,100)` a `Math::roundToCent` (helper) sin sesgo.
- `RegisterPaymentAction::111`: NO reasignar `cash_session_id` de la factura; validar que el payment usa la misma sesión activa.
- `CloseCashSessionAction::107-117`: NO dispatchar RunBackupJob por cada cierre; mover a scheduler.
- Crear commands faltantes: `PruneAuditLogsCommand`, `PruneFailedJobsCommand`, `PruneBackupsCommand`, `SchedulerTickCommand`.
- Mover `auth:create-initial-admin` de `routes/console.php:13` a `app/Console/Commands/InitialAdminCommand.php`.
- Crear `app/Policies/` y registrar en `AppServiceProvider`.

**Archivos esperados:**
- `backend/app/Http/Controllers/Api/PatientInvoiceController.php` (nuevo).
- `backend/app/Http/Controllers/Api/HealthController.php` (nuevo).
- `backend/app/Http/Controllers/Api/CspReportController.php` (nuevo).
- `backend/app/Http/Controllers/Api/EchoConfigController.php` (nuevo).
- `backend/app/Http/Controllers/Api/InvoiceAuditController.php` (nuevo).
- `backend/app/Http/Controllers/Api/InvoiceController.php` (actualizar: método `reverse`).
- `backend/app/Actions/Billing/ReverseInvoiceAction.php` (nuevo).
- `backend/app/Http/Middleware/LoginLockout.php` (nuevo).
- `backend/app/Support/Money.php` (nuevo: helpers de centavos, sin floats).
- `backend/app/Actions/Cash/BuildCashReconciliationAction.php` (refactor: usar Money).
- `backend/app/Actions/Billing/CalculateInvoiceTotalsAction.php` (refactor: usar Money).
- `backend/app/Actions/Payments/RegisterPaymentAction.php` (refactor: NO tocar cash_session_id).
- `backend/app/Actions/Cash/CloseCashSessionAction.php` (refactor: no dispatch RunBackupJob).
- `backend/app/Console/Commands/PruneAuditLogsCommand.php` (nuevo).
- `backend/app/Console/Commands/PruneFailedJobsCommand.php` (nuevo).
- `backend/app/Console/Commands/PruneBackupsCommand.php` (nuevo).
- `backend/app/Console/Commands/SchedulerTickCommand.php` (nuevo).
- `backend/app/Console/Commands/InitialAdminCommand.php` (mover desde routes/console.php).
- `backend/app/Policies/InvoicePolicy.php` (nuevo).
- `backend/app/Policies/CashSessionPolicy.php` (nuevo).
- `backend/app/Policies/ServicePolicy.php` (nuevo).
- `backend/app/Providers/AppServiceProvider.php` (registrar Policies).
- `backend/tests/Feature/Api/*` (cubrir todos los nuevos endpoints).
- `backend/tests/Unit/Support/MoneyTest.php` (nuevo).

**Pruebas:**
- `php artisan test`: agregar 8 Feature tests + 5 Unit tests nuevos; 100% verde.
- `php artisan route:list`: 0 referencias a archivos inexistentes.
- `php artisan tinker`: `Money::fromFloat(1.005)->toCents() === 100` (verifica redondeo bancario).
- `php artisan tinker`: `Money::fromFloat(0.1)->plus(Money::fromFloat(0.2))->toFloat() === 0.3` (sin error de float).

**Riesgos:**
- Refactor de dinero puede romper pruebas existentes (380/380). Mitigado con test que verifica igualdad de comportamiento antes/después.
- Crear controllers nuevos es trabajo manual. Mitigado con TDD: tests Feature primero, controllers después.

**Criterios de aceptación:**
- `php artisan test` 100% verde (incluyendo nuevos).
- `php artisan route:list` no muestra errores.
- `grep -r "ROUND.*\*.*100" backend/app/` retorna 0 hits.
- `grep -r "intdiv.*50.*100" backend/app/` retorna 0 hits.
- 8 endpoints devuelven JSON válido (no 500).
- `app/Policies/` existe y está registrado.

**Commits:**
1. `feat(backend): add Money helper and refactor ROUND usages`
2. `feat(api): add missing controllers for invoices, health, csp, echo, audit`
3. `feat(api): add LoginLockout middleware and reverse invoice action`
4. `refactor(payments): never overwrite cash_session_id from invoice`
5. `refactor(cash): move backup trigger from close to scheduler`
6. `feat(console): add prune-* commands and scheduler-tick`
7. `feat(console): move auth:create-initial-admin to dedicated command`
8. `feat(authorization): add Policies and register in AppServiceProvider`

---

## FASE 4 — Frontend: fuente única de verdad fiscal y auth (3-4 h)

**Objetivo:** eliminar duplicación de reglas fiscales en frontend, cerrar fugas de sesión en logout, y tipar mejor los flujos de dinero.

**Alcance:**
- `posMath.ts`: deprecado; reemplazar imports por llamadas API que retornan totales calculados.
- `useHospitalSession`: al logout y en 401, desconectar Echo, invalidar CSRF, purgar TanStack Query cache.
- `echo.ts`: resetear `configPromise` en error.
- `PaymentModal`: añadir `max={pendingAmount}` al input monto.
- `CashBoxView`: eliminar `parseCents` local, usar helper compartido.
- `vite.config.ts`: actualizar `lucide-react` a versión actual.
- `playwright.config.ts`: cambiar `npm.cmd` a `npm` (cross-platform).
- `useHospitalSession`: dark mode en Login.
- Crear `frontend/src/lib/money.ts` con `parseCents`/`formatCents`/`fromFloat` único.

**Archivos esperados:**
- `frontend/src/lib/money.ts` (nuevo).
- `frontend/src/lib/csrf.ts` (nuevo: helper para invalidar CSRF cookie).
- `frontend/src/lib/realtime/echo.ts` (refactor: reset en error).
- `frontend/src/app/useHospitalSession.ts` (refactor: limpiar en logout/401).
- `frontend/src/features/invoices/state/posMath.ts` (deprecado → re-exporta desde `lib/money.ts`).
- `frontend/src/features/invoices/components/PaymentModal.tsx` (input max).
- `frontend/src/features/cash/CashBoxView.tsx` (usar lib/money).
- `frontend/vite.config.ts` (actualizar lucide-react).
- `frontend/playwright.config.ts` (npm en vez de npm.cmd).
- `frontend/src/features/auth/LoginView.tsx` (dark mode, si existe).
- `frontend/src/test/money.test.ts` (nuevo).
- `frontend/src/test/useHospitalSession.test.ts` (nuevo).

**Pruebas:**
- `npm run typecheck` verde.
- `npm run lint` verde.
- `npm run test`: 100% verde con nuevos tests.
- `npm run build` sin warnings.
- Test E2E: logout limpia Echo, no se reciben eventos de broadcast tras logout.

**Riesgos:**
- Cambio de posMath puede romper componentes que lo importan. Mitigado con re-export temporal.
- Refactor de useHospitalSession puede romper login flow. Mitigado con tests E2E.

**Criterios de aceptación:**
- `grep -r "posMath" frontend/src/features` solo aparece en re-exports deprecados.
- `useHospitalSession` en logout llama `echo.disconnect()` y `queryClient.clear()`.
- `PaymentModal` no permite pagar más del pendiente.
- `npm run test` 100% verde.

**Commits:**
1. `feat(frontend): centralize money helpers in lib/money.ts`
2. `refactor(frontend): deprecate posMath in favor of backend totals`
3. `fix(frontend): disconnect Echo and clear cache on logout/401`
4. `fix(frontend): cap payment input to pending amount`
5. `fix(frontend): reset echo configPromise on error`
6. `chore(frontend): update lucide-react and fix playwright npm cmd`
7. `feat(frontend): dark mode for login screen`

---

## FASE 5 — nginx routing y CSP (1-2 h)

**Objetivo:** que el routing de nginx no rompa API y que CSP sea operativo, no solo Report-Only.

**Alcance:**
- `nginx/default.conf` y `nginx/hospital-common.conf`: location `/api/` antes de SPA fallback (ya hecho en disco, refinar).
- CSP: pasar nonce desde backend (middleware) a nginx (header `X-S_HOSPITAL_CSP_NONCE`) y substituir `__S_H_HOSPITAL_CSP_NONCE__` con directiva `script-src 'nonce-...'`.
- Cabeceras de seguridad ya en server, mover a `nginx/conf.d/security-headers.conf` reusable.

**Archivos esperados:**
- `nginx/default.conf` (refinar bloques api).
- `nginx/hospital-common.conf` (mismo).
- `nginx/conf.d/security-headers.conf` (nuevo, reusable).
- `backend/app/Http/Middleware/CspNonce.php` (nuevo: genera nonce, expone en response).
- `backend/bootstrap/app.php` (registrar middleware).
- `backend/config/csp.php` (nuevo).

**Pruebas:**
- `curl -I http://localhost/api/health` retorna 200 JSON, no HTML.
- `curl -I http://localhost/` retorna 200 HTML.
- `nginx -t` (si nginx instalado) verde.
- CSP header presente en respuesta.

**Riesgos:** CSP muy estricto puede romper inline scripts del bundle. Mitigado con Report-Only primero (ya activo), luego estricto.

**Criterios de aceptación:**
- API responde JSON en `/api/*`.
- Frontend responde HTML en `/`.
- CSP header presente y reporta 0 errores en consola tras navegación completa.

**Commit:** `fix(nginx): route /api/ before SPA fallback and enable CSP with nonce`

---

## FASE 6 — Documentación, CHANGELOG y manuales (2-3 h)

**Objetivo:** alinear CHANGELOG con código, completar manuales faltantes, regenerar release notes.

**Alcance:**
- Reescribir `CHANGELOG.md` v1.0.0-rc.4 para que coincida con código.
- Corregir mojibake en `RELEASE_NOTES_v1.0.0-rc.3.md` y `v1.0.0-rc.4.md` (UTF-8 BOM o encoding correcto).
- `docs/INSTITUTIONAL_RECEIPT_PRINT_VALIDATION.md`: actualizar con pruebas reales (80mm y 58mm).
- `docs/manuales/MANUAL_CAJERO.md`: añadir flujo de eritropoyetina con L.25.
- `docs/KNOWN_LIMITATIONS.md`: añadir bugs P3 conocidos que se difieren.
- `docs/OPERATIVE_NOTES_2026_06_02.md`: actualizar estado a "RC1 listo para piloto".

**Archivos esperados:**
- `CHANGELOG.md` (reescribir sección rc.4).
- `docs/RELEASE_NOTES_v1.0.0-rc.3.md` (re-encode).
- `docs/RELEASE_NOTES_v1.0.0-rc.4.md` (re-encode + alinear con CHANGELOG).
- `docs/INSTITUTIONAL_RECEIPT_PRINT_VALIDATION.md` (actualizar).
- `docs/manuales/MANUAL_CAJERO.md` (sección L.25).
- `docs/KNOWN_LIMITATIONS.md` (bugs P3 diferidos).
- `docs/OPERATIVE_NOTES_2026_06_02.md` (estado).

**Pruebas:**
- Manual visual: leer PDF impreso y validar coincidencia con digital.
- Encoding check: `file -i docs/RELEASE_NOTES*.md` retorna `utf-8` o `utf-8-bom`.

**Riesgos:** bajo; trabajo editorial.

**Criterios de aceptación:**
- CHANGELOG rc.4 coincide con cambios reales de la fase 1-5.
- Manuales mencionan flujos L.25, anulación, cierre de caja.
- Encoding correcto en release notes.

**Commits:**
1. `docs(changelog): realign v1.0.0-rc.4 with actual code changes`
2. `docs(release-notes): fix mojibake in rc.3 and rc.4`
3. `docs(manuals): add L.25 dialysis prescription flow for cashier`
4. `docs(limitations): document deferred P3 issues`

---

## FASE 7 — QA final y veredicto honesto (2-3 h)

**Objetivo:** ejecutar quality gate completo y producir un veredicto verificable, no marketing.

**Alcance:**
- Backend: `php artisan test` (380+ tests), `vendor/bin/pint --test`, `vendor/bin/phpstan analyse`.
- Frontend: `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`.
- E2E Playwright: login, crear factura, cobrar, imprimir, reimprimir, cerrar caja, ver reportes.
- Capturas de pantalla de cada vista principal (Login, Dashboard, POS, Caja, Reportes, Recibo, Settings).
- Ejecutar `scripts/check-branding.ps1` (EXIT=0 esperado).
- Ejecutar `make_offline_release.ps1` y `assert_offline_release_clean.ps1`.
- Verificar que el bundle offline no contiene secretos.

**Archivos esperados:**
- `qa/FINAL_PRODUCTION_HANDOFF_RESULT.md` (reescribir con evidencia).
- `qa/screenshots/*.png` (12+ capturas).
- `qa/E2E_REPORT.md` (reporte de E2E).
- `qa/SECRETS_SCAN.md` (reporte de scan final).

**Pruebas:** todas las de arriba.

**Riesgos:** E2E puede fallar por bugs ocultos. Si falla, FASE 3-5 incompleta → volver a fase fallida.

**Criterios de aceptación:**
- Backend test 100% verde.
- Frontend build sin warnings.
- E2E cubre los 6 flujos críticos y pasan.
- Capturas de cada vista, sin errores de consola visibles.
- `check-branding.ps1` EXIT=0.
- Bundle offline no contiene secretos (`grep -r "PASSWORD=" offline-release/` retorna 0).
- Veredicto honesto: "READY FOR PILOT" o "NOT READY, faltan X".

**Commit:** `docs(qa): final RC1 production handoff with evidence`

---

## Resumen

| Fase | Horas | Commits | Riesgo |
|------|-------|---------|--------|
| 0 | 0.5 | 0 | bajo |
| 1 | 1.5 | 1 | bajo |
| 2 | 2.5 | 4 | medio |
| 3 | 3.5 | 8 | alto |
| 4 | 3.5 | 7 | alto |
| 5 | 1.5 | 1 | medio |
| 6 | 2.5 | 4 | bajo |
| 7 | 2.5 | 1 | medio |
| **Total** | **18 h** | **26** | **medio** |

**Orden de ejecución:** 0 → 1 → 2 → 3 → 4 → 5 → 6 → 7.

**Criterio de stop:** si FASE 3 falla en refactor de Money, abortar y volver al estado anterior con `git reset --hard`.
