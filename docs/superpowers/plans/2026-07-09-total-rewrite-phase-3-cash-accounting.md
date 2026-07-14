# S_Hospital Total Rewrite Phase 3: Cash Reconciliation and Operational Accounting

**Goal:** Make cash reconciliation complete and unambiguous from the live session through close confirmation, closed-session summary and reports.

**Architecture:** Laravel remains authoritative for every monetary and blocking value. `BuildCashReconciliationAction` produces one reconciliation vocabulary, the close endpoint normalizes its immutable snapshot into that same public contract, and a small frontend accounting module turns the contract into operator-facing control states. No generic expenses are introduced because the product has no approved expense policy.

**Tech Stack:** Laravel 12, MariaDB 11, PHPUnit, React 19, TypeScript 5, Vitest, Testing Library and Playwright.

## Global Constraints

- Posted payments, reversed payments, pending invoices and missing institutional receipts must be separate facts.
- Only posted cash payments increase expected physical cash.
- Transfer, card and other methods never increase the drawer amount.
- Closing remains blocked by pending/partial invoices and paid invoices without an issued institutional receipt.
- Closed-session totals come from the close snapshot, not later mutable invoice/payment state.
- Generic expenses remain unsupported and the UI must say so explicitly instead of displaying a misleading zero.
- No monetary value is recalculated with floating point in the backend.

---

### Task 1: Normalize the reconciliation contract at close

**Files:**
- Modify: `backend/app/Actions/Cash/BuildCashReconciliationAction.php`
- Modify: `backend/app/Http/Controllers/CashSessionController.php`
- Modify: `backend/tests/Feature/CashPaymentsReceiptTest.php`
- Modify: `backend/tests/Feature/Cash/CloseCashSessionTest.php`

- [ ] Add failing assertions proving that live reconciliation exposes reversed-payment count and amount.
- [ ] Add failing close-response assertions for normalized `payments_count`, `payments_total`, `payments_by_method`, `expected_cash_amount`, `pending_invoice_count`, `pending_amount` and `missing_institutional_receipt_count`.
- [ ] Count voided payments by `amount_cents` without adding them back into posted totals or expected cash.
- [ ] Return the closed snapshot under the same public field names used by an open session.
- [ ] Keep close authorization, transaction locks, blocker checks and audit writes unchanged.
- [ ] Run focused MariaDB tests, Pint and PHPStan.

### Task 2: Carry reconciliation facts into the cash-session report

**Files:**
- Modify: `backend/app/Actions/Reports/CashSessionReportService.php`
- Modify: `backend/tests/Feature/ReportsTest.php`
- Modify: `frontend/src/lib/api/types.ts`

- [ ] Add failing report assertions for missing receipts and reversed-payment totals.
- [ ] Preserve the immutable posted-payment snapshot for closed sessions while reporting reversal activity as a separate fact.
- [ ] Extend `CashSession` and `CashSessionReport` with required reconciliation fields where the API guarantees them.
- [ ] Verify open and closed reports against MariaDB.

### Task 3: Present an actionable accounting control state

**Files:**
- Create: `frontend/src/modules/accounting/application/reconciliationStatus.ts`
- Create: `frontend/src/modules/accounting/application/reconciliationStatus.test.ts`
- Create: `frontend/src/modules/accounting/components/AccountingControlPanel.tsx`
- Create: `frontend/src/modules/accounting/components/AccountingControlPanel.test.tsx`
- Modify: `frontend/src/features/cash/CashBoxView.tsx`
- Modify: `frontend/src/features/cash/components/CloseSessionDialog.tsx`
- Modify: `frontend/src/features/reports/components/CashSessionReportPanel.tsx`
- Modify related component tests.

- [ ] TDD a pure status interpreter for `ready`, `pending_invoices` and `missing_receipts` blockers plus reversal activity.
- [ ] Show pending balances, missing receipts and reversed payments before the cashier attempts to close.
- [ ] Disable close confirmation locally for known blockers while retaining the mandatory server refresh and backend enforcement.
- [ ] Show an explicit policy note: operational expenses are not modeled in this version; no fake `L 0.00` expense metric.
- [ ] Reuse the control panel in live cash and the cash-session report.
- [ ] Keep all money display derived from server strings and existing safe formatters.

### Task 4: Verify cash and accounting end to end

**Files:**
- Modify: `frontend/e2e/cashbox.spec.ts`
- Modify: `docs/testing-report.md`
- Modify: `CHANGELOG.md`

- [ ] Extend E2E with a blocked close caused by a missing receipt and assert no close request is sent.
- [ ] Verify a clean close response keeps method totals in the confirmed summary.
- [ ] Run backend focused tests, frontend critical tests, cashbox E2E, lint, typecheck and build.
- [ ] Record exact evidence and commit with `refactor(cash): unify reconciliation and close summary`.

## Acceptance Criteria

- Live, close and report screens use the same reconciliation vocabulary.
- Closed summary never replaces real method totals with zero because of response-shape mismatch.
- Reversed payments are visible and excluded from collected/expected amounts.
- Missing institutional receipts are visible before close and still enforced by the backend.
- Expenses are described as unsupported, not reported as a numeric fact.
- Focused MariaDB, frontend, Playwright and static/build gates pass.
