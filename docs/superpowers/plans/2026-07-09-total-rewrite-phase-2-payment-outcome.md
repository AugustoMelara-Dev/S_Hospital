# S_Hospital Total Rewrite Phase 2: Payment Outcome Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make payment completion and institutional-receipt recovery an explicit backend/frontend contract so operators never repeat a successful charge because receipt issuance or PDF opening failed.

**Architecture:** Laravel returns a closed `receipt_outcome` value with every registered payment. A pure TypeScript interpreter in `modules/billing` validates that transport result and produces one UI outcome. `NewInvoiceView` consumes the interpreter instead of inferring business state from nullable receipt/error fields.

**Tech Stack:** Laravel 12, MariaDB 11, PHPUnit, React 19, TypeScript 5, Vitest, Testing Library, Playwright.

## Global Constraints

- A successful payment must never be repeated to recover a missing receipt.
- Payment, invoice update, cash movement and receipt issue remain transactionally consistent.
- Paid invoices without an issued institutional receipt must be reported as `recovery_required`.
- Partial payments must be reported as `not_required` until the invoice is fully paid.
- The backend is authoritative; the frontend interpreter is defensive presentation logic.
- Every mutation remains idempotent and associated with invoice, cash session, cashier, method and date.

---

### Task 1: Add the backend receipt outcome contract

**Files:**
- Modify: `backend/app/Http/Controllers/PaymentController.php`
- Modify: `backend/tests/Feature/InstitutionalReceiptPaymentIntegrationTest.php`
- Modify: `backend/tests/Feature/CashPaymentsReceiptTest.php`

**Interfaces:**
- Consumes: `Invoice`, `Payment`, optional `InstitutionalReceipt`, optional receipt error.
- Produces: `receipt_outcome: 'issued' | 'not_required' | 'recovery_required'` in `POST /api/invoices/{invoice}/payments`.

- [ ] **Step 1: Add failing response assertions**

Add these assertions to the existing paid and partial integration tests:

```php
$response->assertJsonPath('data.receipt_outcome', 'issued');
```

and:

```php
$response->assertJsonPath('data.receipt_outcome', 'not_required');
```

Add a test where a user with `payments.create` but without `receipts.view`
fully pays an invoice:

```php
$response->assertCreated()
    ->assertJsonPath('data.invoice.status', Invoice::STATUS_PAID)
    ->assertJsonPath('data.receipt_outcome', 'recovery_required')
    ->assertJsonPath('data.institutional_receipt', null)
    ->assertJsonPath('data.institutional_receipt_error', 'Pago registrado. Un usuario autorizado debe emitir el recibo institucional desde Facturas.');

$this->assertDatabaseHas('payments', [
    'invoice_id' => $invoice->id,
    'status' => Payment::STATUS_POSTED,
]);
```

- [ ] **Step 2: Run focused backend tests and confirm RED**

```powershell
docker compose exec -T backend php artisan test tests/Feature/InstitutionalReceiptPaymentIntegrationTest.php tests/Feature/CashPaymentsReceiptTest.php
```

Expected: assertions fail because `receipt_outcome` is absent and the
no-receipt-permission path currently returns a null error.

- [ ] **Step 3: Return a closed outcome from the controller**

Change the receipt result shape to:

```php
/** @return array{receipt: InstitutionalReceipt|null, error: string|null, outcome: 'issued'|'not_required'|'recovery_required'} */
```

Return:

```php
['receipt' => $receipt, 'error' => null, 'outcome' => 'issued']
```

after issuance; return:

```php
['receipt' => null, 'error' => null, 'outcome' => 'not_required']
```

for a partial invoice; and return:

```php
[
    'receipt' => null,
    'error' => 'Pago registrado. Un usuario autorizado debe emitir el recibo institucional desde Facturas.',
    'outcome' => 'recovery_required',
]
```

for a fully paid invoice when the actor lacks `receipts.view`. Validation and
missing-configuration catches also return `recovery_required`.

Include in the response:

```php
'receipt_outcome' => $receiptResult['outcome'],
```

- [ ] **Step 4: Run backend tests and static gates**

```powershell
docker compose exec -T backend php artisan test tests/Feature/InstitutionalReceiptPaymentIntegrationTest.php tests/Feature/CashPaymentsReceiptTest.php
docker compose exec -T backend vendor/bin/pint --test app/Http/Controllers/PaymentController.php tests/Feature/InstitutionalReceiptPaymentIntegrationTest.php tests/Feature/CashPaymentsReceiptTest.php
docker compose exec -T backend vendor/bin/phpstan analyse --memory-limit=1G
```

Expected: all commands exit 0.

### Task 2: Interpret the payment result in the billing module

**Files:**
- Create: `frontend/src/modules/billing/application/paymentOutcome.ts`
- Create: `frontend/src/modules/billing/application/paymentOutcome.test.ts`
- Modify: `frontend/src/lib/api/types.ts`

**Interfaces:**
- Consumes: `PaymentRegistrationResult`.
- Produces: `PaymentUiOutcome` with kinds `receipt_ready`, `receipt_recovery` and `partial`.

- [ ] **Step 1: Write failing interpreter tests**

Create tests covering:

```ts
expect(interpretPaymentOutcome(result({ receipt_outcome: 'issued', institutional_receipt: receipt })))
  .toEqual({ kind: 'receipt_ready', receipt });

expect(interpretPaymentOutcome(result({
  receipt_outcome: 'recovery_required',
  institutional_receipt: null,
  institutional_receipt_error: 'Serie no configurada.',
}))).toEqual({
  kind: 'receipt_recovery',
  message: 'Pago registrado, pero el recibo institucional está pendiente: Serie no configurada. Genérelo desde Facturas antes de entregar comprobante.',
});

expect(interpretPaymentOutcome(result({
  receipt_outcome: 'not_required',
  invoice: partialInvoice,
}))).toEqual({
  kind: 'partial',
  message: `Pago parcial registrado. Saldo pendiente ${partialInvoice.balance_due}.`,
});
```

Also test a defensive inconsistent result: `issued` without a receipt becomes
`receipt_recovery` and never `partial`.

- [ ] **Step 2: Run the new tests and confirm RED**

```powershell
npm.cmd run test -- paymentOutcome.test.ts --pool=forks --maxWorkers=1 --no-file-parallelism
```

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Add the transport type and pure interpreter**

Extend:

```ts
export type PaymentReceiptOutcome = 'issued' | 'not_required' | 'recovery_required';

export type PaymentRegistrationResult = {
  payment: Payment;
  invoice: Invoice;
  institutional_receipt: InstitutionalReceipt | null;
  institutional_receipt_error: string | null;
  receipt_outcome: PaymentReceiptOutcome;
};
```

Implement:

```ts
export type PaymentUiOutcome =
  | { kind: 'receipt_ready'; receipt: InstitutionalReceipt }
  | { kind: 'receipt_recovery'; message: string }
  | { kind: 'partial'; message: string };

export function interpretPaymentOutcome(result: PaymentRegistrationResult): PaymentUiOutcome {
  if (result.receipt_outcome === 'issued' && result.institutional_receipt) {
    return { kind: 'receipt_ready', receipt: result.institutional_receipt };
  }

  if (result.receipt_outcome === 'not_required' && result.invoice.status !== 'paid') {
    return {
      kind: 'partial',
      message: `Pago parcial registrado. Saldo pendiente ${result.invoice.balance_due}.`,
    };
  }

  const reason = result.institutional_receipt_error?.trim()
    || 'No se recibió el comprobante institucional.';

  return {
    kind: 'receipt_recovery',
    message: `Pago registrado, pero el recibo institucional está pendiente: ${reason} Genérelo desde Facturas antes de entregar comprobante.`,
  };
}
```

- [ ] **Step 4: Run interpreter and API tests**

```powershell
npm.cmd run test -- paymentOutcome.test.ts billing.test.ts --pool=forks --maxWorkers=1 --no-file-parallelism
```

Expected: all selected tests pass.

### Task 3: Replace nullable receipt inference in `NewInvoiceView`

**Files:**
- Modify: `frontend/src/features/invoices/NewInvoiceView.tsx`
- Modify: `frontend/src/features/invoices/NewInvoiceView.test.tsx`

**Interfaces:**
- Consumes: `interpretPaymentOutcome(result)`.
- Produces: one mutually exclusive branch for receipt-ready, recovery-required or partial payment UI.

- [ ] **Step 1: Update payment flow tests to include the explicit outcome**

Every payment result fixture must include `receipt_outcome`. Add assertions that:

- `issued` opens the institutional PDF once;
- `recovery_required` closes the payment dialog, shows success plus warning and never calls payment again;
- `not_required` shows the remaining balance and does not offer a receipt;
- `issued` without a receipt shows recovery guidance defensively.

- [ ] **Step 2: Run the focused tests and confirm RED**

```powershell
npm.cmd run test -- NewInvoiceView.test.tsx -t "receipt outcome|receipt recovery|partial payment" --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000
```

Expected: fixtures or assertions fail until the explicit interpreter is used.

- [ ] **Step 3: Replace the inference chain**

After updating invoice/payment state, call:

```ts
const outcome = interpretPaymentOutcome(result);
```

Use a `switch (outcome.kind)` with exhaustive `receipt_ready`,
`receipt_recovery` and `partial` cases. Remove checks that infer paid receipt
state from `institutional_receipt`, `institutional_receipt_error` and
`invoice.status` independently.

- [ ] **Step 4: Run billing frontend gates**

```powershell
npm.cmd run test -- NewInvoiceView.test.tsx PaymentModal.test.tsx paymentOutcome.test.ts billing.test.ts --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000
npm.cmd run typecheck
npm.cmd run lint
```

Expected: all commands exit 0.

### Task 4: Verify the cross-layer recovery flow

**Files:**
- Modify: `frontend/e2e/new-invoice-flow.spec.ts`
- Modify: `docs/testing-report.md`
- Modify: `CHANGELOG.md`

**Interfaces:**
- Consumes: backend response contract and frontend interpreter.
- Produces: browser evidence that a successful payment with receipt recovery does not invite or send a duplicate charge.

- [ ] **Step 1: Add an E2E recovery scenario**

Mock a successful payment response with:

```ts
receipt_outcome: 'recovery_required',
institutional_receipt: null,
institutional_receipt_error: 'Serie institucional no configurada.',
```

Assert that the page shows “Pago registrado”, “recibo institucional está
pendiente” and the Facturas recovery instruction. Assert the payment route was
called exactly once and no automatic print/download request occurred.

- [ ] **Step 2: Run cross-layer gates**

```powershell
docker compose exec -T backend php artisan test tests/Feature/InvoiceCreationTest.php tests/Feature/CashPaymentsReceiptTest.php tests/Feature/InstitutionalReceiptPaymentIntegrationTest.php tests/Feature/Resilience/DoublePaymentTest.php
npm.cmd run test:critical
npx.cmd playwright test e2e/new-invoice-flow.spec.ts --workers=1 --reporter=list
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
```

Expected: every command exits 0.

- [ ] **Step 3: Record exact evidence and commit**

Record command counts and outcomes in `docs/testing-report.md`, update the
changelog, then commit:

```powershell
git add backend/app/Http/Controllers/PaymentController.php backend/tests/Feature/InstitutionalReceiptPaymentIntegrationTest.php backend/tests/Feature/CashPaymentsReceiptTest.php frontend/src/modules/billing frontend/src/lib/api/types.ts frontend/src/features/invoices/NewInvoiceView.tsx frontend/src/features/invoices/NewInvoiceView.test.tsx frontend/e2e/new-invoice-flow.spec.ts docs/testing-report.md CHANGELOG.md
git commit -m "refactor(billing): make receipt recovery explicit"
```
