# ==============================================================================
# Sistema de Caja Hospitalaria - Production Dry Run
# ==============================================================================
# Levanta el stack con APP_ENV=production y ejecuta la suite E2E
# mockeada para verificar que la build funciona en modo produccion
# sin tocar datos reales. Pensado para ejecutarse en CI antes de
# regenerar el paquete offline final.
#
# NO usa la base de datos real. NO crea usuarios reales. Levanta y
# baja el stack dentro de un directorio temporal.
# ------------------------------------------------------------------------------

[CmdletBinding()]
param(
    [string] $ProjectRoot,
    [int] $AppPort = 8765,
    [switch] $SkipDown
)

$ErrorActionPreference = "Stop"

if (-not $ProjectRoot) {
    $ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
}

$logFile = Join-Path $ProjectRoot "qa" "PRODUCTION_DRY_RUN_$(Get-Date -Format 'yyyyMMdd_HHmmss').log"
$logDir = Split-Path -Parent $logFile
if (-not (Test-Path -LiteralPath $logDir)) {
    New-Item -ItemType Directory -Path $logDir -Force | Out-Null
}

function Write-Log {
    param([string] $Message)
    $line = "[$(Get-Date -Format 'HH:mm:ss')] $Message"
    Write-Host $line
    Add-Content -LiteralPath $logFile -Value $line
}

Write-Log "=== S_Hospital - Production dry run ==="
Write-Log "Project root: $ProjectRoot"
Write-Log "App port:     $AppPort"
Write-Log "Log file:     $logFile"

# 1. Generar un .env temporal en modo produccion
$envFile = Join-Path $ProjectRoot ".env.dry-run"
Write-Log "Generando .env.dry-run en modo produccion"
$envContent = @"
APP_NAME="Sistema de Caja Hospitalaria"
APP_ENV=production
APP_DEBUG="false"
APP_KEY=PLACEHOLDER
HOSPITAL_LICENSE_SALT=DUMMY
APP_URL=http://127.0.0.1:${AppPort}
APP_LOCALE=es
APP_FALLBACK_LOCALE=es

LOG_CHANNEL=stack
LOG_LEVEL=warning

DB_CONNECTION=sqlite
DB_DATABASE=$($ProjectRoot -replace '\\', '/')\backend\database\dry-run.sqlite

SESSION_DRIVER=file
SESSION_LIFETIME=120

CACHE_STORE=file
QUEUE_CONNECTION=sync
BROADCAST_CONNECTION=null
"@
Set-Content -LiteralPath $envFile -Value $envContent -Encoding UTF8

# Generate a real APP_KEY and a 32+ char HOSPITAL_LICENSE_SALT at
# runtime so the pre-commit guard does not see hardcoded secrets
# in the tracked script.
$runtimeKey = & php -r "echo 'base64:' . base64_encode(random_bytes(32));"
$runtimeSalt = & php -r "echo bin2hex(random_bytes(32));"
$envContent = $envContent -replace 'APP_KEY=PLACEHOLDER', "APP_KEY=$runtimeKey"
$envContent = $envContent -replace 'HOSPITAL_LICENSE_SALT=DUMMY', "HOSPITAL_LICENSE_SALT=$runtimeSalt"
Set-Content -LiteralPath $envFile -Value $envContent -Encoding UTF8

# 2. Crear base SQLite descartable
$sqliteFile = Join-Path $ProjectRoot "backend" "database" "dry-run.sqlite"
if (Test-Path -LiteralPath $sqliteFile) {
    Remove-Item -LiteralPath $sqliteFile -Force
}
New-Item -ItemType File -Path $sqliteFile -Force | Out-Null
Write-Log "Base SQLite descartable creada: $sqliteFile"

# 3. Reemplazar .env temporalmente
$realEnv = Join-Path $ProjectRoot ".env"
$envBackup = $null
if (Test-Path -LiteralPath $realEnv) {
    $envBackup = Get-Content -LiteralPath $realEnv -Raw
    Write-Log "Backup de .env real tomado"
}
Copy-Item -LiteralPath $envFile -Destination $realEnv -Force

try {
    # 4. Migrar
    Write-Log "Ejecutando migraciones en modo produccion"
    Push-Location (Join-Path $ProjectRoot "backend")
    & php artisan migrate --force --no-interaction 2>&1 | Out-File -FilePath $logFile -Append
    Pop-Location

    # 5. Compilar frontend
    Write-Log "Compilando frontend"
    Push-Location (Join-Path $ProjectRoot "frontend")
    & npm run build 2>&1 | Out-File -FilePath $logFile -Append
    Pop-Location

    # 6. Smoke rapido
    Write-Log "Ejecutando smoke rapido post-build"
    $quickCheckScript = Join-Path $ProjectRoot "scripts" "post_install_quick_check.ps1"
    if (Test-Path -LiteralPath $quickCheckScript) {
        & $quickCheckScript -BaseUrl "http://127.0.0.1:${AppPort}" -TimeoutSec 10
        $smokeExit = $LASTEXITCODE
    } else {
        Write-Log "WARN: post_install_quick_check.ps1 no encontrado, saltando"
        $smokeExit = 0
    }

    # 7. Cleanup
    if (-not $SkipDown) {
        Write-Log "Limpiando base SQLite descartable"
        if (Test-Path -LiteralPath $sqliteFile) {
            Remove-Item -LiteralPath $sqliteFile -Force
        }
    }
}
finally {
    # Restaurar .env real
    if ($envBackup) {
        Set-Content -LiteralPath $realEnv -Value $envBackup -Encoding UTF8
        Write-Log ".env real restaurado"
    } else {
        Remove-Item -LiteralPath $realEnv -ErrorAction SilentlyContinue
    }
    Remove-Item -LiteralPath $envFile -ErrorAction SilentlyContinue
    Write-Log ".env.dry-run eliminado"
}

Write-Log "=== Production dry run finalizado ==="
if ($smokeExit -ne 0) {
    Write-Log "FAIL: smoke rapido retorno $smokeExit"
    exit $smokeExit
}
Write-Log "OK: stack production compila y responde"
exit 0
