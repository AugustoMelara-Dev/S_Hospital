# Startup, repair and backup automation smoke

- Date/time: 2026-06-03 05:12 America/Tegucigalpa
- Environment: local Docker development workspace
- Final conclusion: safe startup and repair scripts validated in non-destructive mode; Windows scheduled tasks still need installation on the final server.

## Checks executed

- [x] Startup script dry run. Result/evidence: `scripts/start_hospital_services.ps1 -WhatIfOnly` detected `development-docker` and would request `backend`, `frontend`, and `mysql` without starting or modifying containers.
- [x] Repair script dry run. Result/evidence: `scripts/repair_hospital_system.ps1 -WhatIfOnly -NoBrowser -SkipDockerStart` validated diagnostic path, Docker mode, services, and target URL without writing diagnostics, opening a browser, or starting Docker.
- [x] Open-system smoke without browser. Result/evidence: `scripts/open_hospital_system.ps1 -NoBrowser -SkipRepair` confirmed `http://127.0.0.1:8000` responds and skipped browser launch.
- [x] Backup task registration dry run. Result/evidence: `scripts/install_backup_tasks_windows.ps1 -WhatIfOnly -PhpPath php` showed the worker and daily backup task commands without creating, updating, or deleting scheduled tasks.
- [x] Backup task status. Result/evidence: `scripts/install_backup_tasks_windows.ps1 -Status` reported `SistemaCajaHospitalaria-BackupWorker` and `SistemaCajaHospitalaria-DailyBackup` as not installed in this local environment.

## Remaining final-server work

- Install or update the Windows scheduled tasks on the hospital server.
- Confirm the worker task stays running after reboot/login.
- Confirm the daily backup task runs at the configured time.
- Re-run production preflight on the final LAN URL after tasks and physical proof are complete.

## Safety notes

- No `.env` files, database volumes, backups, or production data were deleted or reset.
- Browser launch was intentionally skipped.
- The task installation check used dry-run mode only.
