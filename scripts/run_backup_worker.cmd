@echo off
setlocal
if not defined HOSPITAL_PHP_PATH set "HOSPITAL_PHP_PATH=C:\xampp\php\php.exe"
if not exist "%HOSPITAL_PHP_PATH%" set "HOSPITAL_PHP_PATH=php"
cd /d "%~dp0..\backend"
"%HOSPITAL_PHP_PATH%" artisan queue:work --queue=backups --tries=1 --timeout=600
endlocal
