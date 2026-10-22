#Requires -Version 5.1
# Modo LAN sin recompilar el frontend.
#
# Contrato: el paquete de produccion resuelve origen/API/cookies/realtime en
# tiempo de ejecucion (mismo origen, variables del host) y no incrusta una IP
# LAN en el build del frontend. Asi, cambiar la direccion del servidor no exige
# recompilar ni reconstruir imagenes.
#
# Es una prueba de contrato sobre los archivos reales; no levanta Docker.

$ErrorActionPreference = 'Stop'

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path

function Get-RequiredFileContent {
    param([string] $RelativePath)
    $full = Join-Path $projectRoot $RelativePath
    if (-not (Test-Path -LiteralPath $full -PathType Leaf)) {
        throw "Falta un archivo requerido por el contrato LAN: $RelativePath"
    }
    return Get-Content -LiteralPath $full -Raw
}

$script:Checks = 0

function Assert-Contains {
    param([string] $Content, [string] $Needle, [string] $Label)
    $script:Checks++
    if (-not $Content.Contains($Needle)) {
        throw "Se esperaba que $Label contuviera: $Needle"
    }
}

function Assert-NotContains {
    param([string] $Content, [string] $Needle, [string] $Label)
    $script:Checks++
    if ($Content.Contains($Needle)) {
        throw "Se esperaba que $Label NO contuviera: $Needle"
    }
}

$compose = Get-RequiredFileContent 'docker-compose.prod.yml'
$dockerfile = Get-RequiredFileContent 'backend\Dockerfile.prod'
$deploy = Get-RequiredFileContent 'scripts\deploy_hospital_lan.ps1'
$baseTs = Get-RequiredFileContent 'frontend\src\lib\api\base.ts'
$echoTs = Get-RequiredFileContent 'frontend\src\lib\realtime\echo.ts'
$echoController = Get-RequiredFileContent 'backend\app\Http\Controllers\EchoConfigController.php'

# --- 1. Enlace de red configurable en runtime por .env, no horneado en el build ---
Assert-Contains $compose '${APP_BIND_IP:-127.0.0.1}:${APP_PORT:-8000}:80' 'nginx en docker-compose.prod.yml'
Assert-Contains $compose '${SOKETI_BIND_IP:-0.0.0.0}:${SOKETI_PORT:-6001}:6001' 'soketi en docker-compose.prod.yml'
Assert-Contains $compose 'APP_URL: ${APP_SCHEME:-http}://${SERVER_IP:?SERVER_IP is required}:${APP_PORT:-8000}' 'APP_URL runtime'
Assert-Contains $compose 'SANCTUM_STATEFUL_DOMAINS: ${SERVER_IP},${SERVER_IP}:${APP_PORT:-8000}' 'Sanctum runtime'
Assert-Contains $compose 'CORS_ALLOWED_ORIGINS: ${APP_SCHEME:-http}://${SERVER_IP}:${APP_PORT:-8000}' 'CORS runtime'
Assert-Contains $compose 'PUSHER_CLIENT_HOST: ${SERVER_IP:?SERVER_IP is required}' 'Pusher host runtime'
Assert-Contains $compose 'PUSHER_CLIENT_PORT: ${SOKETI_PORT:-6001}' 'Pusher port runtime'

# --- 2. El frontend no incrusta la IP: se compila una sola vez, same-origin ---
Assert-NotContains $compose 'VITE_API_BASE_URL' 'docker-compose.prod.yml no debe inyectar VITE_API_BASE_URL en build args'
Assert-NotContains $dockerfile 'VITE_API_BASE_URL' 'Dockerfile.prod no debe fijar VITE_API_BASE_URL'
Assert-Contains $dockerfile 'RUN pnpm install --frozen-lockfile' 'El frontend se compila dentro de la imagen'
Assert-Contains $dockerfile 'RUN pnpm run build' 'El frontend se compila dentro de la imagen'
Assert-Contains $baseTs "import.meta.env.VITE_API_BASE_URL?.trim() ?? ''" 'base.ts debe usar same-origin por defecto'
Assert-Contains $baseTs 'export function resolveApiBaseUrl' 'base.ts debe exponer resolveApiBaseUrl'
Assert-Contains $baseTs "return ''" 'resolveApiBaseUrl debe poder volver a same-origin'

# --- 3. Realtime resuelto en runtime via endpoint autenticado ---
Assert-Contains $echoTs '/api/system/echo-config' 'El cliente Echo debe pedir la configuracion en runtime'
Assert-Contains $echoTs 'fetch(' 'El cliente Echo debe obtener la configuracion por HTTP'
Assert-Contains $echoController 'host' 'EchoConfigController debe devolver host'
Assert-Contains $echoController 'port' 'EchoConfigController debe devolver port'
Assert-Contains $echoController 'useTLS' 'EchoConfigController debe devolver useTLS'

# --- 4. El instalador elige el binding segun el modo (single-PC vs LAN) ---
Assert-Contains $deploy '"SERVER_IP"        = $serverIp' 'El instalador debe escribir SERVER_IP'
Assert-Contains $deploy "'0.0.0.0'" 'El instalador debe poder exponer LAN'
Assert-Contains $deploy '$installMode.LanEnabled' 'El binding debe depender del modo de instalacion'
Assert-Contains $deploy '"APP_BIND_IP"' 'El instalador debe configurar APP_BIND_IP'
Assert-Contains $deploy '"SOKETI_BIND_IP"' 'El instalador debe configurar SOKETI_BIND_IP'

Write-Host "[ OK ] LAN mode contract passed: $script:Checks checks (frontend sin recompilar por IP)."
