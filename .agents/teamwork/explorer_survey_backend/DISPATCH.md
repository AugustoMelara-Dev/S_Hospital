# Dispatch: Explorer Survey Backend

## Identity & Role
- Archetype: teamwork_preview_explorer
- Role: Backend Codebase & Business Logic Surveyor
- Working directory: c:\Projects\S_Hospital_AI\.agents\teamwork\explorer_survey_backend

## Objective & Tasks
Investigate the current backend codebase, business logic, and API in `C:\Projects\S_Hospital_AI` (typically under `backend/` or similar Laravel directory).
Authoritative request: Read `c:\Projects\S_Hospital_AI\.agents\teamwork\ORIGINAL_REQUEST.md` and `c:\Projects\S_Hospital_AI\hospital-ai\MANDATO_PRODUCTO_COMPLETO_AZUL_BLANCO.md`.
Also review project guidelines in `c:\Projects\S_Hospital_AI\AGENTS.md`.

Examine specifically:
1. Architecture, Routes & API Controllers:
   - Identify endpoints for Auth, Invoices (`/invoices`), Services/Catalog, Cash Register Sessions (`/cash-registers`), Movements, Reports, and Settings.
   - Check request validation (FormRequests), Policies/Gates, and DB Transactions.
2. Monetary calculations & EPO Rule:
   - Where and how are invoice totals, ISV, discounts, and line-item prices calculated?
   - How is the EPO rule (`ERYTHROPOIETIN_DIALYSIS_PRESCRIPTION`) implemented? Is it strictly per-line? Is zero authorized total distinct from empty bill?
   - How are prices snapshotted in `invoice_items`?
3. Cashbox & Arqueo logic:
   - Sessions, open/close status, initial cash float, payment methods breakdown (Efectivo, Tarjeta, Transferencia), cash count differences.
4. Receipts, Cancellation, & Reprint Auditing:
   - How is invoice cancellation/reversal handled? Is audit logging active?
   - How is invoice reprint reason tracked/audited?
5. Document Generation (PDF & Excel):
   - PDF generation engine (DomPDF / Snappy / wkhtmltopdf) for Executive Reports (R5) and Institutional Receipts (R6).
   - Check receipt dimensions: Letter (612x792 pt), Half-letter (612x396 pt), A4/A5. Are QR/barcodes excluded?
   - Excel export implementation (Maatwebsite Excel or PhpSpreadsheet) for R5: sheets (Resumen, Operaciones, Detalle, Cobros, Caja), numeric cells, formula injection prevention.

Write your comprehensive findings and recommendations to:
`c:\Projects\S_Hospital_AI\.agents\teamwork\explorer_survey_backend\analysis.md`
and write your completion handoff to:
`c:\Projects\S_Hospital_AI\.agents\teamwork\explorer_survey_backend\handoff.md`.

## 2026-09-28T04:04:28Z
You are the Backend Codebase & Business Logic Surveyor for the Hospital General San Isidro Cashier System reconstruction.
Your working directory is: c:\Projects\S_Hospital_AI\.agents\teamwork\explorer_survey_backend.
Your dispatch assignment is detailed in: c:\Projects\S_Hospital_AI\.agents\teamwork\explorer_survey_backend\DISPATCH.md.
MANDATORY: Read c:\Projects\S_Hospital_AI\.agents\teamwork\ORIGINAL_REQUEST.md, c:\Projects\S_Hospital_AI\hospital-ai\MANDATO_PRODUCTO_COMPLETO_AZUL_BLANCO.md, and c:\Projects\S_Hospital_AI\AGENTS.md before beginning.

Investigate the backend codebase in C:\Projects\S_Hospital_AI:
1. Architecture, Routes, Controllers, FormRequests, Policies, Transactions.
2. Monetary calculations, invoice creation/updates, snapshots, and EPO dialysis prescription rule (per-line evaluation, no bill-wide zeroing).
3. Cashbox & Arqueo logic (sessions, payment methods breakdown, cash count differences).
4. Receipts, cancellation & reprint auditing (mandatory reprint reason, audit logs).
5. Document generation: PDF engine (executive report R5 and institutional receipt R6: Letter, Half-letter, A4/A5 without barcodes/QRs) and Excel exports (5 sheets, real numbers, formula injection prevention).

Write your analysis report to: c:\Projects\S_Hospital_AI\.agents\teamwork\explorer_survey_backend\analysis.md.
Write your handoff to: c:\Projects\S_Hospital_AI\.agents\teamwork\explorer_survey_backend\handoff.md.
When finished, send a message to parent with the summary and path to your handoff report.

