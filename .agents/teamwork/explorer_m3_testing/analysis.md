# Milestone M3 Testing & Specification Analysis Report
**Hospital General San Isidro Cashier System Reconstruction**
**Milestone**: M3 — Receipts & Operation History (Features 10, 11, 12 in `PROJECT.md`)
**Investigator**: Explorer M3 Testing (Specification Miner)
**Date**: 2026-09-28T09:58:00Z
**Target Workspace**: `c:\Projects\S_Hospital_AI`

---

## 1. Executive Summary

Milestone M3 encompasses the operational history, search, inspection, reprint, collection, and cancellation lifecycle of all hospital billing transactions:
- **Feature 10: Receipts & Operations History** (R3, Mandato §5)
- **Feature 11: Audited Reprint Flow** (R3, Mandato §5)
- **Feature 12: Cancellations & Reversals** (R3, Mandato §5)

### Key Investigation Findings
1. **Frontend Vitest (`src/features/recibos/`)**: **47 tests passed across 6 test files**. Core filtering, table display, mobile cards, detail account ledger, and reprint reason prompt are covered. However, **critical gaps exist**: neither the **Void dialog** nor the **Reverse dialog** nor **Payment Collection from history** have unit tests in `src/features/recibos/`, and `InvoiceHistoryActionDialogs.tsx` has zero dedicated unit tests.
2. **Backend PHPUnit/Pest**: High domain rigor. `InvoiceHistoryReprintVoidTest` (**28 passed**), `InvoiceReverseTest` (**9 passed**), `VoidPaymentAgainstClosedCashSessionTest` (**2 passed**), `InvoiceReconciliationFiltersTest` (**3 passed**), and `InstitutionalReceipt` suite (**133 passed**) thoroughly verify DB transactions, durable counter increments, reason length validations, row locks, cash session constraints, and audit log generation.
3. **Playwright E2E (`e2e/recibos-flow.spec.ts`)**: **2 of 3 tests currently FAIL** due to specific mismatches (not business logic faults):
   - **Failure 1 (Test 1)**: Currency format assertion mismatch. Test asserts substring `"L 250.00"`, but UI correctly outputs `"L. 250.00"` per Feature 4 canonical token rules (`L.` with period).
   - **Failure 2 (Test 3)**: Mock HTML mismatch. The mock for `/api/institutional-receipts/:id/pdf` returns plain HTML without `<section class="receipt-page">`. The frontend parser (`summarizeReceiptDocument`) detects `exemplarCount === 0` and renders a warning callout (`"Vista previa incompleta"`) instead of the preview `iframe`, causing locator timeout.
   - **E2E Gaps**: No E2E tests exist for Voiding an invoice, Reversing a paid invoice, Collecting remaining balance from history, or mobile interaction workflows.

---

## 2. Features Discovered

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | History & Search | Single unified search bar | Interprets query as either patient name or invoice number correlative in one input | `q` (string, e.g. "Maria" or "000-001-01-00000010") | Filtered invoice list | Empty result message with "Limpiar filtros" action | `RecibosFilters.tsx`, `RecibosFilters.test.tsx` |
| 2 | History & Search | Grouped date range filter | Filters transactions between `date_from` and `date_to` | `date_from`, `date_to` (YYYY-MM-DD) | Filtered invoice collection | Rejects if `date_from > date_to` with visual alert and no query | `RecibosFilters.tsx` |
| 3 | History & Search | Status and payment filters | Filters by invoice status (`issued`, `paid`, `partial`, `void`), balance state (`pending`), or receipt state (`missing`) | Query params: `status`, `balance_state`, `receipt_state` | Filtered invoice collection | Invalid filter combinations return empty collection or 422 | `InvoiceController.php:48-124` |
| 4 | RBAC Scope | Cashier daily isolation | Cashier sees only own transactions emitted in current day; supervisors/admins see all historical across dates | User role / `invoices.operate_any` permission | Filtered invoice collection scoped by user and current date | 403 Forbidden when requesting other cashier's invoice detail directly | `InvoiceController.php:57-61`, `InvoiceHistoryReprintVoidTest.php:63-148` |
| 5 | History & Presentation | Mobile stacked card view | Replaces wide table under responsive breakpoint (`md`) with stacked cards preserving all actions, total, and status | Viewport width < 768px | Accessible list with 44px min touch targets | No horizontal scroll clip; status and actions preserved | `RecibosTable.tsx:294-390`, `RecibosTable.test.tsx:154-227` |
| 6 | Account Detail | Continuous ledger account inspection | Side panel displaying patient, invoice status, ledger lines (concept, qty, unit price, rule adjustment, line total), payments, and cash session | `GET /api/invoices/{id}` | Detailed account snapshot; rule provenance badges | "Dato histórico no disponible" if adjustment unpersisted; never invented 0 | `RecibosDetailPanel.tsx`, `RecibosDetailPanel.test.tsx` |
| 7 | Account Detail | Deep linking via `?operacion=` | URL parameter opens corresponding invoice detail drawer and sets active row state | URL search param `operacion={id}` | Opens detail side panel, focuses invoice row | Error callout with retry if network fails; invalid ID displays error | `RecibosView.tsx:68-76`, `RecibosView.test.tsx:149-199` |
| 8 | Debt Settlement | Settle remaining balance | Cashier can register partial or full payment on unpaid/partial invoice directly from history table or detail | Click "Cobrar" / "Cobrar saldo" -> `PaymentModal` | `POST /api/invoices/{id}/payments`, updates balance | Blocked if local cash session is closed; prevents overpayment | `RecibosView.tsx:359-391`, `useInvoiceHistoryActions.ts:91-136` |
| 9 | Audited Reprint | Institutional receipt reprint | Reprints institutional receipt document; increments persistent `reprint_count`, logs `reprint` print event | `POST /api/institutional-receipts/{id}/print-events` with `{ reason: string }` | Updated receipt with `reprint_count` + 1 and `REIMPRESIÓN #N` watermark | Rejects reason < 5 chars; rejects missing reason after first print | `InstitutionalReceiptController.php`, `InstitutionalReceiptPaymentIntegrationTest.php:421-460` |
| 10 | Audited Reprint | Legacy receipt reprint | Reprints legacy invoice-receipt; increments durable `invoices.legacy_reprint_count`, preserves `issued_at` | `POST /api/invoices/{id}/reprint` with `{ reason: string }` | Receipt JSON with `copy_label: 'REIMPRESIÓN #N'` | Rejects reason < 5 or > 500 chars; rejects automated strings; rejects void invoices | `ReprintReceiptAction.php`, `InvoiceHistoryReprintVoidTest.php:330-490` |
| 11 | Audited Reprint | Decoupled preview & first print | Document view / HTML preview does not consume correlative or trigger reprint counter | `GET /api/institutional-receipts/{id}/pdf?preview=1` | HTML markup of receipt | First physical print records `issued_print` without reason required | `InstitutionalReceiptController.php:31-42`, `RecibosView.reprint.test.tsx:80-116` |
| 12 | Cancellations | Unpaid invoice void | Marks unpaid invoice as `void`; records `voided_by`, `voided_at`, `void_reason`; voids institutional receipt if any | `POST /api/invoices/{id}/void` with `{ reason: string }` | Invoice with `status: 'void'` | Rejects if invoice has posted payments; rejects if cash session closed; requires min 5 chars | `VoidInvoiceAction.php`, `InvoiceHistoryReprintVoidTest.php:570-660` |
| 13 | Reversals | Paid invoice reversal | Voids all posted payments, creates negative `CashMovement` refund entries, sets invoice to `void`, voids receipt | `POST /api/invoices/{id}/reverse` with `{ reason: string }` | Invoice with `status: 'void'`, all payments void | Rejects if any payment was in a closed cash session; rejects unpaid invoice; requires min 5 chars | `ReverseInvoiceAction.php`, `InvoiceReverseTest.php:30-150` |
| 14 | Payment Void | Individual payment void | Reverses specific payment on an invoice, recalculates invoice balance and status (`paid` -> `partial` or `issued`) | `POST /api/invoices/{id}/payments/{paymentId}/void` with `{ reason: string }` | Payment with `status: 'void'`, negative `CashMovement` | Fails if session is closed without special authorization; voids linked receipt | `VoidPaymentAction.php`, `VoidPaymentAgainstClosedCashSessionTest.php` |
| 15 | Document Verification | Receipt markup structural validation | Parses generated receipt HTML to count `.receipt-page` exemplars and read copy labels / reprint watermarks | Receipt HTML string | `ReceiptDocumentSummary` (exemplars, copy labels, reprint label) | If `exemplarCount === 0`, marks document incomplete; refuses blank iframe | `receiptDocumentSummary.ts`, `InstitutionalReceiptPreviewFrame.tsx:67-81` |

---

## 3. Edge Cases & Observed Behaviors

| # | Feature | Input / Condition | Observed Behavior | Authoritative Source |
|---|---------|-------------------|-------------------|----------------------|
| 1 | Void on Paid Invoice | `POST /api/invoices/{id}/void` on invoice with posted payments | Blocked with 200/null (or rejection), records `invoice.void_blocked_paid` in `audit_logs` without mutating invoice. Must use Reversal flow. | `VoidInvoiceAction.php:67-88`, `InvoiceHistoryReprintVoidTest.php:610-630` |
| 2 | Void on Closed Cash Session | `POST /api/invoices/{id}/void` on invoice where issuing cash session is now closed | Fails with ValidationException: "No se puede anular una factura de una caja cerrada." | `VoidInvoiceAction.php:57-61` |
| 3 | Reversal on Closed Cash Session | `POST /api/invoices/{id}/reverse` on paid invoice where payment session is closed | Reversal rejected inside transaction: "No se puede reversar una factura con pagos en caja cerrada. Registre un ajuste autorizado." No cash mutated. | `ReverseInvoiceAction.php:72-76`, `InvoiceReverseTest.php:80-100` |
| 4 | Reversal on Unpaid Invoice | `POST /api/invoices/{id}/reverse` on invoice with no payments | Reversal rejected: "Solo se pueden reversar facturas con pagos registrados. Para facturas sin pagos use anulacion." | `ReverseInvoiceAction.php:100-104`, `InvoiceReverseTest.php:105-115` |
| 5 | Reason Validation Length | Reason with 4 characters (e.g. `"Test"`) in void, reverse, or reprint | ValidationException: Reason must be at least 5 characters. Form requests and Actions independently reject short reasons. | `VoidInvoiceAction.php:36`, `ReverseInvoiceAction.php:46`, `ReprintReason.php` |
| 6 | MariaDB Timestamp Drift on Reprint | Re-saving invoice model to increment `legacy_reprint_count` | `preserveInvoiceIssuedAt()` explicitly restores `issued_at` to prevent MariaDB from updating `TIMESTAMP` column on row update. | `ReprintReceiptAction.php:65-81`, `InvoiceHistoryReprintVoidTest.php:365-385` |
| 7 | Reprint Counter Durability | Database `audit_logs` pruned or deleted | `reprint_count` and `legacy_reprint_count` survive because they are stored directly on the entity table, not computed via `COUNT(audit_logs)`. | `ReprintReceiptAction.php:26-30`, `InstitutionalReceiptPaymentIntegrationTest.php:421-460` |
| 8 | Idempotency Key Replay | Same `Idempotency-Key` sent twice for reprint or print event | Returns HTTP 200/201 with header `Idempotent-Replay: true`; counter does NOT advance twice; no duplicate audit log created. | `InstitutionalReceiptPaymentIntegrationTest.php:410-419`, `InvoiceHistoryReprintVoidTest.php:720-745` |
| 9 | Incomplete Receipt Preview HTML | Backend HTML preview returned without `<section class="receipt-page">` | `summarizeReceiptDocument()` returns `exemplarCount: 0`. UI displays `AdminCallout` warning ("Vista previa incompleta") rather than empty white iframe. | `receiptDocumentSummary.ts:82-92`, `InstitutionalReceiptPreviewFrame.tsx:67-81` |
| 10 | Unpersisted Rule Adjustment on Historical Items | Invoice item has `special_rule_applied: true` but `rule_adjustment_persisted: false` | UI explicitly displays `"Dato histórico no disponible"`. Never displays fabricated `"L. 0.00"` adjustment. | `recibosModel.ts:60-75`, `RecibosDetailPanel.test.tsx:134-144` |
| 11 | Historical Read Authorization Scope | User has `reports.view` or `invoices.void` without `invoices.operate_any` | Scope restricted to own invoices today. Attempt to view other cashier's historical invoice returns 403 Forbidden. | `InvoiceController.php:57-61`, `InvoiceHistoryReprintVoidTest.php:85-129` |
| 12 | Zero-Total Invoice Payment State | Invoice total is 0.00 (e.g. 100% EPO dialysis coverage) | Rendered as `"Emitida sin cobro"`, never displayed as "Cobrada" or "Pendiente". | `recibosModel.ts`, `RecibosTable.test.tsx:127-133` |

---

## 4. Current Test Suite Audit

### 4.1 Frontend Unit Tests (`vitest run src/features/recibos/`)
- **Status**: 6 test files, 47 tests — **100% PASS** (duration ~7s).
- **Files**:
  1. `RecibosFilters.test.tsx` (7 tests): Search by patient or document correlative in single input, invalid date range rejection, hide cashbox dropdown when unauthorized, show authorized cashbox and clear filters, unified period group.
  2. `RecibosTable.test.tsx` (12 tests): Document kind and textual payment states, primary row action and dropdown menu, reprint priority when view is restricted, zero-total labeled "Emitida sin cobro", total column accessible sort (`aria-sort`), mobile responsive card layout, mobile card actions, synchronized sort state between mobile and desktop, 44px touch targets on mobile actions, separated financial vs documentary states, row selection highlight, stable trigger focus attributes.
  3. `RecibosDetailPanel.test.tsx` (6 tests): Ledger item line rendering (concept, quantity, unit price, rule adjustment, line total), persisted rule adjustment display (EPO "Sin cobro por receta" with magnitude L. 25.00), historical unpersisted rule adjustment labeled "Dato histórico no disponible", grouping in header, lines with financial summary, explicit empty state when 0 items.
  4. `RecibosView.test.tsx` (8 tests): Unauthorized view state without permission, loading state with `role="status"`, "sin operaciones" vs "sin coincidencias", clear filters button, error boundary with retry retaining active filters, filter chips and pagination ranges, deep linking via `?operacion=`, opening detail and initiating reprint modal.
  5. `RecibosView.reprint.test.tsx` (2 tests): First print does not create new charges or numbers, reprint enforces mandatory human reason and records durable print event with idempotency key.
  6. `recibosModel.test.ts` (12 tests): `documentView`, `paymentStateView`, `itemAdjustmentLabel`, `lineAdjustmentView`, `copiesFromMode`, `printInfoText`, `receiptPagesLabel`, `resultCountLabel`, `resultRangeLabel`, `activeFilterChips`.

### 4.2 Backend Feature Tests
- **Status**: Tested suites pass with 0 failures:
  - `InvoiceHistoryReprintVoidTest.php`: **28 tests passed** (189 assertions, 16.9s).
  - `InvoiceReverseTest.php`: **9 tests passed** (54 assertions, 6.7s).
  - `VoidPaymentAgainstClosedCashSessionTest.php`: **2 tests passed** (10 assertions, 3.2s).
  - `InvoiceReconciliationFiltersTest.php`: **3 tests passed** (25 assertions, 3.4s).
  - `InstitutionalReceiptPaymentIntegrationTest.php`: **133 tests passed**, 5 skipped (2717 assertions, 97.2s).

### 4.3 Playwright E2E Tests (`e2e/recibos-flow.spec.ts`)
- **Status**: 1 passed, **2 failed** (36.6s).
- **Execution Output**:
  ```
  x  1 [chromium] › e2e/recibos-flow.spec.ts:148 › muestra el historial con estado de pago y comprobante vinculado (12.4s)
  ok 2 [chromium] › e2e/recibos-flow.spec.ts:164 › abre el detalle de una operación en el panel lateral (2.1s)
  x  3 [chromium] › e2e/recibos-flow.spec.ts:179 › reimprime el recibo institucional exigiendo un motivo auditado (12.0s)
  ```

#### Detailed Root Cause Analysis for E2E Failures:
1. **Failure in Test 1 (`recibos-flow.spec.ts:157`)**:
   - *Verbatim Error*:
     ```
     Error: expect(locator).toContainText(expected) failed
     Locator: getByRole('row', { name: /A-0001.*Maria Lopez/i })
     Expected substring: "L 250.00"
     Received string: "A-0001Sin comprobante18/09/2026 09:30 a. m.Maria LopezL. 250.00Pendiente de cobroCobrar"
     ```
   - *Root Cause*: Feature 4 of `PROJECT.md` mandates standardizing currency format to `"L. 15.00"` with tabular numbers. The UI correctly renders `"L. 250.00"`. The outdated E2E spec asserts `"L 250.00"` without the period.

2. **Failure in Test 3 (`recibos-flow.spec.ts:192`)**:
   - *Verbatim Error*:
     ```
     Error: expect(locator).toBeVisible() failed
     Locator: getByRole('dialog', { name: /comprobante de factura - A-0002/i }).getByTitle(/vista previa del recibo institucional REC-00000070/i)
     Expected: visible
     Timeout: 10000ms
     ```
   - *Root Cause*: In `recibos-flow.spec.ts:135`, the mock route for `/api/institutional-receipts/:id/pdf` returns:
     ```typescript
     body: '<!doctype html><html><body><h1>REC-00000070</h1></body></html>'
     ```
     The frontend component `InstitutionalReceiptPreviewFrame.tsx` feeds this markup to `summarizeReceiptDocument(preview.data)`. Because `countExemplarBlocks` counts HTML elements matching regex `/\breceipt-page\b/`, it finds 0 exemplars (`exemplarCount === 0`). Per its design contract, the component does NOT render an empty `iframe`; instead it displays an `AdminCallout` warning: `"Lo recibido para el recibo REC-00000070 no incluye las páginas del comprobante"`. As a result, the locator `getByTitle(/vista previa del recibo institucional REC-00000070/i)` never appears in the DOM and times out.

---

## 5. Test Gap Analysis Against Acceptance Criteria R3

| Acceptance Criteria (R3 / Features 10, 11, 12) | Current Test Coverage | Identified Gaps | Severity |
|-----------------------------------------------|-----------------------|-----------------|----------|
| **10.1 Search by patient, number, date, status** | Unit tested in `RecibosFilters.test.tsx` (patient/number); Backend tested in `InvoiceHistoryReprintVoidTest`. | **Frontend Filter Execution**: No test verifies applying status filter or applying valid date range triggers `onApply` with correct params. **E2E**: Zero tests verifying live UI filtering. | Medium |
| **10.2 Robust pagination** | Tested in `InvoicePagination.test.tsx` and `RecibosView.test.tsx` (range label). | Page change click interaction (`next`, `prev`, specific page) not verified in `RecibosView.test.tsx` integration. | Low |
| **10.3 Account Detail Modal & Rule Provenance** | Extensively tested in `RecibosDetailPanel.test.tsx` and `recibosModel.test.ts`. | Well-covered. E2E test 2 verifies drawer open. | None |
| **10.4 Balance collection from history** | Backend tested in `PaymentIntegrationTest`. `invoiceActionPolicy.ts` tested. | **Frontend Integration**: No unit test verifies clicking "Cobrar" opens `PaymentModal`, enters amount, and calls `apiClient.registerPayment()`. **E2E**: No E2E test covers collection from `/recibos`. | High |
| **11.1 Audited Reprint Modal (Reason 5-500 chars)** | Backend thoroughly tested in `ReprintReceiptAction` & `InstitutionalReceiptPaymentIntegrationTest`. Frontend reprint modal verified in `RecibosView.reprint.test.tsx`. | **E2E Failure**: Broken by mock markup bug. E2E needs fix and regression suite. Boundary validation for <5 chars in modal needs explicit E2E check. | High |
| **11.2 Durable reprint counter increment** | Backend row-lock transaction tested in `InvoiceHistoryReprintVoidTest` & `InstitutionalReceiptPaymentIntegrationTest`. | Well-covered at backend and frontend model levels. | None |
| **11.3 Decoupled preview & charge** | Backend and frontend unit tested (`RecibosView.reprint.test.tsx:80`). | Well-covered. | None |
| **12.1 Permissions-controlled Void (`invoices.void`)** | Backend tested in `InvoiceHistoryReprintVoidTest` (unpaid only, open session only, reason >= 5). Policy unit tested. | **Frontend Void UI**: Zero unit tests in `RecibosView` / `RecibosDetailPanel` for opening void dialog, validating reason, submitting void, and handling errors. **E2E**: Zero E2E tests for void flow. | Critical |
| **12.2 Permissions-controlled Reversal (`invoices.reverse`)** | Backend tested in `InvoiceReverseTest` (multi-payment voiding, closed session block, reason >= 5, receipt void). Policy unit tested. | **Frontend Reversal UI**: Zero unit tests in `RecibosView` / `RecibosDetailPanel` for opening reverse dialog, validating reason, submitting reversal, and handling errors. **E2E**: Zero E2E tests for reversal flow. | Critical |
| **12.3 Cashbox refund movements during reversal** | Backend verified in `VoidPaymentAction` and `CashPaymentsReceiptTest`. | Concurrency race condition test between simultaneous payment void / session closure. | Medium |
| **12.4 Soft deletion invariant (no row deletion)** | Backend tested in `InvoiceHistoryReprintVoidTest.php:570` (`test_void_marks_invoice_and_does_not_delete_items`). | Well-covered. | None |
| **10.5 Responsive mobile adaptability** | Mobile card layout, 44px targets, synchronized sort tested in `RecibosTable.test.tsx`. | No E2E viewport test (390×844) executing actions on mobile card. | Medium |

---

## 6. Proposed Concrete Test Matrix for Milestone M3

To achieve ironclad confidence for Milestone M3 sign-off, the following test matrix must be satisfied across Tiers 1 through 4:

### Tier 1: Frontend Unit & Component Tests (Vitest)
| Test ID | File Target | Scenario Description | Inputs / Action | Expected Result |
|---------|-------------|----------------------|-----------------|-----------------|
| `FE-M3-01` | `RecibosFilters.test.tsx` | Status dropdown filtering | Select status "Anulada" -> Click Buscar | `onApply` called with `{ status: 'void' }` |
| `FE-M3-02` | `RecibosFilters.test.tsx` | Valid date range application | Desde: 2026-09-01, Hasta: 2026-09-18 -> Click Buscar | `onApply` called with `{ date_from: '2026-09-01', date_to: '2026-09-18' }` |
| `FE-M3-03` | `InvoiceHistoryActionDialogs.test.tsx` | Void dialog validation | Input reason "1234" (< 5 chars) | Confirm button disabled; error message displayed |
| `FE-M3-04` | `InvoiceHistoryActionDialogs.test.tsx` | Reverse dialog validation | Input reason "1234" (< 5 chars) | Confirm button disabled; error message displayed |
| `FE-M3-05` | `RecibosView.void.test.tsx` | Execute Void flow | Open detail of unpaid invoice -> Click Anular -> Type "Error de captura de paciente" -> Confirm | `apiClient.voidInvoice` called with ID & reason; status banner shown; list invalidated |
| `FE-M3-06` | `RecibosView.reverse.test.tsx` | Execute Reverse flow | Open detail of paid invoice -> Click Reversar -> Type "Paciente canceló atención médica" -> Confirm | `apiClient.reverseInvoice` called with ID & reason; status banner shown; list invalidated |
| `FE-M3-07` | `RecibosView.collect.test.tsx` | Balance collection flow | Click Cobrar on invoice with balance L. 115.00 -> Fill L. 115.00 cash -> Confirm | `apiClient.registerPayment` called; modal closes; balance cleared |
| `FE-M3-08` | `RecibosDetailPanel.test.tsx` | Action buttons permission visibility | Permissions with `canVoid: false`, `canReverse: false` | "Anular" and "Reversar" buttons are not rendered in footer |

### Tier 2: Backend Feature Tests (PHPUnit / Pest)
| Test ID | File Target | Scenario Description | Inputs / Action | Expected Result |
|---------|-------------|----------------------|-----------------|-----------------|
| `BE-M3-01` | `InvoiceReverseTest.php` | Reversal generates negative `CashMovement` | Reverse paid invoice with L. 250.00 cash payment | `cash_movements` contains entry with `amount: -250.00` and `type: payment_void` |
| `BE-M3-02` | `InvoiceReverseTest.php` | Reversal of multi-payment mixed methods | Invoice paid with L. 100 Cash + L. 150 Transfer | Two negative cash movements created matching respective payment methods |
| `BE-M3-03` | `InvoiceHistoryReprintVoidTest.php` | Cashier without `invoices.operate_any` cannot void past-day invoice | Cashier calls `POST /api/invoices/{past_id}/void` | 403 Forbidden |
| `BE-M3-04` | `Concurrent/InvoiceReverseConcurrencyTest.php` | Concurrent reversal and payment attempt | Two parallel requests: one reversing, one adding payment | Row lock serializes; second request fails gracefully with validation error |

### Tier 3: End-to-End Specs (Playwright)
| Test ID | File Target | Scenario Description | Inputs / Action | Expected Result |
|---------|-------------|----------------------|-----------------|-----------------|
| `E2E-M3-01` | `recibos-flow.spec.ts` | **Fix: Currency formatting assertion** | Assert row text | Matches `"L. 250.00"` (with period) |
| `E2E-M3-02` | `recibos-flow.spec.ts` | **Fix: Mock HTML for preview frame** | Mock `/api/institutional-receipts/:id/pdf` with `<section class="receipt-page">` | Frame loads preview; dialog title visible; reprint flow succeeds |
| `E2E-M3-03` | `recibos-flow.spec.ts` | Complete Void workflow | Open unpaid invoice A-0001 -> Anular -> Fill reason -> Submit | Badge becomes "Anulada"; row status updates; action buttons removed |
| `E2E-M3-04` | `recibos-flow.spec.ts` | Complete Reversal workflow | Open paid invoice A-0002 -> Reversar -> Fill reason -> Submit | Badge becomes "Anulada"; receipt revoked; balance displays settled |
| `E2E-M3-05` | `recibos-flow.spec.ts` | Balance collection workflow | Click "Cobrar" on A-0001 -> PaymentModal appears -> Submit payment | Invoice status transitions to "Cobrada"; receipt number assigned |
| `E2E-M3-06` | `recibos-mobile.spec.ts` | Mobile 390×844 Card Operations | Set viewport 390×844 -> Click Detalle on stacked card | Card opens drawer cleanly without horizontal scrolling; touch targets >= 44px |

### Tier 4: Real-World Workloads & Audit Resilience
| Test ID | Scenario Description | Verification Method |
|---------|----------------------|---------------------|
| `RW-M3-01` | Audit log durability under pruning | Execute 5 reprints -> Prune `audit_logs` older than current hour -> Verify `GET /api/invoices/{id}` still reports `reprint_count: 5` and reprint modal prompts for `#6`. |
| `RW-M3-02` | End-of-shift reconciliation with reversed transactions | Open shift L. 500 -> Issue & collect L. 200 -> Reverse L. 200 -> Arqueo expected amount is L. 500.00 (reversal fully decremented drawer balance). |
| `RW-M3-03` | Offline reprint without network mutation | Disconnect server mock -> Attempt reprint -> Displays LAN offline error callout with retry; no local state corruption. |

---

## 7. Quality Gate Recommendations for Milestone M3

To consider Milestone M3 complete, the following gates must pass:
1. **Frontend Unit Tests**: All tests in `src/features/recibos/` pass with new unit tests added for Void, Reverse, and Payment Collection dialogs.
2. **E2E Tests**: Fix the 2 broken assertions/mocks in `e2e/recibos-flow.spec.ts` and add tests for Void and Reversal flows. Run: `npx playwright test e2e/recibos-flow.spec.ts --project=chromium` with 100% pass rate.
3. **Backend Static & Tests**: `php artisan test --filter="Invoice|Reprint|Receipt"` passes with 0 failures; `vendor/bin/pint --test` passes; `vendor/bin/phpstan analyse` passes.
4. **Offline & Contract Compliance**: Ensure all currency values retain canonical `"L. 15.00"` formatting; ensure no QR or barcode exposures appear in receipt outputs.
