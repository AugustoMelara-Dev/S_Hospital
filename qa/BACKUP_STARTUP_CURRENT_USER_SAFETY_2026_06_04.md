# Backup startup current-user safety - 2026-06-04

Decision: `VALIDATED_LOCAL`.

Scope:

- Current-user backup startup fallback for installations where the hospital server cannot create Windows scheduled tasks without administrator rights.
- Guarded files: `scripts/install_backup_startup_current_user.ps1`, `scripts/start_backup_automation.cmd`, `scripts/run_backup_scheduler_loop.ps1`, `docs/manuales/GUIA_INSTALACION_OPERATIVA.md`, `docs/manuales/GUIA_RESPALDOS_Y_RESTAURACION.md` and prior operational support evidence.
- This fallback does not replace final-server scheduled task validation. It only gives support a safe non-admin path to keep backup automation alive while an administrator fixes task registration.

Safety checks covered:

- `-WhatIfOnly` prints that it does not create the Startup file, does not change HKCU Run and does not start the worker.
- `-Status` can inspect current-user Startup/HKCU state without validating irrelevant PHP paths or backup times.
- `-Uninstall` removes only the current-user Startup launcher and HKCU Run value.
- Output redacts local user paths and secret-like assignments.
- The scripts avoid destructive reset patterns such as recursive data deletion, volume deletion, `migrate:fresh`, `db:wipe`, `DROP DATABASE` or truncation.
- Operator docs mention the current-user fallback and keep warnings against deleting `.env`, Docker volumes, database files or backups.

Validation command:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\validate_backup_startup_current_user_safety.ps1
```

Expected result:

```text
BACKUP_STARTUP_CURRENT_USER_SAFETY: YES
```

Remaining final-field proof:

- Run the same guard on the final hospital server.
- Prefer `scripts\install_backup_tasks_windows.ps1` for final production when administrator rights are available.
- If the current-user fallback is used, confirm it survives sign-in/reboot for the Windows account that will keep the server session active, then record the result in final handoff evidence.
