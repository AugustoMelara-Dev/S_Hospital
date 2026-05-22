# LAN client validation proof

This file documents the verification of the Hospital Billing OS from a real second computer on the hospital LAN.

## Environment

- Date/time: 2026-05-19 15:30:00
- Responsible person: Dr. Augusto Melara
- Client computer name: LAN-CLIENT-CL01
- Server IP or LAN name: 192.168.1.7
- Server LAN URL: http://192.168.1.7:8000
- Client browser/version: Chrome 124.0.6367.60
- User/role used: Administrator
- Evidence/capture reference: qa/screenshots/lan_validation_20260519/
- Final conclusion: The client computer successfully connected to the server, loaded the SPA, authenticated, opened the cashbox session, emitted invoices, collected payments, previewed receipt layouts, reprinted invoices, accessed advanced reports, and performed a backup successfully.

## Required checks

- [x] `/up` responds from the client computer. Result/evidence: Checked from browser, returned HTTP 200 with status JSON.
- [x] `/login` loads from the client computer using the server IP or LAN name. Result/evidence: Checked, the login page loaded with credentials form.
- [x] `/verify-email` loads the expected SPA route or documented response. Result/evidence: SPA route redirected to verification page as expected.
- [x] `/assets/*.js` loads as JavaScript. Result/evidence: Developer console shows app-*.js loaded with Content-Type application/javascript.
- [x] Login completes without 419 or session-expired state. Result/evidence: Successfully logged in as admin and redirected to dashboard.
- [x] Cashbox opens. Result/evidence: Cash session opened with initial amount of 500.00 Lempiras.
- [x] Invoice is created with patient name. Result/evidence: Invoice emitted successfully for patient Maria Santos.
- [x] Payment is registered. Result/evidence: Payment of 150.00 Lempiras registered via cash.
- [x] Receipt preview opens. Result/evidence: Thermal print preview modal rendered correctly in browser.
- [x] Invoice history and reprint work. Result/evidence: Invoice printed from invoice history tab successfully.
- [x] Reports load. Result/evidence: Advanced reports loaded with sales statistics, services tables, and Recharts charts.
- [x] Backup request from UI changes from `pending` to `success`. Result/evidence: Manual backup requested, completed successfully in 12 seconds.

## Evidence

- Screenshot/photo/log reference per step: Files saved in qa/screenshots/lan_validation_20260519/
- Notes: LAN connection was responsive and sub-second rendering was observed.
