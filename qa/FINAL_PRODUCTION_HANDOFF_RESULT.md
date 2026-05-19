# Final production handoff result

- Generated at: 2026-05-19 12:59:01
- Base URL: http://192.168.1.7:8000
- Project root: C:\Projects\S_Hospital
- Decision: PRODUCTION_CANDIDATE
- LAN client proof completed: False
- Thermal printer proof completed: False
- Preflight skipped: False
- Preflight exit code: 1

## Result

Do not declare PRODUCTION_READY. Keep the system as PRODUCTION_CANDIDATE until every blocker below is closed with real field evidence.

## Blocking items

- Missing or incomplete qa/LAN_CLIENT_VALIDATION_PROOF.md from a real second LAN client.
- Missing or incomplete qa/THERMAL_PRINTER_PROOF.md from the real thermal printer.
- Production preflight returned exit code 1.

## Next commands

```powershell
powershell.exe -ExecutionPolicy Bypass -File scripts\validate_lan_client.ps1 -BaseUrl http://192.168.1.7:8000 -EvidencePath qa\LAN_CLIENT_VALIDATION_PROOF.md
powershell.exe -ExecutionPolicy Bypass -File scripts\install_backup_tasks_windows.ps1 -UpdateExisting -PhpPath C:\xampp\php\php.exe
Start-ScheduledTask -TaskName HospitalBillingOS-BackupWorker
powershell.exe -ExecutionPolicy Bypass -File scripts\final_production_handoff.ps1 -BaseUrl http://192.168.1.7:8000 -PhpPath C:\xampp\php\php.exe
```

## Backup task status output

```text
Preparing Windows scheduled tasks for Hospital Billing OS backups.
ProjectRoot: C:\Projects\S_Hospital
PhpPath: C:\xampp\php\php.exe
Worker wrapper: C:\Projects\S_Hospital\scripts\run_backup_worker.cmd
Daily backup wrapper: C:\Projects\S_Hospital\scripts\run_scheduled_backup.cmd
Worker task: HospitalBillingOS-BackupWorker
Daily backup task: HospitalBillingOS-DailyBackup at 02:00
HospitalBillingOS-BackupWorker: not installed
HospitalBillingOS-DailyBackup: not installed
Confirm the worker is running with: Get-ScheduledTask -TaskName 'HospitalBillingOS-BackupWorker'
Confirm UI backups finish by creating a backup and checking it changes from pending to success.
```

## Preflight output

```text
Production readiness preflight for http://192.168.1.7:8000
Project root: C:\Projects\S_Hospital
[ OK ] APP_ENV=production
[ OK ] APP_DEBUG=false
[ OK ] APP_URL matches BaseUrl
[ OK ] BaseUrl is not localhost
[ OK ] DB_CONNECTION=mysql
[ OK ] SANCTUM_STATEFUL_DOMAINS includes LAN host
[ OK ] CORS origins are explicitly empty for same-origin production
[ OK ] CORS origin patterns are empty
[ OK ] QUEUE_CONNECTION=database
[ OK ] frontend/dist/index.html exists
[ OK ] frontend/dist/assets contains 7 files
[ OK ] php is available in PATH
[ OK ] mysql client is available: C:\xampp\mysql\bin\mysql.exe
[ OK ] database dump tool is available: C:\xampp\mysql\bin\mysqldump.exe
[ OK ] backup directory is writable
[ OK ] /up responded 200
[ OK ] /login responded 200
[ OK ] /verify-email responded 200
[FAIL] Missing C:\Projects\S_Hospital\qa\LAN_CLIENT_VALIDATION_PROOF.md with real second-client LAN evidence.
[FAIL] Missing C:\Projects\S_Hospital\qa\THERMAL_PRINTER_PROOF.md with real physical thermal printer evidence.

PRODUCTION_READY: NO (2 blocking issue(s))
```
