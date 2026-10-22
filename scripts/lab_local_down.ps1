#Requires -Version 5.1
<#
.SYNOPSIS
    Detiene el laboratorio local NO-Docker y dropea su base desechable.

.DESCRIPTION
    Solo actua sobre lo que scripts\lab_local_up.ps1 registro en su archivo de
    estado:
      - detiene el backend (artisan serve) y el frontend (vite) por PID,
        verificando la linea de comandos antes de matar;
      - dropea sh_ai_lab_local (nunca otra base);
      - opcionalmente elimina backend/.env.local.

    Nunca detiene el servicio mysqld de XAMPP ni toca bases ajenas.

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File scripts\lab_local_down.ps1
#>
param(
    [string] $ProjectRoot = (Split-Path -Parent $PSScriptRoot),
    [string] $MySqlExe = 'C:\xampp\mysql\bin\mysql.exe',
    [string] $DatabaseName = '',
    [string] $DatabaseUser = '',
    [switch] $KeepDatabase,
    [switch] $RemoveEnvFile
)

$ErrorActionPreference = 'Stop'

. (Join-Path $PSScriptRoot 'lib\lab_local.ps1')

$projectRoot = Assert-LabLocalRoot -ProjectRoot $ProjectRoot
$paths = Get-LabLocalPaths -ProjectRoot $projectRoot

$state = Read-LabLocalState -StateFile $paths.StateFile

Write-Host ''
Write-Host '=== S_Hospital - LAB LOCAL DOWN ===' -ForegroundColor Cyan

$stoppedAnything = $false

if ($null -eq $state) {
    Write-Host 'No lab state file found; nothing registered to stop.' -ForegroundColor Yellow
} else {
    if ([string]::IsNullOrWhiteSpace($DatabaseName)) {
        $DatabaseName = [string] $state.database
    }

    Assert-LabLocalDatabaseName -DatabaseName $DatabaseName

    $frontendPid = [int] $state.frontend_pid
    if ($frontendPid -gt 0) {
        $result = Stop-LabLocalProcessTree -ProcessId $frontendPid -ExpectedMarker 'run_frontend.cmd'
        Write-Host "Frontend PID $frontendPid -> $result"
        if ($result -eq 'stopped') { $stoppedAnything = $true }
    }

    $backendPid = [int] $state.backend_pid
    if ($backendPid -gt 0) {
        $result = Stop-LabLocalProcessTree -ProcessId $backendPid -ExpectedMarker 'run_backend.cmd'
        Write-Host "Backend  PID $backendPid -> $result"
        if ($result -eq 'stopped') { $stoppedAnything = $true }
    }

    foreach ($launcher in @($paths.FrontendLauncher, $paths.BackendLauncher)) {
        if (Test-Path -LiteralPath $launcher) {
            Remove-Item -LiteralPath $launcher -Force -ErrorAction SilentlyContinue
        }
    }
}

# Barrido por puerto: limpia huerfanos que un `down` anterior (o un timeout del
# llamador) pudo dejar vivos. Sin esto, el siguiente `up` no puede bindear.
$sweepBackendPort = $script:LabLocalDefaultBackendPort
$sweepFrontendPort = $script:LabLocalDefaultFrontendPort
if ($null -ne $state) {
    if ([int] $state.backend_port -gt 0) { $sweepBackendPort = [int] $state.backend_port }
    if ([int] $state.frontend_port -gt 0) { $sweepFrontendPort = [int] $state.frontend_port }
}

$orphans = Stop-LabLocalOrphanProcesses -BackendPort $sweepBackendPort -FrontendPort $sweepFrontendPort
if ($orphans.Count -gt 0) {
    foreach ($orphan in $orphans) {
        Write-Host "Huerfano $($orphan.Role) PID $($orphan.ProcessId) ($($orphan.Name)) detenido." -ForegroundColor Yellow
    }
    $stoppedAnything = $true
} else {
    Write-Host 'Sin huerfanos en los puertos del laboratorio.' -ForegroundColor DarkGray
}

if ([string]::IsNullOrWhiteSpace($DatabaseName)) {
    $DatabaseName = $script:LabLocalDefaultDbName
}
Assert-LabLocalDatabaseName -DatabaseName $DatabaseName

if ([string]::IsNullOrWhiteSpace($DatabaseUser)) {
    if ($null -ne $state -and -not [string]::IsNullOrWhiteSpace([string] $state.database_user)) {
        $DatabaseUser = [string] $state.database_user
    } else {
        $DatabaseUser = $DatabaseName
    }
}

if (-not $KeepDatabase) {
    $mySqlExe = Assert-LabLocalMySqlClient -MySqlExe $MySqlExe
    Test-LabLocalMySqlServer -MySqlExe $mySqlExe | Out-Null

    if (Test-LabLocalDatabaseExists -MySqlExe $mySqlExe -DatabaseName $DatabaseName) {
        Remove-LabLocalDatabase -MySqlExe $mySqlExe -DatabaseName $DatabaseName
        Write-Host "Base desechable '$DatabaseName' dropeada." -ForegroundColor Green
    } else {
        Write-Host "Base '$DatabaseName' ya no existia." -ForegroundColor DarkGray
    }

    if ($DatabaseUser -match '^sh_ai_lab_[A-Za-z0-9_]{1,24}$') {
        Remove-LabLocalDatabaseUser -MySqlExe $mySqlExe -Username $DatabaseUser
        Write-Host "Usuario MariaDB '$DatabaseUser' dropeado." -ForegroundColor Green
    }
} else {
    Write-Host "-KeepDatabase: se conservan '$DatabaseName' y el usuario '$DatabaseUser'." -ForegroundColor Yellow
}

if ($RemoveEnvFile -and (Test-Path -LiteralPath $paths.EnvFile)) {
    Assert-LabLocalEnvFileIsOurs -EnvFile $paths.EnvFile
    Remove-Item -LiteralPath $paths.EnvFile -Force
    Write-Host "Entorno de laboratorio eliminado: $($paths.EnvFile)" -ForegroundColor Green
}

if (Test-Path -LiteralPath $paths.StateFile) {
    Remove-Item -LiteralPath $paths.StateFile -Force
}

Write-Host ''
if ($stoppedAnything) {
    Write-Host 'LAB LOCAL DETENIDO.' -ForegroundColor Green
} else {
    Write-Host 'LAB LOCAL DETENIDO (o ya estaba detenido).' -ForegroundColor Green
}
Write-Host 'El servicio mysqld de XAMPP no fue modificado.' -ForegroundColor DarkGray
Write-Host ''
