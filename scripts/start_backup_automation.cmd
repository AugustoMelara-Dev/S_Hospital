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

if not exist "%LOOP_SCRIPT%" (
    echo ERROR: No se encontro el verificador de respaldos automaticos. Revise la instalacion del sistema.
    exit /b 1
)

if defined CHECK_ONLY (
    powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%LOOP_SCRIPT%" -ProjectRoot "%PROJECT_ROOT%" -PhpPath "%HOSPITAL_PHP_PATH%" -DailyBackupTime "%HOSPITAL_DAILY_BACKUP_TIME%" -WhatIfOnly
)
if defined CHECK_ONLY if errorlevel 1 exit /b 1
if defined CHECK_ONLY exit /b 0

start "SistemaCajaHospitalariaBackupAutomation" /min powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%LOOP_SCRIPT%" -ProjectRoot "%PROJECT_ROOT%" -PhpPath "%HOSPITAL_PHP_PATH%" -DailyBackupTime "%HOSPITAL_DAILY_BACKUP_TIME%"
if errorlevel 1 (
    echo ERROR: No se pudo iniciar la automatizacion de respaldos. Genere paquete de soporte antes de reintentar.
    exit /b 1
)
echo Automatizacion de respaldos iniciada en segundo plano.
endlocal
