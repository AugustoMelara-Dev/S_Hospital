@echo off
setlocal
if not "%~1"=="" set "HOSPITAL_PHP_PATH=%~1"
if not defined HOSPITAL_PHP_PATH set "HOSPITAL_PHP_PATH=C:\xampp\php\php.exe"
if not exist "%HOSPITAL_PHP_PATH%" set "HOSPITAL_PHP_PATH=php"
cd /d "%~dp0..\backend"
"%HOSPITAL_PHP_PATH%" artisan hospital:backup --type=scheduled
endlocal
