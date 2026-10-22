# Dispatch: Forensic Auditor M2

## Identity & Role
- Archetype: teamwork_preview_auditor
- Role: Forensic Integrity Auditor (Milestone M2)
- Working directory: c:\Projects\S_Hospital_AI\.agents\teamwork\auditor_m2_1

## Objective & Verification Scope
Perform rigorous forensic integrity audit on all changes made by Worker M2-R1 for Milestone M2 (Cashier Station / Continuous Ledger Cobrar - R2).
Mandatory references:
- `c:\Projects\S_Hospital_AI\.agents\teamwork\ORIGINAL_REQUEST.md`
- `c:\Projects\S_Hospital_AI\hospital-ai\MANDATO_PRODUCTO_COMPLETO_AZUL_BLANCO.md` (§4)
- `c:\Projects\S_Hospital_AI\PROJECT.md`
- `c:\Projects\S_Hospital_AI\.agents\teamwork\worker_m2_r1\handoff.md`
- `c:\Projects\S_Hospital_AI\.agents\teamwork\worker_m2_r1\changes.md`

Forensic Integrity Checks:
1. **Source Code Integrity**: Check git status / diffs for all modified files in `frontend/src/features/cobrar/`.
2. **No Dummy/Facade Implementations**: Verify that continuous ledger layout, arrow key navigation, accessible steppers, and cash change calculations are real, functional implementations.
3. **No Hardcoded Test Expectations**: Verify that tests execute genuine logic and were not mocked to dummy values.
4. **No Marketing or Backend Code Leakage**: Verify that backend rule codes (`ERYTHROPOIETIN_DIALYSIS_PRESCRIPTION`) or marketing slogans («100% ahorro») are NOT exposed on the UI.
5. **Quality Gate Verification**: Run `npm run typecheck`, `node scripts/check-no-legacy-ui.mjs --mode=strict`, and `npx vitest run src/features/cobrar/`.

Provide binary verdict (CLEAN or INTEGRITY VIOLATION) in `c:\Projects\S_Hospital_AI\.agents\teamwork\auditor_m2_1\handoff.md`.

## 2026-09-28T09:25:23Z
You are Forensic Auditor M2 for the Hospital General San Isidro Cashier System.
Your working directory is: c:\Projects\S_Hospital_AI\.agents\teamwork\auditor_m2_1.
Your dispatch assignment is detailed in: c:\Projects\S_Hospital_AI\.agents\teamwork\auditor_m2_1\DISPATCH.md.
MANDATORY: Read c:\Projects\S_Hospital_AI\.agents\teamwork\ORIGINAL_REQUEST.md, c:\Projects\S_Hospital_AI\hospital-ai\MANDATO_PRODUCTO_COMPLETO_AZUL_BLANCO.md (§4), and c:\Projects\S_Hospital_AI\PROJECT.md.
Worker handoff: c:\Projects\S_Hospital_AI\.agents\teamwork\worker_m2_r1\handoff.md.

Perform systematic forensic integrity audit:
- Check git diff for Worker M2-R1. Verify all changes in CobrarView and components are authentic with zero facades or test shortcuts.
- Verify zero backend code leakage (no ERYTHROPOIETIN_DIALYSIS_PRESCRIPTION or marketing slogans on UI).
- Verify clean quality gates: npm run typecheck, node scripts/check-no-legacy-ui.mjs --mode=strict, and npx vitest run src/features/cobrar/.

Provide binary verdict (CLEAN or INTEGRITY VIOLATION) in c:\Projects\S_Hospital_AI\.agents\teamwork\auditor_m2_1\handoff.md and message parent.

