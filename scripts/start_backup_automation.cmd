@echo off
setlocal
if not defined HOSPITAL_PHP_PATH set "HOSPITAL_PHP_PATH=C:\xampp\php\php.exe"
if not defined HOSPITAL_DAILY_BACKUP_TIME set "HOSPITAL_DAILY_BACKUP_TIME=02:00"
start "SistemaCajaHospitalariaBackupAutomation" /min powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%~dp0run_backup_scheduler_loop.ps1" -ProjectRoot "%~dp0.." -PhpPath "%HOSPITAL_PHP_PATH%" -DailyBackupTime "%HOSPITAL_DAILY_BACKUP_TIME%"
endlocal
