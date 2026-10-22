# Dispatch: Worker M1 — Unified Visual Identity & Shell (R1)

## Identity & Role
- Archetype: teamwork_preview_worker
- Role: Frontend UI & Visual Identity Specialist
- Working directory: c:\Projects\S_Hospital_AI\.agents\teamwork\worker_m1
- Skills to load and apply:
  - `c:\Projects\S_Hospital_AI\.agents\skills\better-ui\SKILL.md`
  - `c:\Projects\S_Hospital_AI\.agents\skills\emil-design-eng\SKILL.md`

## Mandatory Documents
MANDATORY: Read before modifying code:
- `c:\Projects\S_Hospital_AI\.agents\teamwork\ORIGINAL_REQUEST.md`
- `c:\Projects\S_Hospital_AI\hospital-ai\MANDATO_PRODUCTO_COMPLETO_AZUL_BLANCO.md`
- `c:\Projects\S_Hospital_AI\AGENTS.md`
- `c:\Projects\S_Hospital_AI\PROJECT.md`
- `c:\Projects\S_Hospital_AI\.agents\teamwork\explorer_survey_frontend\analysis.md`

## MANDATORY INTEGRITY WARNING
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## File Ownership
You exclusively own:
- `frontend/src/design-system/admin/tokens.css`
- `frontend/src/design-system/admin/components.tsx`
- `frontend/src/App.tsx`
- `frontend/src/AppRoutes.tsx`
- `frontend/src/features/auth/LoginView.tsx`
- `frontend/src/features/resumen/ResumenView.tsx`
- `frontend/src/features/cobrar/components/AccountZone.tsx`
- `frontend/src/features/cobrar/components/cobrarUi.ts`
- `frontend/src/utils/currency.ts` (or wherever `formatLempirasUI` is defined)

## Scope & Implementation Tasks
1. **Tokens (`frontend/src/design-system/admin/tokens.css`)**:
   - Align canonical tokens to:
     - `--ui-action`: `#2563EB`
     - `--ui-action-hover`: `#1D4ED8`
     - `--ui-action-active`: `#1D4ED8`
     - `--ui-action-subtle`: `#EFF6FF`
     - `--ui-surface`: `#FFFFFF`
     - `--ui-paper`: `#F8FAFC`
     - `--ui-ink`: `#0F172A`
     - `--ui-ink-soft`: `#475569`
     - `--ui-line`: `#E2E8F0`
   - Remove `--ui-free: #6941c6` and all purple tokens. For gratuities / zero-charge badges, use clean slate/blue tokens or subtle neutral borders.
2. **Decommission Proposal Bypasses & Clean Shell**:
   - In `frontend/src/App.tsx`: Remove the pre-auth bypass intercepting `/propuestas/cobrar-a`, `/cobrar-a`, `/propuestas/cobrar-b`, `/cobrar-b` (lines 43-58). Normal authentication and session check must protect all application routes.
   - In `frontend/src/features/auth/LoginView.tsx`: Remove the proposal comparison box (lines 115-138) linking to proposals A and B.
   - Ensure routes in `AppRoutes.tsx` render the real operational views under the standard authenticated shell.
3. **Strict Palette Enforcement**:
   - In `frontend/src/features/resumen/ResumenView.tsx`: Replace emerald classes (`border-emerald-500/40`, `bg-emerald-500/...`, `text-emerald-700`) and purple classes with canonical blue (`#2563EB`) and neutral Slate styling.
   - In `frontend/src/features/cobrar/components/AccountZone.tsx`, `cobrarUi.ts`, and `components.tsx`: Replace any residual purple `--ui-free` references with neutral or blue tokens.
4. **Standardize Currency Format**:
   - Ensure the currency formatter formats amounts as `"L. 15.00"` (with period and space) and uses `tabular-nums`.
5. **Verification**:
   - Run in `frontend/`:
     ```powershell
     npm run typecheck
     node scripts/check-no-legacy-ui.mjs --mode=strict
     npm run test:clinical
     ```
   - All must pass cleanly with 0 errors and 0 strict violations.

Write your report to `c:\Projects\S_Hospital_AI\.agents\teamwork\worker_m1\changes.md` and handoff to `c:\Projects\S_Hospital_AI\.agents\teamwork\worker_m1\handoff.md`.

## 2026-09-28T04:24:30Z
You are Worker M1 (Frontend UI & Visual Identity Specialist) for the Hospital General San Isidro Cashier System reconstruction.
Your working directory is: c:\Projects\S_Hospital_AI\.agents\teamwork\worker_m1.
Your task assignment and file ownership are detailed in: c:\Projects\S_Hospital_AI\.agents\teamwork\worker_m1\DISPATCH.md.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

MANDATORY: Read before modifying code:
- c:\Projects\S_Hospital_AI\.agents\teamwork\ORIGINAL_REQUEST.md
- c:\Projects\S_Hospital_AI\hospital-ai\MANDATO_PRODUCTO_COMPLETO_AZUL_BLANCO.md
- c:\Projects\S_Hospital_AI\AGENTS.md
- c:\Projects\S_Hospital_AI\PROJECT.md
- c:\Projects\S_Hospital_AI\.agents\teamwork\explorer_survey_frontend\analysis.md

Load and strictly follow the design skills:
- c:\Projects\S_Hospital_AI\.agents\skills\better-ui\SKILL.md
- c:\Projects\S_Hospital_AI\.agents\skills\emil-design-eng\SKILL.md

Tasks:
1. Align canonical palette tokens in tokens.css to #2563EB, #1D4ED8, #FFFFFF, #F8FAFC, #0F172A, #475569, #E2E8F0, #EFF6FF. Remove purple --ui-free.
2. Remove pre-auth bypass in App.tsx (lines 43-58) and promotional proposal box in LoginView.tsx (lines 115-138). Protect all normal routes under the authenticated shell.
3. Clean rogue emerald/purple classes in ResumenView.tsx, AccountZone.tsx, cobrarUi.ts, and components.tsx.
4. Standardize currency formatting to "L. 15.00" with tabular numbers.
5. Verify your changes pass `npm run typecheck` and `node scripts/check-no-legacy-ui.mjs --mode=strict`.

Document changes in: c:\Projects\S_Hospital_AI\.agents\teamwork\worker_m1\changes.md.
Document your completion handoff in: c:\Projects\S_Hospital_AI\.agents\teamwork\worker_m1\handoff.md.
When finished, send a message to parent with your summary and handoff path.
