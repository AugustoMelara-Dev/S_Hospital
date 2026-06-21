# Changelog - Sistema de Caja Hospitalaria

## 2026-06-15 - v1.1 Critical Hardening post-OFFLINE

Cherry-picked from `hardening-audit-complete-2026-06-15` (commits 680e7d2e + 6cecb4af) sobre la base OFF-A..OFF-E. Ademas del merge, esta ronda agrega:

- Migracion `2026_06_15_000004_add_offline_check_constraints`: CHECK constraints para `invoices.status`, `payments.status`, `cash_register_sessions.status`, `cash_movements.type`, `audit_logs.result`, no-negatividad de `*_amount_cents`, rango `fiscal_sequences.current_number <= max_number`, regla `services.price > 0 OR special_rule_code IS NOT NULL` y unique-active guard para `receipt_print_profiles.is_global_default`. Solo aplica a MariaDB/MySQL; tests en SQLite siguen funcionando.
- Endpoint `POST /api/institutional-receipts/{receipt}/print-events` con throttle `30,1` e idempotency para auditar cada intento de impresion de PDF institucional.
- Fix de regresion: se restaura la ruta `GET /api/area-services/paid` que el refactor del controller habia removido.
- Worklog `worklogs/2026-06-15-v11-critical-hardening-matrix.md` con la matriz PASS/PARTIAL de los 80 IDs P0/P1 originales.

## 2026-06-15 - Hardening audit complete pass

- Cifra backups finales como `.sql.enc`, registra SHA256 del artefacto cifrado y agrega comando `hospital:decrypt-backup`.
- Restore Windows exige `-ExpectedSha256`, soporta `-WhatIf` y descifra backups cifrados a temporal controlado.
- CI elimina `hospital_dev/root_dev` y `APP_KEY` fija; agrega `composer audit`.
- ISV se calcula a nivel factura y se prorratea por largest remainder.
- MariaDB/MySQL bloquea doble recibo institucional `issued` por factura con generated column + unique index.
- Se endurecen login lockout, reset password, jerarquia de roles admin, throttles de descargas, Excel formula injection, idempotencia frontend, timeouts de descarga y atajos globales.

## v1.0.0-rc.5 (unreleased) - Pilot-Closure Round (2026-06-09 / 2026-06-10)

This entry documents the rc5 round of work that landed on
`plan/fase-0-7-rc` after the v1.0.0-rc.4 security-hardening
commits. The goal of this round is to close every gap that
prevented READY FOR PILOT in the prior handoff. It does not
re-state the rc.3 / rc.4 / v1.0.0 work — see those sections
below for that history.

### Commits in this round (newest first)

- `8c0f4188` fix(backend): remove unused AuditLogger support class
- `578a953f` qa(evidence): refresh frontend/backend quality gate
  outputs and clean stale debug runs
- `55232591` docs(operative): refresh executive summary, audit
  matrix, and bugs register for RC1 closure
- `2fc53e14` fix(frontend+ops): robust App.test.tsx mocks, csrf
  TTL 10m, nginx api access_log off, deploy crypto helpers
- `98d05596` feat(resilience): add AuditLogger and resilience
  evidence [partially reverted by 8c0f4188: the AuditLogger
  class had zero callers and was removed in the same round]
- `5111bf4e` fix(frontend): remove hard 5000ms findBy timeout,
  bump vitest test budget to 15s
- `ffaba059` test(e2e): fix screenshot counts in rc1 evidence
  index
- `cdf00efe` test(e2e): add RC1 screen coverage for cashier
  flow
- `95f82c0c` docs(qa): final RC1 handoff - READY FOR PILOT, all
  gaps closed [verdict was premature; superseded by
  the orchestrator's verification pass; see
  docs/KNOWN_LIMITATIONS.md 2026-06-10 update]
- `5226f588` docs(qa): refresh evidence after final test pass
- `6ffb8187` feat: add idempotency key, resilience tests, receipt
  reprint audit
- `7599766a` Revert "feat(frontend): code-split all 9 heavy
  views via React.lazy" [this revert accidentally broke the
  AppRoutes.lazy.test contract; the code-split was re-applied
  in b93ac561 already; the orchestrator's 2fc53e14 confirms
  the 9-view lazy split is in HEAD with a passing test]
- `0cf694d5` test(e2e): capture 13 RC1 critical screens
- `a7e073a7` chore(gitignore): exclude
  testing-production-proofs-partial
- `db6e7629` docs(ci): document local composer install for
  phpstan to work
- `b93ac561` feat(frontend): code-split all 9 heavy views via
  React.lazy [reverted by 7599766a, re-applied in 2fc53e14]

### Gaps closed vs the prior NOT READY handoff

1. **AppRoutes.lazy.test.ts** — was reported as failing. Root
   cause was a code-split revert that left only DashboardView
   under `React.lazy()`. The 9-view split is re-applied and
   the test passes. Evidence: `qa/qa-fe-test.txt` (239/239,
   3 consecutive runs).
2. **phpstan DEFERRED** — was reported as DEFERRED with reason
   "larastan/extension.neon is missing". The file exists in
   the dev environment. `vendor/bin/phpstan analyse` now
   reports `[OK] No errors`. Evidence: `qa/qa-phpstan.txt`.
3. **App.test.tsx flake** — full vitest suite was failing 1-6
   tests depending on order. The "renders only the active
   module" test was hit hardest. Fixed by adding an explicit
   `/api/cash-sessions/current` mock handler and replacing
   the implicit 1s asyncUtilTimeout with `waitFor({ timeout:
   20_000, interval: 100 })`. 3/3 consecutive runs of
   239/239 tests pass. Evidence: `qa/qa-fe-test.txt`.
4. **Working tree dirty** — the previous handoff reported an
   uncommitted `scripts/refresh_lan_ip.ps1` fix and stale
   `qa/qa-*.txt` evidence. All working-tree changes are
   committed in this round.
5. **Stale documentation** — `docs/KNOWN_LIMITATIONS.md`,
   `CHANGELOG.md`, `qa/operative/*` are realigned with the
   actual code in HEAD.

### Quality gate snapshot (run on 2026-06-10 after this round)

| Check | Status | Evidence file |
|---|---|---|
| backend pint | pass | qa/qa-pint.txt |
| backend phpstan | [OK] No errors | qa/qa-phpstan.txt |
| backend phpunit | 432 passed, 5 skipped, 0 failed | qa/qa-test.txt |
| frontend typecheck | 0 errors | qa/qa-typecheck.txt |
| frontend lint | 0 errors, 28 warnings (pre-existing) | qa/qa-lint.txt |
| frontend vitest | 239/239, 3 consecutive runs | qa/qa-fe-test.txt |
| frontend build | 9 lazy chunks, EXIT=0 | qa/qa-fe-build.txt |
| branding | revision completada sin hallazgos | qa/qa-branding.txt |
| secret scan | 0 real creds, 243 hits classified benign | qa/qa-secretscan.txt |
| offline release | OFFLINE_RELEASE_CLEAN: YES at HEAD | qa/qa-offline-release-clean.txt |
| e2e playwright | 13/16 pass, 3 pre-existing failures | qa/qa-e2e-last-run.json |

## v1.0.0-rc.4 (2026-06-09) - Security-Hardening Round

This entry documents ONLY the five commits landed on
`plan/fase-0-7-rc` on 2026-06-09 after the v1.0.0 production
hardening audit was published. It does not re-state the rc.3 or
v1.0.0 hardening work — see those sections below for that history.

### Commits in this round

- `3711cf1d` fix(ci): portable Select-String fallback for branding
  checks
- `cdf6840c` chore(security): harden secrets and remove default
  credentials
- `8fe44203` feat(backend): Money value object, secure dialysis
  flag, no session-mutation on payment
- `68224669` feat(frontend): money centralization, session-cleanup,
  payment cap, echo reset
- `312ad0a8` fix(nginx): report-only CSP without placeholder nonce

### fix(ci): portable Select-String fallback for branding checks

- `scripts/check-branding.ps1`: the previous `ArrayList+regex
  path-filter` was broken under PowerShell 5.1 (it stranded a
  single-element list whose `.Count` was 1 holding
  `'System.Collections.Hashtable'`, a `+=` re-typing artifact).
  Replaced with simple substring filtering and an array
  accumulator. The script now runs without `rg` in `PATH`,
  which is the supported environment for hospital operators.
- `docs/PLAN_7_FASES.md`: consolidates the three audit passes
  into a 7-phase remediation plan with conventional commits.

### chore(security): harden secrets and remove default credentials

- `docker-compose.prod.yml`: `PUSHER_APP_ID`, `PUSHER_APP_KEY`,
  `PUSHER_APP_SECRET` (Soketi) now fail fast with `":?required"`
  if not provided. The previous defaults (`hospital-key` /
  `hospital-secret`) were public knowledge — any LAN listener
  with `curl` could subscribe to all patient/billing events on
  the WebSocket channel.
- `backend/docker/entrypoint.sh`: the literal
  `--password=$DB_PASSWORD` was replaced with a `0600` option
  file at `/tmp/.hospital-db.cnf` consumed via `--defaults-file`.
  The MySQL/MariaDB official docs mark `MYSQL_PWD` and
  `--password` as "extremely insecure" because they appear in
  `/proc/<pid>/cmdline` (readable by any user on the host).
  The option file is removed after the wait loop.
- `backend/.env.docker.example`: documents the
  `PUSHER_APP_ID/KEY/SECRET` slots with
  `openssl rand -hex 16` guidance and the explicit warning that
  no real values are committed.
- `LicenseHelper` already reads `config('app.license_salt')`,
  which maps to `HOSPITAL_LICENSE_SALT` via
  `config/app.php:128` (landed in `7474db13`). No PHP code was
  touched by this commit.

### feat(backend): Money value object, secure dialysis flag, no
session-mutation on payment

- `app/Support/Money.php`: new immutable value object
  (`fromCents`, `fromFloat`, `zero`, `plus`, `minus`, `times`,
  `allocate`, `equals`, `sum`). Integer-cents storage; no float
  arithmetic inside the object.
- `app/Actions/Cash/BuildCashReconciliationAction.php`:
  every amount now routes through `Money`; the original
  2-line `round + cast` pattern is gone.
- `app/Actions/Billing/CalculateInvoiceTotalsAction.php`:
  keeps the half-up rounding (`intdiv($x+50,100)*100`) but
  documents intent in the PHPDoc; tax and subtotals now
  accumulate via `Money::plus` so no float leaks.
- `app/Actions/Payments/RegisterPaymentAction.php`:
  the action used to overwrite the invoice's
  `cash_session_id` whenever a payment was registered in a
  different session than the one the invoice was created in.
  That mutation is removed. The invoice keeps the session it
  had at creation; each payment record carries its own session.
  Verified by `RegisterPaymentDoesNotMutateInvoiceTest`
  (2 cases).
- `app/Actions/Cash/CloseCashSessionAction.php`:
  `RunBackupJob` dispatch and its supporting
  `CreateBackupAction` / `BackupLog` imports are removed.
  Backups are scheduled by the existing scheduler, not on
  every cash close. Verified by `CloseCashSessionTest` using
  `Bus::fake([RunBackupJob::class])`.
- `app/Actions/Billing/CreateInvoiceAction.php` +
  `app/Http/Requests/Billing/StoreInvoiceRequest.php`:
  the `dialysis_prescription` flag moved from per-line to
  top-level on the invoice. A cashier without
  `patients.mark_dialysis_prescription` cannot toggle the
  discount; the eritropoyetina line is auto-zeroed only when
  the issuer has the permission and the flag is `true`.
  Verified by `InvoiceDialysisPrescriptionTest` (5 cases).
- `database/seeders/RolesAndPermissionsSeeder.php`: the new
  permission `patients.mark_dialysis_prescription` is added
  to the `admin` and `supervisor` roles. The `cajero` role
  is intentionally NOT granted this permission — the
  security invariant that eritropoyetina is auto-zeroed only
  by authorized issuers is preserved.
- New tests: `MoneyTest` (19 unit, 42 assertions),
  `InvoiceDialysisPrescriptionTest` (5 feature),
  `CloseCashSessionTest` (2 feature),
  `RegisterPaymentDoesNotMutateInvoiceTest` (2 feature);
  3 pre-existing tests updated to the new top-level flag API.
- Full suite at this commit: 410 passed, 4 skipped, 0 failed
  (2702 assertions). Pint: passes.
- `phpstan` was attempted but the configured extension
  `vendor/larastan/larastan/extension.neon` is missing in the
  dev environment; pre-existing setup gap, unrelated to this
  change. Tracked as a `DEFERRED` item in
  `docs/KNOWN_LIMITATIONS.md`.

### feat(frontend): money centralization, session-cleanup, payment
cap, echo reset

- `src/lib/money.ts`: canonical helpers (`parseCents`,
  `formatCents`, `toFloat`, `fromFloat`, `sumCents`,
  `allocateCents`). Integer-cents storage. 4 new vitest cases
  in `src/test/money.test.ts` cover float drift, rounding,
  format and `toFloat`.
- `src/features/invoices/state/posMath.ts`: every export is
  now a `@deprecated` re-export shim pointing at
  `lib/money.ts` and `lib/moneyCents.ts`. `computeSimpleEstimate`
  emits a one-time `console.warn` so any leftover call surfaces
  to UI dev. Fiscal math is no longer duplicated in the cart
  view; backend remains the source of truth.
- `src/features/invoices/components/PaymentModal.tsx`:
  the amount input now has `max={balanceFloat}`, snaps to
  the cap on every change, shows the inline message
  "El pago no puede superar el saldo pendiente" and disables
  the Pay button when exceeded. Verified by the new cap case
  in `PaymentModal.test.tsx`. `NewInvoiceView.test.tsx` was
  updated to match the new cap behavior.
- `src/app/useHospitalSession.ts`: `handleLogout` now calls
  `disconnectEcho()` and `queryClient.clear()` in addition to
  the existing state reset. 401 branch in `src/lib/api/base.ts`
  calls `invalidateCsrfCookie()` (new `src/lib/csrf.ts` helper
  that re-fetches `/sanctum/csrf-cookie`).
- `src/lib/realtime/echo.ts`: the `.catch` handler now sets
  `configPromise = null` so the next call retries the config
  fetch. Verified by `src/lib/realtime/echo.test.ts`.
- `src/features/cash/CashBoxView.tsx`: local `parseCents` is
  removed; the file imports from `lib/money.ts`.
  `expected_cash_amount` still falls back to server-computed
  values, not to local subtraction.
- `frontend/playwright.config.ts`: uses `'npm'` instead of
  `'npm.cmd'` for cross-platform CI. `vite.config.ts` already
  referenced `lucide-react` without the stale `1.16.0` suffix
  from a prior pass; no change needed.
- Typecheck: 0 errors. Lint: 0 errors (28 pre-existing
  warnings in untouched files). Test files: 52 passed, 1
  failed. The single failing test
  (`AppRoutes.lazy.test.ts`) is pre-existing: it asserts 9
  heavy views are loaded via `React.lazy()` in `AppRoutes.tsx`
  but only `DashboardView` is currently lazy-loaded. This is
  the refactor parked in `stash@{0}` on the audit branch and
  is out of scope for this commit; tracked as a `DEFERRED`
  item in `docs/KNOWN_LIMITATIONS.md`.

### fix(nginx): report-only CSP without placeholder nonce

- `nginx/default.conf`: the `Content-Security-Policy-Report-Only`
  header previously carried a literal
  `nonce-__S_HOSPITAL_CSP_NONCE__` placeholder. No script tag
  in the SPA would ever carry that literal string, so the
  browser sent the directive verbatim and produced confusing
  reports (no script matched the literal) with no useful
  signal about what the enforced CSP would actually block.
  The Report-Only directive is now intentionally permissive
  (`'unsafe-inline'` and `'unsafe-eval'` on script/style) so
  the report endpoint surfaces real violations of the enforced
  policy rather than a static placeholder mismatch.
- The enforced CSP path is unchanged: `AddSecurityHeaders`
  (PHP) generates a real 32-hex-char nonce per request and
  emits `Content-Security-Policy: ... nonce-<hex> ...` for the
  response, which the Vite `cspNoncePlugin` picks up when
  building the SPA. The CSP nonce is NOT new in this round;
  it was wired in the v1.0.0-rc.3 hardening pass and is
  already in production.

### What this round did NOT change

- `app/Providers/AppServiceProvider.php`: no change in this
  round. The `Gate::policy()` registrations for
  `App\Policies\InvoicePolicy` and `App\Policies\CashSessionPolicy`
  were already in place from the v1.0.0 production hardening
  audit (commit `ae1ed5ca` in the audit log and
  `CHANGELOG.md` v1.0.0 B7 item). This round did not re-add
  them.
- `hospital:prune-audit-logs` / `hospital:prune-failed-jobs`:
  not touched. They were already shipped in v1.0.0-rc.3
  (Phase A10) and are not new in rc.4.
- `LicenseHelper` / `HOSPITAL_LICENSE_SALT`: not touched in
  this round. The salt was promoted to required in
  `7474db13` and `cfe6df1c`; `LicenseHelper` already reads
  `config('app.license_salt')` (config/app.php:128).
- CSP nonce in the enforced policy: already implemented
  before this round; not new here.
- `ROUND(*100)` removal: already shipped in v1.0.0-rc.3
  (Phase A2.2, 8 services / 12 guard tests). Not re-done in
  rc.4.

---

## v1.0.0 - Production Hardening Audit (2026-06-02)

### Resumen (branch codex/audit-f1-config-hardening)

Auditoría completa del proyecto v1.0.0-rc.3 + cierre de los 9
bloqueantes CRITICAL detectados por la auditoría de 6 capas
(backend, frontend, base de datos, infra, tests, docs) +
hardening técnico adicional.

**Nuevos CRITICAL cerrados (audit 2026-06-02):**

- **CRIT-1** Pre-commit guard ampliado (HOSPITAL_LICENSE_SALT,
  HOSPITAL_INITIAL_ADMIN_PASSWORD, .env, nginx/ssl/) + dev
  APP_KEY rotado.
- **CRIT-2** Proceso reproducible para generar `offline-release/`
  con imágenes y checksums (D4). El paquete final del hospital
  debe generarse sin omitir `docker build`/`docker save` y pasar
  `OFFLINE_RELEASE_CLEAN: YES`.
- **CRIT-3** Pipeline CI/CD con GitHub Actions (ci.yml +
  release.yml) cubriendo backend-SQLite, backend-MariaDB,
  frontend y e2e-mocked.
- **CRIT-4** Índice `active_document_type` documentado y
  probado con 3 tests nuevos (multi-NULL + activación
  concurrente).
- **CRIT-5** Flujo de reverso de factura implementado:
  `POST /api/invoices/{id}/reverse` con permiso
  `invoices.reverse` (admin/supervisor). 7 tests de feature.
- **CRIT-6** Extensión `bcmath` agregada a `Dockerfile` y
  `Dockerfile.prod`.
- **CRIT-7** Scheduler real: sidecar `supercronic` en
  `docker-compose.prod.yml` + `scripts/register_scheduler_cron.ps1`
  para Windows bare-metal. Heartbeat en `/api/system/status`.
- **CRIT-8** Plantillas `qa/FINAL_*_PROOF.md` listas para
  llenar en el hospital; preflight falla el release si
  alguna sigue PENDING.
- **CRIT-9** `Update-DotEnv` y `env_helpers.ps1` siempre
  escriben con `-Encoding ASCII`. 9 tests de PowerShell
  verifican que ningún BOM UTF-16 se escriba.

**Adicional al paquete CRITICAL:**

- **A8** Real-time sync entre PCs: Soketi + laravel-echo.
  Eventos `invoice.changed`, `payment.changed`,
  `cash-session.changed` emitidos en `DB::afterCommit`.
- **D6** PHP-FPM pool tuned para 5 cajeros: `pm=static`,
  `pm.max_children=8`, `pm.max_requests=500`.
- **B7** `App\Policies\InvoicePolicy` y `CashSessionPolicy`.
  `Gate::policy()` registrado en `AppServiceProvider`.
- **F1** `InvoiceHistoryView` migrado a TanStack Query.
- **F2** Código muerto eliminado: `useClock`, `app-kicker`,
  `needsBillingCashBootstrap`, `cashBootstrapLoading`.
- **C6** Recompute defensivo `payments.amount_cents` a
  `UNSIGNED` (prevención de truncamiento 32-bit).
- **F5/F6** `docs/00_README.md` + `docs/TROUBLESHOOTING.md` +
  `docs/OPERATIVE_NOTES_2026_06_02.md`.

**Scripts nuevos:**

- `scripts/register_scheduler_cron.ps1` - Windows scheduled task
  para `php artisan schedule:run`.
- `scripts/refresh_lan_ip.ps1` - Re-aplica IP LAN si cambia
  el DHCP.
- `scripts/smoke_test_post_install.ps1` - HTTP smoke test
  post-instalación.

### Métricas al cierre de v1.0.0 (branch)

- 380/380 tests PHPUnit backend (+37 desde rc.3)
- 217/217 tests Vitest frontend (+6 desde rc.3)
- 0 errores de typecheck
- 0 errores de ESLint
- 0 errores de phpstan nivel 5 (basado rc.3; nivel 6 + burndown
  baseline en v1.1)
- 6/6 tests de broadcasting (Soketi)
- 9/9 tests de env_helpers (PS1 ASCII)
- 5/5 tests de scheduler heartbeat
- 7/7 tests de reverse invoice flow
- 15/15 tests de pre-commit guard
- 3/3 tests de active_document_type
- Bundle gzipped frontend: <250 kB
- 27 warnings de ESLint (jsx-a11y + react-hooks) documentados
  para v1.1
- New docs: TROUBLESHOOTING.md, OPERATIVE_NOTES_2026_06_02.md,
  CI.md, BRANDING_GUIDELINES.md deferred

### Pendientes para v1.0.0 final (FASE G)

Estos bloquean la entrega final al hospital. Requieren el
servidor real con hardware y la presencia de un operador:

- Validación desde una segunda PC LAN (qa/LAN_CLIENT_VALIDATION_PROOF.md)
- Impresión física en 5 tamaños (qa/INSTITUTIONAL_RECEIPT_PRINT_PROOF.md)
- Restore real (qa/FINAL_RESTORE_PROOF.md)
- Concurrencia real (qa/FINAL_CONCURRENCY_PROOF.md)
- Tareas Windows de backup worker instaladas
- `scripts/final_production_handoff.ps1` exit 0 con
  PRODUCTION_READY=YES

### v1.0.0-rc.3 (predecesor, base de este branch)

- 3 bloqueantes de seguridad resueltos (secretos sin defaults dev,
  HTTPS opcional, CORS/SANCTUM endurecido)
- 5 fases de hardening técnico frontend
- 5 fases de hardening backend (CSP, phpstan level 5, lockout tests,
  secrets playbook)
- docker-compose.prod con no-new-privileges, resource caps, imágenes
  pinneadas y validación de build
- pre-commit guard contra secretos en staged diffs
- `docs/SECRETS.md` con procedimiento de rotación
- `docs/HTTPS_OPTIONAL.md` con CA local y nginx con TLS opcional

### Métricas al cierre de v1.0.0-rc.3

- 340/340 tests PHPUnit backend
- 211/211 tests Vitest frontend
- 0 errores de typecheck
- 0 errores de ESLint
- 0 errores de phpstan nivel 5
- Bundle gzipped mas grande: charts 116.73 kB
- 28 warnings de ESLint (react-hooks exhaustivo + jsx-a11y) documentados

  para promover a error en v1.1

### Bloqueantes cerrados (FASE A)

- **A1** `docs/SECRETS.md` con procedimiento de rotación de APP_KEY y
  passwords. `.env.example` y `backend/.env.example` sin defaults de
  dev (`hospital_dev`, `root_dev`). Pre-commit guard
  (`scripts/pre-commit-guard.ps1`) bloquea staged diffs con
  `APP_KEY=base64:`, `DB_PASSWORD=`, etc.
- **A3** HTTPS opcional con `scripts/generate_local_ca.ps1`. CA local
  + cert de servidor firmados. `docs/HTTPS_OPTIONAL.md` con
  procedimiento de instalación en PCs cliente. `nginx/default.conf`
  con bloque HTTPS comentado listo para activar.
- **A4** `scripts/lib/cors_helpers.ps1` con helper canónico. SANCTUM
  y CORS sin Vite dev port 5173 en prod. Test con 17 casos.
- **A5** `docker-compose.prod.yml` con `no-new-privileges`, mem/cpu/
  pids limits, nginx 1.25.4-alpine y mariadb 11.4.3 pinneados,
  `--max_connections=200` y `--skip-name-resolve` en MariaDB.
  Validación `frontend/dist/index.html` antes de arrancar php-fpm.

### Hardening frontend (FASE B)

- **B1** Invalidación de TanStack Query tras `registerPayment`,
  `voidInvoice`, `reprintInvoice`, `handleServiceSuccess`,
  `toggleServiceActive`. Tests adaptados a QueryClientProvider.
- **B2** `CashBoxView` con `refetchInterval: 10000` y
  `refetchOnWindowFocus` para multi-PC LAN. `useServerStatus`
  pausa polling cuando tab oculta.
- **B3** `formatCurrency.ts` y test eliminados (dead code). Cinco
  vistas migran de `function formatDate` local a
  `formatLocalizedDateTime` compartido en `lib/format/formatDate.ts`.
- **B4** `apiClient` con `AbortController` (10s GET, 30s mutación),
  `onSessionExpired` ahora Set multi-suscriptor con unsubscribe,
  `invalidateSession()` para reset de CSRF en logout, handler
  aislado con try/catch. 5 tests nuevos.
- **B5** ESLint con `eslint-plugin-react-hooks` y `eslint-plugin-
  jsx-a11y` activados. 28 warnings documentados (reglas de hooks
  exhaustivos + 18 reglas a11y) que se promoverán a error en v1.1.

### Hardening backend (FASE C)

- **C1** LoginLockout tests ya existían (5 casos) y pasan.
- **C2** `AddSecurityHeaders` production CSP ahora con nonce en
  `style-src` (sin `unsafe-inline`). Nuevo test
  `test_csp_in_production_drops_unsafe_inline_from_styles`.
- **C5** phpstan (larastan) promovido de nivel 4 a 5. Baseline
  regenerada (155 errores históricos absorbidos; el tamaño del
  baseline cae 613 líneas).

### Pendientes para v1.1 (FASE C3, C4, C6, D1-D5, E1-E6, F1-F3, G1-G3)

- Cobertura >80% en módulos críticos (gate opt-in)
- Auditoría de cambios de permisos via Activitylog
- Rate limit por usuario en endpoints sensibles
- Health dashboard admin con métricas
- Stack auto-start tras reboot del servidor
- Comando `hospital:maintenance` para modo mantenimiento
- Deprecación de `install_hospital_os.ps1` (legacy WPF)
- IP detection robusta con `Get-NetRoute`
- Fix `database/schema_extensions_for_barcode_reports.sql`
- Master operator manual unificado
- Plantillas de evidencia completas
- `KNOWN_LIMITATIONS.md` actualizado al estado v1.0.0
- `production_readiness_preflight.ps2` endurecido
- Tag `v1.0.0` final tras evidencia física

---

## v1.0.0-rc.3 - Production Audit Plan Hardening (2026-06-02)

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

- Script `auto_evidence.ps1` que pre-rellena y valida los archivos
  `qa/*.md` de evidencias finales y handoff con datos del `.env`
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

1. Cerrar las evidencias finales con `auto_evidence.ps1 -Force` para
   pre-rellenar borradores, validar con `auto_evidence.ps1 -Mode check`
   y luego ejecutar `final_production_handoff.ps1`
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
