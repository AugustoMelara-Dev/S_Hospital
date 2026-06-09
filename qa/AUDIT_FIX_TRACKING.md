# S_Hospital Audit Fix Tracking

Source of truth: pasted audit report from Codex attachment `95dbb2e9-631d-47b1-b0be-6010d9ccef84/pasted-text.txt`.

Branch: `codex/audit-fix`

Status values: `detected`, `fixing`, `fixed`, `not_reproducible`, `requires_physical_validation`.

## Phase Plan

| Phase | Scope | Expected files | Migrations | Tests / gates | Risks | Acceptance criteria | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 0 | Prepare branch, tracking, stack discovery, baseline | `qa/AUDIT_FIX_TRACKING.md`, baseline notes | None | Docker, backend, frontend, phpstan/pint, Playwright if available | Existing dirty worktree and stale generated artifacts | Baseline errors documented before fixes | fixing |
| 1 | Critical/high money, fiscal, cash, invoices, payments, CSRF | Backend actions/requests/tests, frontend session/API tests | Additive only if needed | PHPUnit feature/unit, Vitest, MariaDB concurrency where available | Changing financial rules without tests | No reproducible critical/high money bugs remain | detected |
| 2 | Installer, Windows autostart, production compose, backups, release artifacts | `scripts/`, release docs, install docs, qa physical templates | None unless backup metadata needs additive fields | Script static checks, branding/secrets scans, preflight | Accidentally implying physical validation | Production operator path is clear; hardware items marked ready only | detected |
| 3 | Reports, PDFs, receipts, reprint/void marks, timezone, exports | Report services, receipt components, export tests, artifacts | None unless audit payload needs additive fields | PDF/Excel tests, generated artifacts | Dompdf layout differs from physical printers | Test PDFs generated; printer remains physical validation | detected |
| 4 | Security, RBAC, policies, upload, password/lockout, CORS/CSP/license | Policies, FormRequests, controllers, config, tests, docs | Additive only if needed | Feature permission tests, auth tests, security scans | Breaking cashier flow through over-tightening | No unauthorized critical action succeeds | detected |
| 5 | Real visual audit screen-by-screen | `qa/SCREEN_AUDIT.md`, `qa/screenshots/audit-fix-*` | None | Playwright/browser screenshots, responsive/dark/light checks | Seed data may not cover every role/screen | Every important screen audited with evidence | detected |
| 6 | Duplication cleanup, frontend QA coverage | Shared format/money helpers, component tests | None | lint max warnings 0, typecheck, Vitest | Over-refactor causing regressions | Dangerous duplication removed or justified | detected |
| 7 | Final clean verification and final report | `qa/FINAL_AUDIT_FIX_RESULT.md`, evidence artifacts | Fresh migrations from zero | Full suite, build, scans, docker clean up/down | Physical hardware unavailable | Max state `READY_FOR_PHYSICAL_VALIDATION` unless real hardware proof exists | detected |

## Initial Bug Ledger

### Critical

| ID | Severity | Area | Summary | Initial status | Evidence target / notes |
| --- | --- | --- | --- | --- | --- |
| BUG-BA-12 | critical | invoices | Void paid invoice returns 422 without actionable reverse guidance; void/reverse UX opaque | detected | Reproduce API/UI before editing |
| BUG-BA-22 | critical | cash | Cash reconciliation counts pending invoices by invoice session, not payment session | detected | `backend/app/Actions/Cash/BuildCashReconciliationAction.php` |
| BUG-RPT-01 | critical | reports/pdf | Closure PDFs do not call `setPaper`; Dompdf defaults to A4 | detected | `backend/app/Actions/Reports/PdfExportService.php` |
| BUG-DB-01 | critical | data/secrets | Validation credentials published in QA docs/seeder | detected | `qa/VALIDATION_PRESENTATION_READINESS.md`, `DevelopmentValidationSeeder` |
| BUG-DB-05 | critical | migration | Legacy receipt width migration has unsafe SQLite/update/down behavior | detected | Locate migration and reproduce |
| BUG-FE-01 | critical | POS | Frontend reimplements fiscal/ISV/erythropoietin math | detected | `frontend/src/features/invoices/posMath*` or equivalent |
| BUG-FE-08 | critical | POS | Cart is lost on refresh | detected | `frontend/src/features/invoices/NewInvoiceView.tsx` |
| BUG-SEC-01 | critical | auth | Email verification is announced but not implemented | detected | Verify current routes/status copy |
| BUG-OPS-01 | critical | installer | Root `setup.bat` does not invoke offline release flow | detected | `setup.bat`, `offline-release/setup.bat` |
| BUG-OPS-04 | critical | release | Stale `Sistema-Caja-Hospitalaria-RC1.zip` and `offline-release.rar` confuse release path | detected | Root release artifacts |
| BUG-OPS-08 | critical | autostart | Windows autostart not invoked by root setup | detected | `scripts/install_stack_autostart_windows.ps1`, setup scripts |
| BUG-OPS-26 | critical | docs/release | Release notes mojibake | detected | Locate release notes |
| BUG-OPS-38 | critical | Windows tasks | Scheduler registration can run as SYSTEM with excessive privilege | detected | `scripts/register_scheduler_cron.ps1` |
| BUG-OPS-46 | critical | release status | Handoff is not production-ready; physical proofs pending | requires_physical_validation | Must not mark `PRODUCTION_READY` without real evidence |
| BUG-QA-20 | critical | session/CSRF | 401 session expiry does not invalidate CSRF/session cache | detected | `frontend/src/app/useHospitalSession.ts`, `frontend/src/lib/api/base.ts` |

### High

| ID | Severity | Area | Summary | Initial status | Evidence target / notes |
| --- | --- | --- | --- | --- | --- |
| BUG-BA-01 | high | payments | Payment may use another cashier's cash session | detected | Feature tests/actions |
| BUG-BA-02 | high | cash/payments | Cross-session collection and reconciliation mismatch | detected | Fold with BUG-BA-22 if same root |
| BUG-BA-03 | high | payments | Negative refund/reversal without permission | detected | `VoidPaymentAction` |
| BUG-BA-04 | high | idempotency | No Idempotency-Key protection for critical creates | detected | Invoice/payment endpoints |
| BUG-BA-11 | high | fiscal | Fiscal sequence editable without sufficient audit | detected | Fiscal settings controllers/tests |
| BUG-BA-13 | high | invoice reverse | Nested transactions in reverse action | detected | `ReverseInvoiceAction` |
| BUG-BA-18 | high | payments | Reverse lacks session scope check for payment | detected | `VoidPaymentAction`/reverse tests |
| BUG-BA-21 | high | cash | Double-open cash session relies on code + unique handling | detected | `OpenCashSessionAction` |
| BUG-BA-23 | high | cash | Missing cash-in/cash-out support | detected | Validate against product scope |
| BUG-BA-27 | high | reports | Category/area prorating can round incorrectly | detected | `ReportsTest`, report services |
| BUG-FE-02 | high | frontend forms | Money inputs lack hard min/max validation | detected | POS/payment forms |
| BUG-FE-03 | high | payment modal | Modal closes before showing 422 errors | detected | `PaymentModal` |
| BUG-FE-04 | high | patient | Patient name max length missing in UI | detected | `PatientStep` |
| BUG-FE-09 | high | polling | Duplicate polling in POS and cashbox | detected | hooks/views |
| BUG-FE-10 | high | realtime/session | Broadcast sync may leak or not resubscribe after login | detected | Locate broadcast hooks |
| BUG-FE-12 | high | keyboard | Ctrl+Enter can submit dangerous action from inputs | detected | keyboard shortcuts |
| BUG-FE-21 | high | printing | `react-to-print` can hang without timeout/recovery | detected | Receipt print path |
| BUG-FE-23 | high | open cash | Open session 422 not propagated to field | detected | `OpenSessionForm` |
| BUG-FE-28 | high | auth | Rate-limit UI relies on fragile string parsing | detected | `LoginView`, API error typing |
| BUG-FE-29 | high | auth | Enter in login during countdown can resubmit | detected | `LoginView` |
| BUG-FE-35 | high | branding/receipt | Receipt hospital name bypasses display sanitizer | detected | `ReceiptPreview` |
| BUG-DB-02 | high | catalog | `services.category_id` delete behavior can block catalog ops | detected | Migration/model policy |
| BUG-DB-03 | high | money | Rounding uses `+50` before division and may bias cents | detected | `CalculateInvoiceTotalsAction` |
| BUG-DB-04 | high | migration | Receipt width down migration not idempotent | detected | Locate migration |
| BUG-DB-07 | high | reports | Prorating uses SQL ROUND on integer facts | detected | Report services |
| BUG-DB-16 | high | catalog | Unique `(category_id, area_id NULL, slug)` permits duplicates in MySQL | detected | Service migration/request tests |
| BUG-DB-11 | high | RBAC/area | Area role can lack valid area scope | detected | Confirm request/model behavior |
| BUG-SEC-04 | high | discounts | Erythropoietin free rule relies on cashier flag/weak proof | detected | Request/action/permissions |
| BUG-SEC-05 | high | auth | Weak password policy/admin autoassignment concerns | detected | Auth/user controller |
| BUG-SEC-06 | high | RBAC | Missing policies beyond invoice/cash session | detected | `app/Policies`, requests |
| BUG-SEC-07 | high | upload | Logo upload validates extension rather than real MIME/signature | detected | Fiscal/institution settings |
| BUG-SEC-08 | high | lockout | IP lockout can block legitimate LAN users | detected | Auth controller |
| BUG-SEC-11 | high | discounts | Duplicate of BUG-SEC-04 | detected | Consolidate with SEC-04 |
| BUG-SEC-16 | high | license | License salt fallback hardcoded | detected | `LicenseHelper` |
| BUG-SEC-17 | high | RBAC | Policies registered but not invoked in actions/requests | detected | Controllers/FormRequests |
| BUG-SEC-22 | high | cash | Closing another cashier's cash session may be allowed | detected | Reproduce `CloseCashSessionAction` |
| BUG-SEC-25 | high | fiscal data | Cajero can receive sensitive fiscal sequence fields | detected | Invoice show/resources |
| BUG-SEC-27 | high | Sanctum/CSRF | API/web middleware CSRF interplay may cause 419 after session expiry | detected | API client/backend config |
| BUG-SEC-30 | high | admin users | User index not paginated | detected | `UserController` |
| BUG-SEC-33 | high | CORS | Permissive methods/headers/origins risk | detected | `backend/config/cors.php` |
| BUG-RPT-02 | high | receipts | Reprint lacks visible `COPIA - REIMPRESION` mark | detected | Receipt action/UI/PDF |
| BUG-RPT-03 | high | branding | `APP_NAME`/backup/mail can leak legacy product name | detected | Env/docs/backup headers |
| BUG-RPT-05 | high | timezone | Backend timezone hardcoded UTC | detected | `backend/config/app.php` |
| BUG-RPT-06 | high | reports UX | Report filters do not persist in URL | detected | `ReportsView` |
| BUG-RPT-07 | high | reports | Date defaults depend on UTC | detected | Requests/services |
| BUG-RPT-10 | high | receipts | Reprint reason missing from payload/output | detected | `ReprintReceiptAction` |
| BUG-RPT-11 | high | receipts | Voided invoices lack visual `ANULADA` mark | detected | `ReceiptPreview`, PDFs |
| BUG-RPT-15 | high | reports | PDF/Excel footers use wrong timezone | detected | Export services |
| BUG-OPS-02 | high | autostart | Production stack does not clearly survive reboot | detected | scripts/docs |
| BUG-OPS-05 | high | prod compose | Dev compose can be mistaken for production with debug/dev secrets | detected | `docker-compose.yml`, docs |
| BUG-OPS-09 | high | scheduler | Duplicate scheduler mechanisms | detected | compose/scripts |
| BUG-OPS-12 | high | license env | `HOSPITAL_LICENSE_SALT` not written to root env by deploy | detected | deploy scripts |
| BUG-OPS-13 | high | secrets | Root env dev credentials may be preserved | detected | env examples/deploy |
| BUG-OPS-17 | high | backup UX | Backup hour default lacks operator feedback | detected | docs/UI/scripts |
| BUG-OPS-18 | high | backup | Backups only local; off-site/USB process missing or weak | detected | docs/scripts |
| BUG-OPS-19 | high | maintenance | Log pruning not validated | detected | scripts/docs |
| BUG-OPS-22 | high | training | Cashier manual lacks contingency coverage | detected | docs/manuals |
| BUG-OPS-23 | high | training | Admin manual lacks backup/restore cycle | detected | docs/manuals |
| BUG-OPS-29 | high | installer | Root setup requires internet/manual dependency install | detected | `setup.bat` |
| BUG-OPS-33 | high | HTTPS | Local CA/HTTPS path unclear | detected | docs/nginx |
| BUG-OPS-37 | high | scripts | ExecutionPolicy Bypass without adequate warning | detected | PowerShell scripts/docs |
| BUG-OPS-39 | high | Windows tasks | Backup tasks run as current user without clear privilege model | detected | `install_backup_tasks_windows.ps1` |
| BUG-QA-01 | high | duplication | `moneyLabel` duplicated | detected | Frontend reports/cash files |
| BUG-QA-02 | high | duplication | `formatDate` duplicated | detected | Frontend files |
| BUG-QA-08 | high | CI | Duplicate CI smoke step | detected | `.github/workflows` if present |
| BUG-QA-12 | high | E2E | Real E2E not run in CI by default | detected | CI/playwright configs |
| BUG-QA-14 | high | tests | Critical components lack tests | detected | Listed frontend components |
| BUG-QA-15 | high | concurrency | Fiscal concurrency test not enabled in real MariaDB gate | detected | Tests/CI/scripts |
| BUG-QA-16 | high | tests | Missing test: cannot close cash session with pending/partial invoices | detected | `CashPaymentsReceiptTest` |
| BUG-QA-19 | high | lint/a11y | jsx-a11y threshold allows warnings | detected | ESLint config |

### Medium / Low / Requires Confirmation

Medium and low items from the source report are tracked as grouped work until reproduced individually:

| Group | Severity | Area | Summary | Initial status |
| --- | --- | --- | --- | --- |
| MED-MONEY | medium | money/calculation | BA-15, BA-28, DB-06, DB-08, DB-19 and related money/date/audit index concerns | detected |
| MED-PAYMENTS | medium | payments/cash | BA-05, BA-06, BA-07, BA-09, BA-25, BA-33 and related deadlock/scope/denomination concerns | detected |
| MED-REPORTS | medium | reports/export | RPT-08, RPT-09, RPT-13, RPT-14, RPT-17, RPT-19, RPT-20, RPT-21, RPT-24 | detected |
| MED-FRONTEND | medium | UX/frontend | FE-05, FE-06, FE-07, FE-11, FE-13, FE-14, FE-15, FE-16, FE-18, FE-19, FE-22, FE-24, FE-25, FE-26, FE-27, FE-30, FE-31, FE-32, FE-36 | detected |
| MED-SECURITY | medium | security | SEC-09, SEC-10, SEC-12, SEC-14, SEC-15, SEC-18, SEC-19, SEC-20, SEC-24, SEC-26, SEC-29, SEC-31, SEC-35, SEC-36, SEC-37, SEC-38, SEC-39 | detected |
| MED-OPS | medium | operations | OPS-06, OPS-09, OPS-10, OPS-15, OPS-16, OPS-20, OPS-21, OPS-24, OPS-25, OPS-27, OPS-28, OPS-30, OPS-31, OPS-34, OPS-35, OPS-40, OPS-41, OPS-42, OPS-43, OPS-44 | detected |
| MED-QA | medium | QA | QA-04, QA-05, QA-07, QA-13, QA-17, QA-18, QA-21 | detected |
| LOW-NITS | low | misc | DB/BA/FE/RPT/OPS/QA low-severity issues listed in the source report | detected |
| RC-CONFIRM | medium | confirmation | BA-08, BA-16, BA-20, BA-26, BA-33, BA-37, DB-11, DB-20, SEC-22, SEC-23, RPT-23, RPT-24, OPS-32, OPS-45 | detected |

## Baseline Results

Recorded before remediation changes, on branch `codex/audit-fix`.

| Command | Result | Notes |
| --- | --- | --- |
| `git switch -c codex/audit-fix` | PASS | Branch created from current `main` HEAD. Existing untracked files were not touched: `backend/build/`, `backend/storage/framework/testing-production-proofs-empty/`; later `docs/superpowers/plans/2026-06-09-p2-audit-completion.md` appeared untracked and remains untouched. |
| `docker compose up -d` | FAIL | Default host port `3306` occupied: `ports are not available`. |
| `$env:DB_PORT='3307'; docker compose up -d` | PARTIAL | MySQL/frontend started. Backend initially exited because local image lacked `composer`. |
| `$env:DB_PORT='3307'; docker compose build backend` | PASS | Rebuilt backend image; Dockerfile copied `composer` from `composer:2`. |
| `$env:DB_PORT='3307'; docker compose up -d backend` | PASS | Backend started on `0.0.0.0:8000`. Startup ran `composer install`; composer warned lock file is stale and removed `phpstan/phpstan`, `larastan/larastan`, `iamcal/sql-parser`. |
| `$env:DB_PORT='3307'; docker compose exec -T backend php artisan migrate --seed` | PASS | No pending migrations. Seeders ran: roles/permissions, service catalog, development validation users. |
| `$env:DB_PORT='3307'; docker compose exec -T backend php artisan test --colors=never` | FAIL | 159 passed, 24 failed, duration 439.80s. Failures concentrated in `ProductionSpaRouteTest`, `ReportsTest`, `ServiceCatalogTest`, and `SystemStatusTest`. Several failures are HTTP 500s in reports/PDF/export paths; catalog create expected 201 but received 422 requiring `area_id`; physical proof tests disagree on evidence status/messages. |
| `$env:DB_PORT='3307'; docker compose exec -T backend vendor/bin/pint --test` | FAIL | 172 files checked, 5 style issues: `FiscalSettingsController.php`, `UserController.php`, `StoreUserRequest.php`, `routes/web.php`, `BackupWorkflowTest.php`. |
| `$env:DB_PORT='3307'; docker compose exec -T backend vendor/bin/phpstan analyse` | FAIL | `vendor/bin/phpstan` missing after composer install. |
| `$env:DB_PORT='3307'; docker compose exec -T frontend npm run typecheck` | PASS | TypeScript check passed. |
| `$env:DB_PORT='3307'; docker compose exec -T frontend npm run lint -- --max-warnings=0` | PASS | ESLint passed, despite a11y rules still configured as `warn` in config. |
| `$env:DB_PORT='3307'; docker compose exec -T frontend npm run test` | PASS WITH WARNINGS | 10 files, 45 tests passed. Warnings: repeated React `act(...)` warnings in `App.test.tsx`/`ReportsView.test.tsx`; duplicate React key `9` in backup view test path. |
| `$env:DB_PORT='3307'; docker compose exec -T frontend npm run build` | FAIL | `TS2688: Cannot find type definition file for 'vitest-axe/extend-expect'`; `tsconfig.json` references a missing type package. |
| `$env:DB_PORT='3307'; docker compose exec -T frontend npm run e2e` | FAIL | Playwright tests found, but Chromium executable is missing in container cache; requires browser installation or prebundled image. No functional E2E result yet. |

## 2026-06-09 Phase Notes

### P2 cash/session fixes

Scope covered in this subphase:

- `BUG-BA-22`: fixed for cash reconciliation by including pending invoices that either belong to the session or have posted payments collected by the session.
- `BUG-BA-02`: fixed for the same root case where a collector session receives a partial payment for an invoice issued in another session.
- `BUG-QA-16`: fixed by adding a regression test that blocks closing the collecting cash session while that cross-session partial invoice still has a pending balance.
- `BUG-QA-20`: fixed for frontend session cache invalidation by clearing the API client's cached session when the expiration event fires.

Decision notes:

- Cash reconciliation now treats posted payments in the reviewed cash session as operational responsibility for unresolved invoices, even when the original invoice was opened in another session.
- The frontend session hook invalidates cached API session state before showing the expired-session state, reducing confusing retries after 401/419 in LAN use.
- `docs/DECISIONS.md` could not be updated in this subphase because the current file contains non-UTF-8 bytes and `apply_patch` refused to load it. Correct that encoding issue as a separate documentation hygiene phase before appending more decisions there.

Verification:

```text
docker compose exec -T backend php artisan test --colors=never --filter=CashPaymentsReceiptTest
docker compose exec -T backend php artisan test --colors=never --filter=BroadcastingWiringTest
docker compose exec -T backend php artisan test --colors=never --filter=AuditLogTest
docker compose exec -T frontend npm run test -- useHospitalSession.test.tsx
docker compose exec -T backend vendor/bin/pint --test
docker compose exec -T frontend npm run typecheck
docker compose exec -T frontend npm run build
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\check-branding.ps1
```

Current caveats:

- Full frontend lint exits successfully but still reports pre-existing warnings when run through the project script.
- Full backend suite was not rerun in this subphase; baseline failures remain tracked above until addressed by their own fixes.
