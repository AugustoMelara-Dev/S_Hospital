@echo off
REM Hospital Billing OS - Script de Despliegue LAN
REM Diseñado para Windows con compatibilidad absoluta

cd /d "%~dp0"
title "Hospital Billing OS - Instalador LAN"
cls

echo ======================================================================
echo            HOSPITAL BILLING OS - INSTALADOR Y DESPLIEGUE LAN
echo ======================================================================
echo.
echo Este asistente configurara el sistema en red local.
echo.

REM 1. Verificar si Docker esta instalado y en ejecucion
echo [1/5] Verificando requisitos de infraestructura...
where docker >nul 2>nul
if %errorlevel% neq 0 (
    echo.
    echo ERROR: Docker no esta instalado en este sistema.
    echo Por favor, instala Docker Desktop antes de continuar.
    echo.
    pause
    exit /b 1
)

docker info >nul 2>nul
if %errorlevel% neq 0 (
    echo.
    echo ERROR: Docker esta instalado pero no se esta ejecutando.
    echo Por favor, inicia Docker Desktop y vuelve a ejecutar este script.
    echo.
    pause
    exit /b 1
)
echo OK: Docker esta instalado y activo.
echo.

REM Detectar la IP LAN real de la ruta por defecto activa.
set "SERVER_IP=127.0.0.1"
for /f "tokens=4 delims= " %%a in ('route print 0.0.0.0 ^| findstr /r "^[ ]*0.0.0.0"') do (
    set "SERVER_IP=%%a"
)
if "%SERVER_IP%"=="" set "SERVER_IP=127.0.0.1"

REM 2. Compilar Frontend React usando un contenedor Docker
echo [2/5] Compilando Frontend React de forma aislada en Docker...
echo Esto puede tomar un momento...
echo.
docker run --rm -v "%~dp0frontend:/app" -w /app node:22-alpine sh -c "npm install && npm run build"
if %errorlevel% neq 0 (
    echo.
    echo ERROR: La compilacion del frontend ha fallado.
    echo.
    pause
    exit /b 1
)
echo.
echo OK: Frontend compilado con exito.
echo.

REM 3. Iniciar los servicios de Docker Compose
echo [3/5] Iniciando contenedores (Laravel API + MariaDB)...
if not exist "%~dp0backend\.env" (
    echo Creando archivo de entorno backend\.env...
    copy "%~dp0backend\.env.docker.example" "%~dp0backend\.env" > nul
)

powershell -NoProfile -ExecutionPolicy Bypass -Command "$path='%~dp0backend\.env'; $content=Get-Content -Raw $path; $ip='%SERVER_IP%'; $pairs=@{APP_URL='http://'+$ip+':8000'; CACHE_STORE='file'; SANCTUM_STATEFUL_DOMAINS='localhost,localhost:3000,localhost:5173,127.0.0.1,127.0.0.1:8000,127.0.0.1:5173,'+$ip+','+$ip+':8000,::1'}; foreach ($key in $pairs.Keys) { $value=$pairs[$key]; if ($content -match ('(?m)^'+[regex]::Escape($key)+'=')) { $content=[regex]::Replace($content,'(?m)^'+[regex]::Escape($key)+'=.*',$key+'='+$value) } else { $content=$content.TrimEnd()+[Environment]::NewLine+$key+'='+$value+[Environment]::NewLine } }; Set-Content -Path $path -Value $content -NoNewline"

docker compose down >nul 2>nul
docker compose up -d backend mysql
if %errorlevel% neq 0 (
    echo.
    echo ERROR: No se pudieron levantar los contenedores de Docker.
    echo Revisa si el puerto 8000 o 3306 estan ocupados por XAMPP u otros programas.
    echo.
    pause
    exit /b 1
)
echo OK: Contenedores levantados en segundo plano.
echo.

REM 4. Esperar a que la base de datos MariaDB este lista
echo [4/5] Esperando a que MariaDB este listo...
timeout /t 10 /nobreak >nul
echo OK: Base de datos lista.
echo.

REM 5. Ejecutar migraciones y optimizaciones
echo [5/5] Inicializando Base de Datos y optimizando cache...
docker compose exec backend php artisan key:generate --force
docker compose exec backend php artisan migrate --force --seed
docker compose exec backend php artisan config:cache
docker compose exec backend php artisan route:cache
docker compose exec backend php artisan view:cache
if %errorlevel% neq 0 (
    echo.
    echo ERROR: Hubo un problema al inicializar Laravel o migrar la DB.
    echo.
    pause
    exit /b 1
)
echo.
echo OK: Base de Datos migrada y optimizada para produccion.
echo.

echo ======================================================================
echo        HOSPITAL BILLING OS ESTA LISTO Y EN LINEA
echo ======================================================================
echo.
echo El sistema se esta ejecutando en este servidor.
echo.
echo Direcciones de Acceso LAN:
echo - Local:       http://localhost:8000
echo - Red Local:   http://%SERVER_IP%:8000
echo.
echo Instrucciones:
echo 1. Los dispositivos en la misma red LAN podran acceder ingresando a:
echo    http://%SERVER_IP%:8000
echo.
echo Para detener los servicios, ejecuta: docker compose down
echo.
pause
