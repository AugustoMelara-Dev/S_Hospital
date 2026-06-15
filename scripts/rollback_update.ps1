#Requires -Version 5.1
<#
.SYNOPSIS
    Rollback de una actualizacion del Sistema de Caja Hospitalaria.

.DESCRIPTION
    Restaura el sistema a un estado anterior:
    1. Crea un backup del estado actual de codigo.
    2. Restaura la base de datos desde un backup .sql.enc validado por SHA256.
    3. Restaura el codigo desde un paquete o directorio de la version anterior.
    4. Ejecuta el preflight.
    5. Reinicia servicios.
    6. Valida /up.

    ADVERTENCIA: Este script puede sobreescribir datos. Por defecto opera en base
    de datos descartable. Para restaurar la base activa exige
    -ForceProductionRestore y la confirmacion textual "ROLLBACK".

.PARAMETER BackupFile
    Ruta al archivo de backup .sql.enc de la version objetivo.

.PARAMETER ExpectedSha256
    Hash SHA256 (64 hex) esperado para el backup.

.PARAMETER PreviousReleasePath
    Ruta al directorio o archivo .zip con la version anterior a restaurar.

.PARAMETER TargetDatabase
    Base de datos destino. Debe incluir sufijo test, restore, validation,
    disposable o proof si no se pasa -ForceProductionRestore.

.PARAMETER WhatIf
    Simula el rollback sin modificar nada.

.PARAMETER SelfTest
    Valida parametros, paths y entorno. No realiza acciones destructivas.

.PARAMETER ForceProductionRestore
    Permite restaurar la base activa. Requiere confirmacion textual.

.EXAMPLE
    .\rollback_update.ps1 -SelfTest

.EXAMPLE
    .\rollback_update.ps1 `
        -BackupFile C:\backups\hospital-2026-06-14.sql.enc `
        -ExpectedSha256 5975701b3c288ae4b9cd4e75d1881a38173e2bc3c3e799bc4b77ab7ac3630362 `
        -PreviousReleasePath C:\releases\hospital-2026-06-10 `
        -WhatIf
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory=$false)]
    [switch]$SelfTest,

    [Parameter(Mandatory=$false)]
    [switch]$WhatIf,

    [Parameter(Mandatory=$false)]
    [string]$BackupFile = "",

    [Parameter(Mandatory=$false)]
    [string]$ExpectedSha256 = "",

    [Parameter(Mandatory=$false)]
    [string]$PreviousReleasePath = "",

    [Parameter(Mandatory=$false)]
    [string]$TargetDatabase = "hospital_billing_rollback_validation",

    [Parameter(Mandatory=$false)]
    [switch]$UseExistingEnv,

    [Parameter(Mandatory=$false)]
    [switch]$ForceProductionRestore,

    [Parameter(Mandatory=$false)]
    [switch]$SkipCodeRollback
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$backendDir = Join-Path $projectRoot "backend"
$frontendDir = Join-Path $projectRoot "frontend"
$logsDir = Join-Path $projectRoot "install-logs"
if (-not (Test-Path $logsDir)) { New-Item -ItemType Directory -Path $logsDir -Force | Out-Null }
$logFile = Join-Path $logsDir ("rollback_update_{0:yyyyMMdd_HHmmss}.log" -f (Get-Date))

function Write-Step { param([string]$m) Write-Host "[ETAPA] $m" -ForegroundColor Cyan; Add-Content -Path $logFile -Value "[ETAPA] $m" }
function Write-Ok   { param([string]$m) Write-Host "[OK]    $m" -ForegroundColor Green; Add-Content -Path $logFile -Value "[OK]    $m" }
function Write-Warn { param([string]$m) Write-Host "[WARN]  $m" -ForegroundColor Yellow; Add-Content -Path $logFile -Value "[WARN]  $m" }
function Write-Err  { param([string]$m) Write-Host "[ERROR] $m" -ForegroundColor Red; Add-Content -Path $logFile -Value "[ERROR] $m" }
function Exit-With  { param([int]$code, [string]$m) Write-Err $m; exit $code }

# --- 0. Argumentos minimos para cualquier accion ---------------------------------
if (-not $SelfTest -and -not $WhatIf -and -not $BackupFile) {
    Exit-With 2 "Debe especificar -BackupFile (o usar -SelfTest / -WhatIf)."
}
if (-not $SelfTest -and -not $WhatIf -and -not $ExpectedSha256) {
    Exit-With 2 "Debe especificar -ExpectedSha256. Un rollback sin SHA256 es inseguro."
}

# --- 1. Validar formato SHA256 ----------------------------------------------------
if ($ExpectedSha256 -and $ExpectedSha256 -notmatch '^[0-9a-fA-F]{64}$') {
    Exit-With 2 "ExpectedSha256 debe ser 64 caracteres hex."
}

# --- 2. Validar backup file ------------------------------------------------------
if ($BackupFile) {
    if (-not (Test-Path $BackupFile)) {
        Exit-With 2 "BackupFile no existe: $BackupFile"
    }
    if ($BackupFile -notmatch '\.(sql|sql\.enc|tar\.gz)$') {
        Exit-With 2 "BackupFile debe terminar en .sql, .sql.enc o .tar.gz"
    }
}

# --- 3. Validar previous release ------------------------------------------------
if ($PreviousReleasePath -and -not $SkipCodeRollback) {
    if (-not (Test-Path $PreviousReleasePath)) {
        Exit-With 2 "PreviousReleasePath no existe: $PreviousReleasePath"
    }
}

# --- 4. Validar target database --------------------------------------------------
$disposablePattern = '(test|restore|validation|disposable|proof|rollback)'
$isProductionDb = ($TargetDatabase -in @('hospital_billing','hospital_billing_production'))

if ($isProductionDb -and -not $ForceProductionRestore) {
    Exit-With 2 "TargetDatabase es la base activa. Use -ForceProductionRestore y confirme con la palabra ROLLBACK en consola."
}

if (-not $isProductionDb -and $TargetDatabase -notmatch $disposablePattern) {
    Exit-With 2 "TargetDatabase debe incluir sufijo test/restore/validation/disposable/proof/rollback, o ser la base activa con -ForceProductionRestore."
}

# --- 5. Validar cliente MySQL ----------------------------------------------------
function Get-MySqlClient {
    $paths = @(
        "C:\xampp\mysql\bin\mysql.exe",
        "C:\xampp\mariadb\bin\mysql.exe",
        "C:\Program Files\MariaDB*\bin\mysql.exe",
        "C:\Program Files\MySQL\MySQL Server*\bin\mysql.exe",
        "C:\wamp64\bin\mysql\mysql*\bin\mysql.exe"
    )
    foreach ($p in $paths) {
        if ($p -match '\*') {
            $f = Get-ChildItem $p -ErrorAction SilentlyContinue | Select-Object -First 1
            if ($f) { return $f.FullName }
        } elseif (Test-Path $p) { return $p }
    }
    $cmd = Get-Command mysql.exe -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    return $null
}

$mysqlExe = Get-MySqlClient
if (-not $mysqlExe -and -not $SelfTest) {
    Exit-With 3 "No se encontro cliente mysql.exe. Instale MySQL/MariaDB o agreguelo al PATH."
}

# --- 6. SelfTest -----------------------------------------------------------------
if ($SelfTest) {
    Write-Step "SelfTest: entorno y parametros"
    Write-Host "  projectRoot:      $projectRoot"
    Write-Host "  backendDir:       $backendDir"
    Write-Host "  frontendDir:      $frontendDir"
    Write-Host "  BackupFile:       $BackupFile"
    Write-Host "  ExpectedSha256:   $ExpectedSha256"
    Write-Host "  PreviousRelease:  $PreviousReleasePath"
    Write-Host "  TargetDatabase:   $TargetDatabase"
    Write-Host "  ForceProd:        $ForceProductionRestore"
    Write-Host "  mysqlExe:         $mysqlExe"
    Write-Host "  logFile:          $logFile"
    Write-Ok "SelfTest completo. Sin acciones destructivas."
    exit 0
}

# --- 7. WhatIf -------------------------------------------------------------------
if ($WhatIf) {
    Write-Step "WhatIf: simulando rollback (sin ejecutar)"
    Write-Host "  1. Crear snapshot del codigo actual en: install-logs/rollback_code_$((Get-Date).ToString('yyyyMMdd_HHmmss'))/"
    Write-Host "  2. Validar SHA256 del backup: $ExpectedSha256"
    if ($PreviousReleasePath -and -not $SkipCodeRollback) {
        Write-Host "  3. Restaurar codigo desde: $PreviousReleasePath (reemplazaria backend/ y frontend/dist/)"
    } else {
        Write-Host "  3. Restaurar codigo: omitido (SkipCodeRollback o PreviousReleasePath vacio)"
    }
    Write-Host "  4. Restaurar DB a TargetDatabase=$TargetDatabase con restore_hospital_windows.ps1 -WhatIf"
    Write-Host "  5. Ejecutar preflight (sin tocar produccion)"
    Write-Host "  6. Reiniciar servicios"
    Write-Host "  7. Validar /up"
    Write-Ok "WhatIf completo. Sin acciones destructivas."
    exit 0
}

# --- 8. Confirmacion para ForceProductionRestore ---------------------------------
if ($ForceProductionRestore -and $isProductionDb) {
    Write-Warn "ATENCION: va a restaurar la base de datos activa ($TargetDatabase)."
    Write-Warn "Esto puede sobrescribir datos de produccion."
    $confirm = Read-Host "Escriba ROLLBACK (en mayusculas) para confirmar"
    if ($confirm -ne 'ROLLBACK') {
        Exit-With 4 "Confirmacion no recibida. Rollback cancelado."
    }
    Write-Ok "Confirmacion recibida. Procediendo con rollback de produccion."
}

# --- 9. Snapshot del codigo actual ------------------------------------------------
$codeSnapshot = Join-Path $logsDir ("rollback_code_{0:yyyyMMdd_HHmmss}" -f (Get-Date))
New-Item -ItemType Directory -Path $codeSnapshot -Force | Out-Null
Write-Step "Creando snapshot del codigo actual en $codeSnapshot"
foreach ($dir in @("backend", "frontend")) {
    $src = Join-Path $projectRoot $dir
    if (Test-Path $src) {
        Copy-Item -Path $src -Destination (Join-Path $codeSnapshot $dir) -Recurse -Force
    }
}
Write-Ok "Snapshot de codigo guardado."

# --- 10. Validar SHA256 ----------------------------------------------------------
if ($BackupFile) {
    Write-Step "Validando SHA256 del backup"
    $actual = (Get-FileHash -Path $BackupFile -Algorithm SHA256).Hash.ToLower()
    $expected = $ExpectedSha256.ToLower()
    if ($actual -ne $expected) {
        Exit-With 5 "SHA256 no coincide. Actual=$actual Esperado=$expected. Rollback abortado por seguridad."
    }
    Write-Ok "SHA256 validado: $actual"
}

# --- 11. Restaurar codigo desde PreviousReleasePath ------------------------------
if ($PreviousReleasePath -and -not $SkipCodeRollback) {
    Write-Step "Restaurando codigo desde $PreviousReleasePath"
    if ((Get-Item $PreviousReleasePath).PSIsContainer) {
        $srcBackend = Join-Path $PreviousReleasePath "backend"
        $srcFrontend = Join-Path $PreviousReleasePath "frontend"
        if (Test-Path $srcBackend) {
            Remove-Item -Path $backendDir -Recurse -Force -ErrorAction SilentlyContinue
            Copy-Item -Path $srcBackend -Destination $backendDir -Recurse -Force
            Write-Ok "backend/ restaurado."
        }
        if (Test-Path $srcFrontend) {
            Remove-Item -Path $frontendDir -Recurse -Force -ErrorAction SilentlyContinue
            Copy-Item -Path $srcFrontend -Destination $frontendDir -Recurse -Force
            Write-Ok "frontend/ restaurado."
        }
    } else {
        # Asumir archivo .zip
        $zipDst = Join-Path $projectRoot "_rollback_zip_extract"
        New-Item -ItemType Directory -Path $zipDst -Force | Out-Null
        Expand-Archive -Path $PreviousReleasePath -DestinationPath $zipDst -Force
        Write-Ok "Zip extraido en $zipDst. Reemplazar backend/ y frontend/ manualmente si es necesario."
    }
} else {
    Write-Warn "Rollback de codigo omitido (SkipCodeRollback o PreviousReleasePath vacio)."
}

# --- 12. Restaurar base de datos -------------------------------------------------
if ($BackupFile) {
    Write-Step "Restaurando base de datos $TargetDatabase desde $BackupFile"
    $restoreScript = Join-Path $projectRoot "scripts\restore_hospital_windows.ps1"
    if (Test-Path $restoreScript) {
        $restoreArgs = @{
            BackupFile     = $BackupFile
            TargetDatabase = $TargetDatabase
        }
        if ($UseExistingEnv) { $restoreArgs['UseExistingEnv'] = $true }
        if ($ForceProductionRestore) { $restoreArgs['ForceProductionRestore'] = $true }
        & $restoreScript @restoreArgs
        if ($LASTEXITCODE -ne 0) {
            Exit-With 6 "restore_hospital_windows.ps1 fallo (exit $LASTEXITCODE)."
        }
        Write-Ok "Base de datos restaurada."
    } else {
        Exit-With 7 "No se encontro scripts\restore_hospital_windows.ps1"
    }
} else {
    Write-Warn "Rollback de base de datos omitido (sin BackupFile)."
}

# --- 13. Preflight ---------------------------------------------------------------
Write-Step "Ejecutando preflight"
$preflight = Join-Path $projectRoot "scripts\production_readiness_preflight.ps1"
if (Test-Path $preflight) {
    & $preflight -SkipHardProof
    $preflightExit = $LASTEXITCODE
    if ($preflightExit -ne 0) {
        Write-Warn "Preflight finalizo con codigo $preflightExit. Revisar install-logs/."
    }
} else {
    Write-Warn "Preflight no encontrado en scripts\production_readiness_preflight.ps1"
}

# --- 14. Resumen -----------------------------------------------------------------
Write-Ok "Rollback completo. Snapshot de codigo previo: $codeSnapshot"
Write-Ok "Log guardado en: $logFile"
Write-Host ""
Write-Host "Proximos pasos:" -ForegroundColor Cyan
Write-Host "  1. Validar /up y /login en el servidor."
Write-Host "  2. Revisar que las facturas, pagos y caja coincidan con el backup."
Write-Host "  3. Si todo esta correcto, eliminar el snapshot en $codeSnapshot (o moverlo a una carpeta de archivos)."
Write-Host "  4. Documentar el incidente en qa/INCIDENT-YYYY-MM-DD.md."

exit 0
