@echo off
setlocal EnableExtensions
set "SCRIPT_DIR=%~dp0"
for %%I in ("%SCRIPT_DIR%.") do set "SCRIPT_DIR=%%~fI"
set "CHECK_ONLY="
if /I "%~1"=="--check" (
    set "CHECK_ONLY=1"
    shift
)
for %%I in ("%SCRIPT_DIR%\..") do set "PROJECT_ROOT=%%~fI"
set "LOOP_SCRIPT=%SCRIPT_DIR%\run_backup_scheduler_loop.ps1"
if not defined HOSPITAL_PHP_PATH set "HOSPITAL_PHP_PATH=C:\xampp\php\php.exe"
if not defined HOSPITAL_DAILY_BACKUP_TIME set "HOSPITAL_DAILY_BACKUP_TIME=02:00"
if not defined HOSPITAL_BACKUP_MODE set "HOSPITAL_BACKUP_MODE=Auto"

powershell.exe -NoProfile -ExecutionPolicy Bypass -Command ^
  "$mode=$env:HOSPITAL_BACKUP_MODE; $envFile=$env:HOSPITAL_ENV_FILE; $project=$env:HOSPITAL_COMPOSE_PROJECT_NAME; if ($mode -notin @('Auto','Docker','Php')) { Write-Host 'ERROR: Valor invalido para HOSPITAL_BACKUP_MODE. Use Auto, Docker o Php.'; exit 1 }; if ($project -and $project -notmatch '^[A-Za-z0-9_.-]+$') { Write-Host 'ERROR: Valor invalido para HOSPITAL_COMPOSE_PROJECT_NAME.'; exit 1 }; if ($envFile -and $envFile -match '[&|<>^\""]') { Write-Host 'ERROR: Valor invalido para HOSPITAL_ENV_FILE.'; exit 1 }"
if errorlevel 1 exit /b 1

if not exist "%LOOP_SCRIPT%" (
    echo ERROR: No se encontro el verificador de respaldos automaticos. Revise la instalacion del sistema.
    exit /b 1
)

if defined CHECK_ONLY (
    if defined HOSPITAL_ENV_FILE if defined HOSPITAL_COMPOSE_PROJECT_NAME powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%LOOP_SCRIPT%" -ProjectRoot "%PROJECT_ROOT%" -PhpPath "%HOSPITAL_PHP_PATH%" -Mode "%HOSPITAL_BACKUP_MODE%" -EnvFile "%HOSPITAL_ENV_FILE%" -ComposeProjectName "%HOSPITAL_COMPOSE_PROJECT_NAME%" -DailyBackupTime "%HOSPITAL_DAILY_BACKUP_TIME%" -WhatIfOnly
    if defined HOSPITAL_ENV_FILE if not defined HOSPITAL_COMPOSE_PROJECT_NAME powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%LOOP_SCRIPT%" -ProjectRoot "%PROJECT_ROOT%" -PhpPath "%HOSPITAL_PHP_PATH%" -Mode "%HOSPITAL_BACKUP_MODE%" -EnvFile "%HOSPITAL_ENV_FILE%" -DailyBackupTime "%HOSPITAL_DAILY_BACKUP_TIME%" -WhatIfOnly
    if not defined HOSPITAL_ENV_FILE if defined HOSPITAL_COMPOSE_PROJECT_NAME powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%LOOP_SCRIPT%" -ProjectRoot "%PROJECT_ROOT%" -PhpPath "%HOSPITAL_PHP_PATH%" -Mode "%HOSPITAL_BACKUP_MODE%" -ComposeProjectName "%HOSPITAL_COMPOSE_PROJECT_NAME%" -DailyBackupTime "%HOSPITAL_DAILY_BACKUP_TIME%" -WhatIfOnly
    if not defined HOSPITAL_ENV_FILE if not defined HOSPITAL_COMPOSE_PROJECT_NAME powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%LOOP_SCRIPT%" -ProjectRoot "%PROJECT_ROOT%" -PhpPath "%HOSPITAL_PHP_PATH%" -Mode "%HOSPITAL_BACKUP_MODE%" -DailyBackupTime "%HOSPITAL_DAILY_BACKUP_TIME%" -WhatIfOnly
)
if defined CHECK_ONLY if errorlevel 1 exit /b 1
if defined CHECK_ONLY exit /b 0

if defined HOSPITAL_ENV_FILE if defined HOSPITAL_COMPOSE_PROJECT_NAME start "SistemaCajaHospitalariaBackupAutomation" /min powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%LOOP_SCRIPT%" -ProjectRoot "%PROJECT_ROOT%" -PhpPath "%HOSPITAL_PHP_PATH%" -Mode "%HOSPITAL_BACKUP_MODE%" -EnvFile "%HOSPITAL_ENV_FILE%" -ComposeProjectName "%HOSPITAL_COMPOSE_PROJECT_NAME%" -DailyBackupTime "%HOSPITAL_DAILY_BACKUP_TIME%"
if defined HOSPITAL_ENV_FILE if not defined HOSPITAL_COMPOSE_PROJECT_NAME start "SistemaCajaHospitalariaBackupAutomation" /min powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%LOOP_SCRIPT%" -ProjectRoot "%PROJECT_ROOT%" -PhpPath "%HOSPITAL_PHP_PATH%" -Mode "%HOSPITAL_BACKUP_MODE%" -EnvFile "%HOSPITAL_ENV_FILE%" -DailyBackupTime "%HOSPITAL_DAILY_BACKUP_TIME%"
if not defined HOSPITAL_ENV_FILE if defined HOSPITAL_COMPOSE_PROJECT_NAME start "SistemaCajaHospitalariaBackupAutomation" /min powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%LOOP_SCRIPT%" -ProjectRoot "%PROJECT_ROOT%" -PhpPath "%HOSPITAL_PHP_PATH%" -Mode "%HOSPITAL_BACKUP_MODE%" -ComposeProjectName "%HOSPITAL_COMPOSE_PROJECT_NAME%" -DailyBackupTime "%HOSPITAL_DAILY_BACKUP_TIME%"
if not defined HOSPITAL_ENV_FILE if not defined HOSPITAL_COMPOSE_PROJECT_NAME start "SistemaCajaHospitalariaBackupAutomation" /min powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%LOOP_SCRIPT%" -ProjectRoot "%PROJECT_ROOT%" -PhpPath "%HOSPITAL_PHP_PATH%" -Mode "%HOSPITAL_BACKUP_MODE%" -DailyBackupTime "%HOSPITAL_DAILY_BACKUP_TIME%"
if errorlevel 1 (
    echo ERROR: No se pudo iniciar la automatizacion de respaldos. Genere paquete de soporte antes de reintentar.
    exit /b 1
)
echo Automatizacion de respaldos iniciada en segundo plano.
endlocal
