# Review Report: Milestone M2 — Cashier Station & Continuous Ledger Layout (R2)

## Review Summary

**Verdict**: APPROVE  
**Reviewer Role**: Reviewer & Adversarial Critic (Cashier Flow & Layout Reviewer)  
**Target Milestone**: M2 (Cashier Station / Continuous Ledger Cobrar - R2)  
**Worker Reviewed**: `worker_m2_r1`  
**Overall Risk Assessment**: LOW  

---

## 1. Observation

### Exact File Paths & Code Line Observations
1. **Continuous Vertical Ledger Workspace**:
   - `frontend/src/features/cobrar/CobrarView.tsx` (lines 259–324): The former rigid 65/35 side-by-side grid split (`xl:grid-cols-[minmax(0,1fr)_380px]`) has been completely eradicated. There is zero `grid-cols` layout on the main workspace. The view flows vertically within a single unified `AdminPanel` representing the continuous ledger (`Cuenta`):
     - Line 275: `PatientZone` (`Paciente`)
     - Line 280: `CatalogZone` (`Búsqueda / Inserción rápida`)
     - Line 301: `AccountZone` (`Líneas contables (Ledger)`)
     - Line 314: `SummaryActionZone` (`Resumen monetario y acción de cobro`)
2. **Patient Data Minimalism & Clean Initial State**:
   - `frontend/src/features/cobrar/components/PatientZone.tsx` (lines 31–52): Only renders `Nombre del paciente` via `AdminField`. There are zero fields for medical record (`expediente`), RTN/identity document, telephone, address, insurance, or clinical diagnosis.
   - `frontend/src/features/cobrar/cobrarSchema.ts` (lines 19–31): Zod schema strictly validates only `patient_name`.
   - `frontend/src/features/cobrar/CobrarView.tsx` (lines 206–217): `handleNewOperation()` completely resets state:
     ```typescript
     function handleNewOperation() {
       emission.reset();
       setLines([]);
       form.reset({ patient_name: '' });
       setSearch('');
       setCategoryId('all');
       setMethod('cash');
       setReference('');
       setConfirmOpen(false);
       setActionError(null);
       window.setTimeout(() => form.setFocus('patient_name'), 0);
     }
     ```
     Starting a new operation clears cart lines, empties patient name, removes any active dialysis condition, and refocuses on the patient name field.
3. **Keyboard Navigation & Search Insertion Bar**:
   - `frontend/src/features/cobrar/components/CatalogZone.tsx`:
     - Lines 64–76: Arrow key navigation (`ArrowDown` / `ArrowUp` / `Escape`) handles navigation across catalog search results with wrapping via modulo arithmetic.
     - Lines 78–86: `handleSearchSubmit()` invokes `onAddFirst()` or `onAdd(activeService)`.
     - Lines 119–122: `AdminSearch` has `onSubmit={services.length > 0 ? handleSearchSubmit : undefined}`. It adds the selected service with quantity 1 without opening the payment dialog or confirming payment.
     - Lines 150–173: Quick-add chips are backed strictly by real catalog items (`services.slice(0, 5)`). Zero hardcoded items.
4. **Continuous Accounting Table & EPO Rule Enforcement**:
   - `frontend/src/features/cobrar/components/AccountZone.tsx`:
     - Dedicated columns: `Concepto` (line 59), `Cantidad` (line 76, stepper with `-` / `+` accessible touch buttons), `Precio unitario` (line 130, right-aligned, formatted with `MoneyText`), `Ajuste` (line 140, center-aligned, displaying "Sin cobro" or "—"), `Importe` (line 155, right-aligned with `MoneyText`), and `Quitar` (line 163).
     - Lines 182–204: Dialysis prescription rule renders a single concise checkbox: `Paciente con receta de diálisis` with explanation `Aplica solo al medicamento elegible; el resto conserva su precio.`.
     - Lines 68, 146–149: Eligible medication lines display the institutional badge `Sin cobro por receta`, unit price note, adjustment `Sin cobro`, and line total `L. 0.00`. Non-eligible items charge normally. Zero exposure of backend code `ERYTHROPOIETIN_DIALYSIS_PRESCRIPTION`.
5. **Payment Method & Cash Change Calculation**:
   - `frontend/src/features/cobrar/components/ConfirmDialog.tsx`:
     - Lines 62–65: Real-time cash change calculation (`tenderedCents - totalCents`).
     - Lines 67–71, 216–222: `Monto exacto` preset button.
     - Lines 234–238: Underpayment alert if tendered cash is positive but less than total.
     - Lines 207–209, 253–255: `onKeyDown` explicitly intercepts and prevents `Enter` key from submitting modal. Payment only confirms via explicit click on `data-testid="cobrar-confirm"`.
     - Lines 261–266: When total is zero (`isZero`), payment methods are not requested.

### Verbatim Tool Commands Executed & Results
- Command: `npm run typecheck` in `frontend/`
  ```
  > s-hospital-frontend@0.1.0 typecheck
  > tsc --noEmit
  Exit code: 0
  ```
- Command: `node scripts/check-no-legacy-ui.mjs --mode=strict` in `frontend/`
  ```
  [QUALITY GATE PASSED] modo=strict; 396 archivos; 0 violaciones.
  Exit code: 0
  ```
- Command: `npx vitest run src/features/cobrar/` in `frontend/`
  ```
  Test Files  9 passed (9)
       Tests  62 passed (62)
    Duration  12.40s
  Exit code: 0
  ```
- Command: `npm run test:clinical` in `frontend/`
  ```
  Test Files  9 passed (9)
       Tests  177 passed (177)
    Duration  18.33s
  Exit code: 0
  ```

---

## 2. Logic Chain

1. *From Observation 1*: The workspace in `CobrarView.tsx` uses a vertical stacked layout inside `<AdminPanel>` (`PatientZone` → `CatalogZone` → `AccountZone` → `SummaryActionZone`). The removal of `xl:grid-cols-[minmax(0,1fr)_380px]` eliminates the cramped 65/35 side-by-side catalog split and allows the accounting ledger table to span the full width of the workstation, exactly fulfilling Mandato §4 and R2.
2. *From Observation 2*: `PatientZone.tsx` and `cobrarSchema.ts` enforce that only `patient_name` is requested and validated. `handleNewOperation()` wipes all lines, clears patient name, resets the dialysis condition, and refocuses on `patient_name`. Therefore, no patient or clinical data leaks across operations.
3. *From Observation 3*: `CatalogZone.tsx` encapsulates search and keyboard navigation. Pressing `ArrowDown`/`ArrowUp` cycles through available services, and pressing `Enter` calls `onAdd(activeService)` or `onAddFirst()`. Because `AdminSearch` uses `event.preventDefault()` on form submit, and `handleSearchSubmit` only adds the service to the ledger lines, pressing `Enter` never triggers payment submission or confirmation dialog opening.
4. *From Observation 4*: `AccountZone.tsx` features dedicated columns for `Concepto`, `Cantidad`, `Precio unitario`, `Ajuste`, `Importe`, and `Quitar`. All monetary values use `MoneyText` with `tabular-nums` and standard `"L. 15.00"` formatting. The EPO dialysis prescription rule applies strictly per line to eligible medications; other lines (e.g. glucose, lab) retain standard pricing.
5. *From Observation 5*: `ConfirmDialog.tsx` handles cash calculation with exact cent arithmetic, provides a `Monto exacto` shortcut, flags underpayment, suppresses payment method selection for zero-total rule emissions, and intercepts `Enter` to prevent unintended charges.
6. *Integrity Verification*: Codebase grep searches confirm zero hardcoded mock test patient names (e.g. "Maria Lopez") or fake catalog responses in production source code. All commands ran cleanly and independently.

---

## 3. Caveats

- **No caveats.** The implementation in `frontend/src/features/cobrar/` satisfies all requirements of Milestone M2 without shortcuts, facades, or legacy regressions.

---

## 4. Adversarial Challenges & Stress Testing

### Challenge 1: Keyboard Trap & Rapid Enter Submissions
- *Hypothesis*: Rapidly typing a service name and pressing `Enter` could accidentally submit the payment or trigger double additions.
- *Test & Inspection*: Inspected `handleSearchSubmit` in `CatalogZone.tsx` and tested in `CobrarView.test.tsx` (`un Enter en la búsqueda agrega el concepto seleccionado sin abrir confirmación ni cobrar`).
- *Result*: PASS. `Enter` only adds the service with quantity 1. The confirm dialog remains closed, and focus remains in the search box for rapid continuous entry.

### Challenge 2: Stepper Bounds & Quantity Edge Cases
- *Hypothesis*: Decreasing quantity past 1 or entering decimal/invalid values ("0", "-1", "abc") could create negative totals or fake zeros.
- *Test & Inspection*: In `AccountZone.tsx`, `step()` clamps minimum units to `Math.max(100, units + delta)`. Invalid values trigger an immediate accessible `role="alert"` inline warning, set `aria-invalid="true"`, disable stepper buttons, disable the primary confirm button, and set the line amount to "No disponible" rather than `L. 0.00`.
- *Result*: PASS.

### Challenge 3: Cash Change Underpayment
- *Hypothesis*: Typing a cash amount lower than the total could calculate negative change or erroneously confirm payment.
- *Test & Inspection*: In `ConfirmDialog.tsx`, `changeCents = tenderedCents !== null && tenderedCents >= totalCents ? tenderedCents - totalCents : 0`. An alert is explicitly rendered: `El monto recibido es menor que el total a cobrar.`
- *Result*: PASS.

### Challenge 4: Integrity Violation Check
- *Check*: Hardcoded test results, facade implementations, shortcuts, or fabricated outputs.
- *Result*: PASS. Zero integrity violations detected.

---

## 5. Conclusion

The implementation of Milestone M2 (Cashier Station Continuous Ledger Cobrar - R2) by `worker_m2_r1` is **APPROVED**. It faithfully executes the Continuous Ledger architecture of Proposal A depurada, enforces patient data minimalism, provides accessible keyboard navigation, structures a full accounting table with per-line EPO rule adherence, and cleanly decouples payment confirmation from receipt printing.

---

## 6. Verification Method

To independently reproduce this verification:
1. Open terminal in `frontend/`:
   ```powershell
   npm run typecheck
   node scripts/check-no-legacy-ui.mjs --mode=strict
   npx vitest run src/features/cobrar/
   npm run test:clinical
   ```
2. Verify all suites pass with exit code 0.
3. Inspect `frontend/src/features/cobrar/CobrarView.tsx` to confirm no side-by-side grid splits remain.
