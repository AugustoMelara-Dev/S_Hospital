param(
    [string] $ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path,
    [string] $PhpPath = "C:\xampp\php\php.exe",
    [string] $DailyBackupTime = "02:00",
    [switch] $Uninstall,
    [switch] $Status,
    [switch] $StartNow
)

$ErrorActionPreference = "Stop"

$startupDir = [Environment]::GetFolderPath("Startup")
$startupFile = Join-Path $startupDir "HospitalBillingOSBackupAutomation.cmd"
$launcher = Join-Path $ProjectRoot "scripts\start_backup_automation.cmd"
$runKeyPath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run"
$runKeyName = "HospitalBillingOSBackupAutomation"
$runKeyValue = "`"$launcher`""

if (-not (Test-Path -LiteralPath $launcher)) {
    throw "Missing launcher at $launcher"
}

if ($Status) {
    if (Test-Path -LiteralPath $startupFile) {
        Write-Host "Startup automation installed: $startupFile"
        Get-Content -LiteralPath $startupFile
    } else {
        Write-Host "Startup automation is not installed for current user."
    }

    $runValue = (Get-ItemProperty -Path $runKeyPath -Name $runKeyName -ErrorAction SilentlyContinue).$runKeyName
    if ($runValue) {
        Write-Host "HKCU Run automation installed: $runValue"
    } else {
        Write-Host "HKCU Run automation is not installed for current user."
    }

    exit 0
}

if ($Uninstall) {
    if (Test-Path -LiteralPath $startupFile) {
        Remove-Item -LiteralPath $startupFile -Force
        Write-Host "Removed startup automation: $startupFile"
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

    Write-Host "Startup file already exists but could not be overwritten by this process. Keeping existing file: $startupFile"
}
New-Item -Path $runKeyPath -Force | Out-Null
Set-ItemProperty -Path $runKeyPath -Name $runKeyName -Value $runKeyValue

Write-Host "Installed startup automation: $startupFile"
Write-Host "Installed HKCU Run automation: $runKeyName"
Write-Host "It will start the backup worker and daily backup scheduler when this Windows user signs in."

if ($StartNow) {
    & $launcher
    Write-Host "Started backup automation for the current session."
}
