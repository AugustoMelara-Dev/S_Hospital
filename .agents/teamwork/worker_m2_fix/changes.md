# Code Changes: Worker M2-Fix (Cashier Station Remediation)

## Overview
Remediated the cash underpayment enforcement defect in `ConfirmDialog.tsx` and strengthened test coverage in `ConfirmDialog.test.tsx` as mandated by Challenger M2-2 handoff report.

## Modified Files

### 1. `frontend/src/features/cobrar/components/ConfirmDialog.tsx`
- **Line 65**:
  - *Before*: `const isUnderpaid = tenderedCents !== null && tenderedCents > 0 && tenderedCents < totalCents;`
  - *After*: `const isUnderpaid = tenderedCents !== null && tenderedCents < totalCents;`
  - *Rationale*: Previously, entering `0.00` resulted in `tenderedCents === 0`, causing `tenderedCents > 0` to evaluate to `false`, failing to flag zero cash tendered as an underpayment when the bill total was positive. Removing `tenderedCents > 0` ensures any valid entered amount strictly less than `totalCents` (including `0.00`) is correctly marked as `isUnderpaid`.
- **Line 94**:
  - *Before*: `disabled={!status.canConfirm || submitting}`
  - *After*: `disabled={!status.canConfirm || submitting || (method === 'cash' && isUnderpaid)}`
  - *Rationale*: Previously, the confirm button (`data-testid="cobrar-confirm"`) remained enabled even when an underpayment was detected in cash mode, allowing cashiers to accidentally submit underpaid cash transactions. Now, the confirm button is strictly disabled whenever `method === 'cash'` and `isUnderpaid` is true.

### 2. `frontend/src/features/cobrar/components/ConfirmDialog.test.tsx`
- **Updated test `advierte cuando el efectivo recibido es menor que el total a cobrar`**:
  - Added assertion `expect(screen.getByTestId('cobrar-confirm')).toBeDisabled();` after typing `10.00` for a total of `17.25`.
- **Added new test `deshabilita el botón de confirmar y advierte cuando se ingresa 0.00 de efectivo para un total positivo`**:
  - Types `0.00` into `cobrar-cash-tendered` with a total of `17.25` in cash mode.
  - Asserts warning text is displayed (`El monto recibido es menor que el total a cobrar.`).
  - Asserts confirm button is disabled (`expect(screen.getByTestId('cobrar-confirm')).toBeDisabled()`).

## Verification Results
1. `npm run typecheck`: Passed (exit code 0).
2. `node scripts/check-no-legacy-ui.mjs --mode=strict`: Passed (0 violations across 396 files).
3. `npx vitest run src/features/cobrar/components/ConfirmDialog.test.tsx`: Passed (9/9 tests).
4. `npx vitest run src/features/cobrar/`: Passed (63/63 tests across 9 test files).
5. `npm run test:clinical`: Passed (177/177 tests across 9 test files).
6. `npx eslint src/features/cobrar/components/ConfirmDialog.tsx src/features/cobrar/components/ConfirmDialog.test.tsx`: Passed (0 errors, 0 warnings).
