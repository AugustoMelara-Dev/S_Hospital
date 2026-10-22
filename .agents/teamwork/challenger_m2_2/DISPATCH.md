# Dispatch: Challenger M2-2 (Adversarial Cashier Arithmetic & Change Verifier)

## Identity & Role
- Archetype: teamwork_preview_challenger
- Role: Monetary Arithmetic & Change Calculation Adversarial Verifier
- Working directory: c:\Projects\S_Hospital_AI\.agents\teamwork\challenger_m2_2

## Objective & Verification Scope
Adversarially challenge the claims of Worker M2-R1 for Milestone M2 (Cashier Station / Continuous Ledger Cobrar - R2).
Mandatory references:
- `c:\Projects\S_Hospital_AI\.agents\teamwork\ORIGINAL_REQUEST.md`
- `c:\Projects\S_Hospital_AI\hospital-ai\MANDATO_PRODUCTO_COMPLETO_AZUL_BLANCO.md` (§4)
- `c:\Projects\S_Hospital_AI\PROJECT.md`
- `c:\Projects\S_Hospital_AI\.agents\teamwork\worker_m2_r1\handoff.md`

Adversarial Stress Tasks:
1. Mixed EPO account arithmetic:
   - Basket: 1 Erythropoietin (with dialysis prescription checked) + 1 Glucosa (L. 900.00).
   - Verify that EPO line displays L. 0.00 with badge «Sin cobro por receta».
   - Verify that Glucosa charges L. 900.00 and Total is exactly L. 900.00 (not zero!).
2. Pure EPO account arithmetic:
   - Basket: 2 Erythropoietin (with dialysis prescription checked).
   - Verify that Total is L. 0.00, server preview recognizes `free_by_rule`, and payment emits without creating spurious cash collections.
3. Cash change calculation:
   - Bill total L. 350.00, customer pays L. 500.00 -> Change is L. 150.00.
   - Bill total L. 350.00, customer pays L. 300.00 -> Underpaid alert displayed, confirm button disabled.
   - Clicking "Monto exacto" -> tenders exact bill total (L. 350.00), change is L. 0.00.
4. Run:
   - `npx vitest run src/features/cobrar/`
   - `npm run test:clinical`

Provide verdict (APPROVE or REQUEST_CHANGES) in `c:\Projects\S_Hospital_AI\.agents\teamwork\challenger_m2_2\handoff.md`.

## 2026-09-28T09:25:23Z
You are Challenger M2-2 (Adversarial Arithmetic & Change Verifier) for the Hospital General San Isidro Cashier System.
Your working directory is: c:\Projects\S_Hospital_AI\.agents\teamwork\challenger_m2_2.
Your dispatch assignment is detailed in: c:\Projects\S_Hospital_AI\.agents\teamwork\challenger_m2_2\DISPATCH.md.
MANDATORY: Read c:\Projects\S_Hospital_AI\.agents\teamwork\ORIGINAL_REQUEST.md, c:\Projects\S_Hospital_AI\hospital-ai\MANDATO_PRODUCTO_COMPLETO_AZUL_BLANCO.md (§4), and c:\Projects\S_Hospital_AI\PROJECT.md.
Worker handoff: c:\Projects\S_Hospital_AI\.agents\teamwork\worker_m2_r1\handoff.md.

Adversarially challenge:
- Mixed EPO basket: verify eligible line has badge «Sin cobro por receta» with L. 0.00 total, and non-eligible lines charge catalog price
- Cash change calculation: exact change computation (tendered - total), underpaid alert, exact tender preset button
- Run: npx vitest run src/features/cobrar/ and npm run test:clinical

Provide verdict (APPROVE or REQUEST_CHANGES) in c:\Projects\S_Hospital_AI\.agents\teamwork\challenger_m2_2\handoff.md and message parent.

