# Dispatch Assignment — Worker M3 (Receipts & Operation History Specialist)

## Mission
Complete and harden Milestone M3 (Receipts & Operation History - R3, Features 10, 11, 12 in `PROJECT.md`):
1. Create comprehensive unit tests for `InvoiceHistoryActionDialogs.tsx` covering Void, Reverse, and Payment dialogs with reason length validation (5-500 chars).
2. Fix `frontend/e2e/recibos-flow.spec.ts` locator/fixture mismatches (`"L. 250.00"` currency formatting and receipt page HTML structure in mock).
3. Ensure all quality gates (`npm run typecheck`, legacy UI check, vitest suites) pass with 100%.

## Working Directory
`c:\Projects\S_Hospital_AI\.agents\teamwork\worker_m3`

## File Ownership
- `frontend/src/features/invoices/history/InvoiceHistoryActionDialogs.test.tsx` (new)
- `frontend/e2e/recibos-flow.spec.ts`
- Any minor fixes in `frontend/src/features/recibos/` or `frontend/src/features/invoices/history/` if required.

## Required Reading
- `c:\Projects\S_Hospital_AI\.agents\teamwork\ORIGINAL_REQUEST.md`
- `c:\Projects\S_Hospital_AI\hospital-ai\MANDATO_PRODUCTO_COMPLETO_AZUL_BLANCO.md` (§5)
- `c:\Projects\S_Hospital_AI\AGENTS.md`
- `c:\Projects\S_Hospital_AI\PROJECT.md`
- `c:\Projects\S_Hospital_AI\.agents\teamwork\explorer_m3_frontend\handoff.md`
- `c:\Projects\S_Hospital_AI\.agents\teamwork\explorer_m3_backend\handoff.md`
- `c:\Projects\S_Hospital_AI\.agents\teamwork\explorer_m3_testing\analysis.md`

## Mandatory Integrity Warning
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Tasks
1. Create `frontend/src/features/invoices/history/InvoiceHistoryActionDialogs.test.tsx`:
   - Test Void Dialog: renders reason textarea, enforces min 5 characters (confirm button disabled when < 5 chars, enabled when >= 5 chars), calls `onConfirmVoid(invoice, reason)` on submit.
   - Test Reverse Dialog: renders reason textarea, enforces min 5 characters, warns about cashbox refund movement, calls `onConfirmReverse(invoice, reason)` on submit.
   - Test Payment Collection Dialog: renders balance, collects method and amount, calls `onConfirmPayment(...)`.
2. Fix `frontend/e2e/recibos-flow.spec.ts`:
   - Update currency expectation to canonical format `"L. 250.00"` (with period and space).
   - In the mock for `/api/institutional-receipts/**/pdf`, supply valid institutional receipt HTML containing `<section class="receipt-page">` and standard receipt elements so `summarizeReceiptDocument` detects valid pages and renders the preview iframe cleanly.
3. Verification:
   - `npm run typecheck`
   - `node scripts/check-no-legacy-ui.mjs --mode=strict`
   - `npx vitest run src/features/recibos/ src/features/invoices/history/`
4. Document changes in `changes.md` and handoff report in `handoff.md`.
5. Send completion message to parent.

## 2026-09-28T09:59:12Z
Task received from parent: Create InvoiceHistoryActionDialogs.test.tsx, fix recibos-flow.spec.ts, run verification, document changes and handoff.

