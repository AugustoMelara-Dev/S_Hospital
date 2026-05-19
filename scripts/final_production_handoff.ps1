param(
    [Parameter(Mandatory = $true)]
    [string] $BaseUrl,

    [string] $ProjectRoot = "",

    [string] $PhpPath = "php",

    [switch] $InitializeProofFiles,

    [switch] $SkipPreflight
)

$ErrorActionPreference = "Stop"

if ($ProjectRoot -eq "") {
    $scriptRoot = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
    $ProjectRoot = (Resolve-Path (Join-Path $scriptRoot "..")).Path
}

$scriptsDir = Join-Path $ProjectRoot "scripts"
$qaDir = Join-Path $ProjectRoot "qa"
$preflightScript = Join-Path $scriptsDir "production_readiness_preflight.ps1"
$proofInitScript = Join-Path $scriptsDir "init_production_proofs.ps1"
$backupTasksScript = Join-Path $scriptsDir "install_backup_tasks_windows.ps1"
$lanProofPath = Join-Path $qaDir "LAN_CLIENT_VALIDATION_PROOF.md"
$printerProofPath = Join-Path $qaDir "THERMAL_PRINTER_PROOF.md"

function Write-Section([string] $title) {
    Write-Host ""
    Write-Host "== $title ==" -ForegroundColor Cyan
}

function Write-Result([bool] $passed, [string] $message) {
    if ($passed) {
        Write-Host "[ OK ] $message" -ForegroundColor Green
    } else {
        Write-Host "[MISS] $message" -ForegroundColor Yellow
    }
}

function Test-ProofLooksCompleted([string] $path) {
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        return $false
    }

    $content = Get-Content -LiteralPath $path -Raw
    if ($content.Trim().Length -lt 300) {
        return $false
    }

    if ($content -match '(?i)\bTODO\b|\bPENDING_[A-Z_]+\b|\bREPLACE\b|\bTBD\b|\[ \]') {
        return $false
    }

    return $true
}

function Assert-ScriptExists([string] $path) {
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        throw "Missing required script: $path"
    }
}

Assert-ScriptExists $preflightScript
Assert-ScriptExists $proofInitScript
Assert-ScriptExists $backupTasksScript

Write-Host "Hospital Billing OS final production handoff"
Write-Host "ProjectRoot: $ProjectRoot"
Write-Host "BaseUrl: $($BaseUrl.TrimEnd('/'))"
Write-Host "PhpPath: $PhpPath"

Write-Section "Proof files"
if ($InitializeProofFiles) {
    & powershell.exe -ExecutionPolicy Bypass -File $proofInitScript -ProjectRoot $ProjectRoot
}

$lanProofCompleted = Test-ProofLooksCompleted $lanProofPath
$printerProofCompleted = Test-ProofLooksCompleted $printerProofPath
Write-Result $lanProofCompleted "Second-client LAN proof completed at qa\LAN_CLIENT_VALIDATION_PROOF.md"
Write-Result $printerProofCompleted "Physical thermal-printer proof completed at qa\THERMAL_PRINTER_PROOF.md"

if (-not $lanProofCompleted) {
    Write-Host "Run from the second LAN client:"
    Write-Host "powershell.exe -ExecutionPolicy Bypass -File scripts\validate_lan_client.ps1 -BaseUrl $($BaseUrl.TrimEnd('/')) -EvidencePath qa\LAN_CLIENT_VALIDATION_PROOF.md"
}

if (-not $printerProofCompleted) {
    Write-Host "Print real 80mm and 58mm samples, then complete qa\THERMAL_PRINTER_PROOF.md with physical evidence."
}

Write-Section "Backup automation"
& powershell.exe -ExecutionPolicy Bypass -File $backupTasksScript -ProjectRoot $ProjectRoot -PhpPath $PhpPath -Status
Write-Host "If tasks are missing or stale, run elevated PowerShell:"
Write-Host "powershell.exe -ExecutionPolicy Bypass -File scripts\install_backup_tasks_windows.ps1 -UpdateExisting -PhpPath $PhpPath"
Write-Host "Start-ScheduledTask -TaskName HospitalBillingOS-BackupWorker"
Write-Host "powershell.exe -ExecutionPolicy Bypass -File scripts\install_backup_tasks_windows.ps1 -Status -PhpPath $PhpPath"

if ($SkipPreflight) {
    Write-Section "Preflight skipped"
    Write-Host "SkipPreflight was used. This run cannot approve PRODUCTION_READY."
    exit 2
}

Write-Section "Production preflight"
& powershell.exe -ExecutionPolicy Bypass -File $preflightScript -ProjectRoot $ProjectRoot -BaseUrl $BaseUrl
$preflightExit = $LASTEXITCODE

if ($preflightExit -eq 0) {
    Write-Host ""
    Write-Host "PRODUCTION_READY evidence gate passed." -ForegroundColor Green
    exit 0
}

Write-Host ""
Write-Host "PRODUCTION_READY remains blocked. Keep status as PRODUCTION_CANDIDATE and close the missing evidence above." -ForegroundColor Yellow
exit $preflightExit
