---
name: s-hospital-print-receipts
description: Use this skill when implementing printed receipts, invoice print views, fiscal numbering, hospital receipt templates, page CSS, and non-thermal printing for S_Hospital.
---

# S_Hospital Print Receipts Skill

Goal:
Implement institutional printed receipts similar to the manual Hospital San Isidro receipt/talonario, not thermal tickets.

Rules:
- Do not print QR codes unless explicitly required by authorized fiscal rules.
- Do not print internal catalog scanner/barcode/QR codes on the patient receipt.
- Do not assume 80mm thermal printer.
- Create a print-specific route/view and @media print CSS.
- Support one receipt per print job.
- Support Original/Copia labels if needed.
- Include hospital header, government/secretariat text if configured, receipt number, series, date/time, patient name, concept/services, amount numeric, amount in words if possible, cashier, payment method, signature/sello area.
- Fiscal fields must come from settings/database, not hardcoded fake values.
- If legal/fiscal values are missing, show admin setup warning before printing.
- Preserve historical receipts: later settings changes must not mutate old printed receipts.

Required audit output:
1. Print template files created/changed.
2. Fields used and their source.
3. Test print screenshots/PDF if possible.
4. Confirmation QR/catalog codes are absent from receipt.
