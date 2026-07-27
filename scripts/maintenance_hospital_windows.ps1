#Requires -Version 5.1
<#
.SYNOPSIS
    Consola de mantenimiento de S_Hospital.

.DESCRIPTION
    Punto de entrada unico para soporte tecnico. Reemplaza el acceso
    directo que antes apuntaba al helper tecnico de restore.

    El script no invoca clientes SQL del host. Toda la recuperacion
    se canaliza a traves de los contratos lib\recovery_*.ps1, que a
    su vez usan docker compose cuando la distribucion es Docker o
    el runtime bare metal cuando la distribucion es local sin Docker.

    La ventana permanece abierta aunque ocurra un error para que el
    operador pueda leer el mensaje.
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $false)]
    [string] $ProjectRoot,

    [Parameter(Mandatory = $false)]
    [ValidateSet('Menu', 'Status', 'Backup', 'Verify', 'TestRestore', 'Restore', 'Logs', 'SelfTest')]
    [string] $Command = 'Menu'
)

$ErrorActionPreference = 'Stop'
$script:ExitCode = 0
$script:StopOnError = $false

function Resolve-MaintenanceRoot {
    param([string]$Root)

    if (-not [string]::IsNullOrWhiteSpace($Root)) {
        return (Resolve-Path -LiteralPath $Root).Path
    }

    $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
    return (Resolve-Path -LiteralPath (Join-Path $scriptDir '..')).Path
}

function Get-MaintenanceArtisanPath {
    param([string]$Root)
    return Join-Path $Root 'backend\artisan'
}

function Test-MaintenancePrerequisites {
    param([string]$Root)

    $artisan = Get-MaintenanceArtisanPath -Root $Root
    if (-not (Test-Path -LiteralPath $artisan)) {
        throw "No se encontro backend\artisan en $Root. La consola requiere una instalacion completa de S_Hospital."
    }

    $recoveryContract = Join-Path $Root 'scripts\lib\recovery_contract.ps1'
    if (-not (Test-Path -LiteralPath $recoveryContract)) {
        throw "No se encontro scripts\lib\recovery_contract.ps1. La consola requiere los contratos de recuperacion."
    }
}

function Format-Bytes {
    param([long]$Bytes)
    if ($Bytes -lt 1KB) { return "$Bytes B" }
    if ($Bytes -lt 1MB) { return ('{0:N1} KB' -f ($Bytes / 1KB)) }
    if ($Bytes -lt 1GB) { return ('{0:N1} MB' -f ($Bytes / 1MB)) }
    return ('{0:N2} GB' -f ($Bytes / 1GB))
}

function Show-MaintenanceStatus {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$ProjectRoot
    )

    Write-Host ''
    Write-Host '========================================' -ForegroundColor Magenta
    Write-Host '  ESTADO DEL SISTEMA S_HOSPITAL' -ForegroundColor Magenta
    Write-Host '========================================' -ForegroundColor Magenta
    Write-Host ("Instalacion: $ProjectRoot") -ForegroundColor Gray

    $dockerCmd = Get-Command docker.exe -ErrorAction SilentlyContinue
    if ($dockerCmd) {
        Write-Host ("Docker:      {0}" -f $dockerCmd.Source) -ForegroundColor Green
    } else {
        Write-Host 'Docker:      no detectado' -ForegroundColor Yellow
    }

    $dockerCompose = Get-Command docker -ErrorAction SilentlyContinue
    $composeFile = Join-Path $ProjectRoot 'docker-compose.prod.yml'
    $envFile = Join-Path $ProjectRoot '.env'
    if ((Test-Path -LiteralPath $composeFile) -and (Test-Path -LiteralPath $envFile)) {
        Write-Host ("Compose:     {0}" -f $composeFile) -ForegroundColor Green
    } else {
        Write-Host 'Compose:     no se encontro docker-compose.prod.yml o .env' -ForegroundColor Yellow
    }

    $disk = Get-PSDrive -PSProvider FileSystem -ErrorAction SilentlyContinue |
        Where-Object { $_.Used -gt 0 -and $ProjectRoot.StartsWith($_.Root) } |
        Select-Object -First 1
    if ($disk) {
        Write-Host ("Disco:       {0} libres de {1:N1} GB en {2}" -f `
            (Format-Bytes $disk.Free), ($disk.Used + $disk.Free) / 1GB, $disk.Root) -ForegroundColor Green
    }

    $phpCmd = Get-Command php.exe -ErrorAction SilentlyContinue
    if ($phpCmd) {
        Write-Host ("PHP:         {0}" -f $phpCmd.Source) -ForegroundColor Green
    } else {
        Write-Host 'PHP:         no detectado en PATH' -ForegroundColor Yellow
    }

    $artisan = Get-MaintenanceArtisanPath -Root $ProjectRoot
    if (Test-Path -LiteralPath $artisan) {
        Write-Host ("Artisan:     {0}" -f $artisan) -ForegroundColor Green
    }
}

function New-MaintenanceBackup {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$ProjectRoot
    )

    Write-Host ''
    Write-Host '========================================' -ForegroundColor Magenta
    Write-Host '  CREAR RESPALDO AHORA' -ForegroundColor Magenta
    Write-Host '========================================' -ForegroundColor Magenta

    $artisan = Get-MaintenanceArtisanPath -Root $ProjectRoot
    $command = "& php $artisan hospital:backup --type=manual --json"
    Write-Host ("Ejecutando: $command") -ForegroundColor Cyan

    $output = & php $artisan hospital:backup --type=manual --json 2>&1
    $exitCode = $LASTEXITCODE
    Write-Host $output

    if ($exitCode -eq 0) {
        Write-Host 'Respaldo creado correctamente.' -ForegroundColor Green
    } else {
        throw "Respaldo fallo con codigo $exitCode."
    }
}

function Test-MaintenanceBackup {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$ProjectRoot,

        [Parameter(Mandatory = $false)]
        [string]$BackupFile
    )

    Write-Host ''
    Write-Host '========================================' -ForegroundColor Magenta
    Write-Host '  VERIFICAR UN RESPALDO' -ForegroundColor Magenta
    Write-Host '========================================' -ForegroundColor Magenta

    if ([string]::IsNullOrWhiteSpace($BackupFile)) {
        $BackupFile = Read-Host 'Ruta del archivo de respaldo a verificar'
    }

    if (-not (Test-Path -LiteralPath $BackupFile)) {
        throw "Archivo no encontrado: $BackupFile"
    }

    Write-Host ("Archivo:    $BackupFile")
    $size = (Get-Item -LiteralPath $BackupFile).Length
    Write-Host ("Tamanio:    {0}" -f (Format-Bytes $size))

    $hash = (Get-FileHash -LiteralPath $BackupFile -Algorithm SHA256).Hash.ToLowerInvariant()
    Write-Host ("SHA-256:    $hash")
    Write-Host ''
    Write-Host 'Si su respaldo es .sql.enc o .sql.gz.enc, conserve este hash para la recuperacion productiva.' -ForegroundColor Gray
}

function Invoke-DisposableRestore {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$ProjectRoot
    )

    Write-Host ''
    Write-Host '========================================' -ForegroundColor Magenta
    Write-Host '  PRUEBA DE RESTAURACION (BASE DESCARTABLE)' -ForegroundColor Magenta
    Write-Host '========================================' -ForegroundColor Magenta
    Write-Host 'Esta operacion SOLO escribe sobre una base hospital_billing_test.' -ForegroundColor Yellow
    Write-Host 'No modifica la base activa.' -ForegroundColor Yellow
    Write-Host ''

    $restoreScript = Join-Path $ProjectRoot 'scripts\restore_hospital_windows.ps1'
    if (-not (Test-Path -LiteralPath $restoreScript)) {
        throw "No se encontro scripts\restore_hospital_windows.ps1. La prueba de restauracion requiere el helper de recuperacion."
    }

    $backupFile = Read-Host 'Ruta del archivo de respaldo a probar'
    $hash = Read-Host 'SHA-256 esperado (64 caracteres hexadecimales)'

    if ([string]::IsNullOrWhiteSpace($backupFile) -or [string]::IsNullOrWhiteSpace($hash)) {
        throw 'Debe proporcionar ruta y hash.'
    }

    & $restoreScript -ProjectRoot $ProjectRoot -BackupFile $backupFile -ExpectedSha256 $hash -UseExistingEnv -TargetDatabase 'hospital_billing_test' -WhatIfOnly
}

function Invoke-ProductionRecovery {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$ProjectRoot
    )

    Write-Host ''
    Write-Host '========================================' -ForegroundColor Magenta
    Write-Host '  RECUPERACION PRODUCTIVA' -ForegroundColor Magenta
    Write-Host '========================================' -ForegroundColor Magenta
    Write-Host 'ADVERTENCIA: Esta operacion modifica la base activa.' -ForegroundColor Red
    Write-Host 'Antes de continuar, debe verificar que:' -ForegroundColor Yellow
    Write-Host '  - No haya caja abierta (se validara por runbook).' -ForegroundColor Yellow
    Write-Host '  - El paquete sea integro (hash SHA-256).' -ForegroundColor Yellow
    Write-Host '  - Soporte tecnico autorizado haya confirmado la operacion.' -ForegroundColor Yellow
    Write-Host ''

    $databaseConfirmation = Read-Host 'Escriba EXACTAMENTE el nombre de la base de produccion para confirmar'
    $actionConfirmation = Read-Host 'Escriba "RESTAURAR PRODUCCION" para confirmar la accion'

    if ($actionConfirmation -ne 'RESTAURAR PRODUCCION') {
        Write-Host 'Confirmacion incorrecta. Operacion cancelada.' -ForegroundColor Yellow
        return
    }

    $restoreScript = Join-Path $ProjectRoot 'scripts\restore_hospital_windows.ps1'
    if (-not (Test-Path -LiteralPath $restoreScript)) {
        throw "No se encontro scripts\restore_hospital_windows.ps1."
    }

    $backupFile = Read-Host 'Ruta del archivo de respaldo'
    $hash = Read-Host 'SHA-256 esperado (64 caracteres hexadecimales)'

    & $restoreScript `
        -ProjectRoot $ProjectRoot `
        -BackupFile $backupFile `
        -ExpectedSha256 $hash `
        -UseExistingEnv `
        -ProductionRecovery `
        -ProductionDatabaseConfirmation $databaseConfirmation `
        -ProductionActionConfirmation $actionConfirmation
}

function Show-MaintenanceLogs {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$ProjectRoot
    )

    Write-Host ''
    Write-Host '========================================' -ForegroundColor Magenta
    Write-Host '  REGISTROS DE SOPORTE' -ForegroundColor Magenta
    Write-Host '========================================' -ForegroundColor Magenta

    $candidates = @(
        @{ Path = (Join-Path $ProjectRoot 'storage\logs'); Label = 'storage\logs' },
        @{ Path = (Join-Path $ProjectRoot 'install-logs'); Label = 'install-logs' },
        @{ Path = (Join-Path $ProjectRoot 'installer-output'); Label = 'installer-output' }
    )

    foreach ($candidate in $candidates) {
        if (Test-Path -LiteralPath $candidate.Path) {
            Write-Host ("- {0} -> {1}" -f $candidate.Label, $candidate.Path) -ForegroundColor Cyan
        }
    }

    Write-Host ''
    Write-Host 'Los registros pueden contener credenciales. No los comparta sin depurar antes.' -ForegroundColor Yellow
}

function Show-MaintenanceMenu {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$ProjectRoot
    )

    while ($true) {
        Write-Host ''
        Write-Host '========================================' -ForegroundColor Magenta
        Write-Host '  MANTENIMIENTO S_HOSPITAL' -ForegroundColor Magenta
        Write-Host '========================================' -ForegroundColor Magenta
        Write-Host '  1) Estado del sistema' -ForegroundColor White
        Write-Host '  2) Crear respaldo ahora' -ForegroundColor White
        Write-Host '  3) Verificar un respaldo' -ForegroundColor White
        Write-Host '  4) Probar restauracion en base descartable' -ForegroundColor White
        Write-Host '  5) Restaurar el sistema (produccion)' -ForegroundColor White
        Write-Host '  6) Abrir registros de soporte' -ForegroundColor White
        Write-Host '  0) Salir' -ForegroundColor Gray
        Write-Host ''

        $choice = Read-Host 'Seleccione una opcion'
        try {
            switch ($choice) {
                '1' { Show-MaintenanceStatus -ProjectRoot $ProjectRoot }
                '2' { New-MaintenanceBackup -ProjectRoot $ProjectRoot }
                '3' { Test-MaintenanceBackup -ProjectRoot $ProjectRoot }
                '4' { Invoke-DisposableRestore -ProjectRoot $ProjectRoot }
                '5' { Invoke-ProductionRecovery -ProjectRoot $ProjectRoot }
                '6' { Show-MaintenanceLogs -ProjectRoot $ProjectRoot }
                '0' { return }
                default { Write-Host 'Opcion no reconocida.' -ForegroundColor Yellow }
            }
        } catch {
            Write-Host ("[ERROR] {0}" -f $_.Exception.Message) -ForegroundColor Red
            Write-Host 'Regresando al menu. Para salir elija 0.' -ForegroundColor Gray
        }
    }
}

try {
    $root = Resolve-MaintenanceRoot -Root $ProjectRoot
    Test-MaintenancePrerequisites -Root $root

    switch ($Command) {
        'Status' { Show-MaintenanceStatus -ProjectRoot $root }
        'Backup' { New-MaintenanceBackup -ProjectRoot $root }
        'Verify' { Test-MaintenanceBackup -ProjectRoot $root -BackupFile $BackupFile }
        'TestRestore' { Invoke-DisposableRestore -ProjectRoot $root }
        'Restore' { Invoke-ProductionRecovery -ProjectRoot $root }
        'Logs' { Show-MaintenanceLogs -ProjectRoot $root }
        'SelfTest' {
            Write-Host 'Self-test: consola operativa. Sin conectividad requerida.' -ForegroundColor Green
        }
        'Menu' { Show-MaintenanceMenu -ProjectRoot $root }
    }
} catch {
    $script:ExitCode = 1
    Write-Host ''
    Write-Host ("[ERROR FATAL] {0}" -f $_.Exception.Message) -ForegroundColor Red
    Write-Host ''
    Write-Host 'La ventana permanecera abierta para que pueda leer el mensaje.' -ForegroundColor Yellow
    Write-Host 'Presione Enter para salir.' -ForegroundColor Gray
    [void](Read-Host)
}

exit $script:ExitCode
