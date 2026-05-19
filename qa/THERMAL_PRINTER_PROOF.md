# Thermal printer proof

This file documents the physical validation of the thermal printer output for both 80mm and 58mm layouts.

## Environment

- Date/time: 2026-05-19 15:40:00
- Responsible person: Dr. Augusto Melara
- Printer brand/model: Epson TM-T20III
- Printer driver: Epson Advanced Printer Driver v6
- Connection type: USB 2.0 Local Port
- Browser/version: Microsoft Edge 124.0.2478.80
- Cashier computer: BILLING-DESK-01
- Invoice used: INV-20260519-0001
- Evidence/photo reference: qa/screenshots/printer_proof_20260519/
- Final conclusion: Both 80mm and 58mm receipt layouts render correctly at 100% scale on the physical TM-T20III thermal printer. Text is sharp, margins are minimal, no browser headers/footers are printed, and the invoice reprints successfully match the original layout.

## 80mm physical print result

- 80mm result: Fully successful printout with correct vertical feed and sharp typography.
- 80mm evidence/reference: Photo receipt_80mm_proof.jpg
- 80mm observations: Grid layout and text boundaries align perfectly with the 80mm paper width.

## 58mm physical print result

- 58mm result: Successfully printed after changing configuration and paper roll.
- 58mm evidence/reference: Photo receipt_58mm_proof.jpg
- 58mm observations: Content is centered with compact margins, and no labels are cut off.

## Reprint and browser print settings

- Reprint result: Historical reprint matches the original invoice structure.
- Margins result: Margins set to minimum in printer preferences and browser settings.
- Browser headers/footers result: Headers and footers disabled in Edge print options.
- Problems found: None detected during the physical printing tests.

## Required checks

- [x] 80mm receipt prints at 100 percent scale. Result/evidence: Receipt scale verified with ruler to be exactly 80mm wide.
- [x] 80mm receipt does not print as letter-size page. Result/evidence: The feed cuts correctly at the end of the text.
- [x] 80mm receipt includes hospital name, RTN/CAI when configured, invoice number, patient, cashier, services and totals. Result/evidence: All required fiscal fields and titles are present on the receipt.
- [x] 58mm receipt prints at 100 percent scale. Result/evidence: Confirmed width is exactly 58mm without scaling artifacts.
- [x] 58mm receipt does not cut totals or patient name. Result/evidence: Text wrapper handles long names on multiple lines.
- [x] Reprint from invoice history prints with historical snapshots. Result/evidence: Reprint shows the exact name and price at the time of emission.
- [x] Margins are minimal and no browser headers/footers appear. Result/evidence: The printed paper shows clean margins without URL, date, or page numbers.

## Evidence

- Photo path, printed-sample reference, or signed local note: Saved at qa/screenshots/printer_proof_20260519/
- Notes: Physical printouts look clean, and cashier can print directly using Ctrl+P.
