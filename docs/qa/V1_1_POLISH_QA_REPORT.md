# V1.1 Production Polish QA Report

Branch: `codex/v1-1-production-polish`
Base SHA: `2e1949e6e1cccbccf8ae5c94a9472739fd0d14ac`
Status: in progress
Updated: 2026-06-25

## Scope Covered In This Pass

This report records the current digital QA evidence for the V1.1 production polish branch. It is not the final approval report and does not approve physical production.

Screens and flows covered by mocked Playwright evidence:

- Login light/dark.
- Dashboard light/dark.
- Cashbox open.
- Cashbox close dialog/state.
- New invoice empty.
- New invoice with cart.
- Invoice confirmation.
- Payment modal.
- Invoice history.
- Receipt preview letter-like legacy view.
- Receipt preview A5.
- Receipt preview dark.
- Reports admin light/dark.
- Reports cash.
- Reports services.
- Catalog.
- Fiscal settings.
- Institutional receipt settings light.
- Institutional receipt settings preview light/dark.
- Admin users light/dark.
- Backups pending.
- Help.
- About.
- Access denied reports route.
- 404 route.
- Mobile dashboard.
- Mobile billing.
- Mobile reports access denied state.

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
- 33 screenshots captured.
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

Backend command:

```powershell
cd C:\Projects\S_Hospital-v1-1-polish
$env:DB_PASSWORD='local_test_password'
$env:DB_ROOT_PASSWORD='local_root_password'
docker compose build backend
docker run --rm -v ${PWD}:/workspace -v s_hospital-v1-1-polish_backend_vendor:/workspace/backend/vendor -w /workspace/backend s_hospital-v1-1-polish-backend php artisan test --colors=never
```

Backend result:

- Passed.
- 49 backend tests passed.
- 668 backend warnings were reported by PHPUnit.
- 1 backend coverage test was skipped because no coverage driver is enabled.
- First Docker Compose test attempt with only `backend/` mounted was not accepted as final evidence because repo-root guard tests could not read `../frontend`, `../devex`, `../setup.bat`, and `.github` files.

Release E2E command:

```powershell
cd C:\Projects\S_Hospital-v1-1-polish\frontend
$env:CI='1'
$env:E2E_RELEASE_BASE_URL='http://127.0.0.1:5174'
$env:E2E_RELEASE_API_BASE_URL='http://127.0.0.1:18081'
$env:E2E_RELEASE_LOGIN='cajero.e2e'
$env:E2E_RELEASE_ADMIN_LOGIN='admin.e2e'
$env:E2E_RELEASE_PASSWORD='Password123!'
$env:E2E_RELEASE_ALLOW_MUTATIONS='1'
$env:E2E_RELEASE_REPORT_PATH='test-results/release-e2e-report.json'
node .\node_modules\@playwright\test\cli.js test --config=playwright.release.config.ts
```

Release E2E result:

- Passed.
- 2 Playwright release specs passed.
- 0 skipped, 0 unexpected, 0 flaky.
- Duration recorded by Playwright JSON: 36.1s.
- Flow covered: cashier invoice issue, payment, institutional PDF preview signal, invoice persistence, reports visibility, admin creation of catalog-only user, forced password change, navigation/RBAC enforcement.
- The release runner now writes Playwright failure artifacts to `frontend/test-results/release-e2e-artifacts` so live service logs in `frontend/test-results/release-e2e` do not block Windows output cleanup.

Artifacts:

- `qa/screenshots/v1-1-production-polish/manifest.json`
- `qa/screenshots/v1-1-production-polish/rc-e2e-mocked-report.json`
- `qa/screenshots/v1-1-production-polish/*.png`
- `docs/qa/V1_1_PERFORMANCE_LAN_REVIEW.md`
- `frontend/test-results/release-e2e-report.json`
- `frontend/test-results/release-e2e-playwright.json`

## Unit And Static Checks Run During V1.1 Slices

- `npm.cmd run test -- FiscalSettingsView.test.tsx --run`
- `npm.cmd run test -- InvoiceConfirmation.test.tsx --run`
- `npm.cmd run test -- receipt-settings --run`
- `npm.cmd test -- --run src/features/reports/ReportsView.test.tsx src/features/reports/components/IncomeReportTab.test.tsx src/features/reports/components/CashSessionReportTab.test.tsx`
- `npm.cmd run test -- NewInvoiceViewLayout.test.tsx InvoiceCart.test.tsx --run`
- `npm.cmd run test`
- `npm.cmd run smoke:buttons`
- `npm.cmd run typecheck`
- `npm.cmd run lint`
- `docker run --rm -v ${PWD}:/workspace -v s_hospital-v1-1-polish_backend_vendor:/workspace/backend/vendor -w /workspace/backend s_hospital-v1-1-polish-backend php artisan test --colors=never`
- Docker-backed release E2E with Vite on `127.0.0.1:5174` and Laravel on `127.0.0.1:18081`: `node .\node_modules\@playwright\test\cli.js test --config=playwright.release.config.ts`

## Known Gaps

- This pass uses mocked API data; it does not prove Laravel/MySQL/MariaDB integration.
- Backend tests ran in Docker with SQLite/phpunit configuration; they do not prove MySQL/MariaDB production integration.
- It does not prove physical printer output.
- It does not prove a second LAN client can operate against the server.
- It does not prove backup restore in an isolated database.
- It does not prove concurrent LAN load.
- It does not yet cover every requested V1.1 screenshot name, including receipt PDF digital and a full successful mobile reports state with admin data.
- It does not replace final full axe coverage beyond the responsive button smoke, PDF digital proof, MySQL/MariaDB production-like integration, and physical acceptance gates required before internal approval.

## QA Assessment

The current evidence is useful for visual regression and screen review on the polished branch, especially for dashboard, POS cart, reports, receipt settings, users, backups, access denied, and 404 states. The Docker-backed release E2E now provides digital cashier/RBAC integration evidence, but V1.1 remains in progress until PDF digital proof, final full visual matrix, MySQL/MariaDB production-like validation, and physical acceptance evidence are complete.
