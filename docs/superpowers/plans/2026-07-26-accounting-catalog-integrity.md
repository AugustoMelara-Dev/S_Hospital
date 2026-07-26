# Accounting and Catalog Integrity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Guarantee that a dialysis prescription makes only the institutional L 25 erythropoietin line free while every other product, payment, cash movement, receipt, and report retains its correct amount.

**Architecture:** Keep Laravel as the only authoritative fiscal calculator and protect the erythropoietin rule at the catalog boundary. Add end-to-end financial assertions around persisted integer cents, then remove the rule from ordinary catalog editing so new products cannot inherit it.

**Tech Stack:** Laravel 12, PHP 8.2+, PHPUnit 11, Eloquent/MySQL-MariaDB, React 19, TypeScript 5.9, Vitest 4, Testing Library.

## Global Constraints

- Production must operate without internet and without cloud services.
- Money calculations and comparisons use integer cents; floats are forbidden.
- Historical invoice item names and prices remain snapshots.
- The backend decides final totals; the frontend only previews.
- Invoices are never deleted.
- Erythropoietin costs L 25.00 and is free only with an authorized dialysis prescription.
- Every paid invoice retains cash session, cashier, payment method, and payment date.
- Each behavior change follows red-green-refactor and ends in a Conventional Commit.

---

### Task 1: Protect the mixed dialysis basket through the full invoice transaction

**Files:**
- Modify: `backend/tests/Feature/InvoiceCreationTest.php`
- Modify: `backend/tests/Feature/CashPaymentsReceiptTest.php`
- Modify only if the failing test proves a defect: `backend/app/Actions/Billing/CalculateInvoiceTotalsAction.php`
- Modify only if the failing test proves a defect: `backend/app/Actions/Billing/CreateInvoiceAction.php`
- Modify only if the failing test proves a defect: `backend/app/Actions/Payments/RegisterPaymentAction.php`

**Interfaces:**
- Consumes: `CalculateInvoiceTotalsAction::execute(array $items, string $taxRate, bool $patientDialysisPrescription): array`
- Produces: a persisted invoice whose `total_cents` equals the sum of `invoice_items.line_total_cents` and whose payment/cash movement equals the non-free balance.

- [ ] **Step 1: Write the failing mixed-basket feature test**

Add a test that seeds/open cash, creates an ordinary non-taxable service priced `900.00`, adds seeded erythropoietin, and posts:

```php
[
    'patient_name' => 'Paciente con receta',
    'dialysis_prescription' => true,
    'items' => [
        ['service_id' => $product->id, 'quantity' => '1.00'],
        ['service_id' => $erythropoietin->id, 'quantity' => '1.00'],
    ],
]
```

Assert literal values: invoice subtotal/total `900.00`, ordinary line `90000` cents, erythropoietin line `0` cents, and exactly one `special_rule_applied=true`.

- [ ] **Step 2: Run the test and verify red or characterize existing behavior**

Run:

```powershell
cd backend
php artisan test --filter=test_dialysis_prescription_keeps_other_nine_hundred_lempira_service_billable
```

Expected: if it passes on current `main`, record it as a characterization test and perform the required mutation check by temporarily changing the line predicate locally so the test fails; restore immediately. If it fails, the difference must show which persisted field became zero.

- [ ] **Step 3: Add payment and cash assertions**

Extend `CashPaymentsReceiptTest` with a separate test that pays the mixed invoice using `900.00` cash and asserts:

```php
$this->assertSame(90000, $invoice->fresh()->paid_amount_cents);
$this->assertSame(0, $invoice->fresh()->balance_due_cents);
$this->assertDatabaseHas('payments', ['invoice_id' => $invoice->id, 'amount_cents' => 90000]);
$this->assertDatabaseHas('cash_movements', ['reference_type' => Payment::class, 'amount_cents' => 90000]);
```

Also assert no zero-payment dialysis trace is created because the invoice total is not zero.

- [ ] **Step 4: Implement the minimal root-cause fix if any assertion fails**

The allowed calculation predicate is exactly:

```php
return $patientDialysisPrescription
    && $service->special_rule_code === Service::ERYTHROPOIETIN_RULE;
```

Do not add invoice-wide discounts. Preserve the invariant check in `CreateInvoiceAction`.

- [ ] **Step 5: Run focused backend tests**

Run:

```powershell
php artisan test --filter='InvoiceCreationTest|InvoiceDialysisPrescriptionTest|CashPaymentsReceiptTest|CalculateInvoiceTotalsActionTest'
```

Expected: all selected tests pass with zero failures.

- [ ] **Step 6: Commit**

```powershell
git add backend/tests/Feature/InvoiceCreationTest.php backend/tests/Feature/CashPaymentsReceiptTest.php backend/app/Actions/Billing
git commit -m "test(billing): protect mixed dialysis basket totals"
```

### Task 2: Reserve the institutional special rule

**Files:**
- Modify: `backend/app/Http/Requests/Catalog/StoreServiceRequest.php`
- Modify: `backend/app/Http/Requests/Catalog/UpdateServiceRequest.php`
- Modify: `backend/tests/Feature/ServiceCatalogTest.php`
- Modify: `frontend/src/features/catalog/components/ServiceDrawer.tsx`
- Modify: `frontend/src/features/catalog/components/serviceDrawerTypes.ts`
- Modify: `frontend/src/features/catalog/components/ServiceDrawer.test.tsx`

**Interfaces:**
- Consumes: seeded `Service::ERYTHROPOIETIN_RULE`.
- Produces: ordinary create/update payloads that cannot assign, replace, or remove the protected rule.

- [ ] **Step 1: Add failing backend catalog tests**

Add three literal-contract tests:

```php
public function test_new_service_cannot_assign_institutional_erythropoietin_rule(): void
public function test_ordinary_service_cannot_be_updated_to_assign_institutional_erythropoietin_rule(): void
public function test_seeded_erythropoietin_keeps_rule_when_ordinary_fields_are_updated(): void
```

The first two must assert `422` and a `special_rule_code` validation error. The third must omit `special_rule_code` from the request, update an allowed field, and assert the database still contains the rule.

- [ ] **Step 2: Verify the first two tests fail for the expected reason**

Run:

```powershell
cd backend
php artisan test --filter='test_new_service_cannot_assign_institutional_erythropoietin_rule|test_ordinary_service_cannot_be_updated_to_assign_institutional_erythropoietin_rule|test_seeded_erythropoietin_keeps_rule_when_ordinary_fields_are_updated'
```

Expected: create/update assignment tests fail because the request currently accepts the enum value.

- [ ] **Step 3: Implement request-level protection**

In `StoreServiceRequest`, replace the public enum acceptance with:

```php
'special_rule_code' => ['prohibited'],
```

In `UpdateServiceRequest`, allow an omitted field and reject any submitted change:

```php
'special_rule_code' => [
    'sometimes',
    function (string $attribute, mixed $value, Closure $fail) use ($service): void {
        if ($value !== $service->special_rule_code) {
            $fail('La regla institucional no se administra desde el catálogo.');
        }
    },
],
```

Resolve `$service` safely from the route inside `rules()` or move the comparison into `after()`. Preserve the rule automatically when the field is omitted.

- [ ] **Step 4: Add failing frontend test that the rule selector is absent**

Render a new-service drawer and assert:

```ts
expect(screen.queryByLabelText(/regla especial/i)).not.toBeInTheDocument();
```

Render seeded erythropoietin and assert a read-only explanatory alert contains “Regla institucional de eritropoyetina”; do not render an editable select.

- [ ] **Step 5: Verify frontend red**

Run:

```powershell
cd frontend
.\node_modules\.bin\vitest.cmd run src/features/catalog/components/ServiceDrawer.test.tsx --pool=forks --maxWorkers=1 --no-file-parallelism
```

Expected: fail because `ServiceDrawer` still exposes `special_rule_code`.

- [ ] **Step 6: Remove the editable selector and payload field**

Delete `special_rule_code` from the editable Zod draft and from ordinary create/update payload assembly. Keep it on the read model only so the drawer can display protected status for seeded erythropoietin.

- [ ] **Step 7: Run focused catalog tests**

Run:

```powershell
cd backend
php artisan test --filter=ServiceCatalogTest
cd ..\frontend
.\node_modules\.bin\vitest.cmd run src/features/catalog/components/ServiceDrawer.test.tsx src/features/catalog/CatalogView.test.tsx --pool=forks --maxWorkers=1 --no-file-parallelism
```

Expected: all tests pass.

- [ ] **Step 8: Commit**

```powershell
git add backend/app/Http/Requests/Catalog backend/tests/Feature/ServiceCatalogTest.php frontend/src/features/catalog
git commit -m "fix(catalog): reserve erythropoietin institutional rule"
```

### Task 3: Detect invalid existing rule assignments

**Files:**
- Create: `backend/app/Actions/Catalog/AuditInstitutionalServiceRulesAction.php`
- Create: `backend/app/Console/Commands/AuditInstitutionalServiceRulesCommand.php`
- Create: `backend/tests/Feature/AuditInstitutionalServiceRulesCommandTest.php`
- Modify: `backend/app/Actions/System/BuildOperationalStatusAction.php`
- Modify: `backend/tests/Feature/SystemStatusTest.php`

**Interfaces:**
- Produces: `AuditInstitutionalServiceRulesAction::execute(): array{valid: bool, canonical_service_id: int|null, unexpected_service_ids: list<int>}`
- Produces command: `hospital:audit-catalog-rules` with exit `0` when valid and `1` when invalid.
- Consumed by: operational status readiness blockers and release preflight.

- [ ] **Step 1: Write failing action/command tests**

Create fixtures for:

1. exactly one seeded canonical erythropoietin with price `2500`, non-taxable, expected source key;
2. an ordinary service carrying the special rule;
3. missing canonical service.

Assert the exact result arrays and command exit codes. Output may name the service but must not expose internal IDs in operator-facing text.

- [ ] **Step 2: Verify red**

Run:

```powershell
cd backend
php artisan test tests/Feature/AuditInstitutionalServiceRulesCommandTest.php
```

Expected: fail because action and command do not exist.

- [ ] **Step 3: Implement the query-only audit**

The action must select only services where `special_rule_code = Service::ERYTHROPOIETIN_RULE`, compare the canonical row using the seeder’s stable `source_key`, and return IDs for internal consumers. It must never mutate catalog data automatically.

- [ ] **Step 4: Add the readiness blocker**

When `valid=false`, append:

```php
[
    'code' => 'catalog_institutional_rule_invalid',
    'label' => 'Revise la regla institucional de eritropoyetina antes de facturar.',
]
```

Do not include IDs or database column names.

- [ ] **Step 5: Run command and status tests**

Run:

```powershell
php artisan test tests/Feature/AuditInstitutionalServiceRulesCommandTest.php tests/Feature/SystemStatusTest.php
php artisan hospital:audit-catalog-rules
```

Expected: tests pass; command exits zero against seeded test/development catalog.

- [ ] **Step 6: Commit**

```powershell
git add backend/app/Actions/Catalog backend/app/Console/Commands backend/app/Actions/System/BuildOperationalStatusAction.php backend/tests
git commit -m "feat(catalog): audit institutional service rule integrity"
```

### Task 4: Reconcile reports and receipt snapshots for the mixed basket

**Files:**
- Modify: `backend/tests/Feature/FinancialFactsReportTest.php`
- Modify: `backend/tests/Feature/ReportsTest.php`
- Modify: `backend/tests/Feature/InstitutionalReceiptIssueTest.php`
- Modify only if tests expose a defect: `backend/app/Actions/Reports/FinancialFactsService.php`
- Modify only if tests expose a defect: `backend/app/Actions/Receipts/GenerateReceiptDataAction.php`

**Interfaces:**
- Consumes persisted invoice/item/payment cents from Task 1.
- Produces report facts where billed and collected values remain distinct and a receipt containing a L 900 line plus a L 0 erythropoietin line.

- [ ] **Step 1: Write failing report and receipt tests**

Use a paid mixed invoice and assert literal values:

```php
$this->assertSame(90000, $facts['billed_cents']);
$this->assertSame(90000, $facts['collected_cents']);
$this->assertSame(90000, $facts['cash_cents']);
```

Assert service ranking records ordinary service total `900.00`, erythropoietin total `0.00`, and the institutional receipt totals `900.00`.

- [ ] **Step 2: Run red/characterization**

Run:

```powershell
php artisan test --filter='mixed_dialysis_basket'
```

Expected: any failure identifies the exact consumer that recomputes or drops zero lines. If already green, retain tests and perform a local mutation check against the report predicate.

- [ ] **Step 3: Implement only the proven consumer fix**

Reports must sum persisted `*_cents` columns and posted payments. Receipts must read invoice item snapshots including zero-valued lines; never query the current service price.

- [ ] **Step 4: Verify accounting suite**

Run:

```powershell
php artisan test --filter='FinancialFactsReportTest|ReportsTest|InstitutionalReceiptIssueTest|InvoiceCreationTest|CashPaymentsReceiptTest'
```

Expected: all selected tests pass.

- [ ] **Step 5: Commit**

```powershell
git add backend/tests/Feature backend/app/Actions/Reports backend/app/Actions/Receipts
git commit -m "test(accounting): reconcile mixed dialysis invoice facts"
```

