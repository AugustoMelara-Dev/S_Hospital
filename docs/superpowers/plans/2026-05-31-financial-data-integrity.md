# Financial Data Integrity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert S_Hospital into a reliable source of hospital financial information by making invoices, payments, cash sessions, catalog data, reports, exports, receipts, and audit trails consistent and testable.

**Architecture:** The backend remains the source of truth for money, status, permissions, report aggregates, and historical snapshots. Frontend screens consume explicit API fields, show human financial labels, and never derive authoritative totals from raw rows. All database changes are additive and must preserve existing development data.

**Tech Stack:** Laravel 12, MySQL/MariaDB, React 19, TypeScript, TanStack Query, Recharts, Playwright, Docker Compose.

---

## Current Evidence

Evidence collected on 2026-05-31 in local Docker Compose:

- UI screenshots: `qa/financial-data-audit/screenshots/00-login.png` through `qa/financial-data-audit/screenshots/08-configuracion.png`.
- API probe: `qa/financial-data-audit/probe-current-api.json`.
- UI capture script: `qa/financial-data-audit/capture-current-ui.mjs`.
- API probe script: `qa/financial-data-audit/probe-current-api.mjs`.

Observed facts from the latest Phase 0 check:

- Docker services are running: backend on `8000`, frontend on `5173`, MariaDB on host port `3307`.
- All current migrations are marked `Ran`.
- The current MariaDB database has schema but no operational data: `users`, `fiscal_settings`, `fiscal_sequences`, `categories`, `services`, `invoices`, `payments`, `cash_register_sessions`, and `audit_logs` are all empty.
- Browser capture cannot reach the authenticated app shell because there is no current validation user in the database.
- API probe returns `401 Unauthenticated` for protected endpoints after login fails.
- This empty-database state is itself a financial integrity risk: test/validation workflows must not be able to wipe or replace the operator's working database without an explicit disposable target or verified backup.

Observed facts from earlier local evidence in the same audit front, before the current database became empty:

- Report UI screenshot showed `Saldo pendiente: L. undefined`, which means the frontend expected a field that the daily endpoint did not provide.
- Catalog UI screenshot stayed on skeleton/`0 servicios` even though `/api/services?per_page=5` returned 122 total services.
- Vite dev proxy inside the frontend container returned 500 for relative `/api/*` because the proxy target defaulted to `http://localhost:8000` from inside the container. Direct browser calls to `http://localhost:8000` worked.

Verification facts:

- Backend `ReportsTest` passes when run with `docker compose exec -T backend php artisan test --filter=ReportsTest --colors=never`.
- Frontend typecheck, lint, test, and build pass. Frontend tests emit React `act(...)` warnings and duplicate key warnings.
- Full backend test command previously timed out at 5 minutes and must be triaged before claiming a complete quality gate.
- Branding check previously failed in the Linux frontend container because `powershell` is not available there.

## Scope

This front is split into small, committable phases. Do not implement broad visual redesigns. Every code phase must start with failing tests that reproduce a financial inconsistency or missing contract.

Out of scope:

- Fiscal/legal certification claims.
- Cloud sync or SaaS dependencies.
- Clinical patient records beyond patient name.
- Destructive data cleanup without a separate reviewed cleanup plan and backup.
- Pushes to remote.

## Assumptions

- Current Docker development data may be used for inspection but must not be reset.
- Existing invoices/payments are local validation data unless the user confirms otherwise.
- MySQL/MariaDB remains the production database target.
- Existing receipt snapshots on invoices are the authority for reprints.
- If a report needs "area", a first-class `areas` concept must be added instead of overloading category names.

## Blocking Questions

None for planning. Safe assumptions above are enough to start Phase 0 and Phase 1 after approval.

## Phase 0: Baseline Evidence And Audit Contract

**Scope**

Create a durable audit packet describing current financial data flows, screenshots, API probes, DB counts, known inconsistencies, and the exact test baseline. No product behavior changes.

**Files**

- Create/modify: `qa/financial-data-audit/README.md`
- Create/modify: `qa/financial-data-audit/BASELINE_FINDINGS.md`
- Keep: `qa/financial-data-audit/capture-current-ui.mjs`
- Keep: `qa/financial-data-audit/probe-current-api.mjs`
- Keep: `qa/financial-data-audit/screenshots/*.png`
- Modify: `docs/DECISIONS.md`

**Migrations**

- None.

**Tests And Commands**

- `docker compose ps`
- `docker compose exec -T backend php artisan migrate:status`
- `docker compose exec -T backend php artisan test --filter=ReportsTest --colors=never`
- `docker compose exec frontend npm run typecheck`
- `docker compose exec frontend npm run lint`
- `docker compose exec frontend npm run test`
- `docker compose exec frontend npm run build`

**Risks**

- Evidence scripts may reveal local dev data. Keep them in `qa/`, not product UI.
- Full backend suite currently exceeds 5 minutes; document timeout without hiding it.

**Acceptance Criteria**

- Baseline findings name each observed mismatch with screenshot/API/DB evidence.
- No application source files are changed.
- `docs/DECISIONS.md` records the decision to introduce a financial facts contract before UI changes.

**Commit**

- `docs(audit): record financial data baseline`

## Phase 1: Financial Facts Contract

**Scope**

Define a backend contract for all financial report totals so every amount has a named source and consistent meaning:

- `total_billed`: non-void invoice totals issued in range.
- `total_collected`: posted non-void payments paid in range.
- `total_pending`: current balance due on non-void `issued` and `partial` invoices in range.
- `total_voided`: voided invoice totals in range, reported separately and excluded from income.
- `total_partial`: invoice totals or balance for partial invoices, explicitly named.
- `payments_by_method`: posted non-void payments grouped by method.
- `cash_expected`: opening cash plus cash payments only.

**Files**

- Create: `backend/app/Actions/Reports/FinancialFactsService.php`
- Create: `backend/tests/Feature/FinancialFactsReportTest.php`
- Modify: `backend/app/Actions/Reports/DailyReportService.php`
- Modify: `backend/app/Actions/Reports/IncomeReportService.php`
- Modify: `backend/app/Actions/Reports/DashboardReportService.php`
- Modify: `backend/app/Actions/Reports/CashSessionReportService.php`
- Modify: `backend/app/Http/Requests/Reports/*.php` only if filters need stricter validation.
- Modify: `frontend/src/lib/api/types.ts`
- Modify: `frontend/src/features/reports/components/DailyReportTab.tsx`
- Modify: `frontend/src/features/reports/ReportsView.test.tsx`

**Migrations**

- None unless an index is missing for a new query. Any index must be additive only.

**TDD Steps**

- [ ] Add a backend fixture with one paid cash invoice, one partial transfer invoice, one issued unpaid invoice, one void invoice, and one card payment.
- [ ] Assert daily and range reports exclude voided invoices from billed/collected income.
- [ ] Assert partial invoice is not counted as paid.
- [ ] Assert `total_pending` is present and never `undefined`.
- [ ] Assert card/transfer do not increase `cash_expected`.
- [ ] Implement `FinancialFactsService` using SQL aggregates or query builder aggregates, not frontend summing.
- [ ] Update report services to call `FinancialFactsService`.
- [ ] Update frontend API types and report card labels.
- [ ] Add a React test that fails if pending balance renders as `undefined`.

**Risks**

- Existing report tests may encode older field names. Keep backwards compatibility for one phase only if needed, but prefer explicit fields.
- Allocating payments by category for partial invoices can be misleading. Name proportional allocation clearly when used.

**Acceptance Criteria**

- Daily report returns and displays billed, collected, pending, voided, partial, payments by method, invoice counts by state.
- No UI string can show `undefined`, `NaN`, or raw enum names.
- Report tests include paid, partial, issued, void, cash, card, transfer, and other methods.

**Commit**

- `fix(reports): define financial facts contract`

## Phase 2: Cash Reconciliation And Close Semantics

**Scope**

Make cash sessions explain expected cash, counted cash, difference, payments by method, cashier, and pending balances. Decide close behavior explicitly: closing a cash session may show pending/partial balances but must not count them as collected or cash.

**Files**

- Create: `backend/app/Actions/Cash/BuildCashReconciliationAction.php`
- Modify: `backend/app/Actions/Cash/CloseCashSessionAction.php`
- Modify: `backend/app/Http/Controllers/CashSessionController.php`
- Modify: `backend/app/Actions/Reports/CashSessionReportService.php`
- Modify: `backend/tests/Feature/CashPaymentsReceiptTest.php`
- Modify: `backend/tests/Feature/ReportsTest.php`
- Modify: `frontend/src/features/cash/CashBoxView.tsx`
- Modify: `frontend/src/features/cash/components/SessionSummary.tsx`
- Modify: `frontend/src/features/cash/components/CloseSessionDialog.tsx`
- Modify: `frontend/src/features/cash/CashBoxView.test.tsx`

**Migrations**

- Additive only if needed:
  - `cash_register_sessions.pending_amount_snapshot decimal(12,2) null`
  - `cash_register_sessions.method_totals_snapshot json null`

**TDD Steps**

- [ ] Write a backend test with opening `500.00`, cash `100.00`, card `50.00`, transfer `25.00`, and pending `30.00`.
- [ ] Assert expected cash is `600.00`, not `675.00`.
- [ ] Assert close stores counted amount, difference, method totals, and pending snapshot when present.
- [ ] Assert a difference requires notes and creates an audit log.
- [ ] Update frontend close dialog to show "Efectivo esperado", "Contado real", "Diferencia", "Cobros por metodo", and "Pendiente".

**Risks**

- Current code blocks close when pending/partial invoices exist. Changing this is a business decision. If not approved, keep the block but still show pending balances before blocking.

**Acceptance Criteria**

- Card, transfer, and other methods never inflate cash expected.
- Close report can be understood after the fact without recalculating from memory.
- Closing with difference is audited.

**Commit**

- `fix(cashbox): reconcile expected cash by payment method`

## Phase 3: Payment And Invoice State Integrity

**Scope**

Prevent double emission, double payment, impossible amounts, invalid dates, and inconsistent status transitions. Add reversible payment auditing if missing.

**Files**

- Modify: `backend/app/Actions/Payments/RegisterPaymentAction.php`
- Create: `backend/app/Actions/Payments/VoidPaymentAction.php`
- Modify: `backend/app/Models/Payment.php`
- Modify: `backend/app/Http/Controllers/PaymentController.php`
- Create: `backend/app/Http/Requests/Payments/VoidPaymentRequest.php`
- Modify: `backend/tests/Feature/CashPaymentsReceiptTest.php`
- Modify: `backend/tests/Feature/InvoiceCreationTest.php`
- Modify: `backend/tests/Feature/InvoiceHistoryReprintVoidTest.php`
- Modify: `frontend/src/lib/api/billing.ts`
- Modify: `frontend/src/features/invoices/InvoiceHistoryView.tsx`

**Migrations**

- Create additive migration:
  - `payments.voided_by nullable foreign key users`
  - `payments.voided_at nullable timestamp`
  - `payments.void_reason nullable text`
  - optional index `payments(status, paid_at)`

**TDD Steps**

- [ ] Assert paying more than balance returns 422.
- [ ] Assert a second full payment on an already paid invoice returns 422.
- [ ] Assert partial payment sets status `partial`, not `paid`.
- [ ] Assert voiding a payment recalculates `paid_amount`, `balance_due`, and invoice status in one transaction.
- [ ] Assert voided payments are excluded from collected reports and cash expected.
- [ ] Assert all state changes create audit logs.

**Risks**

- Payment reversal changes financial history. It must never delete payments; it must append audit data.

**Acceptance Criteria**

- Invoice state always matches balance and void status.
- Posted/voided payment states are clear in APIs and UI.
- Receipts reprint historical values, not current catalog prices.

**Commit**

- `fix(payments): enforce invoice balance state transitions`

## Phase 4: Institutional Catalog Quality

**Scope**

Strengthen the service catalog as an institutional source of truth: areas, categories, active/inactive, visibility, billability, aliases, duplicate prevention, audit logs, and price history.

**Files**

- Create: `backend/database/migrations/*_create_areas_table.php`
- Create: `backend/database/migrations/*_add_catalog_quality_fields_to_services_table.php`
- Create: `backend/database/migrations/*_create_service_price_histories_table.php`
- Create: `backend/app/Models/Area.php`
- Create: `backend/app/Models/ServicePriceHistory.php`
- Modify: `backend/app/Models/Service.php`
- Modify: `backend/database/seeders/ServiceCatalogSeeder.php`
- Modify: `backend/app/Support/ServiceSearch.php`
- Modify: `backend/app/Http/Requests/Catalog/StoreServiceRequest.php`
- Modify: `backend/app/Http/Requests/Catalog/UpdateServiceRequest.php`
- Modify: `backend/app/Http/Controllers/ServiceController.php`
- Modify: `backend/tests/Feature/ServiceCatalogTest.php`
- Modify: `frontend/src/features/catalog/CatalogView.tsx`
- Modify: `frontend/src/features/catalog/components/ServiceSheet.tsx`
- Modify: `frontend/src/schemas/catalog.schema.ts`

**Migrations**

- `areas`: `id`, `name`, `slug`, `active`, timestamps.
- `services`: add nullable `area_id`, nullable `aliases` text/json, boolean `visible_in_billing default true`, boolean `is_billable default true`.
- `service_price_histories`: `service_id`, `old_price`, `new_price`, `changed_by`, `changed_at`, `reason`.
- Add indexes for `services(area_id, active)`, `services(category_id, visible_in_billing, is_billable)`.

**TDD Steps**

- [ ] Assert seed creates areas and maps all 122 services to an area/category.
- [ ] Assert inactive or not visible services do not appear in billing search.
- [ ] Assert catalog search matches accents and common typo variants through `aliases`.
- [ ] Assert duplicate names in same category/area are rejected.
- [ ] Assert price changes create `service_price_histories` and audit logs.
- [ ] Assert old invoice item snapshots do not change after service price update.

**Risks**

- Some existing services may not map cleanly to an area. Report unmapped rows instead of guessing silently.

**Acceptance Criteria**

- Catalog filters match counts.
- No internal codes are shown in reports/exports unless explicitly needed by admin.
- Services visible in catalog and billing follow the same server rules.

**Commit**

- `feat(catalog): add institutional service quality controls`

## Phase 5: Administration Reports And Exports

**Scope**

Deliver daily and monthly administration views with clear filters and export-safe labels:

- Facturado, cobrado, pendiente, parcial, anulado.
- Payments by method.
- Income by area/category/service.
- Cashier activity.
- Cash differences.
- Reprints, voids, backups.

**Files**

- Create: `backend/app/Actions/Reports/MonthlyReportService.php`
- Create: `backend/app/Actions/Reports/AreaIncomeReportService.php`
- Modify: `backend/app/Actions/Reports/OperationsReportService.php`
- Modify: `backend/app/Actions/Reports/ExcelReportService.php`
- Modify: `backend/app/Actions/Reports/PdfExportService.php`
- Modify: `backend/app/Http/Controllers/ReportController.php`
- Create: `backend/tests/Feature/AdministrationReportsTest.php`
- Modify: `frontend/src/features/reports/ReportsView.tsx`
- Modify: `frontend/src/features/reports/components/*.tsx`
- Modify: `frontend/src/lib/api/reports.ts`

**Migrations**

- Additive indexes only if query plans require them:
  - `invoices(status, issued_at)`
  - `payments(method, paid_at, status)`
  - `invoice_items(category_id, service_id)`
  - `cash_register_sessions(user_id, status, opened_at)`

**TDD Steps**

- [ ] Write report tests with paid, partial, issued, void, cash, card, transfer, and other.
- [ ] Assert monthly totals equal daily totals summed by backend facts.
- [ ] Assert category/area income uses invoice item snapshots.
- [ ] Assert exports omit technical ids, internal codes, stack traces, and raw JSON.
- [ ] Assert filters by range, status, cashier, area, and method affect totals consistently.

**Risks**

- Proportional allocation of partial payments by service/area can be misunderstood. Reports must label it as "cobrado asignado proporcionalmente" if implemented.

**Acceptance Criteria**

- Administration can answer: how much was billed, collected, pending, voided, and by whom.
- Exports match screen totals.
- Filters are visible, human-readable, and persisted per screen where useful.

**Commit**

- `feat(reports): add administration financial accountability`

## Phase 6: Frontend Accuracy, Permissions, And Accessibility

**Scope**

Make screens explain numbers clearly and avoid misleading states:

- Replace raw enum labels with human labels.
- Add loading, empty, error, and retry states.
- Ensure dark mode contrast.
- Hide restricted financial figures by permission.
- Fix catalog loading mismatch and report `undefined`.

**Files**

- Modify: `frontend/src/features/dashboard/DashboardView.tsx`
- Modify: `frontend/src/features/reports/ReportsView.tsx`
- Modify: `frontend/src/features/cash/CashBoxView.tsx`
- Modify: `frontend/src/features/catalog/CatalogView.tsx`
- Modify: `frontend/src/features/invoices/InvoiceHistoryView.tsx`
- Modify: `frontend/src/components/PermissionGate.tsx`
- Modify: `frontend/src/components/ui/states.tsx`
- Modify: `frontend/src/styles.css`
- Modify: related `*.test.tsx`

**Migrations**

- None.

**TDD Steps**

- [ ] Add React tests that render each report state: loading, empty, error, success.
- [ ] Assert cashier role cannot see admin-only managerial totals.
- [ ] Assert every money card renders a finite formatted value.
- [ ] Assert catalog table renders services returned by API.
- [ ] Assert dark mode does not hide critical labels or badges.

**Risks**

- UI can become decorative. Keep layouts dense and operational.

**Acceptance Criteria**

- No `undefined`, `NaN`, skeleton-stuck table, or ambiguous label in financial screens.
- Cajero sees operational needs; admin sees summary and detail.

**Commit**

- `fix(frontend): clarify financial states and permissions`

## Phase 7: Receipt Snapshot And Reprint Verification

**Scope**

Verify receipts and reprints are immutable historical views. Reprinted receipts must not recalculate from current service names, categories, prices, tax rates, or hospital fiscal data.

**Files**

- Modify: `backend/app/Actions/Receipts/GenerateReceiptDataAction.php`
- Modify: `backend/app/Actions/Receipts/ReprintReceiptAction.php`
- Modify: `backend/tests/Feature/InvoiceHistoryReprintVoidTest.php`
- Modify: `backend/tests/Feature/CashPaymentsReceiptTest.php`
- Modify: `frontend/src/features/receipts/ReceiptPreview.tsx`
- Modify: `frontend/src/features/invoices/components/InvoiceSuccess.tsx`

**Migrations**

- None unless a missing snapshot is identified. Any added snapshot column must be nullable and populated only for new invoices unless a safe backfill is planned.

**TDD Steps**

- [ ] Create invoice, update service price/name, reprint receipt, assert old price/name remain.
- [ ] Update fiscal settings, reprint old receipt, assert old CAI/range/hospital snapshot remains.
- [ ] Assert reprint creates audit log with user, invoice, and timestamp.
- [ ] Assert receipt paper size honors media carta, carta and A5 configuration for new receipts.

**Risks**

- Backfilling missing historical snapshots can invent facts. Do not backfill without marking inferred data.

**Acceptance Criteria**

- Reprint is a historical document view.
- Audit log can answer who reprinted what and when.

**Commit**

- `test(receipts): verify immutable historical reprints`

## Phase 8: Full Verification And Handoff Evidence

**Scope**

Run final local quality gates, E2E smoke flows, screenshots after changes, and code-review prompt against the diff.

**Files**

- Modify/create: `qa/financial-data-audit/FINAL_REPORT.md`
- Modify/create: `qa/financial-data-audit/after/*.png`
- Modify/create: `qa/financial-data-audit/INCONSISTENCIES_RESOLVED.md`
- Modify: `docs/DECISIONS.md`

**Migrations**

- Run `php artisan migrate` only. Do not run `migrate:fresh` on current data without explicit approval.

**Commands**

- `docker compose exec -T backend php artisan migrate:status`
- `docker compose exec -T backend php artisan test --colors=never`
- `docker compose exec -T backend vendor/bin/pint --test`
- `docker compose exec -T frontend npm run typecheck`
- `docker compose exec -T frontend npm run lint`
- `docker compose exec -T frontend npm run test`
- `docker compose exec -T frontend npm run build`
- `docker compose exec -T frontend npm run e2e`
- `docker compose exec -T frontend npm run check:branding` or host PowerShell equivalent if container lacks PowerShell
- Run `prompts/03_COMMIT_CODE_REVIEW_ORCHESTRATOR.md` mentally against each phase diff.

**Risks**

- E2E can depend on existing data. Use test-created records and avoid resetting shared data.

**Acceptance Criteria**

- Before/after screenshots exist for caja, factura, historial, reportes, respaldos, catalogo, configuracion, and receipt.
- Final report maps each fixed inconsistency to code, test, and screenshot evidence.
- No push performed.

**Commit**

- `test(finance): add accountability verification evidence`

## Plan Review With 8 Specialist Subagents

**Decision:** APROBADO CON CAMBIOS. No blockers remain after the corrections below, but Phase 1 must not begin until this plan is approved by the user.

| Subagent | Severity | Finding | Evidence | Correction |
|---|---:|---|---|---|
| Architecture | ALTA | The user request spans reports, cash, payments, catalog, receipts, UI, and QA. | Original goal is a multi-subsystem front. | Split into 8 phases with one commit each. |
| Database integrity | ALTA | Payment reversal fields are absent in current model/migration. | `Payment` model has `status` only; no void metadata. | Phase 3 adds void metadata and transactional recalculation. |
| Security/permissions | MEDIA | Admin/cashier financial visibility must be explicit. | User requires cajero/admin separation. | Phase 6 adds permission tests for financial figures. |
| UI/UX cashier | ALTA | Report UI can render `Saldo pendiente: undefined`. | `05-reportes.png`. | Phase 1 and Phase 6 add contract and UI tests. |
| Performance | MEDIA | Report services mix SQL aggregation and in-memory allocation. | `IncomeReportService` loads payments with invoice items. | Phase 1 centralizes facts; Phase 5 adds query/index review. |
| Offline LAN/devex | MEDIA | Vite container proxy uses `localhost:8000` from inside container and can 500 relative `/api`. | `probe-current-api.json` relative requests failed; direct backend requests passed. | Phase 0 records; Phase 6/devex fix if it affects app flows. |
| TDD/QA | ALTA | Full backend suite timed out, so final quality gate is not yet trustworthy. | `php artisan test` timed out at 5 minutes. | Phase 8 requires triage or successful full suite before done. |
| Hospital billing domain | ALTA | Partial, pending, void, and method-specific cash rules must be named separately. | User rules and current report scope. | Phase 1 defines financial facts and Phase 2 enforces cash semantics. |

## Checklist To Start Implementation

- [ ] User approves this plan.
- [ ] Keep Docker services running or restart with `docker compose up -d`.
- [ ] Do not reset database data.
- [ ] Start with Phase 0 only.
- [ ] Before any migration in later phases, create a backup or document why current data is disposable development data.
- [ ] After each phase, run targeted tests, commit with Conventional Commits, and review the diff against `prompts/03_COMMIT_CODE_REVIEW_ORCHESTRATOR.md`.
