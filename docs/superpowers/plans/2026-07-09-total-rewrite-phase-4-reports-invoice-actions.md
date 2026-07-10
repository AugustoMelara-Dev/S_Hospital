# S_Hospital Total Rewrite Phase 4: Reporting Semantics and Invoice Actions

**Goal:** Make financial definitions identical across API, UI, PDF and Excel, and centralize invoice-history action eligibility so unavailable operations never render.

**Architecture:** `ExecutiveReportService` publishes an explicit operational-accounting policy. UI and exporters consume the same definitions instead of implying double subtraction of voids/reversals. Invoice history delegates receipt/void/reverse eligibility to a pure module policy, leaving the table responsible only for rendering authorized actions.

## Constraints

- `billed_total` already excludes void invoices.
- `collected_total` already excludes void payments and payments on void invoices.
- Voided and reversed amounts are disclosure facts and must not be subtracted a second time.
- This product is operational cash/income reporting, not double-entry accounting.
- Invoice action visibility must consider state, ownership window and permissions before rendering.
- Catalog price/tax/availability changes and fiscal identity/tax changes remain reasoned and audited.

### Task 1: Lock accounting definitions across report outputs

**Files:**
- Modify `backend/app/Actions/Reports/ExecutiveReportService.php`
- Modify `backend/app/Actions/Reports/ExecutivePdfExportService.php`
- Modify `backend/app/Actions/Reports/ExecutiveExcelExportService.php`
- Modify executive report/export tests
- Modify `frontend/src/lib/api/types.ts`
- Create `frontend/src/modules/reports/components/AccountingPolicyPanel.tsx` and tests
- Modify `frontend/src/features/reports/ReportsExecutive.tsx`

- [ ] Add failing assertions for an `accounting_policy` response contract.
- [ ] State that billed/collected totals are already net of their exclusions.
- [ ] Remove the incorrect glossary formula `facturado - anulado - reversado`.
- [ ] Show the same policy in the executive UI, PDF and Excel glossary.

### Task 2: Centralize invoice-history action eligibility

**Files:**
- Create `frontend/src/modules/invoices/application/invoiceActionPolicy.ts` and tests
- Modify `frontend/src/features/invoices/history/InvoiceHistoryTable.tsx`
- Modify related history tests

- [ ] TDD state/permission combinations for view, first download, generate missing receipt, reprint, reverse and void.
- [ ] Return no actions for void invoices or unauthorized ownership scopes.
- [ ] Replace nested table conditionals with the policy result without changing handlers.

### Task 3: Reconfirm catalog and fiscal invariants

**Files:**
- Modify `docs/testing-report.md`
- Modify `CHANGELOG.md`

- [ ] Run focused backend catalog/fiscal tests for required reasons, audit history and erythropoietin constraints.
- [ ] Run focused frontend catalog/fiscal/history/report tests.
- [ ] Run report E2E, lint, typecheck, static analysis and build.
- [ ] Commit as `refactor(reports): align accounting definitions and invoice actions`.

## Acceptance Criteria

- API, UI, PDF and Excel explain totals with the same non-double-counting policy.
- No report calls an already-filtered total `facturado - anulado - reversado`.
- Invoice-history buttons are produced by one tested pure policy.
- Catalog and fiscal reason/audit invariants remain green.
