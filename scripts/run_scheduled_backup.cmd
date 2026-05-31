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
set "COMPOSE_FILE=%PROJECT_ROOT%\docker-compose.prod.yml"
set "ENV_FILE=%PROJECT_ROOT%\.env"
set "LOG_DIR=%BACKEND_DIR%\storage\logs"
if not exist "%BACKEND_DIR%\artisan" set "LOG_DIR=%PROJECT_ROOT%\install-logs"
set "LOG_FILE=%LOG_DIR%\backup_scheduled_task.log"
if not "%~1"=="" set "HOSPITAL_PHP_PATH=%~1"
if not defined HOSPITAL_PHP_PATH set "HOSPITAL_PHP_PATH=C:\xampp\php\php.exe"

if exist "%BACKEND_DIR%\artisan" (
    set "BACKUP_MODE=php"
) else if exist "%COMPOSE_FILE%" (
    set "BACKUP_MODE=docker"
) else (
    echo ERROR: No se encontro backend\artisan ni docker-compose.prod.yml. Revise que esta carpeta sea una instalacion completa.
    exit /b 1
)

if "%BACKUP_MODE%"=="php" (
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
        echo Verificacion completada. El respaldo programado puede ejecutarse con PHP local sin tocar datos en este paso.
        exit /b 0
    )

    cd /d "%BACKEND_DIR%" || (
        echo ERROR: No se pudo entrar al backend del sistema. Revise la instalacion antes de facturar.
        exit /b 1
    )

    echo [%date% %time%] Iniciando respaldo programado con PHP local. >> "%LOG_FILE%"
    "%HOSPITAL_PHP_PATH%" artisan hospital:backup --type=scheduled >> "%LOG_FILE%" 2>&1
    if errorlevel 1 (
        echo ERROR: El respaldo programado fallo. No repita muchas veces; genere paquete de soporte y revise el registro tecnico de respaldos.
        exit /b 1
    )
    echo Respaldo programado completado.
    exit /b 0
)

if not exist "%LOG_DIR%" (
    mkdir "%LOG_DIR%" >nul 2>nul
    if errorlevel 1 (
        echo ERROR: No se pudo preparar install-logs para respaldos Docker.
        exit /b 1
    )
)

where docker >nul 2>nul
if errorlevel 1 (
    echo ERROR: No se encontro Docker. El paquete offline productivo requiere Docker Desktop o Docker Engine.
    exit /b 1
)

docker compose version >nul 2>nul
if errorlevel 1 (
    echo ERROR: Docker Compose no esta disponible.
    exit /b 1
)

if not exist "%ENV_FILE%" (
    echo ERROR: No se encontro .env productivo. Ejecute setup.bat antes de registrar o iniciar respaldos.
    exit /b 1
)

docker compose -f "%COMPOSE_FILE%" --env-file "%ENV_FILE%" config --quiet >nul 2>>"%LOG_FILE%"
if errorlevel 1 (
    echo ERROR: docker-compose.prod.yml o .env no son validos para respaldos.
    exit /b 1
)

if defined CHECK_ONLY (
    echo Verificacion completada. El respaldo programado Docker puede ejecutarse sin tocar datos en este paso.
    exit /b 0
)

echo [%date% %time%] Iniciando respaldo programado en contenedor backend. >> "%LOG_FILE%"
docker compose -f "%COMPOSE_FILE%" --env-file "%ENV_FILE%" exec -T backend php artisan hospital:backup --type=scheduled >> "%LOG_FILE%" 2>&1
if errorlevel 1 (
    echo ERROR: El respaldo programado Docker fallo. Revise install-logs\backup_scheduled_task.log.
    exit /b 1
)

echo Respaldo programado completado.
endlocal
