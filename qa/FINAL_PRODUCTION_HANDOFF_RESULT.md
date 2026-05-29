# Final production handoff result

- Generated at: 2026-05-19 15:31:47
- Base URL: http://192.168.1.7:8000
- Project root: C:\Projects\S_Hospital
- Decision: PRODUCTION_READY
- LAN client proof present without obvious placeholders: True
- Thermal printer proof present without obvious placeholders: True
- Preflight skipped: False
- Preflight exit code: 0

## Result

The preflight passed without bypass flags. Keep this report with the completed physical evidence files.

## Blocking items

- None reported by the handoff script.

## Next commands

```powershell
powershell.exe -ExecutionPolicy Bypass -File scripts\validate_lan_client.ps1 -BaseUrl http://192.168.1.7:8000 -EvidencePath qa\LAN_CLIENT_VALIDATION_PROOF.md
powershell.exe -ExecutionPolicy Bypass -File scripts\install_backup_tasks_windows.ps1 -UpdateExisting -PhpPath C:\xampp\php\php.exe
Start-ScheduledTask -TaskName SistemaCajaHospitalaria-BackupWorker
powershell.exe -ExecutionPolicy Bypass -File scripts\final_production_handoff.ps1 -BaseUrl http://192.168.1.7:8000 -PhpPath C:\xampp\php\php.exe
```

## Backup task status output

```text
Preparing Windows scheduled tasks for Sistema de Caja Hospitalaria backups.
ProjectRoot: C:\Projects\S_Hospital
PhpPath: C:\xampp\php\php.exe
Worker wrapper: C:\Projects\S_Hospital\scripts\run_backup_worker.cmd
Daily backup wrapper: C:\Projects\S_Hospital\scripts\run_scheduled_backup.cmd
Worker task: SistemaCajaHospitalaria-BackupWorker
Daily backup task: SistemaCajaHospitalaria-DailyBackup at 02:00
SistemaCajaHospitalaria-BackupWorker: state=Ready, lastRun=05/19/2026 15:29:47, lastResult=1, nextRun=
SistemaCajaHospitalaria-DailyBackup: state=Ready, lastRun=11/30/1999 00:00:00, lastResult=267011, nextRun=05/20/2026 02:00:00
Confirm the worker is running with: Get-ScheduledTask -TaskName 'SistemaCajaHospitalaria-BackupWorker'
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
[ OK ] Windows scheduled task 'SistemaCajaHospitalaria-BackupWorker' state=Ready, lastResult=1, nextRun=
[ OK ] Windows scheduled task 'SistemaCajaHospitalaria-DailyBackup' state=Ready, lastResult=267011, nextRun=05/20/2026 02:00:00
[ OK ] frontend/dist/index.html exists
[ OK ] frontend/dist/assets contains 7 files
[ OK ] php is available in PATH
[ OK ] mysql client is available: C:\xampp\mysql\bin\mysql.exe
[ OK ] database dump tool is available: C:\xampp\mysql\bin\mysqldump.exe
[ OK ] backup directory is writable
[ OK ] /up responded 200
[ OK ] /login responded 200
[ OK ] /verify-email responded 200
[ OK ] second-client LAN evidence is present and completed.
[ OK ] physical thermal printer evidence is present and completed.
[ OK ] final restore evidence is present and completed.
[ OK ] final concurrency evidence is present and completed.

PRODUCTION_PREFLIGHT_PASSED
```
