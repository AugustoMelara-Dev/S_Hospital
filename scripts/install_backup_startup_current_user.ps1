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

trap {
    Write-Host (Protect-StartupText $_.Exception.Message)
    Write-Host "No borre respaldos, archivos .env, volumenes Docker ni carpetas de datos para corregir la automatizacion."
    exit 1
}

try {
    $ProjectRoot = (Resolve-Path -LiteralPath $ProjectRoot).Path
} catch {
    throw "No se pudo ubicar la carpeta del sistema. Ejecute este script desde la instalacion completa."
}

function Get-ValidatedDailyBackupTime([string] $value) {
    try {
        return [DateTime]::ParseExact($value, "HH:mm", [Globalization.CultureInfo]::InvariantCulture)
    } catch {
        throw "DailyBackupTime debe usar formato HH:mm de 24 horas, por ejemplo 02:00 o 23:30."
    }
}

function Get-ValidatedPhpSource([string] $value) {
    if (Test-Path -LiteralPath $value) {
        return "archivo configurado"
    }

    if ($value -match "[\\/]" -or $value -match "\.exe$") {
        throw "No se encontro PHP en la ruta configurada. Use -PhpPath con la ruta real de php.exe antes de activar respaldos."
    }

    $phpCommand = Get-Command $value -ErrorAction SilentlyContinue
    if ($null -eq $phpCommand) {
        throw "No se encontro PHP en el PATH del sistema. Use -PhpPath C:\xampp\php\php.exe o instale PHP antes de activar respaldos."
    }

    return "PATH del sistema"
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

$dailyBackupAt = if ($Status -or $Uninstall) {
    $null
} else {
    Get-ValidatedDailyBackupTime $DailyBackupTime
}
$phpSource = if ($Status -or $Uninstall) {
    "no requerido para esta accion"
} else {
    Get-ValidatedPhpSource $PhpPath
}

if ($WhatIfOnly) {
    Write-Host "Validacion de arranque de backups completada."
    Write-Host "Modo WhatIf: no se crea archivo de inicio, no se cambia el registro y no se inicia la automatizacion de respaldos."
    Write-Host "Hora diaria validada: $DailyBackupTime"
    Write-Host "PHP: $phpSource"
    exit 0
}

if ($Status) {
    if (Test-Path -LiteralPath $startupFile) {
        Write-Host "Automatizacion en carpeta Startup: instalada en $(Protect-StartupText $startupFile)"
        Write-Host "Contenido Startup: oculto; use paquete de soporte si se requiere revisar detalles tecnicos."
    } else {
        Write-Host "Automatizacion en carpeta Startup: no instalada para el usuario actual."
    }

    $runValue = (Get-ItemProperty -Path $runKeyPath -Name $runKeyName -ErrorAction SilentlyContinue).$runKeyName
    if ($runValue) {
        Write-Host "Automatizacion HKCU Run: instalada como $runKeyName -> $(Protect-StartupText $runValue)"
    } else {
        Write-Host "Automatizacion HKCU Run: no instalada para el usuario actual."
    }

    exit 0
}

if ($Uninstall) {
    if (Test-Path -LiteralPath $startupFile) {
        Remove-Item -LiteralPath $startupFile -Force
        Write-Host "Automatizacion Startup eliminada: $(Protect-StartupText $startupFile)"
    } else {
        Write-Host "Automatizacion Startup no estaba instalada."
    }

    Remove-ItemProperty -Path $runKeyPath -Name $runKeyName -ErrorAction SilentlyContinue
    Write-Host "Automatizacion HKCU Run eliminada si existia."

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

Write-Host "Automatizacion Startup instalada: $(Protect-StartupText $startupFile)"
Write-Host "Automatizacion HKCU Run instalada: $runKeyName"
Write-Host "Cuando este usuario inicie sesion, se iniciara la automatizacion de respaldos y el respaldo diario."

if ($StartNow) {
    $env:HOSPITAL_PHP_PATH = $PhpPath
    $env:HOSPITAL_DAILY_BACKUP_TIME = $DailyBackupTime
    & $launcher
    Write-Host "Automatizacion de respaldos iniciada para esta sesion."
}
