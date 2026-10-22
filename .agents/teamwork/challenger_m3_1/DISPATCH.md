# Dispatch Assignment — Challenger M3-1 (Receipts Search & Pagination Adversarial Verifier)

## Mission
Adversarially challenge search, temporal filtering, and pagination in `frontend/src/features/recibos/`.

## Working Directory
`c:\Projects\S_Hospital_AI\.agents\teamwork\challenger_m3_1`

## Required Reading
- `c:\Projects\S_Hospital_AI\.agents\teamwork\ORIGINAL_REQUEST.md`
- `c:\Projects\S_Hospital_AI\hospital-ai\MANDATO_PRODUCTO_COMPLETO_AZUL_BLANCO.md` (§5)
- `c:\Projects\S_Hospital_AI\PROJECT.md`
- `c:\Projects\S_Hospital_AI\.agents\teamwork\worker_m3\handoff.md`

## Verification Scope
1. Adversarial search: non-existent patient queries, special characters in document number, empty search response handling.
2. Temporal bounds: inverted dates (`date_from > date_to`) must display accessible `role="alert"` warning and prevent invalid backend queries.
3. Pagination edge cases: page out-of-range navigation, page size limits, rapid URL query changes.
4. Run: `npx vitest run src/features/recibos/`, `npm run typecheck`, and `node scripts/check-no-legacy-ui.mjs --mode=strict`.

Provide binary verdict (APPROVE or REQUEST_CHANGES) in `handoff.md` and message parent.

## 2026-09-28T10:07:52Z
<USER_REQUEST>
You are Challenger M3-1 (Receipts Search & Pagination Adversarial Verifier) for the Hospital General San Isidro Cashier System.
Your working directory is: c:\Projects\S_Hospital_AI\.agents\teamwork\challenger_m3_1.
Your dispatch assignment is detailed in: c:\Projects\S_Hospital_AI\.agents\teamwork\challenger_m3_1\DISPATCH.md.
MANDATORY: Read c:\Projects\S_Hospital_AI\.agents\teamwork\ORIGINAL_REQUEST.md, c:\Projects\S_Hospital_AI\hospital-ai\MANDATO_PRODUCTO_COMPLETO_AZUL_BLANCO.md (§5), and c:\Projects\S_Hospital_AI\PROJECT.md.
Worker handoff: c:\Projects\S_Hospital_AI\.agents\teamwork\worker_m3\handoff.md.

Adversarially challenge:
- Search edge cases: special chars, empty results, patient vs number query heuristics
- Temporal bounds: date_from > date_to triggers accessible alert and disables invalid query
- Pagination bounds: page out-of-range navigation, URL sync
- Run: npx vitest run src/features/recibos/, npm run typecheck, and node scripts/check-no-legacy-ui.mjs --mode=strict

Provide verdict (APPROVE or REQUEST_CHANGES) in c:\Projects\S_Hospital_AI\.agents\teamwork\challenger_m3_1\handoff.md and message parent.
</USER_REQUEST>
