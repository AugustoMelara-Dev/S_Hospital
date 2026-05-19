param(
    [string] $ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path,
    [string] $PhpPath = "C:\xampp\php\php.exe",
    [string] $DailyBackupTime = "02:00",
    [switch] $Uninstall,
    [switch] $Status
)

$ErrorActionPreference = "Stop"

$startupDir = [Environment]::GetFolderPath("Startup")
$startupFile = Join-Path $startupDir "HospitalBillingOSBackupAutomation.cmd"
$launcher = Join-Path $ProjectRoot "scripts\start_backup_automation.cmd"

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

    exit 0
}

if ($Uninstall) {
    if (Test-Path -LiteralPath $startupFile) {
        Remove-Item -LiteralPath $startupFile -Force
        Write-Host "Removed startup automation: $startupFile"
    } else {
        Write-Host "Startup automation was not installed."
    }

    exit 0
}

New-Item -ItemType Directory -Force -Path $startupDir | Out-Null

$content = @"
@echo off
set "HOSPITAL_PHP_PATH=$PhpPath"
set "HOSPITAL_DAILY_BACKUP_TIME=$DailyBackupTime"
call "$launcher"
"@

Set-Content -LiteralPath $startupFile -Value $content -Encoding ASCII

Write-Host "Installed startup automation: $startupFile"
Write-Host "It will start the backup worker and daily backup scheduler when this Windows user signs in."
