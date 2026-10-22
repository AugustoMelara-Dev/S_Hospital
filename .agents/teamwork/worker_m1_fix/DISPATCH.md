# Dispatch: Worker M1-Fix (Remediation Iteration 2)

## Identity & Role
- Archetype: teamwork_preview_worker
- Role: Frontend UI & Test Remediation Specialist
- Working directory: c:\Projects\S_Hospital_AI\.agents\teamwork\worker_m1_fix
- Skills to load and apply:
  - `c:\Projects\S_Hospital_AI\.agents\skills\better-ui\SKILL.md`
  - `c:\Projects\S_Hospital_AI\.agents\skills\emil-design-eng\SKILL.md`

## Mandatory Documents
MANDATORY: Read before modifying code:
- `c:\Projects\S_Hospital_AI\.agents\teamwork\ORIGINAL_REQUEST.md`
- `c:\Projects\S_Hospital_AI\hospital-ai\MANDATO_PRODUCTO_COMPLETO_AZUL_BLANCO.md`
- `c:\Projects\S_Hospital_AI\AGENTS.md`
- `c:\Projects\S_Hospital_AI\PROJECT.md`
- Gate Feedback from Reviewer 1, Challenger 1, and Challenger 2:
  - `c:\Projects\S_Hospital_AI\.agents\teamwork\reviewer_m1_1\handoff.md`
  - `c:\Projects\S_Hospital_AI\.agents\teamwork\challenger_m1_1\handoff.md`
  - `c:\Projects\S_Hospital_AI\.agents\teamwork\challenger_m1_2\handoff.md`

## MANDATORY INTEGRITY WARNING
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Remediation Tasks

### Task 1: Eliminate Dangling Undefined CSS Tokens
1. In `frontend/src/features/cobrar/components/ResultZone.tsx` (line 70):
   Replace `bg-[var(--ui-free-subtle)] text-[color:var(--ui-free)]` with neutral slate styling:
   `bg-[var(--ui-surface-alt)] text-[color:var(--ui-ink-soft)]` (matching `FreeMedicationBadge` and neutral slate status).
2. In `frontend/src/features/recibos/RecibosDetailPanel.tsx` (line 426):
   Replace `text-[color:var(--ui-free)]` with canonical blue `text-[color:var(--ui-action)]` or neutral `text-[color:var(--ui-ink)]`.
3. In `frontend/src/features/invoices/components/InvoiceConfirmation.tsx` (line 127):
   Replace `text-[color:var(--ui-free)]` with `text-[color:var(--ui-ink-soft)]`.
4. In `frontend/src/styles.css` (line 474):
   Replace `--chart-3: var(--ui-free);` with a valid token or color (e.g. `--chart-3: #6366F1;` or `var(--ui-action)`).
5. In `frontend/src/features/resumen/ResumenView.tsx` (lines 461, 466, 471) or `tokens.css`:
   Define `--ui-text-2xs: 0.6875rem;` in `frontend/src/design-system/admin/tokens.css` (with `line-height: 0.875rem;`), or switch to `--ui-text-xs`.

### Task 2: Synchronize Non-Clinical Test Assertions to "L. " Format
Update test assertions that expect `'L '` without period to match the new canonical `'L. '` standard:
1. `frontend/src/features/cobrar/components/AccountZone.test.tsx`
2. `frontend/src/features/cobrar/components/CatalogZone.test.tsx`
3. `frontend/src/features/cobrar/components/ConfirmDialog.test.tsx`
4. `frontend/src/features/cobrar/components/ResultZone.test.tsx`
5. `frontend/src/features/cobrar/components/SummaryActionZone.test.tsx`
6. `frontend/src/design-system/admin/components.test.tsx`
7. `frontend/src/design-system/admin/AdminTable.mobile.test.tsx`
8. `frontend/src/features/recibos/RecibosDetailPanel.test.tsx`

### Task 3: Fix Root Legacy Check Script
In `scripts/check-no-legacy-ui.mjs`:
Remove or update line 22 referencing `frontend/src/design-system/providers/DesignSystemProvider.tsx` if that file was deleted or moved.

### Task 4: Verification
Execute and verify:
```powershell
cd c:\Projects\S_Hospital_AI\frontend
npm run typecheck
node scripts/check-no-legacy-ui.mjs --mode=strict
npx vitest run src/features/resumen/ src/features/cobrar/ src/design-system/admin/ src/features/recibos/
npm run test:clinical
```
All commands must pass with 0 failures and 0 errors.

Write changes to `c:\Projects\S_Hospital_AI\.agents\teamwork\worker_m1_fix\changes.md` and handoff to `c:\Projects\S_Hospital_AI\.agents\teamwork\worker_m1_fix\handoff.md`.
