# V1.1 Production Polish QA Report

Branch: `codex/v1-1-production-polish`
Base SHA: `2e1949e6e1cccbccf8ae5c94a9472739fd0d14ac`
Status: in progress
Updated: 2026-06-25

## Scope Covered In This Pass

This report records the current digital QA evidence for the V1.1 production polish branch. It is not the final approval report and does not approve physical production.

Screens and flows covered by mocked Playwright evidence:

- Dashboard light/dark.
- Cashbox open.
- New invoice empty.
- New invoice with cart.
- Receipt preview letter-like legacy view.
- Receipt preview A5.
- Receipt preview dark.
- Reports admin light/dark.
- Institutional receipt settings light.
- Institutional receipt settings preview light/dark.
- Admin users light/dark.
- Backups pending.
- Access denied reports route.
- 404 route.

## Command

```powershell
cd C:\Projects\S_Hospital-v1-1-polish\frontend
$env:E2E_CAPTURE_RC_SCREENSHOTS='1'
$env:E2E_CAPTURE_RC_OUTPUT_DIR='..\qa\screenshots\v1-1-production-polish'
$env:E2E_CAPTURE_RC_REPORT_DIR='qa/screenshots/v1-1-production-polish'
npx.cmd playwright test e2e/production-readiness.spec.ts
```

Result:

- 4 Playwright tests passed.
- 0 Playwright failures.
- 18 screenshots captured.
- Browser console issues recorded by the mocked capture report: 0.

Build command:

```powershell
cd C:\Projects\S_Hospital-v1-1-polish\frontend
npm.cmd run build
```

Build result:

- Passed.
- `tsc --noEmit` completed.
- Vite production build completed.

Artifacts:

- `qa/screenshots/v1-1-production-polish/manifest.json`
- `qa/screenshots/v1-1-production-polish/rc-e2e-mocked-report.json`
- `qa/screenshots/v1-1-production-polish/*.png`

## Unit And Static Checks Run During V1.1 Slices

- `npm.cmd run test -- FiscalSettingsView.test.tsx --run`
- `npm.cmd run test -- InvoiceConfirmation.test.tsx --run`
- `npm.cmd run test -- receipt-settings --run`
- `npm.cmd test -- --run src/features/reports/ReportsView.test.tsx src/features/reports/components/IncomeReportTab.test.tsx src/features/reports/components/CashSessionReportTab.test.tsx`
- `npm.cmd run test -- NewInvoiceViewLayout.test.tsx InvoiceCart.test.tsx --run`
- `npm.cmd run typecheck`
- `npm.cmd run lint`

## Known Gaps

- This pass uses mocked API data; it does not prove Laravel/MySQL/MariaDB integration.
- It does not prove physical printer output.
- It does not prove a second LAN client can operate against the server.
- It does not prove backup restore in an isolated database.
- It does not prove concurrent LAN load.
- It does not yet cover every requested V1.1 screenshot name, including login light/dark, payment modal, invoice confirmation, invoice history, catalog, fiscal settings, help, about, mobile dashboard, mobile billing, and mobile reports.
- It does not replace final backend, E2E release, smoke buttons, axe, responsive, PDF digital, and security/RBAC gates required before internal approval.

## QA Assessment

The current evidence is useful for visual regression and screen review on the polished branch, especially for dashboard, POS cart, reports, receipt settings, users, backups, access denied, and 404 states. It is partial evidence only. V1.1 remains in progress until the final QA gate and full visual matrix are complete.
