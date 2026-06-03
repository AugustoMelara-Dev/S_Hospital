@echo off
setlocal EnableExtensions EnableDelayedExpansion
REM Sistema de Caja Hospitalaria - Script local de desarrollo/validacion.
REM Para produccion final use offline-release\setup.bat desde un paquete regenerado.

cd /d "%~dp0"
title "Sistema de Caja Hospitalaria - Setup Local"
cls

echo ======================================================================
echo       SISTEMA DE CAJA HOSPITALARIA - SETUP LOCAL / VALIDACION
echo ======================================================================
echo.
echo Este asistente usa docker-compose de desarrollo para validar el sistema.
echo Puede construir frontend con npm dentro de Docker y usar APP_ENV local.
echo.
echo PRODUCCION FINAL:
echo - Use offline-release\setup.bat desde un paquete offline regenerado.
echo - No use este setup raiz para entregar el servidor del hospital.
echo.
echo No borra datos ni elimina volumenes.
echo.

choice /c SN /m "Desea continuar con setup local de desarrollo"
if errorlevel 2 (
    echo Operacion cancelada. Para produccion use offline-release\setup.bat.
    exit /b 0
)

echo [1/5] Verificando requisitos de infraestructura...
where docker >nul 2>nul
if %errorlevel% neq 0 (
    echo.
    echo ERROR: Docker no esta instalado en este sistema.
    echo Instale Docker Desktop antes de continuar.
    echo.
    pause
    exit /b 1
)

docker info >nul 2>nul
if %errorlevel% neq 0 (
    echo.
    echo ERROR: Docker esta instalado pero no se esta ejecutando.
    echo Inicie Docker Desktop y vuelva a ejecutar este script.
    echo.
    pause
    exit /b 1
)
echo OK: Docker esta instalado y activo.
echo.

set "SERVER_IP=127.0.0.1"
for /f "tokens=4 delims= " %%a in ('route print 0.0.0.0 ^| findstr /r "^[ ]*0.0.0.0"') do (
    set "SERVER_IP=%%a"
)
if "%SERVER_IP%"=="" set "SERVER_IP=127.0.0.1"

echo [2/5] Preparando la interfaz del sistema...
echo Esto puede tomar un momento...
echo.
if exist "%~dp0frontend\dist\index.html" (
    echo OK: Se encontro una interfaz ya preparada en frontend\dist.
) else (
    docker run --rm -v "%~dp0frontend:/app" -w /app node:22-alpine sh -c "npm install && npm run build"
    if %errorlevel% neq 0 (
        echo.
        echo ERROR: La preparacion de la interfaz ha fallado.
        echo.
        pause
        exit /b 1
    )
)
echo.
echo OK: Interfaz preparada.
echo.

echo [3/5] Iniciando servicios locales del hospital...
if not exist "%~dp0backend\.env" (
    echo Creando archivo de entorno backend\.env...
    copy "%~dp0backend\.env.docker.example" "%~dp0backend\.env" > nul
)

powershell -NoProfile -ExecutionPolicy Bypass -Command "$path='%~dp0backend\.env'; $content=Get-Content -Raw $path; $ip='%SERVER_IP%'; $pairs=@{APP_URL='http://'+$ip+':8000'; CACHE_STORE='file'; SANCTUM_STATEFUL_DOMAINS='localhost,localhost:3000,localhost:5173,127.0.0.1,127.0.0.1:8000,127.0.0.1:5173,'+$ip+','+$ip+':8000,::1'}; foreach ($key in $pairs.Keys) { $value=$pairs[$key]; if ($content -match ('(?m)^'+[regex]::Escape($key)+'=')) { $content=[regex]::Replace($content,'(?m)^'+[regex]::Escape($key)+'=.*',$key+'='+$value) } else { $content=$content.TrimEnd()+[Environment]::NewLine+$key+'='+$value+[Environment]::NewLine } }; Set-Content -Path $path -Value $content -NoNewline"

docker compose up -d backend mysql
if %errorlevel% neq 0 (
    echo.
    echo ERROR: No se pudieron levantar los servicios locales.
    echo Revise si los puertos 8000 o 3306 estan ocupados por otro programa.
    echo.
    pause
    exit /b 1
)
echo OK: Servicios levantados en segundo plano.
echo.

echo [4/5] Esperando base de datos local (healthcheck)...
set /a ATTEMPTS=0
set /a MAX_ATTEMPTS=60
:WAIT_DB
docker compose exec -T mysql healthcheck.sh --connect --innodb_initialized >nul 2>&1
if %errorlevel% neq 0 (
    set /a ATTEMPTS+=1
    if !ATTEMPTS! geq %MAX_ATTEMPTS% (
        echo.
        echo ERROR: MariaDB no respondio al healthcheck despues de %MAX_ATTEMPTS% intentos.
        echo Revise los logs con: docker compose logs mysql
        echo.
        pause
        exit /b 1
    )
    timeout /t 2 /nobreak >nul
    goto WAIT_DB
)
echo OK: Base de datos lista tras %ATTEMPTS% intento(s).
echo.

echo [5/5] Inicializando base de datos y optimizando cache...
docker compose exec backend php artisan key:generate --force
docker compose exec backend php artisan migrate --force
docker compose exec backend php artisan db:seed --class=RolesAndPermissionsSeeder --force
docker compose exec backend php artisan config:cache
docker compose exec backend php artisan route:cache
docker compose exec backend php artisan view:cache
if %errorlevel% neq 0 (
    echo.
    echo ERROR: Hubo un problema al inicializar el sistema.
    echo.
    pause
    exit /b 1
)
echo.
echo OK: Sistema inicializado.
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\install_hospital_startup_shortcut.ps1" -ProjectRoot "%~dp0" -Url "http://%SERVER_IP%:8000"

echo ======================================================================
echo        SISTEMA DE CAJA HOSPITALARIA ESTA LISTO Y EN LINEA
echo ======================================================================
echo.
echo Direcciones de acceso:
echo - Servidor:    http://localhost:8000
echo - Red local:   http://%SERVER_IP%:8000
echo.
echo IMPORTANTE:
echo Si aun no existe administrador real, creelo leyendo la clave de
echo la variable de entorno HOSPITAL_INITIAL_ADMIN_PASSWORD (no la
echo escriba en esta consola, en el historial de comandos ni en una
echo linea de shell visible para otros operadores):
echo.
echo   set HOSPITAL_INITIAL_ADMIN_PASSWORD=SuClaveTemporal
echo   docker compose exec -e HOSPITAL_INITIAL_ADMIN_PASSWORD backend ^
echo       php artisan auth:create-initial-admin ^
echo       --username=admin --email=admin@hospital.local
echo.
echo El primer inicio de sesion le pedira cambiar la clave temporal.
echo.
echo Para detener servicios sin borrar datos:
echo docker compose stop
echo.
pause
