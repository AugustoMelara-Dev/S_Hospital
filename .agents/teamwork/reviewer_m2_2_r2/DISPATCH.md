# Dispatch Assignment — Reviewer M2-2 Round 2 (Monetary Logic & Payment Re-Reviewer)

## Mission
Re-review monetary authority, per-line EPO rule enforcement, and payment confirmation in `frontend/src/features/cobrar/` following the remediation in `worker_m2_fix`.

## Working Directory
`c:\Projects\S_Hospital_AI\.agents\teamwork\reviewer_m2_2_r2`

## Required Reading
- `c:\Projects\S_Hospital_AI\.agents\teamwork\ORIGINAL_REQUEST.md`
- `c:\Projects\S_Hospital_AI\hospital-ai\MANDATO_PRODUCTO_COMPLETO_AZUL_BLANCO.md` (§4)
- `c:\Projects\S_Hospital_AI\PROJECT.md`
- `c:\Projects\S_Hospital_AI\.agents\teamwork\worker_m2_fix\handoff.md`

## Verification Scope
1. Per-line EPO dialysis rule: institutional badge «Sin cobro por receta» on eligible medication only, L. 0.00 line total, normal charge on other items. Zero exposure of `ERYTHROPOIETIN_DIALYSIS_PRESCRIPTION` or marketing slogans.
2. Server monetary authority via `/api/invoices/preview` with exact integer cent math.
3. ConfirmDialog remediation in `ConfirmDialog.tsx`:
   - Exact change calculation (`tenderedCents - totalCents`).
   - `Monto exacto` shortcut button.
   - Underpaid cash disables `cobrar-confirm` button.
   - `0.00` tender detected as underpaid when total is positive.
   - Card/transfer references captured properly.
4. Decoupled payment confirmation and receipt printing.
5. Run: `npm run typecheck`, `npx vitest run src/features/cobrar/`, and `npm run test:clinical`.



## 2026-09-28T09:40:28Z
You are Reviewer M2-2 (Round 2) for the Hospital General San Isidro Cashier System.
Your working directory is: c:\Projects\S_Hospital_AI\.agents\teamwork\reviewer_m2_2_r2.
Your dispatch assignment is detailed in: c:\Projects\S_Hospital_AI\.agents\teamwork\reviewer_m2_2_r2\DISPATCH.md.
MANDATORY: Read c:\Projects\S_Hospital_AI\.agents\teamwork\ORIGINAL_REQUEST.md, c:\Projects\S_Hospital_AI\hospital-ai\MANDATO_PRODUCTO_COMPLETO_AZUL_BLANCO.md (§4), and c:\Projects\S_Hospital_AI\PROJECT.md.
Worker M2-Fix handoff: c:\Projects\S_Hospital_AI\.agents\teamwork\worker_m2_fix\handoff.md.

Re-verify:
- Strict per-line EPO dialysis rule UI («Sin cobro por receta» badge on eligible line, L. 0.00 line total, normal charge on other items, zero backend code exposure)
- Server monetary authority (/api/invoices/preview, exact cent validation, free_by_rule handling)
- Payment confirmation in ConfirmDialog.tsx (Cash change calculation, exact tender button, underpaid alert, confirm button disabled when underpaid)
- Decoupled payment confirmation and receipt printing
- Run: npm run typecheck, npx vitest run src/features/cobrar/, and npm run test:clinical

Provide verdict (APPROVE or REQUEST_CHANGES) in c:\Projects\S_Hospital_AI\.agents\teamwork\reviewer_m2_2_r2\handoff.md and message parent.
