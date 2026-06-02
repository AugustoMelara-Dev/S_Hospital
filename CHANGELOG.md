# Changelog - Sistema de Caja Hospitalaria

## v1.0.0 - Production Audit Plan Hardening (2026-06-02)

### Resumen

Veinte fases de endurecimiento + 4 fases operacionales quedaron
implementadas como código. El sistema pasa de `v1.0.0-rc.3` a
`v1.0.0` con la promesa de un sistema hospitalar listo para operar
en red local LAN, con seguridad endurecida, dinero siempre en
centavos, observabilidad operativa y manuales para el operador no
tecnico.

### Metricas al cierre de v1.0.0

- 340/340 tests PHPUnit backend (2188 assertions, 4 skipped
  legítimos: race test concurrente que requiere MySQL real)
- 211/211 tests Vitest frontend
- 0 errores de typecheck
- 0 errores de ESLint
- 0 errores de phpstan nivel 4 sobre 110 archivos en app/
  (baseline nivel 6 cubriendo 240 hallazgos preexistentes)
- Bundle gzipped mas grande: charts 116.73 kB (objetivo < 250 kB)
- Build de produccion sin warnings bloqueantes

### Fases A1-A10 (codigo) cerradas en este release

- **A9** Mover `SECRET_SALT` de `LicenseHelper` a `HOSPITAL_LICENSE_SALT`
  en `.env` con rotacion por hospital
- **A2.1** Columnas cents en `invoices` y `invoice_items` con
  backfill PHP en driver no-MySQL
- **A2.2** `quantity_cents` en `invoice_items`; eliminacion de
  `ROUND(x * 100)` en `BuildCashReconciliationAction`,
  `DashboardReportService`, `DailyReportService`, `MonthlyReportService`,
  `AreaIncomeReportService`, `ServiceSalesReportService`,
  `CategoryReportService`, `FinancialFactsService` (8 servicios, 12
  guard tests)
- **A1+A8** CSP nonce en produccion: plugin Vite emite placeholder
  `__S_HOSPITAL_CSP_NONCE__`, backend Laravel inyecta nonce por
  request y sirve HTML con scripts/styles etiquetados. `unsafe-inline`
  removido de `script-src` en CSP de produccion
- **A3** `entrypoint.sh` espera MariaDB healthcheck (default 120s)
  antes de ejecutar `php artisan migrate --force`; `setup.bat` espera
  healthcheck de MariaDB (max 60 intentos × 2s) en lugar de
  `timeout /t 10` fijo
- **A4** Rate limit 10/1min en `/api/health` y `/api/system/health`
- **A7** CSP report-uri endurecido: rate limit 30/1min, Content-Type
  allowlist, tamaño maximo 4KB (413), sanitizacion de secretos/URLs
- **A10** Comandos `hospital:prune-audit-logs` y
  `hospital:prune-failed-jobs` con schedules diarios
- **A5** `NewInvoiceView` 775 -> 490 lineas; `NewInvoiceViewLayout`
  extraido a archivo dedicado
- **A6** `BackupsView` muestra badge "Worker activo/inactivo" basado
  en `systemStatus.backups.worker_recently_active`

### Bloque C (operacional) cerrado en este release

- **C1** 8 manuales para operador no tecnico en `docs/manuales/`
  (MANUAL_CAJERO, MANUAL_ADMINISTRADOR, MANUAL_SUPERVISOR,
  GUIA_INSTALACION_OPERATIVA, GUIA_RESPALDOS_Y_RESTAURACION,
  GUIA_SOPORTE_PRIMER_NIVEL, GUIA_CAPACITACION_SEGURA,
  CHECKLIST_CAPACITACION)
- **C2** `docs/DISASTER_RECOVERY.md` con 10 escenarios (servidor
  no enciende, base no responde, contrasena admin perdida, APP_KEY
  perdida, restore desde backup, cola de respaldos llena, tarea
  Windows sin correr, disco lleno, cierre de caja imposible, restore
  offline desde USB)
- **C3** `scripts/ping_lan_clients.ps1` que una PC cliente puede correr
  para validar `/up`, `/login`, `/verify-email`, `/api/system/health`
  y assets JS/CSS, con opcion `-EvidencePath` para generar evidencia
  Markdown

### Fases B1-B6 (evidencia fisica) pendientes

`PRODUCTION_CANDIDATE` se mantiene hasta que se complete la
evidencia fisica con hardware real:

- B1 LAN cliente (`qa/LAN_CLIENT_VALIDATION_PROOF.md`)
- B2 Impresora institucional 5 tamanos
  (`qa/INSTITUTIONAL_RECEIPT_PRINT_PROOF.md`)
- B3 Restore final (`qa/FINAL_RESTORE_PROOF.md`)
- B4 Concurrencia final (`qa/FINAL_CONCURRENCY_PROOF.md`)
- B5 Tareas Windows de backup (`install_backup_tasks_windows.ps1`)
- B6 Handoff guiado (`final_production_handoff.ps1`)

Las plantillas, scripts y preflight ya estan preparados. Ver
`docs/RELEASE_CHECKLIST.md` y `qa/FINAL_PRODUCTION_HANDOFF_RESULT.md`.

### Tag

Este commit se etiqueta como `v1.0.0`. El paquete `offline-release/`
se regenera desde este commit con `make_offline_release.ps1 -Force`
y se verifica con `assert_offline_release_clean.ps1
-RequireCurrentCommit`.

## v1.0.0-rc.3 - Audit Plan Complete (2026-06-02)

### Resumen

Catorce fases de la auditoría 2026-06-02 quedaron implementadas como
código. Las seis fases restantes (1-6) requieren evidencia física
en el servidor final (segunda PC, impresora, base de datos real,
tareas Windows). El sistema pasa de `v1.0.0-rc.2` (12 fases previas)
a `v1.0.0-rc.3` con cobertura de código endurecida, validaciones
ampliadas y puertas de calidad nuevas.

### Métricas de calidad al cierre de la auditoría

- 319/319 tests PHPUnit backend (2003 assertions, 4 skipped
  legítimamente: race test concurrente que requiere MySQL real)
- 203/203 tests Vitest frontend (109 nuevos durante la auditoría)
- 0 errores de typecheck
- 0 errores de ESLint
- 0 errores de phpstan nivel 4 sobre 110 archivos en app/
  (con baseline generada a nivel 6 cubriendo 240 hallazgos
  preexistentes)
- Bundle gzipped más grande: charts 116.73 kB (objetivo < 250 kB)
- Build de producción sin warnings bloqueantes
- OpenAPI 3.1 document served at /api/system/openapi
- Health score (healthy + issues[]) returned by /api/system/health

### Fases completadas durante la auditoría

- **Phase 7** Refactor de NewInvoiceView (1020 → 733 líneas) con
  reducer y POS math extraídos, 19 tests nuevos
- **Phase 8** Wire moneyCents en 7 vistas (cart, payment, reports,
  catalog CSV importer)
- **Phase 9** apiClient hardening con CSRF cache 30 min, lista 422
  completa, helper `isPermissionDeniedError`, mensaje 423 Locked
- **Phase 10** Test de concurrencia fiscal con Symfony Process
  (harness opt-in con flag `HOSPITAL_RUN_CONCURRENT_TESTS=1`)
- **Phase 11** phpstan (larastan) nivel 4 instalado y en quality gate
  con baseline de level 6
- **Phase 12** Coverage gate opt-in con `phpunit.coverage.xml` y
  umbral 70% en módulos críticos; tests unitarios para
  GenerateFiscalNumberAction (5 casos)
- **Phase 13** axe-core wired en test suite; LoginView, Button,
  Dialog, OpenSessionForm y ReceiptPreview pasan 0 violaciones
- **Phase 14** Catálogo central de atajos de teclado
  (KEYBOARD_SHORTCUTS, shortcutsByScope, shortcutLabel) con 6 tests
- **Phase 15** Bundle size y lazy-loading gate (revisión source de
  AppRoutes; tests garantizan que las vistas pesadas están en
  `React.lazy`)
- **Phase 16** Helpers de formato es-HN (formatLempiras,
  formatDate, formatDateLong) y diccionario i18n es-HN con t()
- **Phase 17** Login lockout (5 fails / 15 min) con tabla
  `login_attempts`, middleware `LoginLockout`, tests para
  identifier lockout, IP lockout, 423 safe message
- **Phase 18** CSP endurecida con report-only channel,
  Cross-Origin-Opener-Policy, endpoint `/api/system/csp-report`
  y Vite plugin `cspNoncePlugin` para preparar la eliminación
  de `unsafe-inline`
- **Phase 19** Endpoint público `/api/system/health` con métricas
  operativas, heartbeat del backup worker, hook
  `useBackupWorkerHealth` en el frontend

### Mejoras adicionales durante la auditoría

- Script `auto_evidence.ps1` que pre-rellena las 5 plantillas
  `qa/*.md` con datos del `.env` para FASE 1-6
- `RELEASE_NOTES_v1.0.0-rc.3.md` con métricas delta y comandos
  útiles
- Tests adicionales de cobertura (storage, recent_errors en
  health; fiscal correlative edge cases; lockout IP y safe
  message)

### Fases pendientes (requieren hardware real)

Las fases 1 a 6 del plan original dependen de evidencia física que
solo puede recolectarse en el servidor final con hardware real:

- **FASE 1** Evidencia física LAN cliente (segunda PC, 12 checks)
- **FASE 2** Evidencia física impresora (5 tamaños, márgenes)
- **FASE 3** Evidencia de restore final (SHA256, conteos)
- **FASE 4** Evidencia de concurrencia final (RUN_ID, doble pago)
- **FASE 5** Worker continuo de backups (tareas Windows activas)
- **FASE 6** Handoff final con `final_production_handoff.ps1`

Las plantillas `qa/*.md` y los scripts `scripts/*.ps1` ya están
preparados. Procedimiento documentado en `docs/RELEASE_CHECKLIST.md`
y `docs/OFFLINE_LAN_INSTALL.md`.

### Cómo retomar

1. Cerrar las 6 fases físicas con `auto_evidence.ps1 -Force` para
   pre-rellenar las plantillas y luego `final_production_handoff.ps1`
2. Si phpstan se mantiene limpio al corregir la baseline, subir
   el nivel a 5
3. Aplicar el patrón `LoginView.a11y.test.tsx` a las demás vistas
   (CashBox, NewInvoice, InvoiceHistory, Reports, Backups,
   FiscalSettings, Users)
4. Activar el Vite plugin `cspNoncePlugin` en producción y quitar
   `'unsafe-inline'` de la CSP
5. Pintar el estado del backup worker en el panel de Backups
   usando el hook `useBackupWorkerHealth`

## Unreleased - v1.0.0 Audit Plan (2026-06-02)

### Phase 7 - NewInvoiceView refactor (partial, behaviour-preserving)

- The 1020-line `NewInvoiceView.tsx` is split into dedicated modules so
  the cashier workflow can be unit-tested in isolation and the math
  (decimal handling, erythropoietin rule, tax estimate) stops being
  copy-pasted between the cart preview, the confirmation dialog and the
  success summary.
- `frontend/src/features/invoices/state/types.ts` exports `NewInvoiceState`,
  `NewInvoiceAction`, and `getInitialNewInvoiceState`.
- `frontend/src/features/invoices/state/reducer.ts` exports the pure
  `newInvoiceReducer` with a focused `addServiceToCart` helper.
- `frontend/src/features/invoices/state/posMath.ts` exports
  `parseQuantityUnits`, `parseLocalCents`, `formatCents`, `isZeroMoney`,
  `incrementQuantityFromString`, `parseTaxRateBasisPoints`,
  `effectiveUnitPriceCents`, and `computeSimpleEstimate`.
- Two new vitest suites cover the reducer (9 cases) and the POS math
  (10 cases), including the erythropoietin zero-amount path.
- `NewInvoiceView.tsx` drops to ~733 lines and now re-uses the same
  helpers the rest of the views will get in phase 8.

### Phase 8 - moneyCents wire across cashier UI

- `OpenSessionForm`, `ReceiptPreview`, `InvoiceConfirmation`,
  `CashSessionReportTab`, `IncomeReportTab`, `ServiceSalesTab`, and the
  catalog CSV importer of `SetupWizardDialog` now route money through
  `parseCents` / `formatCents` from `frontend/src/lib/moneyCents.ts`
  instead of `Number.parseFloat` / `Number(...)`.
- The cashier dashboard totals, reports, and the setup wizard CSV
  preview agree with the backend rounding rules.

### Phase 9 - apiClient hardening

- `frontend/src/lib/api/base.ts` now caches the `/sanctum/csrf-cookie`
  response for 30 minutes to avoid an extra round-trip on every mutating
  request.
- 422 validation errors expose the full field list (was truncated to the
  first three messages) with human-readable labels like
  `Items #2 (quantity): ...` and `patient name: ...`.
- New `isPermissionDeniedError(error)` helper alongside the existing
  `isSessionExpiredError(error)`.
- 423 Locked responses from the future lockout middleware get a dedicated
  safe message asking the operator to wait or request a supervisor
  reactivation.
- Tests in `frontend/src/lib/api/base.test.ts` cover CSRF caching, full
  422 list, 423, 403, 5xx sanitization, and the new helpers.

### Phase 11 - Static analysis (phpstan) wired into the quality gate

- `nunomaduro/larastan` is added to `backend/composer.json` (dev) so
  the existing `scripts/quality_gate.sh` finds `./vendor/bin/phpstan`
  and runs it on every CI run.
- `backend/phpstan.neon` ships with the project at level 3 and ignores
  Eloquent dynamic properties plus the Laravel scaffold files that
  Laravel 12 no longer publishes.
- The level is deliberately conservative; the next audit pass should
  raise it to 4 once the cashier-facing Actions get explicit return
  type hints.

### Phase 10 - Concurrent fiscal correlative race harness

- `tests/Feature/Concurrent/FiscalNumberRaceTest.php` plus
  `tests/Concurrent/fiscal_race_worker.php` form a Symfony-Process
  harness that spawns two PHP workers in parallel against a real
  MySQL/MariaDB instance, both calling `CreateInvoiceAction`.
- The test is gated by `HOSPITAL_RUN_CONCURRENT_TESTS=1` plus the
  `DB_*` env variables so the regular SQLite suite is not affected
  on developer machines.
- Manual run:

  ```bash
  HOSPITAL_RUN_CONCURRENT_TESTS=1 \
  DB_CONNECTION=mysql DB_HOST=127.0.0.1 DB_PORT=3306 \
  DB_DATABASE=hospital_concurrent DB_USERNAME=hospital \
  DB_PASSWORD=hospital_dev \
    vendor/bin/phpunit --group=concurrent --filter FiscalNumberRaceTest
  ```

### Phase 12 - Coverage gate for critical Actions (opt-in)

- `tests/Coverage/CriticalModulesCoverageTest.php` enforces a 70 percent
  coverage threshold on `app/Actions/Billing`, `app/Actions/Cash`,
  `app/Actions/Payments`, `app/Actions/Backups` and `app/Actions/Receipts`.
- The test detects pcov / xdebug / the global CodeCoverage singleton and
  skips itself with a clear instruction when no driver is available;
  the regular suite stays green on machines that have not enabled one.
- `phpunit.coverage.xml` is a new opt-in profile that adds the
  `<coverage>` section. Run with
  `vendor/bin/phpunit -c phpunit.coverage.xml --coverage-text` to
  produce clover / html / text reports under `build/logs/`.

### Phase 13 - Accessibility (axe-core) wired into the cashier suite

- `axe-core` and `vitest-axe` are added as dev dependencies. The
  shared `frontend/src/test/setup.ts` registers the `toHaveNoViolations`
  matcher and stubs `matchMedia` so Radix-based dialogs do not crash
  jsdom.
- `frontend/src/features/auth/LoginView.a11y.test.tsx` is the first
  view to go through the gate: it asserts no axe-core violations on
  the default render, and that the username / password inputs and
  the submit button are reachable by label and role.
- 127/127 Vitest tests pass (33 new cases). The next audit pass
  should port the same pattern to CashBoxView, NewInvoiceView,
  InvoiceHistoryView, ReportsView, BackupsView, FiscalSettingsView
  and UsersView.

### Phase 17 - Login lockout (5 fails / 15 min) with full audit trail

- New `login_attempts` migration records every login attempt with the
  identifier, IP, user agent, success flag and timestamp.
- `app/Http/Middleware/LoginLockout.php` blocks the next attempt with
  HTTP 423 once a login or an IP exceeds 5 failed attempts in the last
  15 minutes. The frontend already had a safe message wired in for
  423 during the apiClient hardening pass.
- `app/Models/LoginAttempt.php` exposes `failedCountFor` and
  `failedCountForIp` helpers that the middleware calls.
- `app/Http/Controllers/AuthController.php` writes a row to
  `login_attempts` on every attempt, flipping the `success` flag when
  Auth::attempt succeeds.
- `routes/api.php` mounts the middleware on the `auth/login` endpoint
  in addition to the existing throttle.
- `tests/Feature/LoginLockoutTest.php` covers three scenarios: success
  records, lockout engages at 5 fails, and lockout does not bleed into
  other users from the same IP.

### Phase 14 - Central keyboard shortcuts catalogue

- `frontend/src/lib/shortcuts.ts` exposes `KEYBOARD_SHORTCUTS`,
  `shortcutsByScope` and `shortcutLabel` so the cashier help page,
  tooltips and the new a11y test all read from one place.
- Catalogue covers POS bindings (Ctrl+N, Ctrl+B, Ctrl+K, Ctrl+Enter,
  Esc), cash session hot keys (F2), invoice emission (F4), reprint
  (F8) and the global Cmd+K navbar search.
- `shortcuts.test.ts` asserts that every entry has a description,
  no two entries collide inside the same scope, POS bindings are
  present, and labels render in Ctrl+Key form (6 cases).

### Phase 16 - Locale and formatting helpers (es-HN)

- `frontend/src/lib/format/formatCurrency.ts` exposes
  `formatLempiras`, `formatPlainDecimal` and `parseAmount`. Lempiras
  render as `L. 1,500.00`, with a thousands separator and two
  decimals, matching the cashier receipt format.
- `frontend/src/lib/format/formatDate.ts` exposes `formatDate`,
  `formatDateLong`, `formatTime`, `formatDateTime` and
  `formatMonthYear`. The default format is DD/MM/YYYY per es-HN
  convention; the long form reads "2 de junio de 2026".
- `frontend/src/lib/i18n/es-HN.ts` ships the first slice of an es-HN
  string dictionary (app identity, navigation, login, POS, cashbox,
  invoices, common errors, units). A `t()` helper exposes the
  dictionary so new screens can adopt the dictionary without
  pulling in a heavy i18n runtime.
- 19 new vitest cases cover formatting edge cases and dictionary
  completeness (every top-level navigation key, POS message
  templates, cashbox pending format).

### Phase 15 - Bundle size and lazy-loading gate

- `npm run build` reports the largest gzipped chunks: charts 116.73
  kB, index 109.95 kB, ui 42.32 kB, forms 27.64 kB, vendor 17.52
  kB, query 10.79 kB. Total well under the 250 kB gzipped target.
- `frontend/src/AppRoutes.lazy.test.ts` greps the source of
  `AppRoutes.tsx` to assert that the nine heavy views (About,
  Backups, Catalog, Dashboard, Fiscal Settings, Help, Invoice
  History, Reports, Users) are bound through `React.lazy` and that
  a Suspense fallback is provided. The cashier reaches
  /login and /dashboard without paying for the heavy chunks.
- Next audit pass should split Recharts from the initial load by
  deferring the charts chunk behind an intersection observer on the
  dashboard panels.

### Phase 19 - Public health endpoint and worker heartbeat

- New `app/Actions/Reports/OperationalMetricsService.php` snapshots
  database connectivity, queue depth, backup counters, storage
  usage and recent audit_log failures. Each subsystem is wrapped
  in try/catch so a failing component does not break the response.
- New `app/Http/Controllers/HealthController.php` exposes
  `GET /api/system/health` as a public endpoint (no auth) so the
  cashier dashboard and the preflight scripts can poll without
  sharing an admin session.
- `app/Jobs/RunBackupJob::handle` records a worker heartbeat in
  the cache after every successful backup. The health response
  surfaces a boolean so the preflight can flag a stopped worker.
- 3 new tests in `tests/Feature/OperationalMetricsServiceTest`
  cover the snapshot shape, the public endpoint and the heartbeat
  flip.

### Phase 18 - CSP hardened with report-only channel and Cross-Origin-Opener-Policy

- `app/Http/Middleware/AddSecurityHeaders` now emits a stricter
  CSP per environment: production keeps `script-src 'self'
  'unsafe-inline'` (the cashier entry script still uses an inline
  bootstrap), but local development adds `'unsafe-eval'` so Vite
  HMR keeps working. Both branches add `object-src 'none'`,
  `manifest-src 'self'`, the `connect-src` extension for the Vite
  ws/wss HMR socket, and a `Content-Security-Policy-Report-Only`
  channel that points at `/api/system/csp-report`.
- `Cross-Origin-Opener-Policy: same-origin` joins the existing
  `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`
  and `Permissions-Policy` headers.
- New `app/Http/Controllers/CspReportController.php` accepts CSP
  violation reports from the browser, scrubs the body of any
  long-line leakage and stores a structured log entry. The endpoint
  always responds 204 so the browser stops retrying once the
  violation is acknowledged.
- Next audit pass should switch the cashier SPA to a Vite plugin
  that injects the per-request nonce into the entry script and
  the inline styles emitted by Tailwind so `unsafe-inline` can
  finally be removed from `script-src` and `style-src`.

### Audit

- `docs/AUDIT_2026_06_02.md` records the full audit and the 20-phase
  plan to reach `PRODUCTION_READY`.

## v1.0.0-rc.2 - Production Audit Hardening (2026-06-01)

### What's New

12-phase audit-driven hardening pass. Each phase produced a
worklog under `worklogs/2026-06-01-audit-*.md` and a Conventional
Commit. Highlights:

- **F1**: Production defaults hardened — `DB_CONNECTION` now defaults
  to `mysql` instead of `sqlite`; queue `after_commit` enabled for
  database/beanstalkd/sqs/redis. New `ProductionConfigDefaultsTest`
  regression suite.
- **F2**: XSS hardening in `PdfExportService` — every user-controlled
  string (hospital name, RTN, payment method, status) is now escaped
  via a centralized `e()` helper using `htmlspecialchars(... ENT_QUOTES
  | ENT_HTML5, 'UTF-8')`. Five new vitest cases in
  `PdfExportEscapingTest`.
- **F3**: SQL float money math replaced with integer cents in
  `DashboardReportService` and `DailyReportService`. New
  `PaymentCentsSqlGuardTest` asserts no regression to
  `ROUND(payments.amount * 100)`.
- **F4**: Dead `app/Policies/*` removed. Five classes that were never
  registered with `Gate::policy()` are deleted, along with
  `CashRegisterSessionPolicy::viewAny/create` that returned `true`
  unconditionally (latent privilege escalation).
- **F5**: `2026_06_01_000001_add_amount_cents_to_payments_table`
  migration is now safe for SQLite via a driver-guarded backfill path
  and `Schema::hasColumn` re-entry guards. New
  `AmountCentsMigrationTest`.
- **F6**: `useBackups` TanStack Query hook hardened — derived
  `hasPending` and `pollIntervalMs` exposed; `keepPreviousData` and
  `staleTime: 30s` added. Three new vitest cases.
- **F7**: `NewInvoiceView` refactor deferred with rationale (see
  `worklogs/2026-06-01-audit-f7-newinvoice-deferred.md`).
- **F8**: New `frontend/src/lib/moneyCents.ts` — `parseCents`,
  `formatCents`, `parseQuantityUnits`, `formatQuantity` with
  8 vitest cases. Foundation for the next consolidation pass that
  will replace the per-view duplicates.
- **F9**: `apiClient.voidPayment(invoiceId, paymentId, reason)`
  exposed; new `PdfReportFilters` type; `downloadReportPdf` typed.
- **F10**: `setup.bat` no longer prints
  `--password=CAMBIAR_ESTA_CLAVE` on the command line. Operators are
  now instructed to set `HOSPITAL_INITIAL_ADMIN_PASSWORD` in their
  shell.
- **F11**: Docker compose for production — backend and nginx gained
  healthchecks; nginx now depends on backend `service_healthy`
  instead of `service_started`; `client_max_body_size` lowered from
  100M to 32M to match PHP `upload_max_filesize`.

### Quality Gates

| Gate | Status |
|------|--------|
| TypeScript | ✅ 0 errors |
| ESLint | ✅ 0 errors |
| Vitest | ✅ 94/94 (8 new) |
| PHPUnit | ✅ 254/254, 1717 assertions (10 new) |
| Pint | ✅ Passes |
| E2E | ✅ Existing pass (no regression) |

### Commits

- `4282c84` - fix(backend): harden production defaults for DB and queue
- `b66fc35` - fix(reports): escape pdf export html
- `5ea779f` - test(reports): cover pdf export html escaping
- `3346d1a` - fix(reports): prefer payments.amount_cents over SQL float round
- `16c6d70` - refactor(backend): remove dead policies in favor of form request authz
- `166106b` - fix(db): make amount_cents migration safe for non-mysql drivers
- `69d0d29` - refactor(frontend): harden useBackups hook with polling helper
- `ad1f1d1` - refactor(frontend): add moneyCents helpers for cart and payment math
- `46fa5bd` - refactor(frontend): expose voidPayment and add PdfReportFilters type
- `78e2735` - fix(ops): remove plaintext initial admin password from setup.bat
- `037548b` - fix(infra): add backend and nginx healthchecks, align body size

### Known Limitations

- NewInvoiceView (1020 lines, useReducer with 30+ actions) still
  inlined. Refactor deferred to v1.1.0.
- Frontend `parseCents`/`formatCents` are exported but not yet wired
  into the existing views. Migration is a v1.1.0 task.
- apiClient `base.ts` hardening (CSRF cache, localhost fallback
  feedback, full 422 list) still in scope for v1.1.0.
- Concurrent fiscal correlative test is not automated. The existing
  sequential test covers the SQL mechanics; the
  `qa/FINAL_CONCURRENCY_PROOF.md` manual run is still the source of
  truth.
- `phpstan` is not installed. `AGENTS.md` continues to list it as
  optional; the quality gate does not require it.

---

## v1.0.0-rc.1 - Phase 12 Final (2026-05-18)

### What's New

**POS Billing Workflow**
- 2-column layout: search/services left (internal scroll), sticky cart right
- Service cards with rich hover states and visible price badges
- Cart with item count badge and always-visible totals
- InvoiceSuccess with clear next actions (Cobrar ahora, Imprimir, Ver facturas)
- Cash session consistency across Dashboard, Sidebar, Topbar, and POS

**Components Migrated to shadcn/Radix**
- ReceiptPreview: NativeSelect replaced with Select component
- IncomeReportTab: 3 NativeSelect filters replaced with Select components

**Reports & Backups Hierarchy**
- ReportsView: clean shadcn/ui Tabs with KPIs at top
- BackupsView: summary cards (pending/success/failed) + filterable table
- FiscalSettingsView: organized into 4 tabs (Resumen/Hospital/Secuencia/Receipt)

### Quality Gates

| Gate | Status |
|------|--------|
| TypeScript | ✅ 0 errors |
| ESLint | ✅ 0 errors |
| Build | ✅ Passes (638KB gzip: 187KB) |
| Frontend Tests | ✅ 20/20 (3 consecutive runs) |
| Backend Tests | ✅ 124/124 |
| E2E | ✅ 2/2 |
| Laravel Pint | ✅ Passes |

### Known Limitations

- Print hardware validation (80mm/58mm) pending physical testing
- LAN client validation pending from another PC
- Production environment validation pending final server setup

---

## Previous Releases

See `docs/07_FINAL_PHASES_ROADMAP.md` for phase history.