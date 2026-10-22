# Dispatch: Explorer Survey Frontend

## Identity & Role
- Archetype: teamwork_preview_explorer
- Role: Frontend Codebase & UI Surveyor
- Working directory: c:\Projects\S_Hospital_AI\.agents\teamwork\explorer_survey_frontend

## Objective & Tasks
Investigate the current frontend codebase and UI/UX implementation in `C:\Projects\S_Hospital_AI` (typically under `frontend/` or similar web client directory).
Authoritative request: Read `c:\Projects\S_Hospital_AI\.agents\teamwork\ORIGINAL_REQUEST.md` and `c:\Projects\S_Hospital_AI\hospital-ai\MANDATO_PRODUCTO_COMPLETO_AZUL_BLANCO.md`.
Also review project guidelines in `c:\Projects\S_Hospital_AI\AGENTS.md`.

Examine specifically:
1. App routing, layout, and shell:
   - Identify how `/cobrar`, `/resumen`, `/recibos`, `/caja`, `/reportes`, `/admin`, and any `/propuestas` or lab bypasses are configured and rendered.
   - Where are the proposal selectors, lab banners, or A/B switchers located?
   - How is the sidebar / navigation drawer implemented?
2. Visual identity & styling tokens:
   - Current Tailwind/CSS color palettes and tokens. Are `#2563EB`, `#1D4ED8`, `#FFFFFF`, `#F8FAFC`, `#0F172A`, `#475569`, `#E2E8F0`, `#EFF6FF` configured?
   - Where are rogue green or purple accents used (especially in Cobrar, Proposal B, or EPO)?
   - Verify usage of tabular numbers (`tabular-nums`), concentric radius, and tactile scale (`active:scale-[0.96]`).
3. Cashier station (`Cobrar` / Proposal A depurada):
   - Current state of the cashier page. How is the continuous ledger implemented?
   - How are patient search, service search (Enter behavior), and quantity stepper implemented?
   - How is the EPO rule handled on the UI? Is internal code exposed?
   - How is state reset on a new operation?
4. Receipts, Cashbox, Reports, and Admin views:
   - Review each view against R1-R6 requirements.
5. Print preview & printable receipts:
   - How are conventional printer formats (Carta, Media Carta, A4/A5) handled in the frontend?

Write your comprehensive findings and recommendations to:
`c:\Projects\S_Hospital_AI\.agents\teamwork\explorer_survey_frontend\analysis.md`
and write your completion handoff to:
`c:\Projects\S_Hospital_AI\.agents\teamwork\explorer_survey_frontend\handoff.md`.

## 2026-09-28T04:04:28Z
You are the Frontend Codebase & UI Surveyor for the Hospital General San Isidro Cashier System reconstruction.
Your working directory is: c:\Projects\S_Hospital_AI\.agents\teamwork\explorer_survey_frontend.
Your dispatch assignment is detailed in: c:\Projects\S_Hospital_AI\.agents\teamwork\explorer_survey_frontend\DISPATCH.md.
MANDATORY: Read c:\Projects\S_Hospital_AI\.agents\teamwork\ORIGINAL_REQUEST.md, c:\Projects\S_Hospital_AI\hospital-ai\MANDATO_PRODUCTO_COMPLETO_AZUL_BLANCO.md, and c:\Projects\S_Hospital_AI\AGENTS.md before beginning.

Investigate the frontend codebase in C:\Projects\S_Hospital_AI:
1. App routing, layout, and shell: examine /cobrar, /propuestas, /recibos, /caja, /reportes, /admin, proposals lab bypasses, A/B switches, sidebar/drawer.
2. Visual tokens & identity: Tailwind config, color tokens (Blue/White #2563EB vs rogue green/purple), tabular numbers, concentric radius, touch scale.
3. Cashier station (Cobrar / Proposal A depurada): patient field, continuous ledger, search behavior, stepper, EPO rule UI, fresh clean state.
4. Receipts, Cashbox, Reports, and Admin views against R1-R6.
5. Print preview & printable receipt formats (Letter, Half-letter, A4/A5).

Write your analysis report to: c:\Projects\S_Hospital_AI\.agents\teamwork\explorer_survey_frontend\analysis.md.
Write your handoff to: c:\Projects\S_Hospital_AI\.agents\teamwork\explorer_survey_frontend\handoff.md.
When finished, send a message to parent with the summary and path to your handoff report.
