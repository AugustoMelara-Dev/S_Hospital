param(
    [string] $ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path,
    [string] $PhpPath = "C:\xampp\php\php.exe",
    [string] $DailyBackupTime = "02:00",
    [switch] $Uninstall,
    [switch] $Status,
    [switch] $StartNow,
    [switch] $WhatIfOnly
)

$ErrorActionPreference = "Stop"

trap {
    Write-Host $_.Exception.Message
    Write-Host "No borre respaldos, archivos .env, volumenes Docker ni carpetas de datos para corregir la automatizacion."
    exit 1
}

$ProjectRoot = (Resolve-Path -LiteralPath $ProjectRoot).Path

function Protect-StartupText([string] $value) {
    if ([string]::IsNullOrWhiteSpace($value)) {
        return $value
    }

    $protected = $value
    $protected = $protected -replace [regex]::Escape($ProjectRoot), "%PROJECT_ROOT%"
    $protected = $protected -replace [regex]::Escape(($ProjectRoot -replace "\\", "/")), "%PROJECT_ROOT%"
    if (-not [string]::IsNullOrWhiteSpace($env:USERPROFILE)) {
        $protected = $protected -replace [regex]::Escape($env:USERPROFILE), "%USERPROFILE%"
        $protected = $protected -replace [regex]::Escape(($env:USERPROFILE -replace "\\", "/")), "%USERPROFILE%"
    }
    $protected = $protected -replace "(?i)[A-Z]:\\[^\s`"']+", "[ruta-local]"
    return $protected
}

function Get-ValidatedDailyBackupTime([string] $value) {
    try {
        return [DateTime]::ParseExact($value, "HH:mm", [Globalization.CultureInfo]::InvariantCulture)
    } catch {
        throw "DailyBackupTime debe usar formato HH:mm de 24 horas, por ejemplo 02:00 o 23:30."
    }
}

$startupDir = [Environment]::GetFolderPath("Startup")
$startupFile = Join-Path $startupDir "SistemaCajaHospitalariaBackupAutomation.cmd"
$launcher = Join-Path $ProjectRoot "scripts\start_backup_automation.cmd"
$runKeyPath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run"
$runKeyName = "SistemaCajaHospitalariaBackupAutomation"
$runKeyValue = "`"$launcher`""

if (-not (Test-Path -LiteralPath $launcher)) {
    throw "No se encontro el lanzador de automatizacion de backups: $(Protect-StartupText $launcher)"
}

Get-ValidatedDailyBackupTime $DailyBackupTime | Out-Null

if ($WhatIfOnly) {
    Write-Host "Validacion de arranque de backups completada."
    Write-Host "Modo WhatIf: no se crea archivo de inicio, no se cambia el registro y no se inicia el worker."
    Write-Host "Hora diaria validada: $DailyBackupTime"
    exit 0
}

if ($Status) {
    if (Test-Path -LiteralPath $startupFile) {
        Write-Host "Startup automation installed: $(Protect-StartupText $startupFile)"
        Get-Content -LiteralPath $startupFile
    } else {
        Write-Host "Startup automation is not installed for current user."
    }

    $runValue = (Get-ItemProperty -Path $runKeyPath -Name $runKeyName -ErrorAction SilentlyContinue).$runKeyName
    if ($runValue) {
        Write-Host "HKCU Run automation installed: $(Protect-StartupText $runValue)"
    } else {
        Write-Host "HKCU Run automation is not installed for current user."
    }

    exit 0
}

if ($Uninstall) {
    if (Test-Path -LiteralPath $startupFile) {
        Remove-Item -LiteralPath $startupFile -Force
        Write-Host "Removed startup automation: $(Protect-StartupText $startupFile)"
    } else {
        Write-Host "Startup automation was not installed."
    }

    Remove-ItemProperty -Path $runKeyPath -Name $runKeyName -ErrorAction SilentlyContinue
    Write-Host "Removed HKCU Run automation if it existed."

    exit 0
}

New-Item -ItemType Directory -Force -Path $startupDir | Out-Null

$content = @"
@echo off
set "HOSPITAL_PHP_PATH=$PhpPath"
set "HOSPITAL_DAILY_BACKUP_TIME=$DailyBackupTime"
call "$launcher"
"@

try {
    Set-Content -LiteralPath $startupFile -Value $content -Encoding ASCII
} catch [System.UnauthorizedAccessException] {
    if (-not (Test-Path -LiteralPath $startupFile)) {
        throw
    }

    Write-Host "Startup file already exists but could not be overwritten by this process. Keeping existing file: $(Protect-StartupText $startupFile)"
}
New-Item -Path $runKeyPath -Force | Out-Null
Set-ItemProperty -Path $runKeyPath -Name $runKeyName -Value $runKeyValue

Write-Host "Installed startup automation: $(Protect-StartupText $startupFile)"
Write-Host "Installed HKCU Run automation: $runKeyName"
Write-Host "It will start the backup worker and daily backup scheduler when this Windows user signs in."

if ($StartNow) {
    & $launcher
    Write-Host "Started backup automation for the current session."
}
