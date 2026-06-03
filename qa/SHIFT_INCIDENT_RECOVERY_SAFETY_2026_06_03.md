# Shift incident recovery safety evidence - 2026-06-03

Decision: `PASS`.

Scope:

- Verify that Help, operator manuals, first-level support and training guidance preserve safe recovery steps for real shift incidents.
- Cover server unavailable, LAN down, printer not responding, power/restart/browser closed, cashbox left open, failed backup, expired session, permission error and database restore needs.
- Confirm the guidance tells staff not to repeat invoices or payments blindly, not to restore production directly, and to gather safe support evidence.

Command run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\validate_shift_incident_recovery_safety.ps1
```

Observed result:

- `SHIFT_INCIDENT_RECOVERY_SAFETY: YES`.
- Help and tests keep incident guidance for common hospital failures.
- Cashier and supervisor manuals keep history/cashbox checks before retrying invoices, payments or printing.
- First-level support guide keeps safe repair diagnostics, support packet, prohibited actions and closure checklist.
- Training guide keeps drills for real incidents without using production data.

Safety notes:

- This was a read-only documentation/code guard.
- No `.env`, database volume, backup SQL, browser storage or production data was read, changed or reset.
- Final field readiness still requires real LAN client, printer, backup worker, restore, concurrency and production preflight evidence on the installed server.
