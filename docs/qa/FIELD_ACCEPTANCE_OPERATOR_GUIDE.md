# S_Hospital V1.1 - Field Acceptance Operator Guide

This guide is for the technical operator at the hospital. Use only synthetic data. Do not use real patient data, real fiscal numbers not already configured, production secrets or a production restore target.

Verified software SHA for this package:

`bfa115f15f613a69e81e54a462a5c0e7c9e40f69`

Physical production approval is NO until all required gates pass with evidence.

## Before starting

1. Confirm the server PC is the intended S_Hospital server.
2. Confirm the app version/SHA being tested.
3. Confirm the database is the test/acceptance database or that test accounts and synthetic data are approved for the acceptance run.
4. Confirm the Windows network profile is private/trusted for the hospital LAN.
5. Confirm the browser is Edge or Chrome and is updated enough for normal printing.
6. Confirm no screenshots or photos expose real patient data, credentials, tokens or `.env` content.
7. Open `docs/qa/FIELD_ACCEPTANCE_EXECUTION_LOG.md` and fill each gate as it is executed.
8. Use `docs/qa/FIELD_ACCEPTANCE_SITE_RUN_SHEET.md` as the printable field checklist if the operator wants a one-page-per-gate worksheet.

## Gate A - Second PC LAN

Goal: prove a second workstation can use S_Hospital through the local network without internet dependency.

Steps:

1. Turn on the server PC.
2. Start the S_Hospital stack using the approved local deployment method.
3. On the server PC, identify the LAN IP address, for example `192.168.1.10`.
4. Confirm the intended port and URL, for example `http://192.168.1.10`.
5. If access fails, check only the intended Windows Firewall private-network inbound rule and record any change.
6. On the second PC, open Edge or Chrome.
7. Browse to the LAN URL.
8. Log in with a synthetic test user.
9. Open dashboard.
10. Open new invoice.
11. Open cashbox.
12. Open invoice history.
13. Open reports if the user has permission.
14. Open settings only with a user that has permission.
15. Log in with a restricted user and confirm restricted modules show access denied or are hidden according to role.
16. Log out.
17. Record errors, page load problems, 4xx/5xx responses, blank screens and approximate load times.

Pass criteria:

- Second PC reaches the app by LAN URL.
- Login works without internet.
- Authorized modules open.
- Restricted modules stay blocked.
- Logout works.
- No unexpected 500 errors or blank screens.

## Gate B - PC1/PC2 synchronization

Goal: prove two clients see consistent operational state.

PC1:

1. Log in as a cashier test user.
2. Open cashbox.
3. Create a synthetic invoice with patient name `Paciente Validacion Campo`.
4. Add at least one normal service.
5. If testing erythropoietin, use the synthetic dialysis prescription scenario only.
6. Collect payment.
7. Open the receipt preview/PDF.

PC2:

1. Log in with a second test user.
2. Verify dashboard reflects the new transaction.
3. Verify invoice history shows the invoice.
4. Verify cashbox state and movement are consistent with permissions.
5. Verify reports include the transaction after refresh.
6. Verify receipt/reprint access according to permissions.

Concurrency checks:

1. Try two quick payment submissions for the same invoice only if the test environment is approved for this.
2. Try two simultaneous attempts to open cashbox for the same role/user scenario if applicable.
3. Refresh one PC during a safe read-only view.
4. Briefly disconnect and reconnect one client from LAN, then verify the app recovers.

Pass criteria:

- No duplicate invoices, payments, movements or receipt numbers.
- No unexpected 500 errors.
- No white screen.
- Permissions remain correct on both PCs.

## Gate C - Physical printing

Goal: prove institutional receipts print cleanly on real hardware.

Formats to test:

- Letter.
- Half-letter.
- A5.
- 80mm only if compatible hardware exists.
- 58mm only if compatible hardware exists.

Scenarios:

1. One item.
2. Several items.
3. Long service description.
4. Long patient name.
5. Reprinted receipt.
6. Voided receipt if the test environment allows voiding.
7. Large total.
8. Multipage document.

Driver/browser setup:

1. Select the real printer.
2. Select the matching paper size in the driver.
3. Use 100% or actual size.
4. Disable browser headers/footers when available.
5. Do not use automatic scale-to-fit unless the operator records it as a workaround.

Review checklist:

- Margins are acceptable.
- Orientation is correct.
- Text is sharp.
- Header is visible.
- Item table is readable.
- Totals stay together.
- Page breaks do not cut important content.
- Receipt is legible in grayscale.
- No unauthorized QR code.
- No unauthorized barcode.
- No internal IDs, logs or technical codes are visible.
- No fake digital seal/signature appears unless explicitly configured and authorized.

Pass criteria:

- Each approved format prints physically, cleanly and without manual trimming as normal workflow.
- Unsupported 80mm/58mm hardware is recorded as hardware not available, not as software failure.

## Gate D - Backup/restore disposable

Goal: prove a backup can be restored. Never restore over production.

Steps:

1. Create a disposable database or disposable Docker stack.
2. Seed or create synthetic data: users, services, cash session, invoice, payment and receipt.
3. Generate a backup using the approved S_Hospital backup flow.
4. Record backup filename, size and checksum if available.
5. Destroy only the disposable source database.
6. Create a second disposable empty database.
7. Restore the backup into the second disposable database.
8. Run migrations or documented post-restore checks if required.
9. Compare counts before and after restore:
   - users
   - roles
   - services
   - invoices
   - invoice_items
   - payments
   - cash_register_sessions
   - cash_movements
   - settings
   - audit_logs
10. Start the app against the restored disposable database.
11. Verify login.
12. Verify invoice history.
13. Verify receipt/PDF access.
14. Verify reports and users/roles.
15. Destroy the disposable restore environment.

Pass criteria:

- Backup file exists and is non-empty.
- Restore completes into a disposable target.
- Critical counts and relationships are consistent.
- Login and critical reads work after restore.

## Gate E - LAN load/concurrency

Goal: prove realistic multi-client use does not corrupt data or degrade usability.

Minimum field scenario:

1. Use at least two client PCs if available.
2. Use synthetic cashier/admin users.
3. Run for an agreed duration, for example 15 to 30 minutes.
4. Perform repeated safe workflows:
   - create invoice
   - collect payment
   - reprint receipt
   - open reports
   - open cashbox
   - search history
5. Include overlapping actions from different clients.
6. Record timeouts, 500s, duplicates, deadlocks, white screens and approximate latency.

Pass criteria:

- No duplicate payments or receipt numbers.
- No database corruption.
- No unexplained 500 errors.
- System remains usable after the run.

## Evidence rules

- Use screenshots only with synthetic data.
- Photographs of printouts must hide credentials and real patient data.
- Do not capture `.env`, tokens, database passwords or admin passwords.
- Record exact server PC, client PC, printer model, browser and date.
- If a gate cannot run, mark PENDIENTE or NO EJECUTADO. Do not mark PASS by assumption.

## Stop conditions

Stop field approval and open a defect if any of these occur:

- Duplicate paid invoice, payment, cash movement or receipt number.
- Unauthorized role can access reports, backups, users or void actions.
- Restore target is accidentally production or uncertain.
- Receipt exposes QR, barcode, internal IDs or technical logs.
- Real patient data is accidentally used in evidence.
- App requires internet for login, billing, reports or printing.

## Final decision

Only after all required gates pass with evidence may the responsible person consider production physical approval. Until then:

Production physical approval: NO.
