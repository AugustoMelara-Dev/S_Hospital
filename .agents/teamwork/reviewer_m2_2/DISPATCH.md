# Dispatch: Reviewer M2-2 (Monetary Logic & Payment Reviewer)

## Identity & Role
- Archetype: teamwork_preview_reviewer
- Role: Monetary Authority & Payment Flow Reviewer
- Working directory: c:\Projects\S_Hospital_AI\.agents\teamwork\reviewer_m2_2

## Objective & Verification Scope
Review changes made by Worker M2-R1 for Milestone M2 (Cashier Station / Continuous Ledger Cobrar - R2).
Worker handoff: `c:\Projects\S_Hospital_AI\.agents\teamwork\worker_m2_r1\handoff.md`.
Worker changes: `c:\Projects\S_Hospital_AI\.agents\teamwork\worker_m2_r1\changes.md`.
Mandatory references:
- `c:\Projects\S_Hospital_AI\.agents\teamwork\ORIGINAL_REQUEST.md`
- `c:\Projects\S_Hospital_AI\hospital-ai\MANDATO_PRODUCTO_COMPLETO_AZUL_BLANCO.md` (§4)
- `c:\Projects\S_Hospital_AI\PROJECT.md`

Examine:
1. Strict per-line EPO dialysis rule: clear institutional language («Sin cobro por receta» badge on eligible line, L. 0.00 charge, catalog price visible). Non-eligible items charge normally. Zero internal backend code names or marketing slogans.
2. Server monetary authority: integration with `/api/invoices/preview`, exact cent arithmetic, proper handling of `free_by_rule`.
3. Payment confirmation in `ConfirmDialog.tsx`: Cash (exact change calculation `tendered - total`, Monto exacto preset, underpayment alert), Card, Transfer.
4. Decoupling of payment and printing: cancelled print or network issue never duplicates payment.
5. Run verification commands:
   - `npm run typecheck`
   - `npx vitest run src/features/cobrar/`
   - `npm run test:clinical`

Provide verdict (APPROVE or REQUEST_CHANGES) in `c:\Projects\S_Hospital_AI\.agents\teamwork\reviewer_m2_2\handoff.md`.

## 2026-09-28T09:25:23Z
You are Reviewer M2-2 (Monetary Logic & Payment Reviewer) for the Hospital General San Isidro Cashier System.
Your working directory is: c:\Projects\S_Hospital_AI\.agents\teamwork\reviewer_m2_2.
Your dispatch assignment is detailed in: c:\Projects\S_Hospital_AI\.agents\teamwork\reviewer_m2_2\DISPATCH.md.
MANDATORY: Read c:\Projects\S_Hospital_AI\.agents\teamwork\ORIGINAL_REQUEST.md, c:\Projects\S_Hospital_AI\hospital-ai\MANDATO_PRODUCTO_COMPLETO_AZUL_BLANCO.md (§4), and c:\Projects\S_Hospital_AI\PROJECT.md.
Worker handoff: c:\Projects\S_Hospital_AI\.agents\teamwork\worker_m2_r1\handoff.md.

Examine:
- Strict per-line EPO dialysis rule UI («Sin cobro por receta» badge on eligible line, L. 0.00 line total, normal charge on other items, zero backend code exposure)
- Server monetary authority (/api/invoices/preview, exact cent validation, free_by_rule handling)
- Payment confirmation in ConfirmDialog.tsx (Cash change calculation, exact tender button, underpaid alert)
- Decoupled payment confirmation and receipt printing
- Run: npm run typecheck, npx vitest run src/features/cobrar/, and npm run test:clinical

Provide verdict (APPROVE or REQUEST_CHANGES) in c:\Projects\S_Hospital_AI\.agents\teamwork\reviewer_m2_2\handoff.md and message parent.

