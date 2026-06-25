# Date, Time, And Traceability Policy

## Scope

This policy applies to the offline/LAN deployment of S_Hospital. It documents
operator responsibilities for trustworthy timestamps in billing, cash, payment,
receipt, backup, and audit records.

## Operating Rules

- Server and client PCs must use the hospital-approved local timezone.
- The server clock is the operational reference for invoices, payments, cash
  sessions, receipts, backups, and audit logs.
- Do not change the server clock during active cashier operations.
- If the clock must be corrected, stop operations, create a backup, document the
  old time, new time, reason, operator, and approval.

## Verification

- At daily opening, compare server time with the responsible operator's trusted
  time source.
- Check that invoice and payment timestamps match the current shift.
- Check that backup timestamps are plausible before relying on a backup.

## Incident Record

If time drift affects operations, record:

- Date and time detected.
- Server and client affected.
- Difference observed.
- Operations performed during the suspected drift.
- Corrective action.
- Responsible operator.

## Status

Software development is closed. This policy is an operational control and does
not reopen development unless a reproducible software defect is found.
