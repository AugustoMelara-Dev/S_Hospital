# Physical Security Runbook

## Scope

S_Hospital protects software workflows, but physical control of the server,
clients, printers, and backups is required for safe hospital operation.

## Server

- Keep the server in a locked or supervised area.
- Restrict access to the responsible technical operator and authorized backup.
- Do not leave database, backup, or `.env` files in shared folders.
- Protect the server with a UPS when available.

## Client PCs

- Use named OS accounts where possible.
- Lock the screen when the operator leaves.
- Do not use public/patient PCs for billing.
- Keep cashier monitors positioned to avoid exposing patient names or amounts.

## Printers And Paper

- Collect receipts immediately after printing.
- Destroy failed prints that contain patient names or financial amounts.
- Validate physical printing before go-live; digital PDF validation alone is not
  physical approval.

## Backup Media

- Store external backup copies in a locked location.
- Rotate backup media according to hospital policy.
- Do not attach unknown USB drives to the server.

## Status

Physical security is an operational acceptance gate. It does not represent
unfinished code.
