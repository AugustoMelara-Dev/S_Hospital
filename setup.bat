@echo off
REM Sistema de Caja Hospitalaria - Script de despliegue LAN
REM Diseniado para Windows con compatibilidad amplia.

cd /d "%~dp0"
title "Sistema de Caja Hospitalaria - Instalador LAN"
cls

echo ======================================================================
echo       SISTEMA DE CAJA HOSPITALARIA - INSTALADOR Y DESPLIEGUE LAN
echo ======================================================================
echo.
echo Este asistente configurara el sistema en red local.
echo No borra datos ni elimina volumenes.
echo.

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

echo [4/5] Esperando base de datos local...
timeout /t 10 /nobreak >nul
echo OK: Base de datos lista.
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
echo Si aun no existe administrador real, creelo con un password temporal:
echo docker compose exec backend php artisan auth:create-initial-admin --username=admin --email=admin@hospital.local --password=CAMBIAR_ESTA_CLAVE
echo.
echo Para detener servicios sin borrar datos:
echo docker compose stop
echo.
pause
