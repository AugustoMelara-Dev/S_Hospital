# Dispatch Assignment — Worker M2-Fix (Cashier Station Remediation)

## 2026-09-28T09:34:27Z

## Mission
Remediate the empirical defect identified by Challenger M2-2 in `ConfirmDialog.tsx`:
When paying by Cash (`method === 'cash'`), if cash tendered is strictly less than the total (`isUnderpaid`), the confirm button (`data-testid="cobrar-confirm"`) MUST be disabled. In addition, an entered tender of `0.00` must be flagged as underpaid when total is positive.

## Working Directory
`c:\Projects\S_Hospital_AI\.agents\teamwork\worker_m2_fix`

## File Ownership
- `frontend/src/features/cobrar/components/ConfirmDialog.tsx`
- `frontend/src/features/cobrar/components/ConfirmDialog.test.tsx`

## Required Reading Before Making Changes
- `c:\Projects\S_Hospital_AI\.agents\teamwork\ORIGINAL_REQUEST.md`
- `c:\Projects\S_Hospital_AI\hospital-ai\MANDATO_PRODUCTO_COMPLETO_AZUL_BLANCO.md` (§4)
- `c:\Projects\S_Hospital_AI\AGENTS.md`
- `c:\Projects\S_Hospital_AI\PROJECT.md`
- `c:\Projects\S_Hospital_AI\.agents\teamwork\challenger_m2_2\handoff.md`

## Mandatory Integrity Warning
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Tasks
1. In `frontend/src/features/cobrar/components/ConfirmDialog.tsx`:
   - Compute `isUnderpaid = tenderedCents !== null && tenderedCents < totalCents;` (ensuring `0.00` tender is caught).
   - In the confirm button, update `disabled`:
     `disabled={!status.canConfirm || submitting || (method === 'cash' && isUnderpaid)}`
2. In `frontend/src/features/cobrar/components/ConfirmDialog.test.tsx`:
   - In test `'advierte cuando el efectivo recibido es menor que el total a cobrar'`, assert that `screen.getByTestId('cobrar-confirm')` is disabled.
   - Add a test verifying that typing `'0.00'` into cash tendered when total is positive flags underpayment and disables the confirm button.
3. Verify:
   - `npm run typecheck`
   - `node scripts/check-no-legacy-ui.mjs --mode=strict`
   - `npx vitest run src/features/cobrar/components/ConfirmDialog.test.tsx`
   - `npx vitest run src/features/cobrar/`
   - `npm run test:clinical`
4. Document changes in `changes.md` and completion handoff in `handoff.md`.
5. Send completion message to parent.
