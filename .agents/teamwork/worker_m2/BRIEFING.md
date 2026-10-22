# BRIEFING — 2026-09-28T05:14:29Z

## Mission
Reconstruct and integrate the Cashier Station (Cobrar) following the continuous vertical ledger workspace of Proposal A depurada, ensuring clean state, single required patient name, accessible search & keyboard navigation, strict per-line EPO rule display, and server-validated monetary authority.

## 🔒 My Identity
- Archetype: teamwork_preview_worker
- Roles: implementer, qa, specialist (Cashier Station Specialist)
- Working directory: c:\Projects\S_Hospital_AI\.agents\teamwork\worker_m2
- Original parent: afa577c2-4f95-4c65-bb23-5b3900e061e4
- Milestone: M2 (Cashier Station / Continuous Ledger R2)

## 🔒 Key Constraints
- Eradicate the rigid 65/35 side-by-side catalog split; implement continuous vertical ledger: Paciente -> Búsqueda/Inserción rápida -> Líneas Ledger -> Resumen Monetario -> Cobro.
- Patient zone: only "Nombre del paciente" required. Clean start on new operation (no inherited patient or EPO condition).
- Search: Enter selects and adds item without triggering payment. Broad search by name and internal code.
- Continuous ledger table: description, accessible touch stepper for quantity, catalog price, rule adjustment, line total with tabular numbers ("L. 15.00").
- Strict EPO rule: clear institutional badge "Sin cobro por receta" on eligible line only. No internal backend codes or marketing slogans. Non-eligible items charge normally.
- Server-validated totals via /api/invoices/preview. Idempotent payment flow. Strict separation of payment confirmation and receipt printing.
- Exclusive file ownership: CobrarView.tsx, components/, state/, cobrarSchema.ts, and cobrar tests.
- Integrity mandate: genuine implementation, zero cheating/hardcoding/facades.
- Design skills: better-ui (concentric radius, optical alignment, scale-on-press) and emil-design-eng.

## Current Parent
- Conversation ID: afa577c2-4f95-4c65-bb23-5b3900e061e4
- Updated: not yet

## Task Summary
- **What to build**: Continuous vertical ledger workspace in CobrarView.tsx and components, clean patient/dialysis state, search with Enter adding item without paying, quantity steppers with aria-labels, per-line institutional EPO badge, server preview validation, decoupled payment and printing.
- **Success criteria**: All tests in `src/features/cobrar/` pass, `npm run typecheck` passes, `node scripts/check-no-legacy-ui.mjs --mode=strict` passes, `npm run test:clinical` passes.
- **Interface contracts**: PROJECT.md § Interface Contracts (`POST /api/invoices/preview`, `POST /api/invoices`).
- **Code layout**: `frontend/src/features/cobrar/`.

## Key Decisions Made
- [Initial]: Loaded better-ui and emil-design-eng skills; created local copies in workspace.

## Artifact Index
- `.agents/teamwork/worker_m2/DISPATCH.md` — Assignment and prompt record
- `.agents/teamwork/worker_m2/BRIEFING.md` — Agent working memory
- `.agents/teamwork/worker_m2/skills/better-ui.md` — Local copy of better-ui skill
- `.agents/teamwork/worker_m2/skills/emil-design-eng.md` — Local copy of emil-design-eng skill
- `.agents/teamwork/worker_m2/changes.md` — Changes report (to be written)
- `.agents/teamwork/worker_m2/handoff.md` — Handoff report (to be written)

## Change Tracker
- **Files modified**: None yet
- **Build status**: Pending initial run
- **Pending issues**: None

## Quality Status
- **Build/test result**: Pending
- **Lint status**: Pending
- **Tests added/modified**: Pending

## Loaded Skills
- **Source**: `c:\Projects\S_Hospital_AI\.agents\skills\better-ui\SKILL.md`
  - **Local copy**: `.agents/teamwork/worker_m2/skills/better-ui.md`
  - **Core methodology**: Concentric radii, optical alignment, shadows vs borders, scale(0.96) on press, tabular-nums.
- **Source**: `c:\Projects\S_Hospital_AI\.agents\skills\emil-design-eng\SKILL.md`
  - **Local copy**: `.agents/teamwork/worker_m2/skills/emil-design-eng.md`
  - **Core methodology**: Fast animations <250ms, never animate keyboard actions, scale(0.97) feedback, transform-origin awareness.
