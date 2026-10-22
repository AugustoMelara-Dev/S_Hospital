# Handoff Report: Reviewer M2-2 Round 2 (Monetary Logic & Payment Reviewer)

**Verdict**: **APPROVE**  
**Milestone**: M2 (Cashier Station / Continuous Ledger Cobrar - R2)  
**Target Worker**: Worker M2-Fix  
**Working Directory**: `c:\Projects\S_Hospital_AI\.agents\teamwork\reviewer_m2_2_r2`

---

## 1. Observation

### Verification Commands and Direct Results
1. `npm run typecheck` executed in `frontend`:
   ```
   > s-hospital-frontend@0.1.0 typecheck
   > tsc --noEmit
   Exit code: 0
   ```
2. `npx vitest run src/features/cobrar/` executed in `frontend`:
   ```
   RUN v4.1.11 C:/Projects/S_Hospital_AI/frontend

   ✓ src/features/cobrar/components/CatalogZone.test.tsx (7 tests)
   ✓ src/features/cobrar/components/AccountZone.test.tsx (9 tests)
   ✓ src/features/cobrar/components/ConfirmDialog.test.tsx (9 tests)
   ✓ src/features/cobrar/cobrarSchema.test.ts (4 tests)
   ✓ src/features/cobrar/components/ResultZone.test.tsx (5 tests)
   ✓ src/features/cobrar/components/SummaryActionZone.test.tsx (5 tests)
   ✓ src/features/cobrar/CobrarView.test.tsx (9 tests)
   ✓ src/features/cobrar/state/domain.test.ts (6 tests)
   ✓ src/features/cobrar/state/status.test.ts (9 tests)

   Test Files 9 passed (9)
        Tests 63 passed (63)
     Duration 12.21s
   Exit code: 0
   ```
3. `npm run test:clinical` executed in `frontend`:
   ```
   RUN v4.1.11 C:/Projects/S_Hospital_AI/frontend

   ✓ src/features/invoices/components/PaymentModal.test.tsx (41 tests)
   ✓ src/features/backups/BackupsView.test.tsx (39 tests)
   ✓ src/features/cash/CashBoxView.test.tsx (30 tests)
   ✓ src/features/receipts/ReceiptPreview.test.tsx (23 tests)
   ✓ src/features/admin/UsersView.architecture.test.ts (1 test)
   ✓ src/features/admin/UsersView.test.tsx (35 tests)
   ✓ src/features/receipts/ReceiptPreview.a11y.test.tsx (2 tests)
   ✓ src/features/receipts/InstitutionalReceiptPreviewFrame.test.tsx (5 tests)
   ✓ src/features/backups/BackupsView.architecture.test.ts (1 test)

   Test Files 9 passed (9)
        Tests 177 passed (177)
     Duration 17.84s
   Exit code: 0
   ```
4. `node scripts/check-no-legacy-ui.mjs --mode=strict` executed in `frontend`:
   ```
   [QUALITY GATE PASSED] modo=strict; 396 archivos; 0 violaciones.
   Exit code: 0
   ```

### Code Inspection Observations
5. In `frontend/src/features/cobrar/components/ConfirmDialog.tsx` lines 62–66:
   ```tsx
   const [cashTendered, setCashTendered] = useState<string>('');
   const tenderedCents = parseCents(cashTendered);
   const changeCents = tenderedCents !== null && tenderedCents >= totalCents ? tenderedCents - totalCents : 0;
   const isUnderpaid = tenderedCents !== null && tenderedCents < totalCents;
   ```
6. In `frontend/src/features/cobrar/components/ConfirmDialog.tsx` lines 90–99:
   ```tsx
   <button
     type="button"
     className={PRIMARY_BUTTON}
     onClick={onConfirm}
     disabled={!status.canConfirm || submitting || (method === 'cash' && isUnderpaid)}
     data-testid="cobrar-confirm"
   >
     {submitting ? 'Emitiendo…' : isZero ? 'Emitir sin cobro' : `Cobrar${totalLabel ? ` · ${totalLabel}` : ''}`}
   </button>
   ```
7. In `frontend/src/features/cobrar/components/ConfirmDialog.tsx` lines 216–238:
   - Shortcut button:
     ```tsx
     <button
       type="button"
       onClick={handleSetExactCash}
       className="mb-0.5 inline-flex h-[var(--ui-control-h)] items-center rounded-[var(--ui-radius-control)] border border-[var(--ui-line-strong)] bg-[var(--ui-surface)] px-3 text-[length:var(--ui-text-sm)] font-medium text-[color:var(--ui-ink)] hover:border-[var(--ui-action)] hover:bg-[var(--ui-action-subtle)] hover:text-[color:var(--ui-action)] active:scale-[0.96] motion-reduce:active:scale-100"
     >
       Monto exacto
     </button>
     ```
   - Alert display when underpaid:
     ```tsx
     {isUnderpaid ? (
       <p role="alert" className="text-[length:var(--ui-text-xs)] font-medium text-[color:var(--ui-danger)]">
         El monto recibido es menor que el total a cobrar.
       </p>
     ) : null}
     ```
8. In `frontend/src/features/cobrar/components/ConfirmDialog.test.tsx` lines 207–233:
   - Test verifying positive partial underpayment:
     ```tsx
     it('advierte cuando el efectivo recibido es menor que el total a cobrar', async () => {
       const user = userEvent.setup();
       renderDialog({ status: payStatus(1725), method: 'cash' });
       const cashInput = screen.getByLabelText(/efectivo recibido/i);
       await user.type(cashInput, '10.00');
       expect(screen.getByText(/el monto recibido es menor que el total a cobrar/i)).toBeVisible();
       expect(screen.getByTestId('cobrar-confirm')).toBeDisabled();
     });
     ```
   - Test verifying zero tender underpayment:
     ```tsx
     it('deshabilita el botón de confirmar y advierte cuando se ingresa 0.00 de efectivo para un total positivo', async () => {
       const user = userEvent.setup();
       renderDialog({ status: payStatus(1725), method: 'cash' });
       const cashInput = screen.getByLabelText(/efectivo recibido/i);
       await user.type(cashInput, '0.00');
       expect(screen.getByText(/el monto recibido es menor que el total a cobrar/i)).toBeVisible();
       expect(screen.getByTestId('cobrar-confirm')).toBeDisabled();
     });
     ```
9. In `frontend/src/features/cobrar/components/AccountZone.tsx` lines 64–75, 145–153, 182–204:
   - Eligible item badge: `{lineIsFree(line) ? <FreeMedicationBadge label="Sin cobro por receta" /> : null}`.
   - Column `Ajuste`: displays `Sin cobro` for free item, `—` for non-free items.
   - Column `Importe`: displays `MoneyText cents={lineTotalCents(line)}` (L. 0.00 for free item, exact catalog price for non-free items).
   - Zero exposure of internal codes: `ERYTHROPOIETIN_DIALYSIS_PRESCRIPTION` does not appear in user-facing markup; checkbox label is «Paciente con receta de diálisis» and helper text is «Aplica solo al medicamento elegible; el resto conserva su precio.».
10. In `frontend/src/features/cobrar/hooks/useCobrarEmission.ts` and `frontend/src/features/cobrar/components/ResultZone.tsx`:
    - Payment submission is committed before presenting `ResultZone`.
    - Receipt printing and PDF download are independent actions triggered on demand from `ResultZone`. If network or printing fails, `onStatus` reports an error without re-submitting payments or duplicating invoices.

---

## 2. Logic Chain

1. *From Observation 5 & 6*: The condition `isUnderpaid` is defined as `tenderedCents !== null && tenderedCents < totalCents;`. If `cashTendered` is `'0.00'`, `parseCents` yields `0`. When `totalCents` is positive (e.g. 1725 cents), `0 < 1725` evaluates to `true`. When `cashTendered` is `'10.00'`, `1000 < 1725` evaluates to `true`.
2. *From Step 1 & Observation 6*: The confirm button's `disabled` attribute evaluates `!status.canConfirm || submitting || (method === 'cash' && isUnderpaid)`. When `method === 'cash'` and `isUnderpaid` is `true`, `cobrar-confirm` is unconditionally disabled.
3. *From Observation 7 & 8*: When underpaid, `ConfirmDialog.tsx` displays the `<p role="alert">` notification and disables the button. This directly addresses the defect reported by Challenger M2-2 in Round 1.
4. *From Observation 9*: The per-line EPO dialysis rule applies strictly to lines with `isEligibleMedication` and `dialysisPrescription: true`. Mixed carts retain standard pricing for all other items. The UI uses institutional language («Sin cobro por receta», «Paciente con receta de diálisis») without leaking technical constants or marketing slogans.
5. *From Observation 10*: Decoupling between payment and printing is strict: `useCobrarEmission` commits invoice creation and payment, transitioning to `ResultZone`. The cashier can print or save PDF independently without re-triggering billing transactions.
6. *From Observations 1–4*: All 9 cobrar feature tests, all 177 clinical tests, TypeScript compilation (`tsc --noEmit`), and strict UI tokens verification pass with 0 errors.

---

## 3. Caveats

- No caveats. The remediation in `ConfirmDialog.tsx` is clean, adheres to the project's cent-based arithmetic standards, and introduces zero regressions across all test suites.

---

## 4. Conclusion

- **Verdict**: **APPROVE**.
- The cashier station in `frontend/src/features/cobrar/` meets all acceptance criteria defined in `hospital-ai/MANDATO_PRODUCTO_COMPLETO_AZUL_BLANCO.md` (§4) and `PROJECT.md` (Feature 5–9).
- Defect from Round 1 (allowing confirmation when cash was underpaid) has been fully resolved.
- Strict per-line EPO rule UI, server monetary authority, exact cent calculations, change calculation, exact tender preset, and payment/printing decoupling are verified.

---

## 5. Verification Method

To independently reproduce and verify this review, execute the following commands in `C:\Projects\S_Hospital_AI\frontend`:

```powershell
# 1. TypeScript compilation check
npm run typecheck

# 2. Strict UI token check
node scripts/check-no-legacy-ui.mjs --mode=strict

# 3. Cobrar feature test suite (including ConfirmDialog tests)
npx vitest run src/features/cobrar/

# 4. Clinical regression suite
npm run test:clinical
```

### Invalidation Conditions
- If entering cash tendered less than the bill total leaves `data-testid="cobrar-confirm"` enabled.
- If entering `0.00` cash tender on a positive total does not display the underpayment alert.
- If any test in `src/features/cobrar/` or `npm run test:clinical` fails.
