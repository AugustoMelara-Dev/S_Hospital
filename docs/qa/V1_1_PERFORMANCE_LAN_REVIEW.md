# V1.1 Performance And LAN Offline Review

Branch: `codex/v1-1-production-polish`
Base SHA: `2e1949e6e1cccbccf8ae5c94a9472739fd0d14ac`
Status: APROBADO PARA MERGE INTERNO as digital performance review
Updated: 2026-06-25 independent review pass

## Scope

This review records the current frontend performance and LAN-readiness observations for the V1.1 polish branch. It is a digital review only. It does not approve physical LAN production, printer output, restore, or concurrent client load.

## Commands And Evidence

Build command:

```powershell
cd C:\Projects\S_Hospital-v1-1-polish\frontend
npm.cmd run build
```

Result in the independent review worktree:

- Passed.
- `tsc --noEmit` completed.
- Vite production build completed.
- No new runtime dependency was added in the review branch.

Mocked browser evidence:

```powershell
cd C:\Projects\S_Hospital-v1-1-polish\frontend
$env:E2E_CAPTURE_RC_SCREENSHOTS='1'
$env:E2E_CAPTURE_RC_OUTPUT_DIR='..\qa\screenshots\v1-1-production-polish'
$env:E2E_CAPTURE_RC_REPORT_DIR='qa/screenshots/v1-1-production-polish'
npx.cmd playwright test e2e/production-readiness.spec.ts
```

Result:

- 4 Playwright tests passed.
- 33 screenshots captured.
- 0 browser console issues in the mocked report.

## Build Size Snapshot

Largest generated asset groups from the review build:

| Asset group | Size | Gzip |
| --- | ---: | ---: |
| CSS | 74.49 kB | 13.65 kB |
| vendor | 348.15 kB | 109.28 kB |
| charts | 398.35 kB | 114.67 kB |
| index | 196.81 kB | 49.80 kB |
| ui | 159.79 kB | 48.57 kB |

Assessment: the reports/charts chunk remains the largest frontend cost and is expected for the report-heavy screens. Route lazy loading keeps admin, reports, backups, settings, help, support, and about from all loading in the initial cashier path.

## Review Timing Snapshot

- Full a11y matrix: 7 Playwright tests passed in 5.3m.
- Button/axe smoke: 7 Playwright tests passed in 3.5m.
- Production readiness: 4 Playwright tests passed in 58.1s.
- Release E2E: 2 Playwright specs passed in 66.2s.
- MariaDB focal: 71 backend tests passed in 85.0s.
- Backend full suite: exit code 0 in 566.1s.

## Current Architecture Observations

- Heavy operational routes are lazy-loaded through `frontend/src/AppRoutes.tsx`, including dashboard, catalog, invoice history, reports, backups, fiscal settings, institutional receipts, users, help, support, and about.
- The invoice and cashbox routes are kept direct because they are primary cashier workflows and need fast operational access.
- Recharts remains isolated in a separate chart chunk, which is appropriate for reports and dashboard-heavy views.
- The reports route is the largest feature chunk. This is expected because it contains charts, tables, tabs, filters, and executive/reporting panels.
- The build already separates reusable UI, forms, query, vendor, and charts code, reducing the chance that every LAN client pays for all modules on first route.

## LAN Offline Risks

- Real LAN behavior is still unproven without a second client PC against the server IP.
- The browser evidence uses mocked API data, so it does not measure Laravel/MySQL response time, slow reports, backup operations, or receipt/PDF generation.
- The chart and vendor chunks are acceptable for local wired/wifi LAN, but first-load behavior should still be verified on the actual lowest-spec cashier PC.
- Reports with large date ranges may still be limited by backend query shape, pagination, export size, and MySQL indexes rather than frontend bundle size.
- Receipt/PDF preview performance is not fully proven for 40, 100, or multipage item receipts.
- Backup creation/download responsiveness is not proven against real backup files.

## Recommended Next Measurements

- Run the final release gate with the Laravel API and MySQL/MariaDB stack, not only mocked Playwright.
- Measure `/billing/new`, `/reports`, `/invoices`, `/settings/institutional-receipts`, and receipt/PDF generation with seeded large datasets.
- Capture browser performance on a low-spec LAN client for first load, cached reload, route transitions, and report tab switching.
- Test report date ranges that produce large tables and charts.
- Test receipt preview/PDF generation with 1, 10, 40, and 100 items.
- Test backup creation and download against a realistic local backup file.
- Run a small LAN concurrency check with at least two client browsers creating/viewing invoices and reports against the same server.

## QA Assessment

The frontend build is suitable for internal merge: it compiles, keeps major screens lazy-loaded, has no mocked browser console issues in the V1.1 visual pass, and passed the full accessibility and smoke matrices. Production LAN go-live remains blocked until real second-client LAN, restore, printer, and multi-client load evidence exists.
