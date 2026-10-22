# Dispatch Assignment — Challenger M3-2 (Receipts Actions & Invariants Adversarial Verifier)

## Mission
Adversarially challenge audited reprint, void, reversal, and balance payment in `frontend/src/features/invoices/history/`.

## Working Directory
`c:\Projects\S_Hospital_AI\.agents\teamwork\challenger_m3_2`

## Required Reading
- `c:\Projects\S_Hospital_AI\.agents\teamwork\ORIGINAL_REQUEST.md`
- `c:\Projects\S_Hospital_AI\hospital-ai\MANDATO_PRODUCTO_COMPLETO_AZUL_BLANCO.md` (§5)
- `c:\Projects\S_Hospital_AI\PROJECT.md`
- `c:\Projects\S_Hospital_AI\.agents\teamwork\worker_m3\handoff.md`

## Verification Scope
1. Adversarial reason validation:
   - Reason of 4 characters (`"ABCD"`): confirm button MUST be disabled for Void, Reverse, and Reprint.
   - Reason of 5 characters (`"ABCDE"`): confirm button MUST be enabled.
   - Whitespace-only or trimmed reason checking.
   - Reason of 501 characters: confirm button MUST be disabled.
2. Invariant verification:
   - Void cannot be triggered on paid invoices.
   - Reverse cannot be triggered on unpaid invoices.
   - Payment collection cannot be triggered on fully paid invoices (`balance_due === 0`).
3. Run: `npx vitest run src/features/invoices/history/`, `npx vitest run src/features/recibos/`, and `npx playwright test e2e/recibos-flow.spec.ts --project=chromium`.

Provide binary verdict (APPROVE or REQUEST_CHANGES) in `handoff.md` and message parent.

## 2026-09-28T10:07:52Z
You are Challenger M3-2 (Receipts Actions & Invariants Adversarial Verifier) for the Hospital General San Isidro Cashier System.
Your working directory is: c:\Projects\S_Hospital_AI\.agents\teamwork\challenger_m3_2.
Your dispatch assignment is detailed in: c:\Projects\S_Hospital_AI\.agents\teamwork\challenger_m3_2\DISPATCH.md.
MANDATORY: Read c:\Projects\S_Hospital_AI\.agents\teamwork\ORIGINAL_REQUEST.md, c:\Projects\S_Hospital_AI\hospital-ai\MANDATO_PRODUCTO_COMPLETO_AZUL_BLANCO.md (§5), and c:\Projects\S_Hospital_AI\PROJECT.md.
Worker handoff: c:\Projects\S_Hospital_AI\.agents\teamwork\worker_m3\handoff.md.

Adversarially challenge:
- Reason validation: 4 chars (disabled), 5 chars (enabled), whitespace-only (disabled), 501 chars (disabled) for Void, Reverse, and Reprint
- Invariants: Void blocked on paid invoices, Reverse blocked on unpaid invoices, Payment collection blocked on zero balance
- Run: npx vitest run src/features/invoices/history/, npx vitest run src/features/recibos/, and npx playwright test e2e/recibos-flow.spec.ts --project=chromium

Provide verdict (APPROVE or REQUEST_CHANGES) in c:\Projects\S_Hospital_AI\.agents\teamwork\challenger_m3_2\handoff.md and message parent.
