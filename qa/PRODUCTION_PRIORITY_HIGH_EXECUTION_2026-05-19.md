# Production priority high execution - 2026-05-19

## Decision

Current state: `PRODUCTION_CANDIDATE`.

Do not declare `PRODUCTION_READY` yet. The server-side production checks passed, but real second-client LAN proof and physical thermal-printer proof are still missing.

## Server production environment

Validated on this machine with base URL `http://192.168.1.7:8000`.

- `APP_ENV=production`: passed.
- `APP_DEBUG=false`: passed.
- `APP_URL` matches `http://192.168.1.7:8000`: passed.
- `SANCTUM_STATEFUL_DOMAINS` includes `192.168.1.7:8000`: passed.
- `DB_CONNECTION=mysql`: passed.
- `QUEUE_CONNECTION=database`: passed.
- `php artisan config:cache --no-ansi`: passed.

Public route checks from the server machine:

- `/up`: HTTP 200.
- `/login`: HTTP 200.
- `/verify-email`: HTTP 200.
- `/assets/*.js`: HTTP 200 with `text/javascript; charset=UTF-8`.

## Backups

Backup tooling on this server:

- `mysql.exe`: available at `C:\xampp\mysql\bin\mysql.exe`.
- `mysqldump.exe`: available at `C:\xampp\mysql\bin\mysqldump.exe`.
- Backup directory writable: passed.
- Manual backup command: passed.
- Backup file: `backend/storage/app/private/backups/hospital-backup-20260519-172238-etbzgp2s.sql`.
- Size: `315914` bytes.
- SHA256: `1B208E93AA184B2C221E51B1DF58A61D06C1F7DB932B4C865BF85D9A363537AF`.

Current-user backup automation is installed and running through Startup/HKCU Run. The log at `backend/storage/logs/backup-automation.log` shows heartbeat entries for worker PID `91128`.

Windows scheduled tasks exist, but the worker task returned result code `1` when started from this non-admin session. The installer was adjusted so future task registration uses an `AtLogOn` trigger for the continuous worker instead of a boot trigger with an interactive token. Re-registering the scheduled tasks still requires an elevated PowerShell session.

## Physical blockers

The production preflight was executed without bypass:

```powershell
powershell.exe -ExecutionPolicy Bypass -File scripts\production_readiness_preflight.ps1 -BaseUrl http://192.168.1.7:8000
```

Result: `PRODUCTION_READY: NO (2 blocking issue(s))`.

Blocking failures:

- Missing `qa/LAN_CLIENT_VALIDATION_PROOF.md` with real second-client LAN evidence.
- Missing `qa/THERMAL_PRINTER_PROOF.md` with real physical thermal printer evidence.

These cannot be closed from the server machine alone. They require a real second client computer and the real thermal printer or exact printer configuration used by the hospital.

## Quality gates

- `php artisan test --colors=never`: passed, 141 tests / 821 assertions.
- `npm.cmd run lint`: passed.
- `npm.cmd run test`: passed, 30 tests.
- `npm.cmd run build`: passed.
- `php artisan config:cache --no-ansi`: passed after tests/build.

## Code changes in this execution

- `scripts/install_backup_tasks_windows.ps1`: worker scheduled task trigger changed from `AtStartup` to `AtLogOn`.
- `frontend/src/App.test.tsx`: cash-session test mock now returns the opened session after `/api/cash-sessions/open`, matching the real backend contract after query invalidation.

## Remaining mandatory actions

1. From a second computer on the final LAN, fill `qa/LAN_CLIENT_VALIDATION_PROOF.md` using `qa/LAN_CLIENT_VALIDATION_PROOF.example.md`.
2. On the cashier/printer computer, fill `qa/THERMAL_PRINTER_PROOF.md` using `qa/THERMAL_PRINTER_PROOF.example.md`.
3. Re-run `scripts/production_readiness_preflight.ps1` without `-AllowMissingPhysicalProof`.
4. In an elevated PowerShell session, re-register backup scheduled tasks:

```powershell
powershell.exe -ExecutionPolicy Bypass -File scripts\install_backup_tasks_windows.ps1 -UpdateExisting -PhpPath C:\xampp\php\php.exe
Start-ScheduledTask -TaskName SistemaCajaHospitalaria-BackupWorker
powershell.exe -ExecutionPolicy Bypass -File scripts\install_backup_tasks_windows.ps1 -Status -PhpPath C:\xampp\php\php.exe
```

## Guided handoff command

Use this command on the final server to run the closing checks without creating
fake physical evidence:

```powershell
powershell.exe -ExecutionPolicy Bypass -File scripts\final_production_handoff.ps1 `
  -BaseUrl http://192.168.1.7:8000 `
  -PhpPath C:\xampp\php\php.exe `
  -InitializeProofFiles
```

Expected result until field evidence exists: `PRODUCTION_READY` remains blocked
and the system stays `PRODUCTION_CANDIDATE`.

## Current preflight rerun

Latest rerun from this branch:

```powershell
powershell.exe -ExecutionPolicy Bypass -File scripts\production_readiness_preflight.ps1 -BaseUrl http://192.168.1.7:8000
```

Validated as passing:

- `APP_ENV=production`.
- `APP_DEBUG=false`.
- `APP_URL=http://192.168.1.7:8000`.
- `DB_CONNECTION=mysql`.
- `QUEUE_CONNECTION=database`.
- Frontend build exists.
- `C:\xampp\mysql\bin\mysql.exe`.
- `C:\xampp\mysql\bin\mysqldump.exe`.
- Backup directory writable.
- `/up`, `/login` and `/verify-email` respond 200.

Result: `PRODUCTION_READY: NO (2 blocking issue(s))`.

Remaining blockers:

- Missing `qa/LAN_CLIENT_VALIDATION_PROOF.md` with real second-client LAN evidence.
- Missing `qa/THERMAL_PRINTER_PROOF.md` with real physical thermal printer evidence.

During the handoff dry run, Windows scheduled tasks named
`SistemaCajaHospitalaria-BackupWorker` and `SistemaCajaHospitalaria-DailyBackup` were not
installed in this session. Install or update them from elevated PowerShell
before handoff, then create a UI backup and confirm it changes from `pending` to
`success`.
