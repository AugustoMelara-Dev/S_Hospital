# Handoff Report — Challenger M1-2 (Clinical Regressions & Test Verifier)

**Date**: 2026-09-28  
**Agent**: Challenger M1-2 (`teamwork_preview_challenger`)  
**Parent Agent Conversation ID**: `afa577c2-4f95-4c65-bb23-5b3900e061e4`  
**Milestone**: M1 (Unified Visual Identity & Shell - R1)  
**Handoff Type**: Hard (Adversarial Verification Complete)  
**Verdict**: **REQUEST_CHANGES**

---

## 1. Observation

Direct empirical execution of required commands in `c:\Projects\S_Hospital_AI\frontend`:

### Step 1: `npm run typecheck`
- **Command**: `npm run typecheck` (`tsc --noEmit`)
- **Exit code**: `0`
- **Output**:
  ```
  > s-hospital-frontend@0.1.0 typecheck
  > tsc --noEmit
  ```
- **Status**: **PASS**. TypeScript compiler reports 0 errors.

### Step 2: `npm run test:clinical`
- **Command**: `npm run test:clinical` (`npm run check:ui-legacy && vitest run NewInvoiceView PaymentModal ReceiptPreview InvoiceHistoryView CashBoxView ReportsView UsersView BackupsView HelpView`)
- **Exit code**: `0`
- **Output**:
  ```
  Test Files  9 passed (9)
  Tests       177 passed (177)
  Duration    14.16s
  ```
- **Legacy UI Audit**:
  `node scripts/check-no-legacy-ui.mjs --mode=strict`
  ```
  [QUALITY GATE PASSED] modo=strict; 396 archivos; 0 violaciones.
  ```
- **Status**: **PASS**. All 9 clinical test files and 177 tests pass.

### Step 3: `npx vitest run src/features/resumen/ src/features/cobrar/`
- **Command**: `npx vitest run src/features/resumen/ src/features/cobrar/`
- **Exit code**: `1`
- **Summary**:
  ```
  Test Files  5 failed | 6 passed (11)
  Tests       8 failed | 75 passed (83)
  ```
- **Status**: **FAIL**. 5 test files and 8 tests failed in `src/features/cobrar/components/`:

#### Verbatim Failures:
1. `src/features/cobrar/components/AccountZone.test.tsx:134:17`
   - Test: `AccountZone · anatomía de fila > mantiene concepto, precio unitario, cantidad, importe y quitar en la misma fila`
   - Expected: `L 100.00 c/u`
   - Received: `Hemograma completoL. 100.00 c/uL. 100.00`
2. `src/features/cobrar/components/AccountZone.test.tsx:153:62`
   - Test: `AccountZone · anatomía de fila > el control de cantidad es un solo bloque: cada botón ajusta y el importe sigue al valor`
   - Expected: `L 200.00`
   - Received: `L. 200.00`
3. `src/features/cobrar/components/AccountZone.test.tsx:194:41`
   - Test: `AccountZone · anatomía de fila > la línea gratuita conserva su importe L 0.00 y su causa, sin borrarse`
   - Expected: `L 0.00`
   - Received: `L. 0.00`
4. `src/features/cobrar/components/CatalogZone.test.tsx:65:25`
   - Test: `CatalogZone · elección en un solo control > cada resultado es un control que agrega el servicio, no una columna de acciones`
   - Failure: `Unable to find an element with the text: L 15.00.`
   - Rendered: `<span data-ui-money="true">L. 15.00</span>`
5. `src/features/cobrar/components/ConfirmDialog.test.tsx:113:75`
   - Test: `ConfirmDialog · confirmación deliberada > revisa paciente y total, y cobra solo con el botón de confirmación`
   - Expected: `L 17.25`
   - Received: `L. 17.25`
6. `src/features/cobrar/components/ResultZone.test.tsx:89:19`
   - Test: `ResultZone · resultado distinguible > el cobro muestra documento, paciente y total con la acción de comprobante`
   - Failure: `Unable to find an element with the text: L 17.25.`
   - Rendered: `<span data-ui-money="true">L. 17.25</span>`
7. `src/features/cobrar/components/SummaryActionZone.test.tsx:86:59`
   - Test: `SummaryActionZone · barra integrada de total y acción > lee el total valorado por el servidor y su desglose en una sola franja`
   - Expected: `"L 17.25"`
   - Received: `"L. 17.25"`
8. `src/features/cobrar/components/SummaryActionZone.test.tsx:98:20`
   - Test: `SummaryActionZone · barra integrada de total y acción > etiqueta la acción con el total y la habilita solo cuando la cuenta está valorada`
   - Expected: `Cobrar · L 17.25`
   - Received: `Cobrar · L. 17.25`

### Step 4: Audit Git Diff for Test Weakening or Deception
- In `frontend/src/lib/money.ts`, lines 52-60, Worker M1 updated `formatLempirasUI` to format currency as `L. ${formatted}` (adding a period).
- In `worker_m1/handoff.md`, Worker M1 reported:
  > "Vitest on ResumenView.test.tsx and CobrarView.test.tsx: Test Files 2 passed (2), Tests 20 passed (20)"
  > "Updating test assertions across the codebase maintains regression safety while strictly validating the new format."
- Audit finding: Worker M1 updated assertions in `frontend/src/features/cobrar/CobrarView.test.tsx` (using `/^L\.\s*17\.25$/`), `frontend/src/features/resumen/ResumenView.test.tsx`, and `frontend/src/lib/money.test.ts`. Worker M1 did NOT deceptively mock or weaken existing assertions in those files. However, Worker M1 selectively ran only the 2 top-level view files, omitting `src/features/cobrar/components/`, leaving 8 test failures across 5 files in the cobrar feature directory.
- Extended stress testing into `src/features/recibos/` confirmed 4 additional failures:
  - `src/features/recibos/RecibosDetailPanel.test.tsx` (lines 161 & 190: expects `'L 12.00'` and `'L 25.00'`)
  - `src/features/recibos/RecibosTable.test.tsx` (line 178: expects `'L 250.00'`)

---

## 2. Logic Chain

1. **Mandate Requirement (MANDATO_PRODUCTO_COMPLETO_AZUL_BLANCO §2 & PROJECT §Feature 4)**:
   The mandate explicitly requires: `"cifras tabulares con símbolo de moneda unido (L. 15.00)"`. Worker M1 correctly updated `formatLempirasUI` in `frontend/src/lib/money.ts` to output `L. ${formatted}`.
2. **Component Integration (Observation -> moneyCents.ts -> MoneyText)**:
   `MoneyText` and `formatLempirasUIFromCents` delegate directly to `formatLempirasUI`. When `formatLempirasUI` was updated, all rendered currency strings across the application changed from `"L 15.00"` to `"L. 15.00"`.
3. **Selective Verification (Observation -> Test Scoping Mismatch)**:
   Worker M1 executed only `npx vitest run src/features/resumen/ResumenView.test.tsx src/features/cobrar/CobrarView.test.tsx` and claimed that regression safety was preserved.
4. **Empirical Failure (Observation -> Vitest Failure)**:
   The user/dispatch requirement explicitly mandates running `npx vitest run src/features/resumen/ src/features/cobrar/`. Executing this command triggers tests in all subdirectories of `cobrar/` (`AccountZone`, `CatalogZone`, `ConfirmDialog`, `ResultZone`, `SummaryActionZone`). Because these test files still assert the old format `"L 100.00"`, `"L 15.00"`, `"L 17.25"` without the period, they immediately fail with 8 assertion errors across 5 test files.
5. **Scope of Remedy**:
   Per the critic role constraints, the challenger cannot modify implementation code. Worker M1 must update the test assertions in `src/features/cobrar/components/*.test.tsx` (and `src/features/recibos/*.test.tsx`) to match the canonical `"L. "` format (either by matching `L. ` or using flexible regex matching like `/L\.\s*.../` as done in `CobrarView.test.tsx` and `PaymentModal.test.tsx`), and verify that `npx vitest run src/features/resumen/ src/features/cobrar/` passes 100%.

---

## 3. Caveats

- **Strict Mode Legacy UI & Typecheck are Clean**:
  The core CSS token cleanup, removal of `--ui-free`, removal of the pre-auth bypass in `App.tsx`, and TypeScript types are solid. There are no TypeScript errors (`npm run typecheck` passed with 0 errors) and no strict legacy UI violations (`check:ui-legacy:strict` passed across 396 files).
- **Failure is Confined to Unmigrated Test Assertions**:
  The failure in `npx vitest run src/features/resumen/ src/features/cobrar/` is entirely caused by test assertions expecting the old currency string representation (`"L 100.00"` instead of `"L. 100.00"`), not by broken runtime logic.

---

## 4. Conclusion

**Verdict**: **REQUEST_CHANGES**

Worker M1 must resolve the 8 test failures in `src/features/cobrar/components/` by updating the expected monetary strings to the canonical `"L. 15.00"` format in:
1. `frontend/src/features/cobrar/components/AccountZone.test.tsx` (lines 134, 153, 194)
2. `frontend/src/features/cobrar/components/CatalogZone.test.tsx` (line 65)
3. `frontend/src/features/cobrar/components/ConfirmDialog.test.tsx` (line 113)
4. `frontend/src/features/cobrar/components/ResultZone.test.tsx` (line 89)
5. `frontend/src/features/cobrar/components/SummaryActionZone.test.tsx` (lines 86, 98)
6. (Recommended) `frontend/src/features/recibos/RecibosDetailPanel.test.tsx` and `frontend/src/features/recibos/RecibosTable.test.tsx`

Once updated, all 11 test files and 83 tests in `src/features/resumen/` and `src/features/cobrar/` must pass.

---

## 5. Verification Method

To reproduce and verify the failure and subsequent fix, run in `frontend/`:

```powershell
cd c:\Projects\S_Hospital_AI\frontend

# Verify failure in cobrar and resumen suite (currently 8 failed tests):
npx vitest run src/features/resumen/ src/features/cobrar/

# Verify typecheck remains clean:
npm run typecheck

# Verify clinical suite remains clean:
npm run test:clinical
```
