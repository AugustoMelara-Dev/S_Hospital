# E2E Test Infra: S_Hospital Cashier System

## Test Philosophy
- Opaque-box, requirement-driven, offline-first.
- Methodology: Category-Partition + Boundary Value Analysis + Pairwise Combinatorial Testing + Real-World Workload Testing.

## Feature Inventory & Test Coverage
| # | Feature | Source | Tier 1 (Isolated) | Tier 2 (Boundary) | Tier 3 (Interactions) |
|---|---------|--------|:-----------------:|:-----------------:|:---------------------:|
| 1 | Visual Tokens & Shell | ORIGINAL_REQUEST §R1 | ✓ (Palette tests) | ✓ (Responsive scale) | ✓ (Shell navigation) |
| 2 | Cashier Patient & Clean State | ORIGINAL_REQUEST §R2 | ✓ (Empty start) | ✓ (Whitespace/Long) | ✓ (New bill reset) |
| 3 | Ledger Search & Enter | ORIGINAL_REQUEST §R2 | ✓ (Item selection) | ✓ (Non-existent query) | ✓ (Enter key vs submit) |
| 4 | Quantity Stepper & Calc | ORIGINAL_REQUEST §R2 | ✓ (Quantities 1-10) | ✓ (Large qty > 1000) | ✓ (Price multiplication) |
| 5 | Per-line EPO Gratuity | ORIGINAL_REQUEST §R2 | ✓ (Pure EPO basket) | ✓ (Zero total allowed) | ✓ (Mixed EPO + Glucosa) |
| 6 | Receipts & History Search | ORIGINAL_REQUEST §R3 | ✓ (Query by patient) | ✓ (No matches found) | ✓ (Filter by date/status) |
| 7 | Audited Reprint Reason | ORIGINAL_REQUEST §R3 | ✓ (Reprint modal) | ✓ (Reason < 5 chars rejected) | ✓ (Durable reprint counter) |
| 8 | Cashbox Open & Arqueo | ORIGINAL_REQUEST §R4 | ✓ (Shift opening) | ✓ (Zero float count) | ✓ (Denomination breakdown) |
| 9 | Cashbox Close Validation | ORIGINAL_REQUEST §R4 | ✓ (Normal balance) | ✓ (Discrepancy requires notes) | ✓ (Blocked if pending bills) |
| 10 | Executive PDF & Excel | ORIGINAL_REQUEST §R5 | ✓ (Export generation) | ✓ (Empty range handling) | ✓ (5 sheets & numeric types) |
| 11 | Institutional Receipt Format | ORIGINAL_REQUEST §R6 | ✓ (Letter/Half-letter) | ✓ (No barcodes/QRs) | ✓ (Decoupled print/charge) |

## Test Architecture
- **E2E Test Runner**: Playwright (`frontend/e2e/`)
- **Unit & Integration**: Vitest (`frontend/src/**/*.test.tsx`)
- **Backend Feature & Domain**: PHPUnit / Pest (`backend/tests/Feature/`)
- **Static Quality Gates**:
  - Frontend: `npm run typecheck` (`tsc --noEmit`), `node scripts/check-no-legacy-ui.mjs --mode=strict`
  - Backend: `vendor/bin/phpstan analyse --no-progress`, `vendor/bin/pint --test`
- **Visual Capture**: Playwright screenshots at 1440×900 (Desktop) and 390×844 (Mobile).

## Backend Database Test Matrix (SQLite vs MariaDB)

`backend/phpunit.xml` runs the default SQLite `:memory:` suite. The
MySQL/MariaDB suite is `backend/phpunit.mysql.xml`, but the harness deliberately
**forces SQLite unless two conditions hold**
(`backend/tests/TestCase.php::forceTestingEnvironment`):

1. `HOSPITAL_TEST_ALLOW_EXTERNAL_DB=1`
2. `DB_DATABASE` starts with `s_hospital_test_`

Without them the command still looks green but runs SQLite, so the MySQL-only
tests (money CHECKs, FKs, audit triggers, real concurrency) are silently
skipped. That is the trap A-12 records.

Correct PowerShell invocation (disposable lab database, never production):

```powershell
$env:APP_ENV='testing'
$env:DB_CONNECTION='mysql'
$env:DB_HOST='127.0.0.1'
$env:DB_PORT='3306'                       # 3317 for the payload MariaDB 11.4
$env:DB_DATABASE='s_hospital_test_delivery_104'
$env:DB_USERNAME='sh_ai_lab_local'
$env:DB_PASSWORD=$env:LAB_DB_PASSWORD     # from the local lab env, never committed
$env:HOSPITAL_TEST_ALLOW_EXTERNAL_DB='1'
php -c <php83.ini> vendor/bin/phpunit -c phpunit.mysql.xml --display-skipped
```

- The database must be disposable and match the `s_hospital_test_` prefix; the
  harness throws before touching anything else.
- Run the SQLite and MariaDB suites **serially**: both share
  `backend/storage/framework/testing/` and the backup directories.
- `HOSPITAL_RUN_CONCURRENT_TESTS=1` enables the real multi-process cash/fiscal
  race tests (also requires the external-DB flag).
- The production target is MariaDB 11.4 (payload); the lab also has MariaDB
  10.4. Both must be green before the release candidate.

## Real-World Application Scenarios (Tier 4)
1. **Full Cashier Shift Lifecycle**: Operator logs in -> Opens cashbox with L. 500.00 -> Issues multiple invoices (standard and mixed EPO) -> Performs mid-shift movement -> Reconciles drawer with physical denominations -> Closes cashbox with audit notes.
2. **Mixed Emergency Basket**: Patient receives Erythropoietin (covered by dialysis prescription) plus emergency laboratory tests (Glucose, Blood count). Eligible line displays "Sin cobro por receta" with L. 0.00 charge, while lab items are charged at full catalog price. Total exactly matches billable items.
3. **Receipt Reprint Under Audit**: Cashier requests reprint of historical invoice -> System enforces mandatory human reason ("Reimpresión por extravío de comprobante por el paciente") -> Receipt issued with "REIMPRESIÓN #1" header and counter incremented durably.
4. **Offline Export Verification**: Administrator generates Monthly Executive Report -> Downloads PDF (verified monochrome, repeated thead) -> Downloads Excel (verified 5 sheets, real float numbers, no formula injection).
