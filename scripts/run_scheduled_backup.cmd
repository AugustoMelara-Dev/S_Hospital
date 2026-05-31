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
set "BACKEND_DIR=%PROJECT_ROOT%\backend"
set "LOG_DIR=%BACKEND_DIR%\storage\logs"
set "LOG_FILE=%LOG_DIR%\backup_scheduled_task.log"
if not "%~1"=="" set "HOSPITAL_PHP_PATH=%~1"
if not defined HOSPITAL_PHP_PATH set "HOSPITAL_PHP_PATH=C:\xampp\php\php.exe"

if not exist "%BACKEND_DIR%\artisan" (
    echo ERROR: No se encontro la aplicacion del sistema. Revise que esta carpeta sea la instalacion completa.
    exit /b 1
)

if not exist "%LOG_DIR%" (
    mkdir "%LOG_DIR%" >nul 2>nul
    if errorlevel 1 (
        echo ERROR: No se pudo preparar el registro tecnico de respaldos. Revise permisos o espacio en disco.
        exit /b 1
    )
)

if not exist "%HOSPITAL_PHP_PATH%" (
    where php >nul 2>nul
    if errorlevel 1 (
        echo ERROR: No se encontro PHP. Instale XAMPP/PHP o defina HOSPITAL_PHP_PATH antes de ejecutar respaldos.
        exit /b 1
    )
    set "HOSPITAL_PHP_PATH=php"
)

if defined CHECK_ONLY (
    echo Verificacion completada. El respaldo programado puede ejecutarse sin tocar datos en este paso.
    exit /b 0
)

cd /d "%BACKEND_DIR%" || (
    echo ERROR: No se pudo entrar al backend del sistema. Revise la instalacion antes de facturar.
    exit /b 1
)

echo [%date% %time%] Iniciando respaldo programado. >> "%LOG_FILE%"
"%HOSPITAL_PHP_PATH%" artisan hospital:backup --type=scheduled >> "%LOG_FILE%" 2>&1
if errorlevel 1 (
    echo ERROR: El respaldo programado fallo. No repita muchas veces; genere paquete de soporte y revise el registro tecnico de respaldos.
    exit /b 1
)
echo Respaldo programado completado.
endlocal
