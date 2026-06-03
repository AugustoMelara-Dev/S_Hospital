# Startup and repair safety validation - 2026-06-03

Decision: `PASS`.

Scope:

- Validate that startup, repair, open-system, stack-autostart and backup-task recovery scripts are present.
- Scan startup and repair entry points for destructive database/Docker/file operations.
- Confirm safe dry-run modes do not start Docker, open the browser, write diagnostics or register scheduled tasks.
- Confirm final handoff and production preflight use `-NoProfile` for nested
  PowerShell calls so a broken operator profile cannot hang closure checks.
- Confirm backup task installer follow-up commands use `-NoProfile` so support
  can inspect, update or uninstall scheduled backup tasks even when an operator
  PowerShell profile is broken.

Command run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\validate_startup_repair_safety.ps1
```

Observed result:

- `STARTUP_REPAIR_SAFETY: YES`.
- Startup dry run detected `development-docker` and did not start or modify containers.
- Repair dry run validated report path, URL and Docker mode without writing diagnostics.
- Shortcut dry run did not create a desktop shortcut or startup task.
- Stack autostart dry run did not register, update or remove
  `SistemaCajaHospitalaria-StackAutostart` and confirmed the planned
  `AtStartup` trigger.
- Backup task dry run did not register, update or remove scheduled tasks.
- Nested final handoff and production preflight PowerShell calls use
  `-NoProfile`.
- Backup task installer follow-up instructions for status, update and uninstall
  use `powershell.exe -NoProfile -ExecutionPolicy Bypass`.

Safety notes:

- This check uses `-WhatIfOnly` for recovery actions.
- It does not delete `.env`, backups, database volumes or production data.
- It does not open a browser or create Windows scheduled tasks.
