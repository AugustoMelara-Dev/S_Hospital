# BRIEFING — 2026-09-28T09:25:00Z

## Mission
Refactor CobrarView and related cobrar components to implement Proposal A depurada continuous vertical ledger workspace with clean state, keyboard navigation, strict per-line EPO badge, and server monetary authority.

## 🔒 My Identity
- Archetype: teamwork_preview_worker
- Roles: implementer, qa, specialist
- Working directory: c:\Projects\S_Hospital_AI\.agents\teamwork\worker_m2_r1
- Original parent: afa577c2-4f95-4c65-bb23-5b3900e061e4
- Milestone: M2 (Cashier Station / Continuous Ledger Cobrar R2)

## 🔒 Key Constraints
- Single required patient field: Nombre del paciente only. Clean state on new operation (no inherited patient or EPO condition).
- Eradicate 65/35 split, adopt Proposal A depurada continuous vertical ledger workspace.
- Broad search with keyboard navigation: Enter selects and adds item without triggering payment.
- Continuous ledger table: description, accessible touch stepper for quantity, catalog price, rule adjustment, line total with tabular numbers (L. 15.00 format).
- Strict EPO rule: clear institutional badge "Sin cobro por receta" on eligible line only. Non-eligible items charge normally. No internal codes or marketing slogans.
- Server-validated totals via /api/invoices/preview. Idempotent payment flow. Strict separation of payment confirmation and receipt printing.
- File ownership: frontend/src/features/cobrar/CobrarView.tsx, components/, state/, cobrarSchema.ts, cobrar/**/*.test.tsx.
- Verification: npm run typecheck, node scripts/check-no-legacy-ui.mjs --mode=strict, npx vitest run src/features/cobrar/ must pass with 0 errors.

## Current Parent
- Conversation ID: afa577c2-4f95-4c65-bb23-5b3900e061e4
- Updated: 2026-09-28T09:25:00Z

## Task Summary
- **What to build**: Continuous vertical ledger Cobrar station adhering to Proposal A depurada, single required patient name, real-time preview, accessible quantity steppers, strict EPO badge per line, decoupled payment and printing.
- **Success criteria**: All typecheck, strict legacy UI check, vitest unit tests pass with 0 errors.
- **Interface contracts**: PROJECT.md Interface Contracts
- **Code layout**: PROJECT.md Code Layout

## Key Decisions Made
- Implemented Proposal A depurada continuous vertical sequence inside Cuenta: Paciente -> Búsqueda / Inserción rápida -> Líneas contables (Ledger) -> Resumen monetario -> Cobro.
- Eradicated 65/35 side-by-side grid split; accounting ledger utilizes full horizontal width.
- Implemented arrow key navigation (`ArrowDown` / `ArrowUp`) in catalog search, with Enter adding highlighted item (qty 1) while retaining focus in search input.
- Added real-catalog frequent items chips (`services.slice(0, 5)`) when search is empty.
- Added full accounting columns to AccountZone (`Concepto`, `Cantidad`, `Precio unitario`, `Ajuste`, `Importe`, `Quitar`).
- Implemented exact cash change calculation (`tenderedCents - totalCents`) and `Monto exacto` preset button in ConfirmDialog.
- Maintained clean start on new operation: zero lines, empty patient name, unconfirmed dialysis condition.

## Artifact Index
- c:\Projects\S_Hospital_AI\.agents\teamwork\worker_m2_r1\DISPATCH.md
- c:\Projects\S_Hospital_AI\.agents\teamwork\worker_m2_r1\better-ui-SKILL.md
- c:\Projects\S_Hospital_AI\.agents\teamwork\worker_m2_r1\emil-design-eng-SKILL.md
- c:\Projects\S_Hospital_AI\.agents\teamwork\worker_m2_r1\changes.md
- c:\Projects\S_Hospital_AI\.agents\teamwork\worker_m2_r1\handoff.md

## Change Tracker
- **Files modified**:
  - `frontend/src/features/cobrar/CobrarView.tsx`: Continuous vertical ledger structure and clean operation reset.
  - `frontend/src/features/cobrar/components/CatalogZone.tsx`: Arrow key navigation, enter-to-add, frequent items.
  - `frontend/src/features/cobrar/components/AccountZone.tsx`: Full-width continuous accounting table with dedicated columns.
  - `frontend/src/features/cobrar/components/ConfirmDialog.tsx`: Cash change calculation and exact tender action.
  - `frontend/src/features/cobrar/CobrarView.test.tsx`: Tests for clean initial state and search Enter behavior.
  - `frontend/src/features/cobrar/components/CatalogZone.test.tsx`: Tests for arrow navigation and frequent items.
  - `frontend/src/features/cobrar/components/AccountZone.test.tsx`: Test for dedicated ledger columns.
  - `frontend/src/features/cobrar/components/ConfirmDialog.test.tsx`: Tests for cash change calculation and exact tender.
- **Build status**: PASS (`tsc --noEmit`, `check-no-legacy-ui.mjs`, `vitest run src/features/cobrar/`, `test:clinical`).
- **Pending issues**: None.

## Quality Status
- **Build/test result**: All 9 test files (62 tests) in `src/features/cobrar/` pass. All 177 tests in `test:clinical` pass.
- **Lint status**: 0 violations across 396 files in strict legacy UI check.
- **Tests added/modified**: 8 new/enhanced test cases across CobrarView, CatalogZone, AccountZone, and ConfirmDialog.

## Loaded Skills
- **Source**: c:\Projects\S_Hospital_AI\.agents\skills\better-ui\SKILL.md
- **Local copy**: c:\Projects\S_Hospital_AI\.agents\teamwork\worker_m2_r1\better-ui-SKILL.md
- **Core methodology**: Concentric border radius, optical alignment, surface depth, scale on press (0.96), tabular numbers, accessible hit areas.
- **Source**: c:\Projects\S_Hospital_AI\.agents\skills\emil-design-eng\SKILL.md
- **Local copy**: c:\Projects\S_Hospital_AI\.agents\teamwork\worker_m2_r1\emil-design-eng-SKILL.md
- **Core methodology**: Animation restraint (no animation on keyboard/high-frequency loops), purposeful micro-interactions, tactile active feedback, clean transitions.
