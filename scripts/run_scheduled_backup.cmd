@echo off
setlocal EnableExtensions EnableDelayedExpansion
set "SCRIPT_DIR=%~dp0"
for %%I in ("%SCRIPT_DIR%.") do set "SCRIPT_DIR=%%~fI"
set "CHECK_ONLY="
set "FORCED_BACKUP_MODE="
set "ENV_FILE_OVERRIDE="
set "COMPOSE_PROJECT_NAME_OVERRIDE="
:parse_args
if "%~1"=="" goto parsed_args
if /I "%~1"=="--check" (
    set "CHECK_ONLY=1"
    shift
    goto parse_args
)
if /I "%~1"=="--mode=docker" (
    set "FORCED_BACKUP_MODE=docker"
    shift
    goto parse_args
)
if /I "%~1"=="--mode" (
    if /I "%~2"=="docker" set "FORCED_BACKUP_MODE=docker"
    if /I "%~2"=="php" set "FORCED_BACKUP_MODE=php"
    if not defined FORCED_BACKUP_MODE (
        echo ERROR: Valor invalido para --mode. Use docker o php.
        exit /b 1
    )
    shift
    shift
    goto parse_args
)
set "CURRENT_ARG=%~1"
if /I "!CURRENT_ARG:~0,7!"=="--mode=" (
    set "MODE_VALUE=!CURRENT_ARG:~7!"
    if /I "!MODE_VALUE!"=="docker" set "FORCED_BACKUP_MODE=docker"
    if /I "!MODE_VALUE!"=="php" set "FORCED_BACKUP_MODE=php"
    if not defined FORCED_BACKUP_MODE (
        echo ERROR: Valor invalido para --mode. Use docker o php.
        exit /b 1
    )
    shift
    goto parse_args
)
if /I "%~1"=="--mode=php" (
    set "FORCED_BACKUP_MODE=php"
    if not "%~2"=="" if /I not "%~2"=="--env-file" set "HOSPITAL_PHP_PATH=%~2"
    shift
    goto parse_args
)
if /I "%~1"=="--env-file" goto :envarg
if /I "%~1"=="--project-name" goto :projarg
if /I "!CURRENT_ARG:~0,11!"=="--env-file=" (
    set "ENV_FILE_OVERRIDE=!CURRENT_ARG:~11!"
    shift
    goto parse_args
)
if /I "!CURRENT_ARG:~0,15!"=="--project-name=" (
    set "COMPOSE_PROJECT_NAME_OVERRIDE=!CURRENT_ARG:~15!"
    shift
    goto parse_args
)
if not defined HOSPITAL_PHP_PATH set "HOSPITAL_PHP_PATH=%~1"
shift
goto parse_args
:envarg
if "%~2"=="" (
    echo ERROR: Falta valor para --env-file.
    exit /b 1
)
set "ENV_FILE_OVERRIDE=%~2"
shift
shift
goto parse_args
:projarg
if "%~2"=="" (
    echo ERROR: Falta valor para --project-name.
    exit /b 1
)
set "COMPOSE_PROJECT_NAME_OVERRIDE=%~2"
shift
shift
goto parse_args
:parsed_args
for %%I in ("%SCRIPT_DIR%\..") do set "PROJECT_ROOT=%%~fI"
set "BACKEND_DIR=%PROJECT_ROOT%\backend"
set "COMPOSE_FILE=%PROJECT_ROOT%\docker-compose.prod.yml"
set "ENV_FILE=%PROJECT_ROOT%\.env"
set "COMPOSE_PROJECT_ARGS="
if defined ENV_FILE_OVERRIDE (
    for %%I in ("%ENV_FILE_OVERRIDE%") do set "ENV_FILE=%%~fI"
)
if defined COMPOSE_PROJECT_NAME_OVERRIDE (
    powershell.exe -NoProfile -Command "if ($env:COMPOSE_PROJECT_NAME_OVERRIDE -match '^[A-Za-z0-9][A-Za-z0-9_.-]*$') { exit 0 } else { exit 1 }" >nul 2>nul
    if errorlevel 1 (
        echo ERROR: Valor invalido para --project-name. Use solo letras, numeros, punto, guion o guion_bajo; debe iniciar con letra o numero.
        exit /b 1
    )
    set "COMPOSE_PROJECT_ARGS=-p !COMPOSE_PROJECT_NAME_OVERRIDE!"
)
set "LOG_DIR=%BACKEND_DIR%\storage\logs"
set "LOG_FILE=%LOG_DIR%\backup_scheduled_task.log"
if not defined HOSPITAL_PHP_PATH set "HOSPITAL_PHP_PATH=C:\xampp\php\php.exe"

if /I "%FORCED_BACKUP_MODE%"=="docker" set "BACKUP_MODE=docker"
if /I "%FORCED_BACKUP_MODE%"=="php" set "BACKUP_MODE=php"
if not defined BACKUP_MODE if exist "%BACKEND_DIR%\artisan" (
    set "BACKUP_MODE=php"
) else if exist "%COMPOSE_FILE%" (
    set "BACKUP_MODE=docker"
) else (
    echo ERROR: No se encontro backend\artisan ni docker-compose.prod.yml. Revise que esta carpeta sea una instalacion completa.
    exit /b 1
)
if "%BACKUP_MODE%"=="docker" set "LOG_DIR=%PROJECT_ROOT%\install-logs"
set "LOG_FILE=%LOG_DIR%\backup_scheduled_task.log"

if "%BACKUP_MODE%"=="php" (
    if not exist "%BACKEND_DIR%\artisan" (
        echo ERROR: Modo PHP solicitado, pero no se encontro backend\artisan.
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

set "DOCKER_CONFIG=%LOG_DIR%\docker-config"
if not exist "%DOCKER_CONFIG%" (
    mkdir "%DOCKER_CONFIG%" >nul 2>nul
    if errorlevel 1 (
        echo ERROR: No se pudo preparar la configuracion tecnica de Docker para respaldos.
        exit /b 1
    )
)
if not exist "%DOCKER_CONFIG%\config.json" (
    > "%DOCKER_CONFIG%\config.json" echo {}
)

where docker >nul 2>nul
if errorlevel 1 (
    echo ERROR: No se encontro Docker. El paquete offline productivo requiere Docker Desktop o Docker Engine.
    exit /b 1
)

docker compose version >nul 2>>"%LOG_FILE%"
if errorlevel 1 (
    echo ERROR: Docker Compose no esta disponible.
    exit /b 1
)

if not exist "%ENV_FILE%" (
    echo ERROR: No se encontro .env productivo. Ejecute setup.bat antes de registrar o iniciar respaldos.
    exit /b 1
)

docker compose %COMPOSE_PROJECT_ARGS% -f "%COMPOSE_FILE%" --env-file "%ENV_FILE%" config --quiet >nul 2>>"%LOG_FILE%"
if errorlevel 1 (
    echo ERROR: docker-compose.prod.yml o .env no son validos para respaldos.
    exit /b 1
)

set "HAS_BACKEND_SERVICE="
for /f "usebackq delims=" %%S in (`docker compose %COMPOSE_PROJECT_ARGS% -f "%COMPOSE_FILE%" --env-file "%ENV_FILE%" config --services`) do (
    if /I "%%S"=="backend" set "HAS_BACKEND_SERVICE=1"
)
if not defined HAS_BACKEND_SERVICE (
    echo ERROR: docker-compose.prod.yml no define el servicio backend requerido para respaldos.
    exit /b 1
)

if defined CHECK_ONLY (
    set "BACKEND_CONTAINER="
    for /f %%I in ('docker compose %COMPOSE_PROJECT_ARGS% -f "%COMPOSE_FILE%" --env-file "%ENV_FILE%" ps --status running -q backend 2^>nul') do set "BACKEND_CONTAINER=%%I"
    if not defined BACKEND_CONTAINER (
        echo ERROR: El servicio Docker backend no esta activo. Inicie el sistema antes de validar el respaldo programado.
        exit /b 1
    )

    docker compose %COMPOSE_PROJECT_ARGS% -f "%COMPOSE_FILE%" --env-file "%ENV_FILE%" exec -T backend php artisan --version >nul 2>>"%LOG_FILE%"
    if errorlevel 1 (
        echo ERROR: El backend Docker no responde a artisan. Revise contenedores antes de entregar respaldos automaticos.
        exit /b 1
    )

    docker compose %COMPOSE_PROJECT_ARGS% -f "%COMPOSE_FILE%" --env-file "%ENV_FILE%" exec -T backend php artisan list --raw | findstr /I /C:"hospital:backup" >nul
    if errorlevel 1 (
        echo ERROR: El comando hospital:backup no esta disponible en el backend Docker.
        exit /b 1
    )

    docker compose %COMPOSE_PROJECT_ARGS% -f "%COMPOSE_FILE%" --env-file "%ENV_FILE%" exec -T backend php artisan migrate:status >nul 2>>"%LOG_FILE%"
    if errorlevel 1 (
        echo ERROR: El backend Docker no puede leer el estado de migraciones. Revise conexion a MariaDB antes de entregar respaldos automaticos.
        exit /b 1
    )

    docker compose %COMPOSE_PROJECT_ARGS% -f "%COMPOSE_FILE%" --env-file "%ENV_FILE%" exec -T backend sh -lc "command -v mariadb-dump || command -v mysqldump" >nul 2>>"%LOG_FILE%"
    if errorlevel 1 (
        echo ERROR: No se encontro mariadb-dump ni mysqldump dentro del backend Docker.
        exit /b 1
    )

    echo Verificacion completada. El respaldo programado Docker tiene artisan, DB y herramienta de dump disponibles sin crear respaldos en este paso.
    exit /b 0
)

echo [%date% %time%] Iniciando respaldo programado en contenedor backend. >> "%LOG_FILE%"
docker compose %COMPOSE_PROJECT_ARGS% -f "%COMPOSE_FILE%" --env-file "%ENV_FILE%" exec -T backend php artisan hospital:backup --type=scheduled >> "%LOG_FILE%" 2>&1
if errorlevel 1 (
    echo ERROR: El respaldo programado Docker fallo. Revise install-logs\backup_scheduled_task.log.
    exit /b 1
)

echo Respaldo programado completado.
endlocal
