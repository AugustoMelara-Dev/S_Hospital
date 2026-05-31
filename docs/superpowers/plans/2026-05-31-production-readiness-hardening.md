# Production Readiness Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the remaining blockers that keep S_Hospital at `PRODUCTION_CANDIDATE` and move it toward a production-ready offline LAN delivery.

**Architecture:** Keep Laravel as the source of truth for money, invoice scope, reports, backups, and audit. Keep React as an operator-focused client that previews data but does not authorize or finalize financial facts. Production delivery must use a locked offline package, local MariaDB/MySQL, safe backup automation, and evidence from final hardware.

**Tech Stack:** Laravel 12, Sanctum session auth, Spatie Permission, MySQL/MariaDB, React 19, TypeScript, Vite, TanStack Query, React Hook Form/Zod, Docker Compose, Windows PowerShell/CMD deployment scripts.

---

## Audit Summary

Current status: **PRODUCTION_CANDIDATE, not PRODUCTION_READY**.

The system already has substantial backend domain code, frontend modules, tests, documentation, backups, release scripts, and QA evidence. The remaining work is concentrated in production hardening: test reliability, least-privilege authorization, zero-total invoice audit semantics, receipt printing/audit, scanner authority, report precision/performance, backup retention, offline release packaging, and final field evidence.

## Evidence Collected

- `docker compose ps`: backend, frontend, and MariaDB containers are running.
- `docker compose exec -T frontend npm run typecheck`: passed.
- `docker compose exec -T frontend npm run lint`: passed.
- Frontend auditor also ran `npm.cmd run test`: passed, 10 files / 45 tests.
- `composer validate`: not runnable from host because `composer` is not on Windows PATH.
- `docker compose exec -T backend php artisan test --colors=never --stop-on-failure`: failed in `Tests\Feature\CashPaymentsReceiptTest`.
- `docker compose exec -T backend php artisan test --colors=never tests/Feature/CashPaymentsReceiptTest.php`: failed 5 tests when run as a class.
- `docker compose exec -T backend php artisan test --colors=never --filter test_payment_requires_an_open_own_cash_session`: passed in isolation.
- Existing unstaged changes were present before this audit in `qa/screenshots`, `qa/visual-smoke/phase-12-visual-smoke.mjs`, backup scripts, and `backend/tests/Feature/ReportsTest.php`. Do not revert them.

## Current Gate Failure

The backend class `backend/tests/Feature/CashPaymentsReceiptTest.php` has order-dependent failures. Individual tests pass, but the full class returns 403/500 during `openSession()` calls. This points to test isolation around Spatie permission/cache state and/or a prior expected database exception leaving framework state dirty. Fix this before claiming backend gate health.

## Plan Review Orchestrator Result

Decision: **APPROVED WITH REQUIRED CHANGES** for implementation.

Production readiness decision: **BLOCKED** until field validation is complete on the final server, LAN client, MariaDB restore target, and physical 80mm/58mm printer.

| Reviewer | Severity | Finding | Recommendation |
| --- | --- | --- | --- |
| Architecture and maintainability | High | `InvoiceAccess` grants operational invoice access via broad view/report/reprint permissions. | Add explicit operational permission for paying/voiding any invoice. Keep view/reprint historical access separate. |
| Database and transactions | High | Zero-total invoices can become `paid` without a payment/cash/audit fact. | Introduce a formal zero-amount payment/waiver audit path or a non-paid `waived` status with tests. |
| Security and privacy | Medium | Full fiscal settings endpoint is public while the API contract says it needs `settings.fiscal.view`. | Protect full settings. Add a narrow public branding endpoint only if login needs it. |
| Cashier UX | High | Thermal 80mm/58mm receipt requirement is not exposed in frontend receipt paper sizes. | Add 80mm and 58mm paper sizes end to end and validate print CSS. |
| Performance and local scale | Medium | Global frontend request queue serializes read-only GET/report calls. | Keep CSRF/mutation ordering, allow concurrent GET requests. |
| Offline LAN and backups | Blocking | Offline release backup automation calls `php artisan` from a package that lacks `backend/artisan`; retention is missing. | Make release backup automation Docker-based or include the runnable app, fail preflight hard, add retention/prune. |
| TDD and QA | High | Backend gate is unstable when `CashPaymentsReceiptTest` runs as a class. | Fix test isolation first and rerun backend gate. |
| Hospital billing domain | High | Reprint audit can be bypassed from "Ver recibo"; scanner fallback can use cached service data when backend lookup fails. | Route printing through audited reprint intent where needed; remove scanner fallback that weakens backend authority. |

## Phase 13A0 - Stabilize Backend Gate and Permission Test Isolation

**Scope**

Fix the current order-dependent backend test failures without changing business behavior. This phase exists so later financial/security fixes are measured against a stable gate.

**Expected files**

- Modify: `backend/tests/TestCase.php`
- Modify if needed: `backend/tests/Feature/CashPaymentsReceiptTest.php`
- Modify if needed: `backend/database/seeders/RolesAndPermissionsSeeder.php`
- Document: `docs/DECISIONS.md`

**Migrations**

- None.

**Tests**

- `docker compose exec -T backend php artisan test --colors=never tests/Feature/CashPaymentsReceiptTest.php`
- `docker compose exec -T backend php artisan test --colors=never --stop-on-failure`
- If full suite is slow, run targeted suites first: `CashPaymentsReceiptTest`, `ReportsTest`, `BackupWorkflowTest`, `FiscalSettingsTest`.

**Risks**

- Hiding a real permission regression by over-clearing auth state.
- Making tests pass only for SQLite while MySQL remains different.

**Acceptance criteria**

- `CashPaymentsReceiptTest` passes as a full class.
- The main backend suite no longer fails on the current 403/500 permission/cache issue.
- No production behavior is changed.

**Commit**

- `test(backend): stabilize permission test isolation`

## Phase 13A1 - Least-Privilege Invoice Operations and Fiscal Settings Exposure

**Scope**

Harden backend authorization for invoice operations and close public exposure of full fiscal settings.

**Expected files**

- Modify: `backend/app/Support/InvoiceAccess.php`
- Modify: `backend/database/seeders/RolesAndPermissionsSeeder.php`
- Modify: `backend/routes/api.php`
- Modify: `backend/app/Http/Controllers/FiscalSettingsController.php`
- Add or modify: `backend/tests/Feature/FiscalSettingsTest.php`
- Add or modify: `backend/tests/Feature/CashPaymentsReceiptTest.php`
- Document: `docs/API_CONTRACTS.md`
- Document: `docs/PERMISSIONS_MATRIX.md`
- Document: `docs/DECISIONS.md`

**Migrations**

- None expected. New permissions can be added via seeder unless the project standard changes.

**Tests**

- A user with `reports.managerial.view` but without explicit operational permission cannot pay another cashier invoice.
- A user with `receipts.reprint_any` but without explicit operational permission cannot pay another cashier invoice.
- Admin/supervisor with explicit operational permission can perform intended elevated operation.
- Guest cannot fetch full `/api/settings/fiscal`.
- Login/branding screen still has only the public fields it needs through a narrow endpoint.

**Risks**

- Breaking login branding if the frontend currently depends on public full fiscal settings.
- Breaking supervisor workflows if roles are not mapped carefully.

**Acceptance criteria**

- Payment/create/list/void authorization uses an explicit operation scope.
- Full fiscal settings require authentication and permission.
- Public branding response contains no CAI/ranges/internal settings unless explicitly intended.

**Commit**

- `fix(security): tighten invoice operation scope`

## Phase 13A2 - Zero-Total Invoice Financial Audit Semantics

**Scope**

Resolve the conflict between the dialysis/eritropoyetina free rule and the invariant that paid invoices must have cashbox, cashier, payment method, and date.

**Expected files**

- Modify: `backend/app/Actions/Billing/CreateInvoiceAction.php`
- Modify if needed: `backend/app/Actions/Payments/RegisterPaymentAction.php`
- Modify: `backend/app/Actions/Receipts/GenerateReceiptDataAction.php`
- Modify: `backend/app/Models/Payment.php`
- Modify: `backend/tests/Feature/CashPaymentsReceiptTest.php`
- Modify: `frontend/src/features/invoices/components/InvoiceSuccess.tsx`
- Modify: `frontend/src/features/receipts/ReceiptPreview.tsx`
- Document: `docs/FISCAL_RULES.md`
- Document: `docs/DECISIONS.md`

**Migrations**

- Only if the current `payments.method` validation/storage cannot represent a zero-amount audited method such as `waiver`, `exempt`, or `dialysis_prescription`.

**Tests**

- Zero-total dialysis prescription invoice produces an auditable payment-equivalent fact or an explicitly audited non-payment state.
- Receipt shows the zero-total reason clearly.
- Cash reconciliation does not inflate cash expected amount.
- Reports do not count zero-total waiver as collected revenue.
- Paid invoice invariant is either preserved or documented as replaced by a stricter `paid_or_waived` invariant.

**Risks**

- Fiscal ambiguity if zero-total invoices are marked `paid` without actual payment.
- Report totals can drift if waiver facts are counted as income.

**Acceptance criteria**

- No zero-total invoice silently becomes paid without an audit trail.
- Cashbox/cashier/date/reason are traceable.
- Reports and receipts distinguish collected money from waived/free services.

**Commit**

- `fix(billing): audit zero total invoice settlement`

## Phase 13B - Receipt Printing and Reprint Audit Hardening

**Scope**

Implement true 80mm/58mm receipt sizing in the frontend and prevent unaudited reprint/print paths from invoice history.

**Expected files**

- Modify: `frontend/src/lib/api/types.ts`
- Modify: `frontend/src/features/receipts/ReceiptPreview.tsx`
- Modify: `frontend/src/features/invoices/NewInvoiceView.tsx`
- Modify: `frontend/src/features/invoices/InvoiceHistoryView.tsx`
- Modify: `frontend/src/styles.css`
- Modify: `frontend/src/features/invoices/NewInvoiceView.test.tsx`
- Modify if needed: `backend/app/Http/Requests/Fiscal/UpdateFiscalSettingsRequest.php`
- Modify if needed: `backend/tests/Feature/FiscalSettingsTest.php`
- Document: `docs/INSTITUTIONAL_RECEIPT_PRINT_VALIDATION.md`
- Document: `docs/DECISIONS.md`

**Migrations**

- None expected if `receipt_paper_size` is a string and already stores configurable values.

**Tests**

- `80mm` and `58mm` are accepted by settings and rendered by receipt preview.
- Print CSS uses fixed thermal widths and does not render as letter/half-letter.
- Invoice history "Ver recibo" cannot produce an unaudited reprint when printing a historical receipt.
- Reprint endpoint records audit and increments/records the reprint fact used by reports.

**Risks**

- Browser print behavior differs from physical printer behavior.
- Operators need preview without audit but print with audit; UI copy and event timing must be precise.

**Acceptance criteria**

- Thermal receipt requirement is visible and test-covered.
- Historical print action is audited.
- Physical printer validation remains an external final-server criterion.

**Commit**

- `fix(printing): support thermal receipts and audited reprints`

## Phase 13C - POS Scanner Authority and Frontend Money Handling

**Scope**

Ensure scanner/code lookup does not rely on stale frontend service data after backend lookup failure. Reduce cashier-visible floating point money calculations.

**Expected files**

- Modify: `frontend/src/features/invoices/NewInvoiceView.tsx`
- Modify: `frontend/src/features/invoices/components/PaymentModal.tsx`
- Modify: `frontend/src/schemas/invoice.schema.ts`
- Modify: `frontend/src/lib/api/catalog.ts`
- Modify: `frontend/src/features/invoices/NewInvoiceView.test.tsx`
- Modify: `frontend/src/features/invoices/components/PaymentModal.test.tsx` if created
- Document: `docs/DECISIONS.md`

**Migrations**

- None.

**Tests**

- Scanner code found by backend adds the service.
- Scanner code not found by backend shows a clear error and does not add cached local service.
- Backend error during scanner lookup does not add service from local cache.
- Payment modal handles decimal-string values and computes change/display safely.
- Backend remains final authority for saved amount.

**Risks**

- Removing fallback can reveal backend search gaps that cashiers currently do not notice.
- Decimal helper changes can affect UI edge cases around partial payments.

**Acceptance criteria**

- Scanned service additions are backend-authoritative.
- UI money display no longer depends on casual `parseFloat`/`toFixed` paths for cashier decisions.

**Commit**

- `fix(pos): enforce backend scanner authority`

## Phase 13D - Reports Precision, Performance, and Operator UX

**Scope**

Move remaining report allocation away from in-memory float math and improve report filters for real operators.

**Expected files**

- Modify: `backend/app/Actions/Reports/IncomeReportService.php`
- Modify: `backend/app/Actions/Reports/FinancialFactsService.php`
- Modify: `backend/tests/Feature/ReportsTest.php`
- Modify: `frontend/src/features/reports/ReportsView.tsx`
- Modify: `frontend/src/features/reports/components/IncomeReportTab.tsx`
- Modify: `frontend/src/features/reports/components/CashSessionReportTab.tsx`
- Modify: `frontend/src/lib/api/reports.ts`
- Modify: `frontend/src/features/reports/ReportsView.test.tsx`
- Document: `docs/DECISIONS.md`

**Migrations**

- Add indexes only if query plans show slow filters on realistic data. Candidate indexes: `payments(status, paid_at, method)`, `payments(user_id, paid_at)`, `payments(cash_session_id, paid_at)`, `invoice_items(area_name)`, `invoice_items(category_name)`.

**Tests**

- Report totals match integer cent facts.
- Partial payments allocate deterministically with no penny drift across categories/areas/services.
- Filters by cajero/caja use operator-friendly selectors, not only raw IDs.
- Export still requires `reports.export`.
- Cash-session-only users remain scoped to permitted sessions.

**Risks**

- Existing report tests may encode old float allocation behavior.
- SQL can become hard to maintain if over-optimized.

**Acceptance criteria**

- Backend is authoritative for report totals.
- Report UI is usable by supervisors without knowing numeric IDs.
- Performance-sensitive reports stay date-range filtered.

**Commit**

- `fix(reports): use cent based financial facts`

## Phase 13E - API Layer Concurrency and Session UX

**Scope**

Allow read-only API calls to run concurrently and show mandatory password-change errors directly on screen.

**Expected files**

- Modify: `frontend/src/lib/api/base.ts`
- Modify: `frontend/src/lib/api/base.test.ts`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/app/useHospitalSession.ts`
- Modify: `frontend/src/features/auth/PasswordChangeView.tsx`
- Modify: `frontend/src/App.test.tsx`

**Migrations**

- None.

**Tests**

- GET requests can run in parallel.
- Mutating requests still prepare CSRF and remain safe.
- 401/419 still trigger session expiration handling.
- Password-change failure displays actionable inline feedback.
- Password-change success transitions to normal app flow.

**Risks**

- Removing the global request chain incorrectly can reintroduce CSRF races for mutations.
- Session-expired handling must stay centralized.

**Acceptance criteria**

- Dashboard/report loads are not serialized by default.
- Temporary-password users see success and error messages in the password-change view.

**Commit**

- `fix(frontend): improve api concurrency and password feedback`

## Phase 13F - Backup Retention, Scheduler Contract, and Release Automation

**Scope**

Make backups production-safe: scheduled, retained, verifiable, restorable, and runnable from the offline package.

**Expected files**

- Modify: `backend/app/Actions/Backups/CreateBackupAction.php`
- Add: `backend/app/Actions/Backups/PruneBackupsAction.php`
- Add or modify: `backend/app/Console/Commands/*Backup*`
- Modify: `backend/routes/console.php`
- Modify: `backend/tests/Feature/BackupWorkflowTest.php`
- Modify: `scripts/run_backup_scheduler_loop.ps1`
- Modify: `scripts/run_backup_worker.cmd`
- Modify: `scripts/run_scheduled_backup.cmd`
- Modify: `scripts/start_backup_automation.cmd`
- Modify: `offline-release/scripts/install_backup_tasks_windows.ps1`
- Modify: `offline-release/scripts/deploy_hospital_lan.ps1`
- Modify: `offline-release/docker-compose.prod.yml`
- Document: `docs/BACKUP_RESTORE.md`
- Document: `docs/manuales/GUIA_RESPALDOS_Y_RESTAURACION.md`
- Document: `docs/DECISIONS.md`

**Migrations**

- Optional: add retention metadata to `backup_logs` only if existing columns cannot record prune/verification facts.

**Tests**

- Backup prune keeps latest successful backups according to configured count/days.
- Failed backups are not the only retained recovery point.
- Disk-space guard blocks unsafe backup attempts with operator-safe error.
- Production backup scheduler command works from offline release structure.
- Installer/preflight fails hard if backup automation cannot be installed/proven.

**Risks**

- Pruning must never delete the only restorable backup.
- Windows scheduled task behavior differs by privilege level.
- Docker-based commands must not require internet after installation.

**Acceptance criteria**

- Startup method implemented and documented.
- Backup schedule and retention are explicit.
- Restore test process is documented and repeatable against a disposable DB.
- Operator docs explain backup status without technical jargon.

**Commit**

- `fix(backups): add retention and release scheduler`

## Phase 13G - Production Installer Split and Artifact Lock

**Scope**

Separate dev setup from production install, regenerate offline release artifacts from the current commit, and ensure archives do not include `.env`, logs, backups, or stale evidence.

**Expected files**

- Modify: `setup.bat`
- Modify: `docker-compose.yml`
- Modify or add: `devex/docker-compose.example.yml`
- Modify: `offline-release/MANIFEST.txt`
- Modify: `offline-release/docker-compose.prod.yml`
- Modify: `scripts/final_production_handoff.ps1`
- Modify: `scripts/production_readiness_preflight.ps1`
- Document: `docs/OFFLINE_LAN_INSTALL.md`
- Document: `docs/INSTALL_SUMMARY.md`
- Document: `qa/RELEASE_READINESS.md`
- Document: `docs/DECISIONS.md`

**Migrations**

- None.

**Tests**

- Root setup clearly states dev-only or delegates to production installer.
- Production compose uses `APP_ENV=production`, `APP_DEBUG=false`, built frontend assets, no Vite dev server, no package installs at container startup.
- Release packaging check fails if `.env`, logs, SQL backups, `node_modules`, or local proof artifacts enter the archive.
- Manifest records commit hash and no stale "must regenerate" note.

**Risks**

- Changing installer UX can disrupt existing local demos.
- Release regeneration may require local Docker image export time and disk space.

**Acceptance criteria**

- Dev and production setup paths are unambiguous.
- Offline release is reproducible and locked.
- No production instructions rely on internet at runtime.

**Commit**

- `chore(release): lock offline production artifact`

## Phase 13H - Final Evidence Cleanup and Field Validation

**Scope**

Clean stale/contradictory QA evidence and produce final-server validation artifacts.

**Expected files**

- Modify: `qa/FINAL_PRODUCTION_HANDOFF_RESULT.md`
- Modify: `qa/RELEASE_READINESS.md`
- Modify: `qa/LAN_CLIENT_VALIDATION_PROOF.md`
- Modify: `qa/FINAL_RESTORE_PROOF.md`
- Modify: `qa/FINAL_CONCURRENCY_PROOF.md`
- Modify: `qa/INSTITUTIONAL_RECEIPT_PRINT_PROOF.md`
- Modify: `docs/KNOWN_LIMITATIONS.md`
- Add: `worklogs/YYYY-MM-DD-production-field-validation.md`

**Migrations**

- None.

**Tests**

- Final server `.env`: `APP_ENV=production`, `APP_DEBUG=false`, real `APP_URL`, CORS/Sanctum stateful domains for LAN.
- Final server: `/up`, `/login`, `/verify-email` respond correctly.
- Physical LAN client can log in by server IP/name.
- Physical 80mm and 58mm printer validation completed.
- Restore validation completed against disposable DB on final or equivalent hardware.
- Backup worker and scheduled backup proven after reboot/login as applicable.

**Risks**

- This phase depends on external hardware and the final installation environment.
- It cannot be truthfully completed inside the current dev workspace alone.

**Acceptance criteria**

- QA files no longer contradict each other.
- Any missing physical validation remains explicitly `PENDING_*`.
- System can be called `PRODUCTION_READY` only after all final-field evidence is attached.

**Commit**

- `docs(release): finalize production evidence`

## Global Quality Gate

Run after each phase when relevant:

```powershell
docker compose exec -T backend php artisan test --colors=never
docker compose exec -T backend vendor/bin/pint --test
docker compose exec -T frontend npm run typecheck
docker compose exec -T frontend npm run lint
docker compose exec -T frontend npm run test
docker compose exec -T frontend npm run build
```

Run before release candidate:

```powershell
docker compose exec -T backend php artisan config:cache --no-ansi
docker compose exec -T backend php artisan config:clear --no-ansi
docker compose exec -T frontend npm run e2e
docker compose exec -T frontend npm run smoke:real
```

Destructive or mutating production-like validation must require explicit disposable target confirmation and a backup first.

## Implementation Order

1. 13A0 test isolation.
2. 13A1 least-privilege and fiscal settings.
3. 13A2 zero-total audit semantics.
4. 13B receipt printing and reprint audit.
5. 13C scanner authority and frontend money handling.
6. 13D report precision and UX.
7. 13E API concurrency and password-change UX.
8. 13F backup retention and release scheduler.
9. 13G installer split and artifact lock.
10. 13H final field evidence.

## Stop Conditions

- Do not mark any phase complete if its tests fail.
- Do not run destructive reset or restore against production data.
- Do not edit or revert unrelated unstaged files.
- Do not declare `PRODUCTION_READY` without final hardware/LAN/printer/restore evidence.
- Commit one coherent phase at a time using Conventional Commits.
