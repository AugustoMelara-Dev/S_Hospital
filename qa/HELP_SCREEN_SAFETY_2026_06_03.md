# Help screen safety evidence - 2026-06-03

Decision: `PASSED`.

Scope:

- Validate that the in-app **Ayuda institucional** screen keeps the operational
  workflows requested for cashier, supervisor and administrator support.
- Validate that common real incidents remain visible: server unavailable,
  printer failure, LAN failure, power/browser restart, open cashbox, failed
  backup, restore escalation, expired session and missing permissions.
- Validate that the local support evidence panel still prepares a sanitized
  support summary without secrets, local paths or raw technical details.

Command run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\validate_help_screen_safety.ps1
```

Observed result:

- `HELP_SCREEN_SAFETY: YES`.
- Help keeps steps for opening the system, login, opening cashbox, invoicing,
  charging, printing, reprinting, reports, backups, shift close and support.
- Help keeps role responsibilities, daily checklists and delicate-action
  warnings.
- Client incident logging keeps redaction for credentials, `.env`, SQLSTATE,
  internal field names and local paths.
- Existing Help/client-issue tests continue to assert common failures and safe
  support summaries.

Safety notes:

- This was a read-only source/test guard.
- No browser storage, `.env`, database, backup SQL, Docker volume or production
  data was touched.
- Physical LAN and printer evidence remain required before production handoff.
