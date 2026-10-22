# Dispatch Assignment — Challenger M2-2 Round 2 (Cash Change & Underpaid Adversarial Re-Verifier)

## Mission
Adversarially re-verify the cash underpayment enforcement and change calculation in `frontend/src/features/cobrar/components/ConfirmDialog.tsx` after worker_m2_fix changes.

## Working Directory
`c:\Projects\S_Hospital_AI\.agents\teamwork\challenger_m2_2_r2`

## Required Reading
- `c:\Projects\S_Hospital_AI\.agents\teamwork\ORIGINAL_REQUEST.md`
- `c:\Projects\S_Hospital_AI\hospital-ai\MANDATO_PRODUCTO_COMPLETO_AZUL_BLANCO.md` (§4)
- `c:\Projects\S_Hospital_AI\PROJECT.md`
- `c:\Projects\S_Hospital_AI\.agents\teamwork\challenger_m2_2\handoff.md` (previous failure report)
- `c:\Projects\S_Hospital_AI\.agents\teamwork\worker_m2_fix\handoff.md`

## Verification Scope
Empirically verify the previous failing condition:
1. Bill total L. 350.00, customer pays L. 300.00 cash: underpaid alert displayed, confirm button `cobrar-confirm` MUST be disabled.
2. Bill total L. 350.00, customer types `0.00` cash: underpaid alert displayed, confirm button `cobrar-confirm` MUST be disabled.
3. Bill total L. 350.00, customer clicks `Monto exacto`: exact cash (L. 350.00) entered, change L. 0.00, confirm button enabled.
4. Bill total L. 350.00, customer pays L. 500.00 cash: change L. 150.00 displayed, confirm button enabled.
5. Mixed EPO arithmetic and pure EPO rule handling.
6. Run: `npx vitest run src/features/cobrar/components/ConfirmDialog.test.tsx`, `npx vitest run src/features/cobrar/`, and `npm run test:clinical`.

Provide binary verdict (APPROVE or REQUEST_CHANGES) in `handoff.md` and message parent.

## 2026-09-28T09:40:29Z
You are Challenger M2-2 (Round 2) for the Hospital General San Isidro Cashier System.
Your working directory is: c:\Projects\S_Hospital_AI\.agents\teamwork\challenger_m2_2_r2.
Your dispatch assignment is detailed in: c:\Projects\S_Hospital_AI\.agents\teamwork\challenger_m2_2_r2\DISPATCH.md.
MANDATORY: Read c:\Projects\S_Hospital_AI\.agents\teamwork\ORIGINAL_REQUEST.md, c:\Projects\S_Hospital_AI\hospital-ai\MANDATO_PRODUCTO_COMPLETO_AZUL_BLANCO.md (§4), and c:\Projects\S_Hospital_AI\PROJECT.md.
Review your previous failure report: c:\Projects\S_Hospital_AI\.agents\teamwork\challenger_m2_2\handoff.md.
Worker M2-Fix handoff: c:\Projects\S_Hospital_AI\.agents\teamwork\worker_m2_fix\handoff.md.

Adversarially re-verify the previous failing condition:
- Bill total L. 350.00, customer pays L. 300.00: underpaid alert displayed, confirm button cobrar-confirm MUST be disabled.
- Bill total L. 350.00, customer types 0.00: underpaid alert displayed, confirm button cobrar-confirm MUST be disabled.
- Bill total L. 350.00, customer clicks 'Monto exacto': exact cash (L. 350.00) entered, change L. 0.00, confirm button enabled.
- Bill total L. 350.00, customer pays L. 500.00: change L. 150.00 displayed, confirm button enabled.
- Mixed EPO basket and pure EPO rule handling.
- Run: npx vitest run src/features/cobrar/components/ConfirmDialog.test.tsx, npx vitest run src/features/cobrar/, and npm run test:clinical.

Provide verdict (APPROVE or REQUEST_CHANGES) in c:\Projects\S_Hospital_AI\.agents\teamwork\challenger_m2_2_r2\handoff.md and message parent.
