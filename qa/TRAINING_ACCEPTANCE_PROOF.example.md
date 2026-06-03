# Training acceptance proof

Decision: `PENDING_FINAL_FIELD`.

Use this template after supervised training. Keep it anonymous: do not write
participant names, patient names, phone numbers, identity numbers, usernames,
passwords, `.env` values, backup SQL filenames or local machine paths.

## Training context

- Date/time:
- Responsible person:
- Training environment name:
- Training environment URL or location:
- Evidence/capture reference:
- Final conclusion:

## Safety confirmation

- [ ] Training did not use the production database.
- [ ] Training did not use real patient data.
- [ ] Training did not use real cashier shift users.
- [ ] Training did not restore over the real database.
- [ ] Training did not print receipts that could be confused with real fiscal documents.
- [ ] Training did not expose `.env`, passwords, tokens, backup SQL files or local paths.

## Roles covered

- [ ] Cashier role practiced opening the system, login, opening cashbox, invoicing, charging, printing, reprinting, closing cashbox and preparing safe support summary.
- [ ] Supervisor role practiced shift review, printer failure, LAN failure, permission issue, open cashbox recovery and incident escalation.
- [ ] Administrator role practiced system diagnostics, manual backup, backup status review, safe support packet and restore-only-on-disposable-database procedure.

## Incident drills

- [ ] Server unavailable.
- [ ] LAN down or server IP changed.
- [ ] Printer not responding.
- [ ] Power loss or PC restart.
- [ ] Browser closed during invoice or payment.
- [ ] Cashbox left open.
- [ ] Backup failed.
- [ ] Session expired.
- [ ] Permission denied.
- [ ] Database requires restore into a disposable target first.

## Acceptance notes

- Questions or follow-up items:
- Manual sections that need clarification:
- Additional training needed:

Do not mark `PRODUCTION_READY` from this file alone. Final readiness still
requires second-client LAN proof, physical printer proof, final backup worker,
restore/concurrency evidence and production preflight.
