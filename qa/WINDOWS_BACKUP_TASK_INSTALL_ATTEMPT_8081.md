# Windows backup task install attempt - LAN 8081

## Environment

- Date/time: 2026-06-16 17:20 America/Tegucigalpa
- Server LAN URL: http://192.168.1.3:8081
- Compose project: shospital_offlinetest
- Mode: Docker
- Result: BLOCKED - current shell is not Administrator and elevated UAC registration did not create the tasks.

## Commands attempted

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\install_backup_tasks_windows.ps1 -ProjectRoot C:\Projects\S_Hospital -Mode Docker -EnvFile C:\tmp\s_hospital_lanvalidation.env -ComposeProjectName shospital_offlinetest -Status
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\install_backup_tasks_windows.ps1 -ProjectRoot C:\Projects\S_Hospital -Mode Docker -EnvFile C:\tmp\s_hospital_lanvalidation.env -ComposeProjectName shospital_offlinetest -UpdateExisting -LaunchElevated
```

## Evidence

- Current PowerShell administrator check: `ADMIN: NO`.
- Status before elevated attempt: `SistemaCajaHospitalaria-BackupWorker: no instalada`; `SistemaCajaHospitalaria-DailyBackup: no instalada`.
- Elevated relaunch requested UAC successfully from the non-admin shell.
- Status after waiting and rechecking: both tasks still `no instalada`.
- Direct `Get-ScheduledTask` lookup found no matching tasks.
- After hardening `scripts\install_backup_tasks_windows.ps1`, the same elevated relaunch now exits `1` when tasks are not created instead of returning a false success.
- Hardened failure message: `La ejecucion elevada termino, pero las tareas programadas no quedaron instaladas. Apruebe UAC y ejecute de nuevo desde PowerShell como Administrador si persiste.`

## Conclusion

This PC still requires an approved elevated Administrator PowerShell run before it can be declared `PRODUCTION_READY`.
The current-user Startup/HKCU fallback is installed and validated, but it remains a blocker for final production because it depends on an interactive Windows user session.
# Windows backup task install attempt - LAN 8081

## Latest attempt - 2026-06-17

- Command: `powershell -NoProfile -ExecutionPolicy Bypass -File scripts\install_backup_tasks_windows.ps1 -Mode Docker -EnvFile C:\tmp\s_hospital_lanvalidation.env -ComposeProjectName shospital_offlinetest -UpdateExisting -LaunchElevated`
- Result: FAILED_TO_INSTALL_ADMIN_TASKS
- Evidence: the script requested Administrator elevation, returned exit code 1, and reported that the elevated run finished but the scheduled tasks were not installed.
- Worker task: `SistemaCajaHospitalaria-BackupWorker` -> not installed.
- Daily task: `SistemaCajaHospitalaria-DailyBackup` -> not installed.
- Current-user fallback: installed in Startup and HKCU Run for the current Windows user.

## Status verification

```text
SistemaCajaHospitalaria-BackupWorker: no instalada
SistemaCajaHospitalaria-DailyBackup: no instalada
```

```text
Automatizacion en carpeta Startup: instalada en %USERPROFILE%\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup\SistemaCajaHospitalariaBackupAutomation.cmd
Automatizacion HKCU Run: instalada como SistemaCajaHospitalariaBackupAutomation
```

## Operational conclusion

This PC still requires an Administrator PowerShell/UAC-approved run to install the two Windows scheduled tasks. Until that is done, production readiness remains blocked because the fallback depends on the Windows user logging in.

## Latest reattempt - 2026-06-17 after LAN/WebSocket hardening

- Command: `powershell -NoProfile -ExecutionPolicy Bypass -File scripts\install_backup_tasks_windows.ps1 -Mode Docker -EnvFile C:\tmp\s_hospital_offlinetest.env -ComposeProjectName shospital_offlinetest -UpdateExisting -LaunchElevated`
- Result: FAILED_TO_INSTALL_ADMIN_TASKS
- Exit code: 1
- Evidence: the script requested Administrator elevation, waited for the elevated process, then reported: `La ejecucion elevada termino, pero las tareas programadas no quedaron instaladas. Apruebe UAC y ejecute de nuevo desde PowerShell como Administrador si persiste.`
- Status command: `powershell -NoProfile -ExecutionPolicy Bypass -File scripts\install_backup_tasks_windows.ps1 -Status -PhpPath php`
- Worker task: `SistemaCajaHospitalaria-BackupWorker` -> not installed.
- Daily task: `SistemaCajaHospitalaria-DailyBackup` -> not installed.
- Current-user fallback: still installed in Startup and HKCU Run for the current Windows user.
