# Technical Analysis: M3 Backend Receipts & Operations History API

## 1. Executive Summary

This investigation analyzed the backend architecture for Receipts & Operation History (Milestone M3, Requirement R3) in `Hospital General San Isidro Cashier System`.

Key conclusions:
1. **Listing & Filtering API**: The canonical endpoint for receipt and operations history is `GET /api/invoices`. There is no separate redundant `/api/receipts` endpoint; instead, `InvoiceController::index` embeds an `institutional_receipt` summary into each invoice object. The endpoint implements complete filtering by patient name, invoice number, date range (`date_from`, `date_to`), status (`issued`, `partial`, `paid`, `void`), cashier (`user_id`), cash session (`cash_session_id`), and specialized reconciliation states (`balance_state=pending`, `receipt_state=missing`). Cashiers without supervisor permissions are strictly scoped to their own invoices issued today.
2. **Reprint Architecture**: Both legacy receipt reprint (`POST /api/invoices/{id}/reprint`) and institutional PDF reprint (`POST /institutional-receipts/{id}/pdf`) require mandatory operator-authored human reasons of 5–500 characters, enforce `receipts.reprint` permissions, lock records `FOR UPDATE` within DB transactions, durably increment persistent database counters (`invoices.legacy_reprint_count` and `institutional_receipts.reprint_count`), emit `REIMPRESIÓN #n` labels, and write structured entries to `audit_logs` and `institutional_receipt_print_events`.
3. **Void vs. Reversal Segregation**:
   - `POST /api/invoices/{id}/void` operates exclusively on **unpaid** invoices (`status = issued`), requiring `invoices.void` permission, reason (5–500 chars), and open cash session. It voids associated institutional receipts and records an audit log. Attempting to call `/void` on an invoice with payments is blocked and logs `invoice.void_blocked_paid`.
   - `POST /api/invoices/{id}/reverse` operates on **paid or partially paid** invoices, requiring `invoices.reverse` permission and reason (5–500 chars). In a single DB transaction, it verifies that cash sessions are open, executes `VoidPaymentAction` on every posted payment (generating negative cash movements of type `payment_void`), voids institutional receipts, sets invoice to `STATUS_VOID`, and audits the reversal.
4. **Historical Data Preservation**: Invoices and items are strictly snapshot-driven (`invoice_items` stores denormalized prices, names, and rule adjustments; `invoices` stores institution, fiscal, and tax snapshots). Catalog changes never mutate historical invoices. The `PreservesIssuedTimestamps` trait prevents MariaDB implicit `ON UPDATE` timestamp overwrites during counter increments or void status changes.
5. **Test Suite Verification**: 100% of relevant backend test suites pass with 0 failures:
   - `InvoiceHistoryReprintVoidTest`: 28 passed, 189 assertions.
   - `InvoiceReverseTest`: 9 passed, 54 assertions.
   - `InvoiceReconciliationFiltersTest`: 3 passed, 25 assertions.
   - `InstitutionalReceiptIssueTest`: 10 passed, 75 assertions.
   - `InstitutionalReceiptPdfTest`: 34 passed, 1318 assertions.
   - `Billing` feature tests: 52 passed, 386 assertions.
   - `Payment` feature tests: 128 passed, 4 skipped (MariaDB-specific checks), 1337 assertions.

---

## 2. Detailed Findings by Investigation Question

### 2.1 Question 1: Invoices and Receipts Listing & Filtering Endpoints

#### Endpoint Details
- **Route**: `GET /api/invoices` (`backend/routes/api.php:151`)
- **Controller**: `App\Http\Controllers\InvoiceController::index` (`backend/app/Http/Controllers/InvoiceController.php:32-134`)
- **Form Request**: `App\Http\Requests\Billing\IndexInvoiceRequest` (`backend/app/Http/Requests/Billing/IndexInvoiceRequest.php:9-50`)
- **Policy**: `App\Policies\InvoicePolicy::viewAny` (`backend/app/Policies/InvoicePolicy.php:36-39`)

#### Supported Query Parameters and Filters
| Parameter | Type / Validation | Query Behavior | Line Reference |
|---|---|---|---|
| `page` | `integer, min:1` | Pagination page number | `IndexInvoiceRequest.php:22` |
| `per_page` | `integer, min:1, max:50` | Pagination page size (defaults to 15) | `IndexInvoiceRequest.php:23, 46-49` |
| `patient` | `string, max:180` | `where('patient_name', 'like', "%{$escaped}%")` | `InvoiceController.php:71-73` |
| `invoice_number` | `string, max:80` | `where('invoice_number', 'like', "%{$escaped}%")` | `InvoiceController.php:74-76` |
| `date_from` | `date` | `where('issued_at', '>=', $dateFrom)` (privileged users) | `InvoiceController.php:63-65` |
| `date_to` | `date, after_or_equal:date_from` | `where('issued_at', '<=', $dateTo . ' 23:59:59')` | `InvoiceController.php:66-69` |
| `status` | `in:issued,partial,paid,void` | `where('status', $status)` | `InvoiceController.php:70` |
| `user_id` | `integer, exists:users,id` | `where('issued_by', $userId)` (privileged users) | `InvoiceController.php:77-80` |
| `cash_session_id` | `integer, exists:cash_register_sessions,id` | `where('cash_session_id', $cashSessionId)` | `InvoiceController.php:81-84` |
| `balance_state` | `in:pending`, prohibits `receipt_state` | Filters `status IN (issued, partial)` for session reconciliation | `InvoiceController.php:102-108` |
| `receipt_state` | `in:missing`, prohibits `balance_state` | Filters `status = paid` where no issued `institutional_receipt` exists | `InvoiceController.php:109-122` |
| `reconciliation_cash_session_id` | `integer`, required with `balance_state`/`receipt_state` | Matches either invoice session or sessions of posted payments on invoice | `InvoiceController.php:85-100` |

#### Operational Scope & Security Restriction
In `InvoiceController::index` (lines 56–61) and `InvoiceAccess::canAccessAnyInvoice` (`backend/app/Support/InvoiceAccess.php:33-39`):
- A standard cashier (`cajero` role) who lacks `invoices.operate_any`, `receipts.reprint_any`, or `reports.managerial.view` is restricted to:
  ```php
  where('issued_by', $user->id)
  ->whereBetween('issued_at', [now()->startOfDay(), now()->endOfDay()])
  ```
- Only administrators, supervisors, or users with explicit managerial/any-access permissions can query historical dates across days or view other cashiers' invoices.

#### Embedded Institutional Receipt Payload
`InvoiceController::withInstitutionalReceiptSummary` (lines 261–285) injects an `institutional_receipt` object directly into each invoice in the list response:
```json
{
  "institutional_receipt": {
    "id": 14,
    "receipt_number_full": "REC-A-00000014",
    "status": "issued",
    "reprint_count": 0,
    "print_events_count": 1,
    "has_print_events": true,
    "issued_at": "2026-09-28T09:30:00.000000Z"
  }
}
```
If no institutional receipt has been issued, `institutional_receipt` is `null`.

#### Single Detail Endpoint
- **Route**: `GET /api/invoices/{invoice}`
- **Controller**: `InvoiceController::show` (`InvoiceController.php:158-174`)
- Loads relations: `items`, `payments.user`, `cashSession.user`, `issuer`, `voidedBy`, `issuedInstitutionalReceipts`, `issuedInstitutionalReceipts.printEvents`.
- Attaches the line rule contract to each item:
  - `unit_price_registered`: Catalog price at emission.
  - `rule_adjustment`: Calculated discount in Lempiras.
  - `rule_cause`: Human-readable cause ("Sin cobro por receta").
  - `rule_adjustment_persisted`: Boolean indicating whether the rule adjustment was recorded or is unknown (legacy backfilled line).

---

### 2.2 Question 2: Reprint Flow

#### Endpoints & Routing
1. **Legacy Invoice Receipt Reprint**:
   - `POST /api/invoices/{invoice}/reprint` (`backend/routes/api.php:179`)
   - Controller: `ReceiptController::reprint` (`backend/app/Http/Controllers/ReceiptController.php:41-57`)
   - Action: `ReprintReceiptAction::execute` (`backend/app/Actions/Receipts/ReprintReceiptAction.php:46-114`)
2. **Institutional Receipt PDF Reprint**:
   - `POST /institutional-receipts/{receipt}/pdf` (`backend/routes/api.php:127`)
   - Controller: `InstitutionalReceiptController::pdf` (`backend/app/Http/Controllers/InstitutionalReceiptController.php:43-79`)
   - Service: `InstitutionalReceiptPdfService::pdfForAuthorizedReceipt` (`backend/app/Actions/InstitutionalReceipts/InstitutionalReceiptPdfService.php:122-160`)
3. **Institutional Print Event Recording**:
   - `POST /institutional-receipts/{receipt}/print-events` (`backend/routes/api.php:129`)
   - Controller: `InstitutionalReceiptController::printEvent` (`InstitutionalReceiptController.php:81-104`)

#### Human Reason Validation
- Handled by `App\Actions\Receipts\ReprintReason` (`backend/app/Actions/Receipts/ReprintReason.php:21-49`).
- `ReprintReason::MIN_LENGTH = 5`, `ReprintReason::MAX_LENGTH = 500`.
- In `ReprintReceiptRequest::rules()` (`backend/app/Http/Requests/Receipts/ReprintReceiptRequest.php:34-39`):
  ```php
  'width' => ['required', Rule::in(ReceiptPaperSize::values())],
  'reason' => ['required', 'string', 'min:5', 'max:500'],
  ```
- In `ReprintReceiptAction::execute`:
  ```php
  $humanReason = ReprintReason::assertValid($reason);
  ```
  Zero backend-generated or canned strings are permitted; empty, trimmed < 5 chars, or > 500 chars immediately throws a 422 `ValidationException`.

#### Durable Counter Increment
- In `ReprintReceiptAction::execute`:
  - Runs in `DB::transaction()` with `Invoice::whereKey(...)->lockForUpdate()->firstOrFail()`.
  - Rejects void invoices (`status === Invoice::STATUS_VOID`).
  - Increments `$lockedInvoice->legacy_reprint_count + 1`.
  - Durably persists:
    ```php
    $reprintNumber = ((int) $lockedInvoice->legacy_reprint_count) + 1;
    $lockedInvoice->forceFill(['legacy_reprint_count' => $reprintNumber])->save();
    ```
  - Label is derived as: `'REIMPRESIÓN #' . $reprintNumber`.
  - The counter is in the `invoices` table and does not rely on `COUNT(audit_logs)` (which may be pruned or cleared).
- In `InstitutionalReceiptPdfService`:
  - Reprints increment `institutional_receipts.reprint_count` under a row lock `lockForUpdate()`.
  - Each reprint creates an `InstitutionalReceiptPrintEvent` with `event_type = 'reprint'`.

#### Audit Log Generation
- In `ReprintReceiptAction`:
  ```php
  $this->auditLogger->log(
      action: 'invoice.reprinted',
      entity: $lockedInvoice,
      user: $user,
      request: $request,
      newValues: [
          'invoice_number' => $lockedInvoice->invoice_number,
          'width' => $width,
          'reason' => $humanReason,
          'copy_label' => $copyLabel,
          'legacy_reprint_count' => $reprintNumber,
      ],
      reason: $humanReason,
  );
  ```
- When using `Idempotency-Key` headers, replayed reprint requests return the cached response without advancing the counter or duplicating audit logs (`InvoiceHistoryReprintVoidTest::test_reprint_with_same_idempotency_key_replays_without_duplicating_audit`).

#### Permissions Enforced
- `receipts.reprint`: Required to perform a reprint.
- `receipts.reprint_any`: Required to reprint another cashier's invoice or an invoice from a previous operational day.
- Otherwise, cashiers are checked via `InvoiceAccess::wasIssuedDuringCurrentOperationalDay($invoice)` and `invoice->issued_by === $user->id`.

---

### 2.3 Question 3: Void and Cancellation Flow

#### Endpoint Separation
The system has two distinct endpoints for invalidating invoices:
1. `POST /api/invoices/{invoice}/void` — Voiding an **unpaid** invoice.
2. `POST /api/invoices/{invoice}/reverse` — Reversing a **paid or partially paid** invoice with financial refund movements.

#### Flow 1: Void Unpaid Invoice (`POST /api/invoices/{id}/void`)
- **Controller**: `InvoiceController::void` (`InvoiceController.php:176-188`)
- **Form Request**: `VoidInvoiceRequest` (`VoidInvoiceRequest.php:7-28`)
  - Authorizes via `Gate::authorize('void', $invoice)` -> `InvoicePolicy::void` (`InvoicePolicy.php:65-78`):
    - Requires `$user->can('invoices.void')`.
    - Disallows if `$invoice->status === Invoice::STATUS_VOID`.
    - Enforces operational scope (`$this->operate($user, $invoice)`).
  - Validation: `'reason' => ['required', 'string', 'min:5', 'max:500']`.
- **Action**: `VoidInvoiceAction::execute` (`VoidInvoiceAction.php:28-147`)
  - Runs in `DB::transaction()` with `Invoice::lockForUpdate()`.
  - Checks if cash session is open (`$cashSession->status === STATUS_OPEN`).
  - Guards against paid invoices (`hasPaymentState`):
    - If posted payments count > 0, paid amount > 0, or status is `partial`/`paid`, it blocks the void:
      - Writes `invoice.void_blocked_paid` to `audit_logs`.
      - Throws 422: *"No se puede anular una factura con pagos registrados sin flujo de reversión."*
  - Updates invoice:
    - `status = Invoice::STATUS_VOID`
    - `void_reason = $reason`
    - `voided_by = $user->id`
    - `voided_at = now()`
  - Calls `VoidInstitutionalReceiptAction::forInvoice` to void any issued institutional receipts.
  - Restores original `issued_at` via `PreservesIssuedTimestamps`.
  - Writes `invoice.voided` to `audit_logs`.
  - Dispatches `InvoiceChanged::dispatch($lockedInvoice, 'voided')` on DB after-commit.

#### Flow 2: Reverse Paid Invoice (`POST /api/invoices/{id}/reverse`)
- **Controller**: `InvoiceController::reverse` (`InvoiceController.php:190-201`)
- **Form Request**: `ReverseInvoiceRequest` (`ReverseInvoiceRequest.php:7-28`)
  - Authorizes via `Gate::authorize('reverse', $invoice)` -> `InvoicePolicy::reverse`:
    - Requires `$user->can('invoices.reverse')`.
    - Enforces operational scope (`$this->operate($user, $invoice)`).
  - Validation: `'reason' => ['required', 'string', 'min:5', 'max:500']`.
- **Action**: `ReverseInvoiceAction::execute` (`ReverseInvoiceAction.php:43-178`)
  - Runs in a single atomic `DB::transaction()`.
  - Locks all affected `CashRegisterSession` records `FOR UPDATE`.
  - Rejects if any associated cash session is `STATUS_CLOSED`:
    - Throws 422: *"No se puede reversar una factura con pagos en caja cerrada. Registre un ajuste autorizado."*
  - Rejects if invoice is already void or has no posted payments.
  - Iterates through every posted payment and executes `VoidPaymentAction::execute`:
    - Locks payment and session.
    - Sets `payment->status = Payment::STATUS_VOID`.
    - Creates a negative `CashMovement` in the cash session:
      ```php
      CashMovement::create([
          'cash_session_id' => $lockedPayment->cash_session_id,
          'payment_id' => $lockedPayment->id,
          'user_id' => $user->id,
          'type' => CashMovement::TYPE_PAYMENT_VOID,
          'method' => $lockedPayment->method,
          'amount' => Money::formatCents(-((int) $lockedPayment->amount_cents)),
          'notes' => substr($lockedInvoice->invoice_number.' - '.$lockedPayment->void_reason, 0, 255),
          'occurred_at' => now(),
      ]);
      ```
    - Recalculates invoice paid amount and balance due in integer cents.
    - Voids associated institutional receipts.
    - Records `payment.voided` in `audit_logs`.
  - Marks invoice:
    - `status = Invoice::STATUS_VOID`
    - `void_reason = $reason`
    - `voided_by = $user->id`
    - `voided_at = now()`
  - Writes `invoice.reversed` in `audit_logs`.
  - Dispatches `InvoiceChanged::dispatch($reloaded, 'reversed')` on after-commit.

---

### 2.4 Question 4: Historical Data Preservation

#### Denormalized Snapshots in `invoice_items`
From `InvoiceItem.php` (`backend/app/Models/InvoiceItem.php:41-70`):
- `service_id`: Nullable foreign key (deletion or inactivation of a catalog service does not cascade or break invoice item).
- `service_name`: String snapshot of service description at time of sale.
- `category_id`, `category_name`: Category snapshot.
- `area_id`, `area_name`, `service_area_id`, `service_area_name`: Area taxonomy snapshots.
- `quantity`, `quantity_cents`: Integer cents precision.
- `unit_price`, `unit_price_cents`: Charged unit price in decimal and integer cents.
- `unit_price_registered_cents`: Catalog unit price before special rule discounts.
- `rule_adjustment_cents`: Discount amount in integer cents.
- `tax_rate`, `tax_amount`, `tax_amount_cents`: Applied tax snapshot.
- `line_subtotal`, `line_subtotal_cents`, `line_total`, `line_total_cents`: Line total snapshot.
- `special_rule_code`, `special_rule_applied`: Rule flags.

#### Invoice-Level Snapshots in `invoices`
From `CreateInvoiceAction.php` (`CreateInvoiceAction.php:103-142`):
- `hospital_name`, `hospital_rtn`, `hospital_address`, `hospital_phone`, `hospital_slogan`
- `fiscal_sequence_id`, `fiscal_cai`, `fiscal_prefix`, `fiscal_range_from`, `fiscal_range_to`, `fiscal_valid_until`
- `receipt_template_mode`, `receipt_paper_size`, `receipt_government_line`, `receipt_secretariat_line`, `receipt_location`, `receipt_footer_text`
- `tax_label`, `tax_rate_snapshot`
- `patient_name`
- `subtotal_cents`, `tax_amount_cents`, `discount_amount_cents`, `total_cents`, `paid_amount_cents`, `balance_due_cents`

#### Protection Against Recalculation
- Neither `GenerateReceiptDataAction` nor `BuildInstitutionalReceiptSnapshotAction` perform queries to `services` or `categories`.
- `BuildInstitutionalReceiptSnapshotAction` (lines 65–80) maps `unit_price_registered_cents` and `rule_adjustment_cents` exclusively from `$item`, with the explicit contract note:
  > *"Precio de catálogo registrado y ajuste por regla persistidos en la línea al emitir. Se copian del propio ítem (snapshot histórico), nunca del catálogo vigente."*
- `LineRuleProvenance` (`backend/app/Actions/Reports/LineRuleProvenance.php`) safely handles legacy backfilled lines from migration `2026_09_18_000002`: if a line has `special_rule_applied = true` and `unit_price_registered_cents <= unit_price_cents`, it marks `rule_adjustment_persisted = false` so that the client displays "desconocido" instead of a fictitious `L. 0.00`.
- `PreservesIssuedTimestamps`: MariaDB timestamp auto-update behavior is defended by explicitly restoring original `issued_at` in all update queries across `ReprintReceiptAction`, `VoidInvoiceAction`, `ReverseInvoiceAction`, and `VoidPaymentAction`.

---

### 2.5 Question 5: Backend Test Coverage and Results

All test suites were executed directly against the local testing database (`sqlite :memory:` configured in `backend/phpunit.xml`).

| Test Class | Tests Run | Assertions | Status | Duration |
|---|---|---|---|---|
| `Tests\Feature\InvoiceHistoryReprintVoidTest` | 28 | 189 | **PASSED** | 15.67s |
| `Tests\Feature\InvoiceReverseTest` | 9 | 54 | **PASSED** | 6.44s |
| `Tests\Feature\InvoiceReconciliationFiltersTest` | 3 | 25 | **PASSED** | 3.44s |
| `Tests\Feature\InstitutionalReceiptIssueTest` | 10 | 75 | **PASSED** | 4.87s |
| `Tests\Feature\InstitutionalReceiptPdfTest` | 34 | 1318 | **PASSED** | 32.28s |
| `Tests\Feature\Billing\*` (all billing tests) | 52 | 386 | **PASSED** | 23.28s |
| `Tests\Feature\Payments\*` (all payment tests) | 128 | 1337 | **PASSED** (4 skipped) | 65.05s |
| **Total Verified** | **264 tests** | **3384 assertions** | **0 failures** | — |

*Note on skipped tests*: 4 tests were skipped because they are explicit MariaDB database `CHECK` constraint tests that are only enabled when running against a live MySQL/MariaDB server (`DomainConstraintsOla1Test`, `MonetaryCoherenceConstraintsTest`, `CashSessionConcurrencyTest`).

---

## 3. Gap Analysis against R3 Requirements

### Requirement Checklist (R3, MANDATO §5, PROJECT.md)
| # | Requirement Specification | Backend Implementation Status | Evaluation |
|---|---|---|---|
| 1 | Búsqueda por paciente (`patient`) | Supported in `GET /api/invoices?patient=...` | Complete |
| 2 | Búsqueda por número correlativo (`invoice_number`) | Supported in `GET /api/invoices?invoice_number=...` | Complete |
| 3 | Filtro por rango de fecha (`date_from`, `date_to`) | Supported in `GET /api/invoices?date_from=...&date_to=...` | Complete |
| 4 | Filtro por estado (`status`) | Supported in `GET /api/invoices?status=issued\|partial\|paid\|void` | Complete |
| 5 | Paginación robusta | `page` and `per_page` (default 15, max 50) with `meta.total`, `meta.current_page` | Complete |
| 6 | Visualización del detalle de la cuenta | `GET /api/invoices/{id}` with items, payments, cash session, line rule contracts | Complete |
| 7 | Cobro de saldos cuando aplique | `POST /api/invoices/{id}/payments` with partial payment or full payment support | Complete |
| 8 | Reimpresión auditada con motivo obligatorio (5–500 chars) | Implemented in `POST /api/invoices/{id}/reprint` and `POST /institutional-receipts/{id}/pdf` | Complete |
| 9 | Contador durable de reimpresiones | `invoices.legacy_reprint_count` and `institutional_receipts.reprint_count` | Complete |
| 10 | Anulaciones y reversiones controladas por permisos | `POST /api/invoices/{id}/void` and `POST /api/invoices/{id}/reverse` | Complete |
| 11 | Reversión de movimientos de caja al anular cobro | `VoidPaymentAction` creates negative `CashMovement` | Complete |
| 12 | Auditoría inmutable de reimpresiones y anulaciones | `audit_logs` entries created for reprint, void, reverse, and blocked attempts | Complete |

### Critical Integration Notes for Frontend Team (R3)

1. **Void vs. Reverse Endpoint Selection**:
   - The frontend must check invoice payment state before triggering cancellation:
     - If the invoice has **NO payments** (`posted_payments_count === 0` and `paid_amount === "0.00"`): call `POST /api/invoices/{id}/void`.
     - If the invoice has **ANY payments** (`paid_amount > 0` or status is `partial`/`paid`): call `POST /api/invoices/{id}/reverse`.
     - Calling `/void` on a paid invoice returns HTTP 422 with `errors.invoice = ["No se puede anular una factura con pagos registrados sin flujo de reversión."]`.
2. **Payload for `POST /api/invoices/{id}/reprint`**:
   - Both `reason` (string, 5–500 chars) AND `width` (enum: `letter`, `half_letter`, `a4`, `a5`, `80mm`, `58mm`) are required by `ReprintReceiptRequest`. The frontend reprint modal must always submit the paper profile width (e.g. `'half_letter'`).
3. **Cashier Operational Day Scoping**:
   - When a cashier is logged in without supervisor roles, `GET /api/invoices` automatically filters to their own invoices from today. If the frontend UI passes `date_from` or `user_id` for another cashier, those parameters are safely ignored by the backend query scope.
4. **Idempotency Header**:
   - Both `/void`, `/reverse`, and `/reprint` routes have the `idempotency` middleware enabled (`backend/routes/api.php:158, 160, 180`). The frontend should pass an `Idempotency-Key` UUID header to prevent duplicate operations on network retries.
