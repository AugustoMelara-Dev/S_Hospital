# Survey Report: Testing Suite & Quality Gate Infrastructure
**Hospital General San Isidro — Sistema de Caja Hospitalaria**
**Investigator**: Testing Suite & Quality Gate Surveyor (Archetype: `teamwork_preview_spec_miner`)
**Date**: 2026-09-28
**Scope**: Frontend testing, Backend testing, E2E infrastructure, Quality gates, Acceptance criteria gap analysis (R1-R6).

---

## Executive Summary

This survey provides a comprehensive audit of the testing infrastructure, automated suites, quality gates, and acceptance criteria verification for the reconstructed Cashier System of Hospital General San Isidro (`C:\Projects\S_Hospital_AI`).

### Key Findings Snapshot:
1. **Frontend Typecheck & UI Rules**:
   - `npm run typecheck` (`tsc --noEmit`) passes with **0 errors**.
   - `node scripts/check-ui-rules.mjs` passes with **400 shadcn compliant files**.
   - `node scripts/check-no-legacy-ui.mjs --mode=inventory` flags residual prohibited classes in `src/features/propuestas/PropuestaShell.tsx` (indigo, emerald, amber), `PropuestaSwitcher.tsx`, and `src/features/resumen/ResumenView.tsx` (emerald, purple, amber violating R1).
2. **Frontend Vitest Suites**:
   - 142 test files discovered in `src/`.
   - `features/cobrar`: 9 test files, 54 tests, **100% passing** (domain logic, schema, components, integration).
   - **Quality Gate Blocker**: `npm run test:segmented` immediately aborts with exit code 1 because **21 newly created test files** (in `cobrar`, `recibos`, `caja`, `reportes`, `resumen`, `administracion`) were never registered in `frontend/scripts/segmented-tests-lib.mjs`.
   - Scripts `test:critical` and `test:clinical` in `package.json` reference non-existent legacy files (`NewInvoiceView`, `InvoiceHistoryView`), causing direct Vitest invocations of those scripts to fail.
3. **Backend Test Suites & Environments**:
   - `php artisan test` runs on SQLite in-memory (`backend/phpunit.xml`), executing in fast, isolated mode.
   - Tested suites demonstrate rock-solid domain logic:
     - `Tests\Feature\Billing`: 44 tests, 334 assertions, **100% passing** (EPO per-line rules, zero-total invoices, mixed cart, idempotency).
     - `Tests\Feature\Cash`: 35 tests passing, 2 skipped (1 SQLite specific foreign-key limitation, 1 opt-in benchmark).
     - `Tests\Feature\Reports`: 58 tests, 539 assertions, **100% passing** (Executive PDF, Excel with 5 structured sheets, daily trends).
     - `Tests\Feature\InstitutionalReceipt*`: 44 tests, 1393 assertions, **100% passing** (Carta vertical, Media carta horizontal, amount in words, audited reprints).
     - `Tests\Feature\InvoiceCreationTest` & `InvoiceHistoryReprintVoidTest`: 64 tests, 338 assertions, **100% passing**.
   - **Lab Environment**: Docker daemon is structurally unavailable on the host (WSL2 Docker Desktop broken). The project uses a dedicated, non-Docker disposable MariaDB database (`sh_ai_lab_local` on port 3306) managed via `scripts/lab_local_up.ps1` and `backend/.env.local`.
4. **Backend Static Analysis Quality Gates**:
   - **Larastan (PHPStan Level 9)**: **Fails with 24 errors** across 7 files (`BuildInstitutionalReceiptSnapshotAction.php`, `InstitutionalReceiptHtmlBuilder.php`, `PromoteProposedReceiptPrintProfileAction.php`, `ReceiptSheetComposition.php`, `ExecutiveExcelExportService.php`, `ExecutivePdfExportService.php`, `ExecutiveReportService.php`).
   - **Laravel Pint**: **Fails with 2 files** violating style rules (`AdversarialContractAttackTest.php`, `InstitutionalReceiptC4PaperMatrixTest.php`).
5. **E2E & Playwright Integration**:
   - Playwright 1.61.1 is installed and discovered 174 tests across 15 files.
   - Running `npx playwright test e2e/cobrar-flow.spec.ts --project=chromium`: **4 tests passed**.
   - Running `recibos-flow.spec.ts` & `caja-flow.spec.ts`: **3 passed, 2 failed due to mock/assertion mismatches**:
     - `caja-flow.spec.ts`: Expected text `/sin sesión abierta/i`, but new UI renders `"No hay una caja abierta actualmente"` / `"Caja cerrada"`.
     - `recibos-flow.spec.ts`: Mock `/api/institutional-receipts/700/pdf` returned raw HTML rather than structured pages payload, triggering "Vista previa incompleta" alert.
   - **Screenshot Automation**: `e2e/visual-capture.spec.ts` currently captures at 1366×768 (desktop) and 390×844 (mobile). Must be updated to **1440×900** and **390×844** to satisfy Acceptance Criteria, while ensuring no lab headers are present.

---

## Features Discovered

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | Quality Gate (FE) | TypeScript Strict Typecheck | Static compilation verification without code emission | Source `.ts` and `.tsx` files | Exit 0, 0 errors | Compiler diagnostic messages | `package.json:typecheck`, `tsc --noEmit` |
| 2 | Quality Gate (FE) | UI Rules Scanner | Lints for banned CSS patterns (`space-[xy]-`, `transition-all`, remote URLs, `text-secondary`) | `src/components/ui/`, `src/styles.css` | Conformance report | Exit 1 with file:line violations | `scripts/check-ui-rules.mjs` |
| 3 | Quality Gate (FE) | Legacy UI Audit | Scans for banned UI libraries (antd, ag-grid, echarts) and un-tokenized palettes | `src/**/*.{ts,tsx,css}` | JSON / text summary of violations | Exit 1 in strict/final mode | `scripts/check-no-legacy-ui.mjs` |
| 4 | Test Runner (FE) | Segmented Vitest Execution | Splits 142 test files into named segments to prevent memory exhaustion on Windows | Segment configuration in `segmented-tests-lib.mjs` | Aggregated test report JSON | Aborts with Exit 1 if uncovered or duplicate files detected | `scripts/run-segmented-tests.mjs` |
| 5 | Test Suite (FE) | Cobrar Station Unit & Integration | Validates patient naming, mixed cart calculation, line-level EPO gratuity, UI steppers | Patient name, catalog items, prescription flag | Calculated totals, DOM state updates | Buttons disabled, error banners | `src/features/cobrar/*.test.ts(x)` |
| 6 | Test Suite (FE) | Recibos History & Detail | Tests pagination, receipt filtering, detail drawer, audited reprint dialog | Query params, invoice IDs, reprint reasons | Table rows, drawer panels, modal views | Mandatory reason validation | `src/features/recibos/*.test.ts(x)` |
| 7 | Test Suite (FE) | Caja & Cash Management | Tests physical register assignment, open balance, denomination count, shift close | Opening amount, denomination counts, session IDs | Session summary, difference calculation | Zero/negative amount validation | `src/features/cash/`, `src/features/caja/` |
| 8 | Test Suite (BE) | Billing Domain & EPO Rule | Evaluates per-line gratuity for Erythropoietin with dialysis prescription; leaves other items billable | Invoice payload, `dialysis_prescription` boolean | Persisted invoice lines with cents snapshots | 403 Forbidden without permission; 422 on invalid line | `Tests\Feature\Billing\*` |
| 9 | Test Suite (BE) | Idempotent Invoicing & PDF Failure | Prevents double billing on repeated submit or PDF failure; preserves fiscal numbers | `Idempotency-Key` header, payment requests | Replayed invoice response without re-charging | 409 Conflict if payload differs for same key | `PdfFailureDoesNotRechargeTest.php`, `InvoiceCreationTest.php` |
| 10 | Test Suite (BE) | Institutional Receipt Generation | Generates Carta vertical & Media carta horizontal PDF receipts; enforces amount in words, escapes XSS | Receipt ID, profile code (`carta_vertical`, `media_carta`) | Binary PDF stream, clean monochrome HTML | 403 on inaccessible invoice, 422 if series exhausted | `InstitutionalReceiptPdfTest.php`, `InstitutionalReceiptIssueTest.php` |
| 11 | Test Suite (BE) | Executive Reports (PDF & Excel) | Generates executive report with 5 workbook sheets (Resumen, Operaciones, Detalle, Cobros, Caja) & PDF | Date range (`from`, `to`), filter params | Structured `.xlsx` or `.pdf` file stream | 403 without export permission; 422 on invalid range | `Tests\Feature\Reports\*` |
| 12 | Quality Gate (BE) | Larastan Static Analysis | Level 9 PHPStan analysis over `app/` and `routes/` | PHP source files | Diagnostic report | Exit 1 with line-level type errors (24 detected) | `phpstan.neon`, `vendor/bin/phpstan` |
| 13 | Quality Gate (BE) | Laravel Pint Code Style | Lints PHP formatting and code conventions | Backend PHP files | Code style diff report | Exit 1 if fixers are required (2 files detected) | `vendor/bin/pint --test` |
| 14 | E2E Runner | Playwright Mocked E2E | Executes browser flows using route mocking (`page.route`) without requiring a live backend | Spec files in `e2e/` | Playwright test report, traces | Step timeout, locator assertion failure | `scripts/run-mock-e2e.mjs` |
| 15 | E2E Runner | Playwright Release E2E | Runs against live ephemeral backend (`php artisan serve`) and Vite frontend with synthetic DB | Golden SQLite DB, seed passwords | JSON report, readiness audit | Exit 1 on HTTP 500, console error, or health fail | `scripts/run-release-e2e.mjs` |
| 16 | E2E Visual | Visual Evidence Capture | Takes full-page screenshots of all primary operative views across viewports | Desktop and mobile viewport configs | PNG screenshots in `evidencia/VISUAL/`, `MANIFEST.json` | Viewport clipping, locator timeout | `e2e/visual-capture.spec.ts` |
| 17 | Environment (BE) | Non-Docker Local Lab | Sets up MariaDB `sh_ai_lab_local`, runs migrations/seeders, manages ports 18080/15173 | PowerShell script execution | Dedicated lab environment | Exits if ports busy or MySQL down | `scripts/lab_local_up.ps1` |

---

## Edge Cases

| # | Feature | Input | Observed Behavior |
|---|---------|-------|-------------------|
| 1 | Segmented Vitest Runner | 21 new test files in `src/features/{cobrar,recibos,caja,reportes,resumen,administracion}` | Script detects uncovered files and exits immediately with code 1; no Vitest processes run. |
| 2 | Legacy Test Scripts (`package.json`) | `npm run test:clinical` / `npm run test:critical` | Commands fail because `NewInvoiceView` and `InvoiceHistoryView` were renamed/refactored. |
| 3 | Visual Capture Viewport | Desktop run in `e2e/visual-capture.spec.ts` | Configured as `1366x768` instead of required `1440x900`. Mobile is correctly `390x844`. |
| 4 | Banned Palette Classes in Resumen | `ResumenView.tsx` inspected by `check-no-legacy-ui` | Contains `border-emerald-500`, `text-emerald-700`, `bg-purple-500`, violating R1 unified blue `#2563EB`. |
| 5 | Lab Shell Bypasses in Operating Routes | Direct navigation to `/propuestas/cobrar-a` | Handled before authentication in `App.tsx` and routed in `AppRoutes.tsx` when `DEV=true`. |
| 6 | E2E Caja Closed State Assertion | `caja-flow.spec.ts:61` searching for `/sin sesión abierta/i` | Failed because new component renders `"No hay una caja abierta actualmente"` and `"Caja cerrada"`. |
| 7 | E2E Receipt Preview Mock | `recibos-flow.spec.ts:126` mock returning plain HTML | Failed because `InstitutionalReceiptPreviewFrame` expects structured preview pages, triggering "Vista previa incompleta". |
| 8 | Backend Foreign Key on SQLite | `CashRegisterScopeSchemaTest.php:115` delete cascade test | SQLite does not support `ADD CONSTRAINT RESTRICT`; test correctly skips with warning on SQLite. |
| 9 | Larastan Null Coalesce & Types | `ExecutiveExcelExportService.php:118` and `ExecutiveReportService.php:909` | PHPStan level 9 rejects casting `mixed` to `int` and redundant null coalescing on non-nullable types. |
| 10 | Pint Test File Formatting | `tests\Feature\Adversarial\AdversarialContractAttackTest.php` | Unused or un-ordered imports and operator spacing fail Pint style check. |

---

## Detailed Investigation by Area

### 1. Frontend Test Setup & Quality Gates

#### Configuration & Frameworks:
- **Test Framework**: Vitest `4.1.11` configured with JSDOM environment (`frontend/vite.config.ts`, `frontend/vitest.unit.config.ts`).
- **Testing Library**: `@testing-library/react` `16.0.0`, `@testing-library/user-event` `14.6.1`, `@testing-library/jest-dom` `6.0.0`.
- **Accessibility Testing**: `vitest-axe` `0.1.0` and `axe-core` `4.12.0`.
- **Linter**: ESLint `9.0.0` with `@typescript-eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-jsx-a11y`.
- **Compiler**: TypeScript `5.9.3` (`tsconfig.json`).

#### Package.json Scripts Audit:
```json
"scripts": {
  "typecheck": "tsc --noEmit",
  "lint": "eslint .",
  "check:ui-legacy": "node scripts/check-no-legacy-ui.mjs --mode=inventory",
  "check:ui-legacy:strict": "node scripts/check-no-legacy-ui.mjs --mode=strict",
  "check:ui-legacy:final": "node scripts/check-no-legacy-ui.mjs --mode=final",
  "check:ui-rules": "node scripts/check-ui-rules.mjs",
  "test": "vitest run",
  "test:segmented": "node scripts/run-segmented-tests.mjs",
  "test:critical": "vitest run NewInvoiceView PaymentModal ReceiptPreview InvoiceHistoryView BackupsView ReportsView DashboardView UsersView ...",
  "test:clinical": "npm run check:ui-legacy && vitest run NewInvoiceView PaymentModal ...",
  "build": "tsc --noEmit && vite build",
  "test:e2e:mock": "node scripts/run-mock-e2e.mjs",
  "test:e2e:release": "node scripts/run-release-e2e.mjs"
}
```

#### Observations & Findings:
1. `npm run typecheck`: **Passes completely** with zero compiler errors.
2. `node scripts/check-ui-rules.mjs`: **Passes completely**; scans 400 shadcn foundation files and finds zero illegal classes.
3. `node scripts/check-no-legacy-ui.mjs`:
   - In `inventory` mode, reports 32 palette violations in `PropuestaShell.tsx` and `PropuestaSwitcher.tsx` (which should not be part of the operative product).
   - Reports 23 palette violations in `ResumenView.tsx` (`border-emerald-500`, `text-emerald-700`, `bg-purple-500`, `bg-amber-500`). This is a direct contradiction of R1 ("Sin verde como segunda marca, sin morado para EPO").
4. `npm run test:segmented`:
   - **Broken Quality Gate**: The script checks that all Vitest files are partitioned into `SEGMENTS` in `frontend/scripts/segmented-tests-lib.mjs`.
   - 21 test files are currently missing from the segment list:
     - `src/AppRoutes.test.tsx`
     - `src/features/administracion/AdministracionView.test.tsx`
     - `src/features/caja/CajaView.test.tsx`
     - `src/features/cobrar/*` (9 files)
     - `src/features/recibos/*` (6 files)
     - `src/features/reportes/ReportesView.test.tsx`
     - `src/features/resumen/*` (2 files)
   - Running `npm run test:segmented` immediately terminates with:
     `El manifiesto segmentado no cubre cada archivo exactamente una vez. No se ejecutó Vitest.`
5. Outdated Scripts: `test:critical` and `test:clinical` still refer to deleted filenames (`NewInvoiceView`, `InvoiceHistoryView`).

---

### 2. Backend Test Setup & Quality Gates

#### Configuration & Architecture:
- **Framework**: PHPUnit `11.5.50` on PHP `8.2.12` CLI, Laravel Framework `12.0`.
- **Database Configurations**:
  - `backend/phpunit.xml`: Configured with `<env name="DB_CONNECTION" value="sqlite" force="true"/>` and `<env name="DB_DATABASE" value=":memory:" force="true"/>`. This allows fast, zero-dependency unit and feature test execution without touching MySQL.
  - `backend/phpunit.mysql.xml`: Uses environment database variables to run against real MySQL/MariaDB.
  - `backend/.env.local`: Configured for the disposable lab database `sh_ai_lab_local` on port 3306 (user `sh_ai_lab_local`).
- **No-Docker Environment Rationale**:
  - As documented in `hospital-ai/evidencia/C1-INST-01` and `scripts/lab_local_up.ps1`, Docker WSL2 is damaged on this host. Testing must run against native Windows PHP, native Node, and the local MariaDB instance (`sh_ai_lab_local`).
- **Static Analysis Tools**:
  - `vendor/bin/phpstan`: Configured with Larastan at **Level 9** (`backend/phpstan.neon`), scanning `app/` and `routes/`.
  - `vendor/bin/pint`: Laravel Pint `1.24` for code styling.

#### Observations & Test Suite Health:
1. `php artisan test tests/Feature/Billing`: **44/44 passed** (17.41s).
   - Covers EPO dialysis prescription rule (only eligible items free), zero-total invoice emissions without fake payments, integer-cents rounding invariants, and PDF generation failure without double-charging.
2. `php artisan test tests/Feature/Cash`: **35 passed, 2 skipped** (8.96s).
   - Verifies physical cash register scopes, concurrent cash session opening prevention, denomination arqueo, and closing without triggering backups.
3. `php artisan test tests/Feature/Reports`: **58/58 passed** (29.67s).
   - Verifies Excel generation with the 5 required sheets (*Resumen*, *Operaciones*, *Detalle*, *Cobros*, *Caja*), numeric cell types, formula injection escaping, executive PDF formatting with repeating headers, and reconciliation between UI and exports.
4. `php artisan test tests/Feature/InstitutionalReceipt*`: **44/44 passed** (32.04s, 1393 assertions).
   - Confirms institutional receipt snapshot composition, Carta vertical and Media carta horizontal profiles, omission of barcodes/QRs, exact Spanish amount-in-words translation, and audited reprint counter persistence.
5. Static Analysis Errors (Larastan Level 9):
   - Found **24 errors** in 7 action files. All 24 errors are strict type assertions introduced in recent report and receipt additions (e.g. casting `mixed` to `string`/`int`, redundant `array_values` on lists, PHPDoc type narrowing).
6. Code Style Violations (Pint):
   - Found styling issues in 2 test files:
     - `backend/tests/Feature/Adversarial/AdversarialContractAttackTest.php`
     - `backend/tests/Feature/InstitutionalReceiptC4PaperMatrixTest.php`

---

### 3. E2E & Integration Setup (Playwright)

#### Configuration & Specs:
- **Playwright**: `@playwright/test` `1.60.0` / Playwright `1.61.1`.
- **Config Files**:
  - `playwright.config.ts`: Main configuration, desktop & mobile devices, port 4173/5173.
  - `playwright.release.config.ts`: Integration config running against real backend on port 18081 + frontend 5174.
- **Run Modes**:
  1. **Mocked E2E** (`scripts/run-mock-e2e.mjs`):
     - Uses route interception (`fixtures/admin-e2e.ts`) and strict guard (`fixtures/strict-mock-guard.ts`).
     - Ultra-fast, isolated, verifies UI behavior without backend dependencies.
  2. **Release E2E** (`scripts/run-release-e2e.mjs`):
     - Spawns `php artisan serve --port=18081` on ephemeral SQLite DB.
     - Spawns `vite --port=5174`.
     - Executes `release-gate.spec.ts` and `release-rbac.spec.ts`.
  3. **Visual Capture** (`e2e/visual-capture.spec.ts`):
     - Takes full-page screenshots across all operative surfaces.

#### Test Execution Findings:
- Running `cobrar-flow.spec.ts`: **4/4 passed**.
  - Confirms patient name required and trimmed.
  - Confirms mixed cart: EPO gratis with dialysis prescription while glucosa is billed.
  - Confirms zero-total emission without fake payment.
  - Confirms payment registration with payment method and reference.
- Running `caja-flow.spec.ts` and `recibos-flow.spec.ts`:
  - `recibos-flow` list and detail panel tests passed.
  - `caja-flow` opening test failed because the locator was looking for `/sin sesión abierta/i`, but the updated UI displays `"No hay una caja abierta actualmente"` and `"Caja cerrada"`.
  - `recibos-flow` reprint test failed because the mock for `/api/institutional-receipts/700/pdf` returned plain HTML string instead of structured pages payload expected by `InstitutionalReceiptPreviewFrame`.

#### Screenshot Capture Mechanism & Gap:
- In `frontend/e2e/visual-capture.spec.ts`:
  - Lines 46-47 define:
    ```typescript
    const DESKTOP_VIEWPORT = { width: 1366, height: 768 };
    const MOBILE_VIEWPORT = { width: 390, height: 844 };
    ```
  - **Acceptance Criteria Requirement**:
    `Capturas de pantalla directas del navegador a resolución real (1440×900 y 390×844) de las vistas operativas principales sin cabeceras de laboratorio.`
  - **Gap**: Desktop viewport must be updated to **1440×900**.
  - **Gap**: Screenshots currently save to `hospital-ai/evidencia/VISUAL/`. A verified capture run must be executed at 1440×900 and 390×844 once operative routes are free of laboratory headers.

---

## Acceptance Criteria Gap Analysis (R1 - R6)

| Req | Acceptance Criterion | Current Status | Existing Test Coverage | Identified Gaps & Needed Tests |
|---|---|---|---|---|
| **R1** | **Unified Visual Identity (#2563EB) & Shell**<br>- Palette #2563EB dominant<br>- No green/purple branding<br>- Remove lab bar, A/B selector, debug cards from operative routes<br>- Better-ui & emil-design-eng applied (`tabular-nums`, concentric radius, `active:scale-[0.96]`) | ⚠️ Partial | - `styles-contract.test.ts`<br>- `institutional-tokens.test.ts`<br>- `check-no-legacy-ui.mjs`<br>- `check-ui-rules.mjs` | 1. `ResumenView.tsx` has green/purple card accents that violate R1.<br>2. `App.tsx` has bypass routes `/propuestas/cobrar-a`, `/cobrar-a`, etc.<br>3. `institutional-tokens.test.ts` still tests teal `#2dd4bf`. Needs update to assert `#2563EB` canonical blue.<br>4. Need test verifying no lab headers render on operative routes. |
| **R2** | **Estación de Cobro (Cuenta Continua)**<br>- Patient name only mandatory field<br>- Starts clean, no inherited state/EPO<br>- Keyboard search (`Enter` adds item without charging)<br>- Continuous account ledger table<br>- EPO gratuity per line only<br>- Exact cents, server authority, idempotency | ⚠️ Partial | - Backend: 44 tests in `Feature\Billing`<br>- Frontend: 9 test files in `features/cobrar` (54 tests passing)<br>- E2E: `cobrar-flow.spec.ts` | 1. `cobrar-flow.spec.ts` skipped catalog search input with keyboard Enter because search had 0px width in layout. Need test verifying keyboard search & Enter insertion.<br>2. Need test verifying "Nueva Operación" cleans all state.<br>3. Need test for accessible steppers on line quantity. |
| **R3** | **Recibos e Historial de Operaciones**<br>- Search by patient, number, date, status<br>- Detail panel & balance payment<br>- Audited reprint with mandatory reason<br>- Controlled void/reverse<br>- Responsive table layout | ⚠️ Partial | - Backend: `InstitutionalReceiptIssueTest`, `InstitutionalReceiptPdfTest`, `InvoiceHistoryReprintVoidTest`<br>- Frontend: 6 files in `features/recibos`<br>- E2E: `recibos-flow.spec.ts` | 1. `recibos-flow.spec.ts` reprint test failed due to mock payload mismatch on receipt preview frame.<br>2. Need responsive Playwright test verifying no clipped columns or hidden actions at 390×844.<br>3. Need test for void/reverse flow with permission checks. |
| **R4** | **Caja, Movimientos y Arqueo**<br>- Shift opening with initial fund<br>- Cash, Card, Transfer breakdown<br>- Arqueo with denomination counter (differentiate pending vs zero)<br>- Reconciled closing and report | ⚠️ Partial | - Backend: 6 test files in `Feature\Cash`<br>- Frontend: `CashBoxView.test.tsx`, `CajaView.test.tsx`, denomination tests<br>- E2E: `caja-flow.spec.ts` | 1. `caja-flow.spec.ts` failed due to text assertion mismatch (`sin sesión abierta` vs `No hay una caja abierta actualmente`).<br>2. Need E2E test verifying denomination counter arithmetic and non-premature zero display. |
| **R5** | **Reportes Operativos, Ejecutivos, PDF y Excel**<br>- Distinguish emission, payment, and cutoff dates<br>- Executive PDF with repeating headers, ink-saving<br>- Excel (.xlsx) with 5 structured sheets, numeric values, formula sanitization | ⚠️ Partial | - Backend: 58 tests in `Feature\Reports` (all passing)<br>- Frontend: `ReportesView.test.tsx`<br>- E2E: `reportes-flow.spec.ts` | 1. Backend Larastan has 24 Level 9 errors in report & receipt action services.<br>2. Need automated test or script that exports real PDF & Excel from UI and stores them into the designated deliverables evidence directory. |
| **R6** | **Comprobante Hospitalario Convencional**<br>- Carta vertical (612×792 pt) & Media carta horizontal (612×396 pt)<br>- Institutional layout, amount in words, signatures<br>- No QR, no barcode, no debug texts<br>- Preview does not consume fiscal sequence | ⚠️ Partial | - Backend: 44 tests in `InstitutionalReceiptIssueTest` & `InstitutionalReceiptPdfTest`<br>- Frontend: `ReceiptPreview.test.tsx`, `InstitutionalReceiptPreviewFrame.test.tsx` | 1. Pint failed on `InstitutionalReceiptC4PaperMatrixTest.php`.<br>2. Larastan errors in `InstitutionalReceiptHtmlBuilder.php` and `ReceiptSheetComposition.php`.<br>3. Verify paper dimensions (612×792 pt and 612×396 pt) in evidence artifacts. |
| **Gate** | **Technical Quality Gates & Deliverables**<br>- `npm run typecheck`: 0 errors<br>- Backend tests: 0 failures<br>- Frontend tests: 0 failures<br>- PDF & Excel evidence files saved<br>- Screenshots at 1440×900 and 390×844 | ❌ Broken Gates | - `npm run typecheck` passes (0 errors)<br>- Backend `php artisan test` passes on SQLite | 1. `npm run test:segmented` fails due to 21 uncovered files.<br>2. Backend `phpstan` has 24 errors.<br>3. Backend `pint` has 2 errors.<br>4. E2E specs in `caja-flow` and `recibos-flow` have 2 locator/mock failures.<br>5. Screenshots must be generated at 1440×900 and 390×844 without lab headers.<br>6. Exported PDF & Excel files must be saved in evidence folder. |

---

## Actionable Remediation Plan for Teams

### Phase 1: Quality Gate Repair (Pre-requisite for Green Pipeline)
1. **Fix `frontend/scripts/segmented-tests-lib.mjs`**:
   - Update `SEGMENTS` array to assign:
     - `src/features/cobrar` to a `cobrar` segment.
     - `src/features/recibos` to a `recibos` segment.
     - `src/features/caja` to `cash-auth-dashboard`.
     - `src/features/reportes` to `reports-and-receipts`.
     - `src/features/resumen` to `cash-auth-dashboard`.
     - `src/features/administracion` to `admin-and-catalog`.
     - `src/AppRoutes.test.tsx` to `app-and-routing`.
   - Verify `npm run test:segmented` executes cleanly.
2. **Update `frontend/package.json` Test Scripts**:
   - Replace deleted component names in `test:critical` and `test:clinical` with current names (`CobrarView`, `RecibosView`, `CajaView`, `ReportesView`, `ResumenView`).
3. **Fix Backend Static Analysis (Larastan Level 9)**:
   - Resolve 24 type errors in `BuildInstitutionalReceiptSnapshotAction.php`, `InstitutionalReceiptHtmlBuilder.php`, `PromoteProposedReceiptPrintProfileAction.php`, `ReceiptSheetComposition.php`, `ExecutiveExcelExportService.php`, `ExecutivePdfExportService.php`, `ExecutiveReportService.php`.
   - Run `vendor/bin/phpstan analyse --no-progress` until 0 errors.
4. **Fix Backend Pint Code Style**:
   - Run `vendor/bin/pint` on `tests\Feature\Adversarial\AdversarialContractAttackTest.php` and `tests\Feature\InstitutionalReceiptC4PaperMatrixTest.php`.
   - Verify `vendor/bin/pint --test` passes with 0 errors.

### Phase 2: E2E Test Alignments
1. **Fix `caja-flow.spec.ts`**:
   - Update line 61 from `getByText(/sin sesión abierta/i)` to `getByText(/no hay una caja abierta actualmente/i)` or `getByText(/caja cerrada/i)`.
2. **Fix `recibos-flow.spec.ts`**:
   - Update mock route for `/api/institutional-receipts/700/pdf` or `/preview` to return the structured pages/document-plan payload expected by `InstitutionalReceiptPreviewFrame`.
3. **Update `visual-capture.spec.ts` Viewport**:
   - Change `DESKTOP_VIEWPORT` from `{ width: 1366, height: 768 }` to `{ width: 1440, height: 900 }`.
   - Retain `MOBILE_VIEWPORT` at `{ width: 390, height: 844 }`.

### Phase 3: Deliverables Generation
1. **Screenshot Generation**:
   - Once R1 cleanses the lab bar and bypass routes, execute `npx playwright test e2e/visual-capture.spec.ts --project=chromium`.
   - Verify images at 1440×900 and 390×844 are produced and free of lab banners.
2. **PDF & Excel Evidence Artifacts**:
   - Execute report export flow and store generated `.pdf` (Executive Report) and `.xlsx` (5-sheet workbook) into `hospital-ai/evidencia/DELIVERABLES/`.
