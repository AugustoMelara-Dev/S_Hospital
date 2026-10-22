# Handoff Report: Reviewer M2-2 (Monetary Logic & Payment Reviewer)

**Verdict**: APPROVE

---

## 1. Observation

### Verification Commands & Results (Executed Independently in `frontend/`)
1. `npm run typecheck` (`tsc --noEmit`):
   ```
   > s-hospital-frontend@0.1.0 typecheck
   > tsc --noEmit
   Exit code: 0
   ```
2. `npx vitest run src/features/cobrar/`:
   ```
   RUN  v4.1.11 C:/Projects/S_Hospital_AI/frontend

   ✓  0  src/features/cobrar/components/CatalogZone.test.tsx (7 tests) 730ms
   ✓  0  src/features/cobrar/components/AccountZone.test.tsx (9 tests) 883ms
   ✓  0  src/features/cobrar/components/ConfirmDialog.test.tsx (8 tests) 1429ms
   ✓  0  src/features/cobrar/state/status.test.ts (9 tests) 39ms
   ✓  0  src/features/cobrar/components/ResultZone.test.tsx (5 tests) 567ms
   ✓  0  src/features/cobrar/CobrarView.test.tsx (9 tests) 5274ms
   ✓  0  src/features/cobrar/components/SummaryActionZone.test.tsx (5 tests) 413ms
   ✓  0  src/features/cobrar/state/domain.test.ts (6 tests) 21ms
   ✓  0  src/features/cobrar/cobrarSchema.test.ts (4 tests) 16ms

   Test Files  9 passed (9)
        Tests  62 passed (62)
     Duration  12.78s
   Exit code: 0
   ```
3. `npm run test:clinical`:
   ```
   Test Files  9 passed (9)
        Tests  177 passed (177)
     Duration  18.71s
   Exit code: 0
   ```
4. `node scripts/check-no-legacy-ui.mjs --mode=strict`:
   ```
   [QUALITY GATE PASSED] modo=strict; 396 archivos; 0 violaciones.
   Exit code: 0
   ```

### Code Observations
1. **Strict per-line EPO dialysis rule & zero backend code exposure**:
   - `frontend/src/features/cobrar/components/AccountZone.tsx` lines 68 & 146-150: The eligible line renders `<FreeMedicationBadge label="Sin cobro por receta" />`, unit price remains noted (`<MoneyText cents={parseCents(line.service.price)} /> c/u`), the adjustment column displays `Sin cobro`, and line total renders `L. 0.00` via `<MoneyText cents={lineTotalCents(line)} />`.
   - `frontend/src/features/cobrar/components/AccountZone.tsx` lines 197-200: Condition checkbox is clearly labeled `Paciente con receta de diálisis` with the single note `Aplica solo al medicamento elegible; el resto conserva su precio.`.
   - `frontend/src/features/cobrar/state/domain.ts` lines 17-19: `lineIsFree(line)` evaluates `line.dialysisPrescription === true && isEligibleMedication(line.service)`. Non-eligible items (e.g. Glucosa, Laboratorio) retain their catalog unit price and normal line total.
   - Comprehensive `grep_search` across `src/features/cobrar/` confirmed zero user-visible exposure of `ERYTHROPOIETIN_DIALYSIS_PRESCRIPTION`, and zero marketing slogans («100% ahorro», «Regla activa», «Cobertura»).

2. **Server Monetary Authority**:
   - `frontend/src/features/cobrar/hooks/useCobrarPreview.ts`: Debounced queries are sent to `/api/invoices/preview`. Responses are tracked against a cart signature hash (`revision`). If the revision changes, prior previews are invalidated.
   - `frontend/src/features/cobrar/components/SummaryActionZone.tsx` lines 79-105: Totals, subtotal, exempt base, and ISV are rendered strictly from server preview data. Line 80-82 notes: *"Los importes se leen tal cual de la valoración del servidor. Nunca se deriva 'Exento' sumando el precio registrado de la línea gratuita: la línea sin cobro aporta 0 a la base exenta."*
   - `frontend/src/features/cobrar/state/status.ts` lines 141-150 & 221-233: A zero-item cart is always `borrador` and cannot be submitted. Legitimate zero total is only permitted when confirmed by server preview (`code: 'sin_cobro'`, `confirmKind: 'zero'`).
   - `backend/app/Actions/Billing/PreviewInvoiceTotalsAction.php` and `CalculateInvoiceTotalsAction.php`: Server computes exact cents, half-up rounding (`intdiv(($cents * $units) + 50, 100)`), applies rule per-line, and sets `tax_unavailable` if the tax rate cannot be parsed, returning null rather than fake zero.

3. **Payment Confirmation in `ConfirmDialog.tsx`**:
   - Lines 62-66: `cashTendered` input is parsed using `parseCents()`. `changeCents = tenderedCents !== null && tenderedCents >= totalCents ? tenderedCents - totalCents : 0;`.
   - Lines 67-71: `handleSetExactCash()` sets `toExchangeDecimal(status.totalCents)`.
   - Lines 207-209 & 253-255: Enter key in input fields is trapped (`if (event.key === 'Enter') event.preventDefault()`) so accidental Enter presses never trigger payment confirmation.
   - Lines 234-238: When `isUnderpaid` (`tenderedCents > 0 && tenderedCents < totalCents`), an accessible warning is rendered: `<p role="alert">El monto recibido es menor que el total a cobrar.</p>`.
   - Lines 243-260: Dedicated fields for transfer and card references.
   - Lines 261-266: When total is zero, payment methods are hidden and institutional explanation is displayed.

4. **Decoupled Payment and Printing Flow**:
   - `frontend/src/features/cobrar/hooks/useCobrarEmission.ts` lines 197-238: `submit()` creates the invoice via `apiClient.createInvoice`. For positive totals, it registers payment via `payInvoice()`. If payment fails, the invoice status becomes `pending` and `retryPayment` allows re-registering without creating a duplicate invoice.
   - `frontend/src/features/cobrar/hooks/useCobrarReceiptActions.ts` and `ResultZone.tsx`: Printing and saving PDF actions are only available in `ResultZone` after successful transaction completion. A printing error or canceled print preview logs an operational warning/toast and never duplicates the invoice or re-submits payment.

---

## 2. Logic Chain

1. *From Observation 1 (EPO Dialysis Rule)*: The implementation fulfills the strict per-line rule required by MANDATO §4 and AGENTS.md. Non-eligible items maintain their standard charges, eligible lines show L. 0.00 with the badge «Sin cobro por receta», the original catalog price is visible as reference, and no internal code names or marketing slogans leak into the cashier view.
2. *From Observation 2 (Server Monetary Authority)*: The frontend does not act as fiscal authority. All fiscal math (subtotal, taxable base, exempt amount, ISV, total) is driven by `/api/invoices/preview`. Cents arithmetic prevents floating-point inaccuracies. If server calculations fail or tax is unavailable, confirmation is blocked.
3. *From Observation 3 (ConfirmDialog & Cash Change)*: Cash payments provide explicit change calculation (`tendered - total`), exact tender button, underpaid alert, and Enter-key defense. Card and transfer methods capture references. Zero-total invoices skip payment registration.
4. *From Observation 4 (Decoupled Printing)*: The transaction completes and settles before printing is offered. A network error during print or a cancelled print dialog cannot re-trigger the billing transaction.
5. *From Integrity Analysis*: No hardcoded outputs, fake fixtures in production code, or facade implementations were detected. All 62 feature tests and 177 clinical tests pass cleanly and genuinely.

---

## 3. Caveats

- **No caveats**. The cashier station implementation cleanly satisfies all monetary, payment, and rule-handling requirements for Milestone M2.

---

## 4. Conclusion

**Verdict: APPROVE**

Milestone M2 (Cashier Station / Continuous Ledger Cobrar - R2) fully satisfies all requirements of `MANDATO_PRODUCTO_COMPLETO_AZUL_BLANCO.md` (§4), `AGENTS.md`, and `PROJECT.md`:
- Per-line EPO dialysis rule displays clearly with institutional wording («Sin cobro por receta», L. 0.00 line total, catalog unit price shown, other items charged normally).
- Server remains the sole monetary authority via `/api/invoices/preview` with exact integer cent validation.
- Payment confirmation in `ConfirmDialog.tsx` accurately handles cash change math, exact tender presets, underpayment alerts, and card/transfer references.
- Payment and printing are decoupled so printer/PDF issues never duplicate financial transactions.
- All static gates and automated test suites pass with 0 errors and 0 violations.

---

## 5. Verification Method

To independently verify these findings, run the following commands in `c:\Projects\S_Hospital_AI\frontend`:

```powershell
npm run typecheck
node scripts/check-no-legacy-ui.mjs --mode=strict
npx vitest run src/features/cobrar/
npm run test:clinical
```

### Files to Inspect:
- `frontend/src/features/cobrar/CobrarView.tsx`
- `frontend/src/features/cobrar/components/AccountZone.tsx`
- `frontend/src/features/cobrar/components/ConfirmDialog.tsx`
- `frontend/src/features/cobrar/components/SummaryActionZone.tsx`
- `frontend/src/features/cobrar/components/ResultZone.tsx`
- `frontend/src/features/cobrar/state/domain.ts`
- `frontend/src/features/cobrar/hooks/useCobrarPreview.ts`
- `frontend/src/features/cobrar/hooks/useCobrarEmission.ts`
- `frontend/src/features/cobrar/hooks/useCobrarReceiptActions.ts`

### Invalidation Conditions:
- Any recalculation of fiscal taxes or totals in the frontend bypassing `/api/invoices/preview`.
- Any application of the dialysis gratuity to non-eligible services in mixed carts.
- Any leak of `ERYTHROPOIETIN_DIALYSIS_PRESCRIPTION` or marketing phrases into cashier-facing UI.
- Any payment duplication caused by re-printing or cancelling print dialogs.
