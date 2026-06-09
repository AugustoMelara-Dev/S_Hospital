# P2 Reconciliation - 2026-06-09

Scope: reconcile the pasted "Pasada 2" findings against `HEAD` after fast-forwarding from `origin/main` and applying the two local commits on branch `codex/p2-audit-completion`.

## Commits in This Pass

- `7474db13 fix(config): use hospital local timezone`
- `cfe6df1c fix(security): require production license salt`

## Resolved or Already Present in HEAD

- `BUG-P2-01`: `backend/app/Http/Middleware/LoginLockout.php` exists and `/api/auth/login` uses it.
- `BUG-P2-03`, `BUG-P2-04`, `BUG-P2-05`: `HealthController`, `CspReportController`, and `EchoConfigController` exist and are routed.
- `BUG-P2-07`: `ReverseInvoiceAction` exists and `InvoiceController::reverse` is routed at `/api/invoices/{invoice}/reverse`.
- `BUG-P2-08`: `InvoicePolicy` and `CashSessionPolicy` exist and are registered in `AppServiceProvider`.
- `BUG-P2-10`: production CSP uses nonces for scripts/styles; `unsafe-inline` remains only for development/report-only policy and is guarded by `SecurityHeadersTest`.
- `BUG-P2-11`/`BUG-P2-12`: payment/invoice/item cents columns are present; app SQL no longer recomputes cents with `ROUND(decimal * 100)`. Remaining `ROUND()` calls prorate integer cents columns.
- `BUG-P2-13`: `hospital:prune-audit-logs` and `hospital:prune-failed-jobs` exist, are scheduled, and have tests.
- `BUG-P2-16`/`BUG-P2-39`: production `license.json` validation now fails closed when `HOSPITAL_LICENSE_SALT` is empty.
- `BUG-P2-34`/`BUG-P2-41`: cashier operational-day checks now use `APP_TIMEZONE` defaulting to `America/Tegucigalpa`.

## Accepted / Non-Blocking Signals

- `User` still does not implement `MustVerifyEmail`; current `/verify-email` is a public SPA smoke route, not an email verification flow. Existing docs/tests treat it as an install/preflight route.
- `LicenseHelper::DEFAULT_SALT` remains for local/testing compatibility only. In production with `license.json`, it is blocked by `LicenseHelperTest::test_production_license_file_requires_configured_salt`.
- `unsafe-inline` remains in non-production CSP and report-only CSP. Production enforced CSP drops it, covered by `SecurityHeadersTest`.
- Migration SQL contains historical `ROUND(amount * 100)` backfills guarded for migration/backfill use, not live report/payment logic.

## Verification

Commands run:

```powershell
php artisan test --colors=never --filter='ProductionConfigDefaultsTest|InvoiceAccessTest'
php artisan test --colors=never --filter='InvoiceHistoryReprintVoidTest|CashPaymentsReceiptTest|ProductionConfigDefaultsTest|InvoiceAccessTest'
php artisan test --colors=never --filter='LicenseHelperTest|ProductionConfigDefaultsTest'
vendor\bin\pint --test app\Support\InvoiceAccess.php app\Http\Requests\Billing\ShowInvoiceRequest.php app\Http\Requests\Receipts\ShowReceiptRequest.php app\Http\Requests\Receipts\ReprintReceiptRequest.php config\app.php tests\Unit\InvoiceAccessTest.php tests\Unit\ProductionConfigDefaultsTest.php
vendor\bin\pint --test app\Support\LicenseHelper.php tests\Feature\LicenseHelperTest.php config\app.php
php artisan config:cache
php artisan test --colors=never
```

Latest full backend result: `382 passed`, `4 skipped`.

## Remaining Work Outside This P2 Pass

- Physical production readiness remains dependent on real LAN client, printer, restore, backup worker, and MySQL/MariaDB concurrency evidence already documented elsewhere.
- Unrelated local worktree changes existed during this pass and were intentionally excluded from commits:
  - `backend/app/Actions/Cash/BuildCashReconciliationAction.php`
  - `backend/app/Models/AuditLog.php`
  - `backend/tests/Feature/CashPaymentsReceiptTest.php`
  - `frontend/package-lock.json`
  - `frontend/src/app/useHospitalSession.ts`
  - `frontend/src/app/useHospitalSession.test.tsx`
  - `backend/build/`
  - `qa/AUDIT_FIX_TRACKING.md`
