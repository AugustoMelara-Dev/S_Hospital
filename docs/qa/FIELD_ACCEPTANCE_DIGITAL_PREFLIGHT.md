# S_Hospital V1.1 - Field Acceptance Digital Preflight

Date: 2026-06-25
Timezone: America/Tegucigalpa
Branch: `codex/field-acceptance-prep`
Verified main SHA: `ebc9018102b1940ebe8ba9b5bfd3107a2ef4b122`
Production physical approval: NO

## Scope

This preflight records what was executed from the current workstation before the hospital field operator runs physical acceptance. It does not approve go-live. The following gates still require real equipment and an operator:

- Second PC on the real LAN.
- Real physical printer and paper profiles.
- Disposable MySQL/MariaDB backup/restore in the operating environment.
- Real multi-client LAN load/concurrency.

## Main verification

Commands executed:

```powershell
git fetch origin
git branch --show-current
git status --short
git rev-parse main
git rev-parse origin/main
git log --oneline --decorate -n 15
```

Result: PASS.

- `main`: `ebc9018102b1940ebe8ba9b5bfd3107a2ef4b122`
- `origin/main`: `ebc9018102b1940ebe8ba9b5bfd3107a2ef4b122`
- Branch for package: `codex/field-acceptance-prep`
- Production code changes: none.

## Frontend validation

Command group executed from `frontend/`:

```powershell
npm run typecheck
npm run lint
npm run test
npm run build
npm run smoke:buttons
npm run test:e2e
```

Result: PASS.

Observed details:

- TypeScript: PASS.
- ESLint: PASS.
- Vitest: PASS, 82 test files and 487 tests.
- Build: PASS, Vite transformed 2698 modules and completed successfully.
- Button smoke: PASS, 7 browser viewport/button safety checks.
- Release E2E: PASS, 2 Playwright release tests.

Release E2E details:

- Disposable SQLite clone was used from the current migration hash.
- Laravel E2E backend became ready at `http://127.0.0.1:18081/api/system/health`.
- Vite E2E frontend became ready at `http://127.0.0.1:5174`.
- Tests:
  - Cashier can issue, collect, show receipt and surface reports: PASS.
  - Admin creates catalog-only user and RBAC navigation enforces module access: PASS.

## Backend validation

Command executed from repository root using the validated backend image:

```powershell
docker run --rm -v "C:\Projects\S_Hospital:/repo" -w /repo/backend s-hospital-v1-1-review-backend php artisan test --colors=never
```

Result: PASS.

- Tests: 707 passed.
- Skipped: 11.
- Assertions: 4672.
- Duration: 578.39s.

## PDF validation

Command executed:

```powershell
docker run --rm -v "C:\Projects\S_Hospital:/repo" -w /repo/backend s-hospital-v1-1-review-backend php artisan test --filter=InstitutionalReceiptPdfTest --display-warnings --colors=never
```

Result: PASS.

- Tests: 13 passed.
- Assertions: 171.
- Duration: 36.19s.

## MariaDB focal validation

Scope:

- `InstitutionalReceiptPdfTest`
- `CashPaymentsReceiptTest`
- `UserManagementTest`

Environment:

- Disposable Docker network.
- Disposable MariaDB 11.4.3 container.
- Disposable database name using `s_hospital_test_*`.
- Disposable golden database using `s_hospital_golden_*`.
- Resources removed after execution.

First attempt:

- Status: setup correction, not a product failure.
- Cause: invalid `--force` option was passed to `testing:prepare-golden-database`.
- Action: container/network cleaned up and command corrected.

Final command shape:

```powershell
vendor/bin/phpunit --configuration phpunit.mysql.xml --filter "InstitutionalReceiptPdfTest|CashPaymentsReceiptTest|UserManagementTest"
```

Result: PASS.

- Tests: 71.
- Assertions: 614.
- Duration: 01:24.077.
- Migration hash: `4f4f0cd342534b5c0261237777705c75d7887a77abf16d58763b9fdb0dbfdccd`.

## Local digital evidence

Evidence directory:

`qa/field-acceptance/digital-screenshots/`

Result: GENERATED WITH LIMITS.

Files created:

- Release E2E PASS log: `release-e2e-capture.log`.
- Mocked capture log: `production-readiness-capture-5175.log`.
- Mocked capture report: `rc-e2e-mocked-report.json`.
- PNG screenshots for login, dashboard, billing, payment modal, invoice confirmation, cashbox, receipt preview, access denied, 404 and mobile views.

Important limit:

- The official release E2E gate passed.
- The mocked screenshot run produced useful PNG evidence, but one capture scenario timed out while selecting the A5 receipt option; three other mocked scenarios passed.
- These mocked screenshots are visual evidence only. They do not replace physical LAN, printer, restore or load acceptance.

## Physical gates

| Gate | Status | Reason |
| --- | --- | --- |
| Second PC LAN | PENDIENTE | Requires a real second PC on the hospital LAN. |
| PC1/PC2 synchronization | PENDIENTE | Requires two real clients and synthetic operator users. |
| Physical printer | PENDIENTE | Requires real printer, driver and paper. |
| Disposable restore | PENDIENTE | Requires operator-run disposable DB restore in the deployment environment. |
| Real LAN load | PENDIENTE | Requires multiple LAN clients or an agreed field load tool. |

## Decision

Digital preflight: PASS.

Physical production approval: NO.

Next action: the hospital operator must execute `docs/qa/FIELD_ACCEPTANCE_OPERATOR_GUIDE.md` and fill `docs/qa/FIELD_ACCEPTANCE_EXECUTION_LOG.md` with real evidence.
