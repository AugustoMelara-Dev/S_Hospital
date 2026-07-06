# Testing Report

Living verification report for the S_Hospital total refactor. This document is
evidence for the current branch, not a production approval.

Status date: 2026-07-05
Branch: `codex/refactor-total`
Production approval: NO

## Current Focus

The latest verification pass moved from local frontend-only evidence to the
Docker stack. It confirmed the containerized Laravel, MySQL/MariaDB and
frontend services can boot, migrate, seed, run focused backend gates, and pass
the frontend lint/typecheck/test/build path.

The focused Playwright gates remain mocked and non-mutating. They prove frontend
contracts, RBAC visibility, payload shape, and accessible UI behavior. They do
not replace real LAN, printer, backup scheduler, restore dry-run, or physical
print validation.

The current release target has been narrowed to a stable single-machine local
installation. Multi-PC LAN proof is no longer treated as the next engineering
blocker, but fiscal integrity, audit trails, institutional receipts, local
backups, restore evidence and printer/PDF validation remain required before any
production approval.

## Verified Commands

| Date | Command | Result | Notes |
|---|---|---|---|
| 2026-07-02 | `npm run test` | PASS, 100 files / 552 tests | Local Vitest run from `frontend`; not Docker. |
| 2026-07-02 | `npm run build` | PASS | Local production build: `tsc --noEmit && vite build`; largest chunks `vendor` 398.37 kB gzip 121.92 kB and `charts` 357.04 kB gzip 104.93 kB. |
| 2026-07-02 | `npx playwright test e2e/accessibility.spec.ts e2e/new-invoice-flow.spec.ts e2e/reports-flow.spec.ts e2e/cashbox.spec.ts e2e/invoice-history-flow.spec.ts` | PASS, 8 tests | Fresh focused gate for accessibility, invoice/payment, reports, cashbox close and invoice voiding. |
| 2026-07-02 | `npx playwright test e2e/accessibility.spec.ts` | PASS, 2 tests | Login and critical protected routes: one `h1`, `main`, named controls, no serious/critical axe issues. |
| 2026-07-02 | `npx playwright test e2e/new-invoice-flow.spec.ts e2e/reports-flow.spec.ts` | PASS, 4 tests | Invoice payload/payment payload/PDF request; reports filters/export/cash/audit. |
| 2026-07-02 | `npx playwright test e2e/cashbox.spec.ts e2e/invoice-history-flow.spec.ts` | PASS, 2 tests | Cash close difference requires note; invoice void requires reason and row ActionMenu. |
| 2026-07-02 | `npm run lint` | PASS | Frontend lint. |
| 2026-07-02 | `npm run typecheck` | PASS | TypeScript no emit. |
| 2026-07-02 | `docker compose up -d` | PASS | `mysql`, `backend`, and `frontend` containers started; MySQL healthy on local mapped port 3307. |
| 2026-07-02 | `docker compose exec backend php artisan migrate --seed` | PASS | Applied pending receipt/fiscal permission migrations and completed core seeders. |
| 2026-07-02 | `docker compose exec backend php artisan test` | TIMEOUT | Timed out after about 304 seconds with no final result. Full backend PHPUnit remains open. |
| 2026-07-02 | `docker compose exec backend php artisan test` | PASS, 752 passed / 13 skipped | 4862 assertions. Completed in 497.84 seconds after rerunning with a wider command timeout. This supersedes the earlier timeout row. |
| 2026-07-02 | `docker compose exec backend php artisan test --testsuite=Unit` | PASS, 147 passed / 2 skipped | 598 assertions. Skips were MySQL-specific admin audit support tests. |
| 2026-07-02 | `docker compose exec backend php artisan test tests/Feature/ReceiptPrintProfileAdvancedFieldsTest.php tests/Feature/CloseCashSessionDifferenceTest.php tests/Feature/Resilience/IdempotencyKeyTest.php tests/Feature/BackupWorkflowTest.php tests/Feature/UserManagementTest.php` | PASS, 71 tests | 382 assertions covering receipt advanced-field RBAC/audit, cash close difference notes, idempotency, backups, and user management. |
| 2026-07-02 | `docker compose exec backend vendor/bin/pint --test` | PASS | 423 files checked. |
| 2026-07-02 | `docker compose exec backend vendor/bin/phpstan analyse` | FAIL | Default parallel worker ended with child process error exit code 255; no code errors were reported before the worker failure. |
| 2026-07-02 | `docker compose exec backend vendor/bin/phpstan analyse --memory-limit=1G` | PASS | 211/211 files, no errors. This is the stable backend static-analysis gate for this pass. |
| 2026-07-02 | `docker compose exec frontend npm run lint` | PASS | Containerized frontend lint. |
| 2026-07-02 | `docker compose exec frontend npm run typecheck` | PASS | Containerized TypeScript no emit. |
| 2026-07-02 | `docker compose exec frontend npm run test` | PASS, 101 files / 557 tests | Containerized Vitest. React `act(...)` and TanStack Query undefined-data warnings remain test hygiene items. |
| 2026-07-02 | `docker compose exec frontend npm run build` | PASS | Containerized production build. Largest chunks: `vendor` 398.37 kB gzip 121.92 kB, `charts` 357.04 kB gzip 104.93 kB, `index` 236.04 kB gzip 59.20 kB. |
| 2026-07-02 | `docker compose exec frontend npm run test -- src/components/keyboard-shortcuts-palette.test.tsx src/layout/AppShell.test.tsx src/layout/AppShell.a11y.test.tsx src/features/admin/components/RoleFormDialog.test.tsx` | PASS, 21 tests | Focused gate for keyboard shortcuts palette, AppShell/topbar accessibility, and role permission filtering. |
| 2026-07-02 | `docker compose exec frontend npm run test -- ReportsAudit.test.tsx src/lib/api/system.test.ts` | PASS, 5 tests | Audit report UI now mocks executive summary plus audit-log register; system API client query-string contract covered. |
| 2026-07-02 | `docker compose exec frontend npm run test` | PASS, 102 files / 562 tests | First rerun exposed one transient `src/lib/realtime/echo.test.ts` timeout; focused rerun passed, and full rerun passed. React `act(...)` and TanStack Query warnings remain test hygiene items. |
| 2026-07-05 | `docker compose exec frontend npm run test -- --run` | PASS, 112 files / 737 tests | Fresh full Vitest rerun after test hygiene cleanup. The prior React `act(...)` and TanStack Query undefined-data warnings are no longer emitted. |
| 2026-07-02 | `docker compose exec frontend npm run typecheck` | PASS | Re-run after audit register/API client tests. |
| 2026-07-02 | `docker compose exec frontend npm run lint` | PASS | Re-run after audit register/API client tests. |
| 2026-07-02 | `docker compose exec backend php artisan test --filter=AuditLogTest` | PASS, 7 tests | Covers audit-log persistence plus `/api/system/audit-logs` filtered listing and `audit.view` 403 gate. |
| 2026-07-02 | `docker compose exec -e PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium-browser frontend npx playwright test` | FAIL, 36 passed / 39 failed | Environment browser is now usable. Initial failure was missing bundled Chromium; `npx playwright install chromium` could not download in-container because DNS/network timed out, so Alpine Chromium was installed and wired by env var. Remaining failures were app/test contract issues addressed with focused gates. |
| 2026-07-02 | `docker compose exec -e PLAYWRIGHT_EXTERNAL_SERVER=1 -e PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium-browser frontend npx playwright test e2e/reports-flow.spec.ts` | PASS, 3 tests | Reports executive/cash/audit flow after restoring `/reports` root and audit counters. |
| 2026-07-02 | `docker compose exec -e PLAYWRIGHT_EXTERNAL_SERVER=1 -e PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium-browser frontend npx playwright test e2e/all-buttons-smoke.spec.ts` | PASS, 7 tests | Button smoke updated for invoice history ActionMenu flow. |
| 2026-07-02 | `docker compose exec -e PLAYWRIGHT_EXTERNAL_SERVER=1 -e PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium-browser frontend npx playwright test e2e/v1-2-full-a11y.spec.ts` | PASS, 7 tests | Full v1.2 accessibility smoke after ActionMenu and backup contrast fixes. |
| 2026-07-02 | `docker compose exec -e PLAYWRIGHT_EXTERNAL_SERVER=1 -e PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium-browser frontend npx playwright test e2e/v1-2-visible-ui-a11y.spec.ts --grep "1920x1080"` | PASS, 1 test | Confirms backup status contrast correction for the desktop visible UI gate. |
| 2026-07-02 | `docker compose exec frontend npm run typecheck` | PASS | Re-run after RC1/new-invoice/history/production-readiness E2E stabilization. |
| 2026-07-02 | `docker compose exec frontend npm run lint` | PASS | Re-run after RC1/new-invoice/history/production-readiness E2E stabilization. |
| 2026-07-02 | `docker compose exec -e PLAYWRIGHT_EXTERNAL_SERVER=1 -e PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium-browser frontend npx playwright test e2e/rc1-screens.spec.ts` | PASS, 9 tests | RC1 screen capture flows for login, POS billing, reprint, cashbox close, reports, fiscal settings, backups, login validation and billing validation. |
| 2026-07-02 | `docker compose exec -e PLAYWRIGHT_EXTERNAL_SERVER=1 -e PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium-browser frontend npx playwright test e2e/new-invoice-flow.spec.ts` | PASS, 1 test | New invoice flow aligned with current service-area endpoint and confirmation dialog. |
| 2026-07-02 | `docker compose exec -e PLAYWRIGHT_EXTERNAL_SERVER=1 -e PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium-browser frontend npx playwright test e2e/invoice-history-flow.spec.ts` | PASS, 1 test | Invoice history ActionMenu void flow stabilized with Radix menu visibility/click handling. |
| 2026-07-02 | `docker compose exec -e PLAYWRIGHT_EXTERNAL_SERVER=1 -e PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium-browser frontend npx playwright test e2e/production-readiness.spec.ts` | PASS, 4 tests | Production readiness workflow with resilient receipt paper selection. |
| 2026-07-02 | `docker compose exec -e PLAYWRIGHT_EXTERNAL_SERVER=1 -e PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium-browser frontend npx playwright test e2e/refactor-total.spec.ts` | PASS, 7 tests | Refactor-total a11y gates with synchronized backend login. |
| 2026-07-02 | `docker compose exec -e PLAYWRIGHT_EXTERNAL_SERVER=1 -e PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium-browser frontend npx playwright test --workers=2` | PASS, 73 passed / 2 skipped | Full Docker Playwright gate. Release mutation specs remain skipped unless `E2E_RELEASE_ALLOW_MUTATIONS=1`. A prior `--workers=4` run exposed resource-sensitive timeouts; `--workers=2` is the stable offline/container setting. |
| 2026-07-05 | `npm.cmd run e2e` | FAIL, preflight | Host release E2E now fails early with an operator-safe message because `backend/vendor/autoload.php` is missing on the host. Run `composer install` in `backend/` before this host gate, or use the Docker mocked Playwright gates for containerized UI smoke. |
| 2026-07-05 | `docker compose exec frontend npx vitest run scripts/release-e2e-preflight.test.mjs --pool=forks --maxWorkers=1 --no-file-parallelism` | PASS, 2 tests | Covers the release E2E preflight for present/missing Composer autoloader. |
| 2026-07-05 | `docker compose exec frontend npx vitest run scripts/button-smoke-report.test.mjs --pool=forks --maxWorkers=1 --no-file-parallelism` | PASS, 2 tests | Button-smoke report writer refuses empty evidence artifacts. |
| 2026-07-05 | `docker compose exec -e PLAYWRIGHT_EXTERNAL_SERVER=1 -e E2E_BUTTON_SMOKE_REPORT_PATH=/tmp/button-smoke-dangerous.json frontend npx playwright test e2e/all-buttons-smoke.spec.ts --grep "dangerous history" --workers=1 --reporter=list` | PASS, 1 test | Validates the history reverse-cancel smoke and writes a non-empty temporary report. |
| 2026-07-05 | `docker compose build frontend` | PASS | Builds the local frontend QA image with Alpine Chromium installed. |
| 2026-07-05 | `docker compose exec -e PLAYWRIGHT_EXTERNAL_SERVER=1 frontend npx playwright test e2e/all-buttons-smoke.spec.ts --workers=1 --reporter=list` | PASS, 7 tests | Full button-smoke matrix passed in 4.7m and regenerated `qa/production-audit/button-smoke-report.json` with 79 passed results. |
| 2026-07-05 | `docker compose exec backend composer validate --no-interaction` | PASS | Backend Composer manifest is valid inside the supported backend container. |
| 2026-07-05 | `docker compose exec backend composer audit --no-interaction` | PASS | No Composer security vulnerability advisories found. |
| 2026-07-05 | `docker compose exec frontend npm audit --audit-level=high --json` | PASS | npm audit reports 0 total vulnerabilities in the supported frontend container. |
| 2026-07-05 | `docker compose exec frontend npm run typecheck` | PASS | Fresh frontend TypeScript gate after QA container changes. |
| 2026-07-05 | `docker compose exec frontend npm run lint` | PASS | Fresh frontend lint gate after QA container changes. |
| 2026-07-05 | `docker compose exec frontend npm run build` | PASS | Fresh production build; largest chunks remain `vendor` 398.43 kB gzip 121.82 kB and `charts` 357.04 kB gzip 104.93 kB. |
| 2026-07-05 | `docker compose exec backend php artisan test tests/Feature/InvoiceCreationTest.php tests/Feature/CashPaymentsReceiptTest.php tests/Feature/InvoiceHistoryReprintVoidTest.php tests/Feature/InvoiceReverseTest.php tests/Feature/ServiceCatalogTest.php tests/Feature/BackupWorkflowTest.php tests/Feature/UserManagementTest.php tests/Feature/ReportsTest.php tests/Feature/Reports/TodayReportTest.php` | PASS, 254 tests / 2032 assertions | Focused backend gate for billing, cashbox, receipts, history/void/reverse, catalog, backups, users, reports and today's report. |
| 2026-07-05 | `docker compose exec -e PLAYWRIGHT_EXTERNAL_SERVER=1 frontend npx playwright test --workers=2 --reporter=list` | TIMEOUT | Timed out after about 900 seconds and left a Playwright worker alive. The process was stopped and partial QA artifacts/screenshots were discarded; use the divided critical E2E commands instead of this full historical matrix as a single gate. |
| 2026-07-05 | `docker compose exec frontend npx vitest run src/features/backups/BackupsView.test.tsx src/features/invoices/InvoiceHistoryView.test.tsx --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | PASS, 67 tests | TDD focused gate for single-machine backup readiness wording and human receipt-preview copy. |
| 2026-07-05 | `docker compose exec frontend npm run test:critical` | PASS, 173 tests | Critical frontend gate for invoices, payment modal, receipts, history, backups, reports, dashboard and users after narrowing operator copy to local single-machine operation. |
| 2026-07-05 | `docker compose exec frontend npm run typecheck` | PASS | TypeScript no emit after single-machine UI copy changes. |
| 2026-07-05 | `docker compose exec frontend npm run lint` | PASS | ESLint after single-machine UI copy changes. |
| 2026-07-05 | `docker compose exec frontend npx vitest run src/features/help/HelpView.test.tsx --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | PASS, 1 test | Help screen now keeps normal receipt guidance on carta/media carta/A5 and does not present second-PC/80mm/58mm as normal operation. |
| 2026-07-05 | `docker compose exec frontend npx vitest run src/features/reports/ReportsCash.test.tsx src/features/reports/components/CashSessionReportTab.test.tsx src/features/reports/ReportsView.subroutes.test.tsx --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | PASS, 19 tests | Cash report now loads recent cash sessions so the cashier can open the latest report without typing an internal ID. |
| 2026-07-05 | `docker compose exec frontend npm run test:critical` | PASS, 173 tests | Re-run after cash report recent-session selector; output clean without React `act(...)` warnings. |
| 2026-07-05 | `docker compose exec frontend npm run typecheck` | PASS | TypeScript no emit after cash report selector. |
| 2026-07-05 | `docker compose exec frontend npm run lint` | PASS | ESLint after cash report selector. |
| 2026-07-05 | `docker compose exec frontend npx vitest run src/features/admin/UsersView.test.tsx src/features/admin/components/UserFormDialog.test.tsx --pool=forks --maxWorkers=1 --no-file-parallelism` | PASS, 44 tests | User management now keeps basic create/edit on role inheritance and moves exact direct permissions into the advanced accordion. |
| 2026-07-05 | `docker compose exec frontend npm run test:critical` | PASS, 174 tests | Critical frontend gate after advanced exact-permission controls. |
| 2026-07-05 | `docker compose exec frontend npm run typecheck` | PASS | TypeScript no emit after advanced exact-permission controls. |
| 2026-07-05 | `docker compose exec frontend npm run lint` | PASS | ESLint after advanced exact-permission controls. |
| 2026-07-05 | `docker compose exec backend php artisan test tests/Feature/CashPaymentsReceiptTest.php tests/Unit/OpenCashSessionActionConcurrencyTest.php tests/Feature/Payments/RegisterPaymentDoesNotMutateInvoiceTest.php` | PASS, 39 tests / 389 assertions | Cashbox now enforces one open local drawer globally and keeps payment-session immutability coverage. |
| 2026-07-05 | `docker compose exec backend php artisan test tests/Feature/Reports/TodayReportTest.php tests/Feature/Reports/ExecutiveReportTest.php` | PASS, 20 tests / 246 assertions | Report helpers remain compatible with the single-open-drawer rule. |
| 2026-07-05 | `docker compose exec backend php artisan test tests/Feature/ReportsTest.php --filter='cash_session|managerial_reports|CashSession'` | PASS, 8 tests / 103 assertions | Cash-session report coverage after the local drawer rule. |
| 2026-07-05 | `docker compose exec backend php artisan test tests/Feature/InternalControlAuditTest.php` | PASS, 7 tests / 53 assertions | User deactivation audit now includes the required reason. |
| 2026-07-05 | `docker compose exec frontend npm run test -- CashBoxView base.test` | PASS, 2 files / 47 tests | Frontend shows a human `Caja` validation message when another local cash session is already open. |
| 2026-07-05 | `docker compose exec backend vendor/bin/phpstan analyse --memory-limit=1G` | PASS | Static analysis after single-open-drawer backend change. |
| 2026-07-05 | `docker compose exec frontend npm run typecheck` | PASS | TypeScript no emit after cashbox conflict message. |
| 2026-07-05 | `docker compose exec frontend npm run lint` | PASS | ESLint after cashbox conflict message. |
| 2026-07-05 | `docker compose exec backend php artisan test tests/Feature/BackupWorkflowTest.php` | PASS, 28 tests / 146 assertions | Backup listing no longer exposes internal filename/path/disk/checksum; download remains integrity checked and audited. |
| 2026-07-05 | `docker compose exec frontend npm run test -- BackupsView useBackups backups.test` | PASS, 3 files / 43 tests | Frontend backup contract and UI remain green after removing technical filenames from normal payloads. |

Recharts emits a known Playwright/Vite console warning about chart container
dimensions in the mocked browser run. It does not currently fail the focused
gates, but it remains a visual/performance review item for final QA.

A fresh 2026-07-05 containerized Vitest run no longer emits the React
`act(...)` warnings or TanStack Query undefined-data warnings that were tracked
as test hygiene items in earlier runs. The same date now has fresh frontend
typecheck/lint/build plus a focused backend business-critical test gate.

## Focused E2E Coverage Added

| Spec | Critical behavior covered |
|---|---|
| `frontend/e2e/accessibility.spec.ts` | WCAG smoke for login and critical routes, one visible `h1`, `main` landmark, named controls, axe serious/critical gate. |
| `frontend/e2e/new-invoice-flow.spec.ts` | Open cash session, patient, service search, invoice emission, payment registration payload, institutional receipt PDF request. |
| `frontend/e2e/reports-flow.spec.ts` | Executive filters, PDF/Excel export, cash session lookup, audit counters. |
| `frontend/e2e/cashbox.spec.ts` | Close cash session wizard/difference/note requirement/payload. |
| `frontend/e2e/invoice-history-flow.spec.ts` | Patient filter, row action menu, void dialog, reason payload. |
| `frontend/e2e/backups-flow.spec.ts` | Safe backup status, create confirmation, no restore/delete actions. |
| `frontend/e2e/settings-flow.spec.ts` | Fiscal/receipt settings gates and receipt paper separation. |
| `frontend/e2e/catalog-flow.spec.ts` | Service search, ActionMenu, deactivate confirmation. |
| `frontend/e2e/users-flow.spec.ts` | User management and permission/role controls. |
| `frontend/e2e/auth.spec.ts` / `frontend/e2e/rbac.spec.ts` | Auth/session and route permission gates. |

## Full Gate Status

The Docker stack, backend migrations/seeders, full backend PHPUnit, backend
Unit suite, focused backend Feature suite, Pint, PHPStan with
`--memory-limit=1G`, frontend lint, frontend typecheck, frontend Vitest,
frontend build, and divided critical Playwright gates have green evidence in
this report. The full historical Playwright matrix is not current green for the
2026-07-05 pass because the Docker run timed out after about 900 seconds; use
the divided critical E2E specs until that timeout is fixed.

For Playwright in this container, use the system Chromium executable because the
bundled browser cannot be downloaded reliably in offline/LAN-style conditions:

```bash
docker compose exec -e PLAYWRIGHT_EXTERNAL_SERVER=1 -e PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium-browser frontend npx playwright test e2e/auth.spec.ts e2e/rbac.spec.ts e2e/new-invoice-flow.spec.ts e2e/cashbox.spec.ts e2e/invoice-history-flow.spec.ts e2e/reports-flow.spec.ts e2e/backups-flow.spec.ts e2e/settings-flow.spec.ts e2e/catalog-flow.spec.ts e2e/users-flow.spec.ts e2e/print-profiles.spec.ts e2e/pwa.spec.ts --workers=2 --reporter=list
```

## Backend Status

Backend verification is stronger but not production-final:

- migrations and seeders pass in Docker;
- full PHPUnit passes: 752 passed, 13 skipped, 4862 assertions, 497.84 seconds;
- Unit suite passes: 147 passed, 2 skipped, 598 assertions;
- focused Feature suite passes: 71 passed, 382 assertions;
- Pint passes across 423 files;
- PHPStan passes with `--memory-limit=1G` across 211 files;
- the first full `php artisan test` attempt timed out after about 304 seconds,
  but the wider-timeout rerun completed cleanly;
- default PHPStan parallel execution failed with worker exit code 255, while the
  memory-limited rerun completed cleanly.

## Manual/Physical QA Still Required

- real LAN login and route access by server IP;
- real MySQL/MariaDB migrations and seeders from zero;
- physical or PDF print checks for Carta, Media carta and A5;
- backup worker/scheduler behavior on the server;
- restore runbook dry-run outside the app;
- invoice/payment/cashbox flow against a real database;
- browser zoom/responsive checks at 1366x768 and 125%.

## Current Conclusion

The focused mocked frontend gates are improving and currently green for the
covered critical flows. The total refactor is not complete until the full
backend, frontend, E2E, print, LAN/offline, and manual QA requirements above are
verified.

### 2026-07-05 Receipt Settings Normal Profile Gate

| Command | Result |
|---|---|
| `docker compose exec frontend npm run test -- InstitutionalReceiptSettingsView --run -t "saves a standard paper profile as the institutional default for support users in the normal flow"` | RED first on `is_global_default: false`; then PASS, 1 focused test. |
| `docker compose exec frontend npm run test -- InstitutionalReceiptSettingsView --run` | PASS, 22 tests. |
| `docker compose exec frontend npm run typecheck` | PASS. |
| `docker compose exec frontend npm run lint` | PASS. |

### 2026-07-05 Receipt Test Print Selected Profile Gate

| Command | Result |
|---|---|
| `docker compose exec frontend npm run test -- InstitutionalReceiptSettingsView --run -t "generates a test print with the selected support profile"` | RED first on `profile_code: media_carta_horizontal`; then PASS, 1 focused test. |
| `docker compose exec frontend npm run test -- InstitutionalReceiptSettingsView --run` | PASS, 23 tests. |
| `docker compose exec frontend npm run typecheck` | PASS. |
| `docker compose exec frontend npm run lint` | PASS. |

### 2026-07-05 Backup Visual E2E Contract Gate

| Command | Result |
|---|---|
| `docker compose exec frontend npx playwright test e2e/rc-backup-screen.spec.ts --workers=1 --reporter=list` | RED first on stale login/mock contract; then PASS, 1 test. |
| `docker compose exec frontend npx playwright test e2e/backups-flow.spec.ts --workers=1 --reporter=list` | PASS, 1 test. |
| `docker compose exec frontend npm run lint` | PASS. |

### 2026-07-05 Reports Audit Permission Gate

| Command | Result |
|---|---|
| `docker compose exec frontend npm run test -- ReportsView.subroutes --run -t "hides the audit report"` | RED first because `Auditoria` stayed visible without `audit.view`; then PASS, 1 focused test. |
| `docker compose exec frontend npm run test -- ReportsView.subroutes --run -t "opens audit from root"` | RED first because audit-only users did not land on Auditoria; then PASS, 1 focused test. |
| `docker compose exec frontend npm run test -- ReportsView.subroutes ReportsAudit --run` | PASS, 17 tests. |
| `docker compose exec frontend npm run typecheck` | PASS. |
| `docker compose exec frontend npm run lint` | PASS. |

### 2026-07-05 Catalog Availability Reason Gate

| Command | Result |
|---|---|
| `docker compose exec frontend npm run test -- CatalogView --run -t "requires confirmation"` | RED first because deactivation could be confirmed without reason; then PASS, 1 focused test. |
| `docker compose exec frontend npm run test -- CatalogView --run` | PASS, 19 tests. |
| `docker compose exec frontend npm run typecheck` | PASS. |
| `docker compose exec frontend npm run lint` | PASS. |

### 2026-07-05 Erythropoietin Catalog Lock Gate

| Command | Result |
|---|---|
| `docker compose exec frontend npm run test -- ServiceSheet --run -t "locks erythropoietin"` | RED first because price/rule/tax stayed editable; then PASS, 1 focused test. |
| `docker compose exec frontend npm run test -- ServiceSheet --run` | PASS, 18 tests. |
| `docker compose exec frontend npm run typecheck` | PASS. |
| `docker compose exec frontend npm run lint` | PASS. |

### 2026-07-05 Catalog Deactivation E2E Patch Gate

| Command | Result |
|---|---|
| `docker compose exec frontend npx playwright test e2e/catalog-flow.spec.ts --workers=1 --reporter=list` | RED first because the spec still expected DELETE; then RED once against an old Vite bundle without the reason textarea; after `docker compose restart frontend`, PASS, 1 test. |
| `docker compose exec frontend npm run test -- src/features/catalog/CatalogView.test.tsx --run -t "requires confirmation"` | PASS, 1 focused test. |
| `docker compose exec frontend npm run test -- src/features/catalog/CatalogView.test.tsx --run` | PASS, 19 tests. |
| `docker compose exec frontend npm run typecheck` | PASS. |
| `docker compose exec frontend npm run lint` | PASS. |

### 2026-07-05 Report Export Audit Gate

| Command | Result |
|---|---|
| `docker compose exec backend php artisan test --filter=test_report_export_without_audit_view_omits_audit_sheet_but_keeps_cashier_summary` | RED first because XLSX still included `Auditoria`; then PASS, 1 focused test. |
| `docker compose exec backend php artisan test --filter=test_period_closure_pdf_without_audit_view_omits_operational_audit_section` | RED first because PDF still rendered audit summary; then PASS, 1 focused test. |
| `docker compose exec backend php artisan test --filter=ReportsTest` | PASS, 55 tests. |
| `docker compose exec backend vendor/bin/pint --test` | RED first on style; after `vendor/bin/pint ...`, PASS, 429 files. |
| `docker compose exec backend vendor/bin/phpstan analyse` | Incomplete: PHPStan hit the configured 128M memory limit. |
| `docker compose exec backend vendor/bin/phpstan analyse --memory-limit=512M` | PASS, no errors. |

### 2026-07-05 Executive Report Audit Gate

| Command | Result |
|---|---|
| `docker compose exec backend php artisan test --filter=test_executive_without_audit_view_redacts_audit_details` | RED first because `can_view_audit` was absent and audit rows remained; then PASS, 1 focused test. |
| `docker compose exec backend php artisan test --filter=test_executive_pdf_without_audit_view_omits_audit_sections` | RED first because PDF still rendered audit sections; then PASS, 1 focused test. |
| `docker compose exec backend php artisan test --filter=test_executive_excel_without_audit_view_omits_audit_sheets` | RED first because XLSX still created audit sheets; then PASS, 1 focused test. |
| `docker compose exec backend php artisan test tests/Feature/Reports/ExecutiveReportTest.php tests/Feature/Reports/ExecutivePdfExportTest.php tests/Feature/Reports/ExecutiveExcelExportTest.php` | PASS, 24 tests. |
| `docker compose exec backend vendor/bin/pint --test` | PASS, 429 files. |
| `docker compose exec backend vendor/bin/phpstan analyse --memory-limit=512M` | PASS, no errors. |

### 2026-07-05 Print Profiles Normal E2E Gate

| Command | Result |
|---|---|
| `npx playwright test e2e/print-profiles.spec.ts` | PASS, 2 tests. |
| `npm run typecheck` | PASS. |
| `npm run lint` | PASS. |

### 2026-07-05 Invoice Submit Payload Idempotency Gate

| Command | Result |
|---|---|
| `npm run test -- useInvoices.test.tsx` | RED first because changed payload reused `invoice-attempt-1`; then PASS, 4 tests. |
| `npm run typecheck` | PASS. |
| `npm run lint` | PASS. |
| `git diff --check -- frontend/src/hooks/useInvoices.ts frontend/src/hooks/useInvoices.test.tsx` | PASS. |

### 2026-07-05 Fiscal Numeration Reason Gate

| Command | Result |
|---|---|
| `npm run test -- FiscalNumerationView --run` | RED first because the view had no fiscal reason field/message; then PASS, 4 tests. |
| `npm run typecheck` | PASS. |
| `npm run lint` | PASS. |

### 2026-07-05 Help Restore Wording Gate

| Command | Result |
|---|---|
| `npm run test -- HelpView --run` | RED first because Help still presented restore as normal admin work; then PASS, 1 test. |
| `npm run typecheck` | PASS. |
| `npm run lint` | PASS. |

### 2026-07-05 New Invoice Critical E2E Gate

| Command | Result |
|---|---|
| `npx playwright test e2e/new-invoice-flow.spec.ts --workers=1 --reporter=list` | PASS, 1 Chromium test in 6.3s. |

### 2026-07-05 Zero-Total Institutional Receipt Gate

| Command | Result |
|---|---|
| `npm run test -- NewInvoiceView --run -t "issues an institutional receipt for a paid zero-total invoice"` | RED first because zero-total invoices used the legacy receipt path; then PASS, 1 focused test. |
| `npm run test -- NewInvoiceView --run` | PASS, 25 tests. |
| `npm run typecheck` | PASS. |
| `npm run lint` | PASS. |

### 2026-07-05 Backup Scheduler Heartbeat UI Gate

| Command | Result |
|---|---|
| `npm run test -- BackupsView --run -t "shows automatic backup heartbeat status"` | RED first because the heartbeat copy was hidden behind collapsed support details; then PASS, 1 focused test. |
| `npm run test -- BackupsView --run` | PASS, 32 tests. |
| `npm run typecheck` | PASS. |
| `npm run lint` | PASS. |

### 2026-07-05 Audit Report Executive Permission Gate

| Command | Result |
|---|---|
| `npm run test -- ReportsAudit --run -t "does not fetch the executive summary"` | RED first because audit-only users still called `getExecutiveReport`; then PASS, 1 focused test. |
| `npm run test -- ReportsAudit --run` | PASS, 8 tests. |
| `npm run test -- ReportsView.subroutes --run` | PASS, 10 tests. |
| `npm run typecheck` | PASS. |
| `npm run lint` | PASS. |

### 2026-07-05 Cash Report Session List Permission Gate

| Command | Result |
|---|---|
| `npm run test -- ReportsCash --run -t "does not list recent cash sessions"` | RED first because cash report permission still called `getCashSessions`; then PASS, 1 focused test. |
| `npm run test -- ReportsCash --run` | PASS, 7 tests. |
| `npm run test -- ReportsView.subroutes --run` | PASS, 10 tests. |
| `npm run typecheck` | PASS. |
| `npm run lint` | PASS. |

### 2026-07-05 Operational Settings Permission Gate

| Command | Result |
|---|---|
| `docker compose exec backend php artisan test --filter=test_operational_settings_update_uses_operational_permission_not_fiscal_update` | RED first because `settings.operational.update` did not exist; then PASS, 1 focused test. |
| `npm run test -- FiscalSettingsView --run -t "allows editing only operational rules"` | RED first because operational rules still used the global fiscal edit flag; then PASS, 1 focused test. |
| `docker compose exec backend php artisan test tests/Feature/FiscalSettingsTest.php` | PASS, 21 tests. |
| `npm run test -- FiscalSettingsView --run` | PASS, 5 tests. |
| `npm run test -- OperationalRulesView --run` | PASS, 4 tests. |
| `npm run test -- App --run` | PASS, 41 tests across 7 files. |
| `npm run typecheck` | PASS. |
| `npm run lint` | PASS. |
| `docker compose exec backend vendor/bin/pint --test` | PASS, 429 files. |
| `docker compose exec backend vendor/bin/phpstan analyse --memory-limit=512M` | PASS, no errors. |

### 2026-07-05 Operational Settings Critical Permission Gate

| Command | Result |
|---|---|
| `npm run test -- RoleFormDialog --run -t "operational settings updates"` | RED first because `settings.operational.update` was not marked critical; then PASS, 1 focused test. |
| `docker compose exec backend php artisan test tests/Unit/RoleCatalogTest.php` | RED first because `RoleCatalog` did not treat the permission as elevated; then PASS, 1 test. |
| `npm run test -- RoleFormDialog --run` | PASS, 13 tests. |
| `docker compose exec backend php artisan test --filter=test_user_manager_without_admin_assignment_permission_cannot_create_elevated_operational_roles` | PASS, 1 test. |
| `docker compose exec backend php artisan test --filter=test_user_manager_without_admin_assignment_permission_cannot_promote_user_to_elevated_operational_role` | PASS, 1 test. |
| `npm run typecheck` | PASS. |
| `npm run lint` | PASS. |
| `docker compose exec backend vendor/bin/pint --test` | PASS, 430 files. |
| `docker compose exec backend vendor/bin/phpstan analyse --memory-limit=512M` | PASS, no errors. |

### 2026-07-05 Operational Permission Catalog Label Gate

| Command | Result |
|---|---|
| `docker compose exec backend php artisan test --filter=test_permission_catalog_labels_operational_settings_as_human_configuration_rule` | RED first because the permission catalog exposed `Settings`; then PASS, 1 focused test. |
| `docker compose exec backend php artisan test tests/Feature/RoleManagementTest.php` | PASS, 10 tests. |
| `docker compose exec backend vendor/bin/pint --test` | PASS, 430 files. |
| `docker compose exec backend vendor/bin/phpstan analyse --memory-limit=512M` | PASS, no errors. |

### 2026-07-05 Operational Settings Route Gate

| Command | Result |
|---|---|
| `npm run test -- appNavigation --run -t "operational settings editors"` | RED first because `/settings/fiscal` only accepted `settings.fiscal.view`; then PASS, 1 focused test. |
| `npm run test -- FiscalSettingsView --run -t "does not request fiscal settings"` | RED first because the view stayed on fiscal summary and could not reach the scanner field; then PASS, 1 focused test. |
| `npm run test -- appNavigation FiscalSettingsView App --run` | PASS, 48 tests across 8 files. |
| `npm run typecheck` | PASS. |
| `npm run lint` | PASS. |

### 2026-07-06 Seeded Cashier Dialysis Prescription Gate

| Command | Result |
|---|---|
| `docker compose exec backend php artisan test --filter=test_seeded_cashier_can_apply_dialysis_prescription_to_erythropoietin` | RED first because seeded `cajero` received 422 for `dialysis_prescription`; then PASS, 1 focused test. |
| `docker compose exec backend php artisan test tests/Feature/Billing/InvoiceDialysisPrescriptionTest.php` | PASS, 6 tests and 45 assertions. |
| `docker compose exec backend php artisan test tests/Feature/AuthTest.php` | PASS, 19 tests and 80 assertions. |
| `docker compose exec backend php artisan test tests/Feature/UserManagementTest.php --filter="direct_permissions|module_permissions|regular_direct_permissions"` | PASS, 11 tests and 49 assertions. |
| `docker compose exec backend php artisan test tests/Feature/InvoiceCreationTest.php --filter=erythropoietin` | PASS, 2 tests and 12 assertions. |
| `docker compose exec backend php artisan test tests/Feature/CashPaymentsReceiptTest.php --filter=dialysis_prescription` | PASS, 1 test and 23 assertions. |
| `docker compose exec backend vendor/bin/pint --test` | PASS, 430 files. |
| `docker compose exec backend vendor/bin/phpstan analyse --memory-limit=512M` | PASS, no errors. |
