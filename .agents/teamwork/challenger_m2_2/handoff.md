# Handoff Report: Challenger M2-2 (Adversarial Cashier Arithmetic & Change Verifier)

**Verdict**: **REQUEST_CHANGES**  
**Milestone**: M2 (Cashier Station / Continuous Ledger Cobrar - R2)  
**Target Worker**: Worker M2-R1  
**Working Directory**: `c:\Projects\S_Hospital_AI\.agents\teamwork\challenger_m2_2`

---

## 1. Observation

### Test Suites Executed Directly
1. `npx vitest run src/features/cobrar/`:
   ```
   RUN v4.1.11 C:/Projects/S_Hospital_AI/frontend

   ✓ src/features/cobrar/components/AccountZone.test.tsx (9 tests)
   ✓ src/features/cobrar/components/ConfirmDialog.test.tsx (8 tests)
   ✓ src/features/cobrar/adversarial_verification.test.tsx (5 tests)
   ✓ src/features/cobrar/components/CatalogZone.test.tsx (7 tests)
   ✓ src/features/cobrar/components/ResultZone.test.tsx (5 tests)
   ✓ src/features/cobrar/CobrarView.test.tsx (9 tests)
   ✓ src/features/cobrar/cobrarSchema.test.ts (4 tests)
   ✓ src/features/cobrar/state/status.test.ts (9 tests)
   ✓ src/features/cobrar/state/domain.test.ts (6 tests)
   ✓ src/features/cobrar/components/SummaryActionZone.test.tsx (5 tests)

   Test Files 10 passed (10)
        Tests 67 passed (67)
     Duration 12.54s
   Exit code: 0
   ```

2. `npm run test:clinical`:
   ```
   Test Files 9 passed (9)
        Tests 177 passed (177)
     Duration 15.39s
   Exit code: 0
   ```

### Code Inspections
3. In `frontend/src/features/cobrar/components/ConfirmDialog.tsx` lines 62–66:
   ```tsx
   const [cashTendered, setCashTendered] = useState<string>('');
   const tenderedCents = parseCents(cashTendered);
   const changeCents = tenderedCents !== null && tenderedCents >= totalCents ? tenderedCents - totalCents : 0;
   const isUnderpaid = tenderedCents !== null && tenderedCents > 0 && tenderedCents < totalCents;
   ```

4. In `frontend/src/features/cobrar/components/ConfirmDialog.tsx` lines 90–99:
   ```tsx
   <button
     type="button"
     className={PRIMARY_BUTTON}
     onClick={onConfirm}
     disabled={!status.canConfirm || submitting}
     data-testid="cobrar-confirm"
   >
     {submitting ? 'Emitiendo…' : isZero ? 'Emitir sin cobro' : `Cobrar${totalLabel ? ` · ${totalLabel}` : ''}`}
   </button>
   ```

5. In `frontend/src/features/cobrar/components/ConfirmDialog.test.tsx` lines 207–218:
   ```tsx
   it('advierte cuando el efectivo recibido es menor que el total a cobrar', async () => {
     const user = userEvent.setup();
     renderDialog({
       status: payStatus(1725),
       method: 'cash',
     });

     const cashInput = screen.getByLabelText(/efectivo recibido/i);
     await user.type(cashInput, '10.00');

     expect(screen.getByText(/el monto recibido es menor que el total a cobrar/i)).toBeVisible();
   });
   ```
   *Note*: The test only checked that the warning text was visible, omitting the requirement that the confirm button must be disabled.

### Empirical Adversarial Test Execution
6. An empirical test checking the dispatch mandate:
   `Bill total L. 350.00, customer pays L. 300.00 -> Underpaid alert displayed, confirm button disabled`
   yielded verbatim failure:
   ```
   FAIL src/features/cobrar/components/ConfirmDialog.adversarial.test.tsx > Task 3: Cash change calculation & underpaid enforcement > Bill total L. 350.00, customer pays L. 300.00 -> Underpaid alert displayed, confirm button disabled
   Error: expect(element).toBeDisabled()

   Received element is not disabled:
     <button
       class="inline-flex h-[var(--ui-control-h-operational)] items-center justify-center gap-2 rounded-[var(--ui-radius-control)] bg-[var(--ui-action)] px-3.5 text-[length:var(--ui-text-base)] font-semibold text-white transition-[transform,background-color] duration-[140ms] ease-out enabled:hover:bg-[var(--ui-action-hover)] enabled:active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none motion-reduce:active:scale-100 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ui-focus)]"
       data-testid="cobrar-confirm"
       type="button"
     >Cobrar · L. 350.00</button>
   ```

---

## 2. Logic Chain

1. *From Observation 3 & 4*: In `ConfirmDialog.tsx`, `isUnderpaid` is computed on line 65 (`tenderedCents !== null && tenderedCents > 0 && tenderedCents < totalCents`), but on line 94, the confirm button's disabled condition is strictly `disabled={!status.canConfirm || submitting}`.
2. *From Step 1*: When `status.canConfirm` is true (valid patient, active cash session, valid preview), and `method === 'cash'`, entering an underpaid amount (e.g. L. 300.00 for a bill of L. 350.00) makes `isUnderpaid` true, displaying the warning text, but leaves `disabled` as `false`.
3. *From Step 2 and Observation 6*: The cashier can click the confirm button while underpaid, allowing an underpaid cash transaction to be submitted and settled without receiving full payment.
4. *From Observation 3*: Furthermore, if the cashier types `0.00`, `tenderedCents` is `0`, causing `tenderedCents > 0` to evaluate to `false`. Therefore, typing `0.00` does not even trigger `isUnderpaid`.
5. *From Dispatch Task 3*: The explicit specification requires:
   `Bill total L. 350.00, customer pays L. 300.00 -> Underpaid alert displayed, confirm button disabled.`
6. *From Steps 1-5*: Worker M2-R1 failed to disable the confirm button upon underpayment in cash mode.

---

## 3. Caveats

- **Task 1 (Mixed EPO basket)** was tested and verified: 1 EPO (with Rx) + 1 Glucosa (L. 900.00) correctly displays the badge «Sin cobro por receta» on the EPO line with L. 0.00 total, while Glucosa charges L. 900.00 and cart subtotal is L. 900.00.
- **Task 2 (Pure EPO basket)** was tested and verified: 2 EPO (with Rx) correctly computes total L. 0.00, server preview handles `free_by_rule`, and `useCobrarEmission` invokes `issueZeroTotalReceipt` and skips `payInvoice` (no payment cash movement created).
- **Task 3a (Exact change)** was tested and verified: L. 350.00 bill with L. 500.00 cash tendered calculates L. 150.00 change correctly.
- **Task 3c (Monto exacto preset)** was tested and verified: clicking "Monto exacto" sets tendered input to L. 350.00 and calculates L. 0.00 change correctly.
- The defect is isolated to `ConfirmDialog.tsx`: disabling the confirm button when cash payment is underpaid (`isUnderpaid`), and handling zero tender when total > 0.

---

## 4. Conclusion & Required Action

Verdict: **REQUEST_CHANGES**

Worker M2-R1 must implement the following changes in `frontend/src/features/cobrar/components/ConfirmDialog.tsx` and its test suite:

1. **Disable confirm button when underpaid**:
   In `frontend/src/features/cobrar/components/ConfirmDialog.tsx`:
   - Ensure `isUnderpaid` properly detects any entered amount strictly less than `totalCents` (including `0.00`):
     ```tsx
     const isUnderpaid = tenderedCents !== null && tenderedCents < totalCents;
     ```
   - Wire `isUnderpaid` into the confirm button `disabled` attribute:
     ```tsx
     disabled={!status.canConfirm || submitting || (method === 'cash' && isUnderpaid)}
     ```
2. **Update test suite in `frontend/src/features/cobrar/components/ConfirmDialog.test.tsx`**:
   - In the test `advierte cuando el efectivo recibido es menor que el total a cobrar`, add:
     ```tsx
     expect(screen.getByTestId('cobrar-confirm')).toBeDisabled();
     ```
   - Add a test verifying that typing `0.00` also triggers underpaid state and disables the confirm button when total is positive.

---

## 5. Verification Method

1. Run vitest on the dialog component:
   ```powershell
   npx vitest run src/features/cobrar/components/ConfirmDialog.test.tsx
   ```
2. Verify full cobrar suite:
   ```powershell
   npx vitest run src/features/cobrar/
   ```
3. Verify clinical suite:
   ```powershell
   npm run test:clinical
   ```
4. Invalidation conditions:
   - When bill total is L. 350.00 and customer pays L. 300.00 in cash, `data-testid="cobrar-confirm"` remains enabled.
   - When bill total is L. 350.00 and customer enters `0.00` in cash, underpaid alert is missing or button remains enabled.
