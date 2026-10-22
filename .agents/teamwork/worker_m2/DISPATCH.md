# Dispatch: Worker M2 — Cashier Station / Continuous Ledger Cobrar (R2)

## Identity & Role
- Archetype: teamwork_preview_worker
- Role: Cashier Station Specialist
- Working directory: c:\Projects\S_Hospital_AI\.agents\teamwork\worker_m2
- Skills to load and apply:
  - `c:\Projects\S_Hospital_AI\.agents\skills\better-ui\SKILL.md`
  - `c:\Projects\S_Hospital_AI\.agents\skills\emil-design-eng\SKILL.md`

## Mandatory Reference Documents
MANDATORY: Read before modifying code:
- `c:\Projects\S_Hospital_AI\.agents\teamwork\ORIGINAL_REQUEST.md`
- `c:\Projects\S_Hospital_AI\hospital-ai\MANDATO_PRODUCTO_COMPLETO_AZUL_BLANCO.md` (especially §4)
- `c:\Projects\S_Hospital_AI\AGENTS.md`
- `c:\Projects\S_Hospital_AI\PROJECT.md`

## MANDATORY INTEGRITY WARNING
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## File Ownership
You exclusively own:
- `frontend/src/features/cobrar/CobrarView.tsx`
- `frontend/src/features/cobrar/components/` (all files: `PatientZone.tsx`, `AccountZone.tsx`, `CatalogZone.tsx`, `SummaryActionZone.tsx`, `ConfirmDialog.tsx`, `ResultZone.tsx`, `cobrarUi.ts`)
- `frontend/src/features/cobrar/state/` (all files: `cobrarStore.ts`, `domain.ts`, `status.ts`)
- `frontend/src/features/cobrar/cobrarSchema.ts`
- `frontend/src/features/cobrar/**/*.test.tsx`

## Scope & Implementation Tasks
1. **Ergonomic Continuous Ledger Layout**:
   - Refactor `CobrarView.tsx` so the workspace flows as a continuous vertical ledger following Proposal A depurada:
     `Paciente` -> `Búsqueda/Inserción rápida` -> `Líneas de la Cuenta (Ledger)` -> `Resumen Monetario` -> `Cobro`.
   - Remove the rigid 65%/35% side-by-side catalog split. The search bar and frequent items must sit directly at the top of the ledger or as an inline insertion mechanism, allowing the account ledger to use the full workspace.
2. **Single Required Patient Field & Clean State**:
   - Only `Nombre del paciente` is required. No document number, phone, address, or medical history fields.
   - When a new operation starts or is reset, all state must start completely fresh and empty: empty patient name, zero items, and unconfirmed dialysis condition (`patient_dialysis_prescription: false`). Never inherit state from previous transactions.
3. **Search & Accessible Keyboard/Mouse Navigation**:
   - Broad search across catalog items by name and internal code.
   - Arrow keys / mouse selection.
   - Pressing `Enter` on an active search result immediately adds the item with quantity 1 to the ledger, and keeps focus ready for the next action. `Enter` in search MUST NEVER submit or trigger the payment.
   - Optional frequent items supported strictly from the real catalog.
4. **Continuous Accounting Table & Quantity Stepper**:
   - Table columns: Concept description (full text visible, no truncation), Quantity with accessible stepper (`-` and `+` buttons with `aria-label`, numeric input), Catalog Unit Price, Special Rule Adjustment, Line Total.
   - All amounts aligned and formatted with `tabular-nums` and `"L. 15.00"` standard.
5. **Strict EPO Dialysis Prescription Rule (UI)**:
   - Clear institutional language: checkbox explained once with clear label («Receta de diálisis confirmada» or similar institutional phrasing).
   - On the eligible medication line: display clear institutional badge «Sin cobro por receta» and show the line total as L. 0.00 with the original catalog price noted.
   - Non-eligible items in the same account (e.g. Glucose, Lab tests) MUST maintain their standard catalog price and charge.
   - NEVER expose backend code names (`ERYTHROPOIETIN_DIALYSIS_PRESCRIPTION`), marketing slogans («100% ahorro», «Regla activa»), or false tax exemption claims.
6. **Server Monetary Authority & Confirmation**:
   - Real-time pre-validation via `/api/invoices/preview` to calculate exact totals and discounts on the server.
   - Distinguish empty account vs pending calculation vs zero total authorized by rule (`free_by_rule`) vs billable total.
   - Payment confirmation modal supports Cash (with exact change calculation), Card, and Transfer.
   - Strict separation of confirmed payment and receipt printing. A network issue or cancelled print preview must never duplicate payment.
7. **Verification**:
   - Run in `frontend/`:
     ```powershell
     npm run typecheck
     node scripts/check-no-legacy-ui.mjs --mode=strict
     npx vitest run src/features/cobrar/
     npm run test:clinical
     ```
   - All must pass cleanly with 0 errors.

Write your report to `c:\Projects\S_Hospital_AI\.agents\teamwork\worker_m2\changes.md` and handoff to `c:\Projects\S_Hospital_AI\.agents\teamwork\worker_m2\handoff.md`.
## 2026-09-28T05:14:29Z
User Request received for Worker M2:
You are Worker M2 (Cashier Station Specialist) for the Hospital General San Isidro Cashier System reconstruction.
Your working directory is: c:\Projects\S_Hospital_AI\.agents\teamwork\worker_m2.
Tasks:
1. Refactor CobrarView.tsx and components to follow the continuous vertical ledger workspace of Proposal A depurada (eradicating the rigid 65/35 side-by-side catalog split).
2. Patient zone: only Patient Name required. Clean state on new operation (no inherited patient or EPO condition).
3. Search & keyboard navigation: Enter selects and adds item without triggering payment.
4. Continuous ledger table: description, accessible touch stepper for quantity, catalog price, rule adjustment, line total with tabular numbers.
5. Strict EPO rule: clear institutional badge "Sin cobro por receta" on eligible line only. No internal backend codes or marketing slogans. Non-eligible items charge normally.
6. Server-validated totals via /api/invoices/preview. Idempotent payment flow. Strict separation of payment confirmation and receipt printing.
7. Verify npm run typecheck, node scripts/check-no-legacy-ui.mjs --mode=strict, and npx vitest run src/features/cobrar/ pass with 0 errors.
