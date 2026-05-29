param(
    [Parameter(Mandatory = $true)]
    [string] $BaseUrl,

    [string] $ProjectRoot = "",

    [string] $PhpPath = "php",

    [string] $ReportPath = "",

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

if ($ReportPath -eq "") {
    $ReportPath = Join-Path $qaDir "FINAL_PRODUCTION_HANDOFF_RESULT.md"
}

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

    if ($content -match '(?i)\bTODO\b|\bPENDING_[A-Z_]+\b|\bREPLACE\b|\bN/A\b|\bTBD\b|\[ \]|example|template|use this file') {
        return $false
    }

    return $true
}

function Assert-ScriptExists([string] $path) {
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        throw "Missing required script: $path"
    }
}

function Add-ReportLine([System.Collections.Generic.List[string]] $lines, [string] $line = "") {
    $lines.Add($line) | Out-Null
}

function Write-HandoffReport(
    [string] $path,
    [bool] $lanProofCompleted,
    [bool] $printerProofCompleted,
    [string[]] $backupStatusOutput,
    [string[]] $preflightOutput,
    [int] $preflightExit,
    [bool] $preflightSkipped
) {
    $now = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $lines = New-Object System.Collections.Generic.List[string]
    $decision = if (-not $preflightSkipped -and $preflightExit -eq 0) { "PRODUCTION_READY" } else { "PRODUCTION_CANDIDATE" }

    Add-ReportLine $lines "# Final production handoff result"
    Add-ReportLine $lines ""
    Add-ReportLine $lines "- Generated at: $now"
    Add-ReportLine $lines "- Base URL: $($BaseUrl.TrimEnd('/'))"
    Add-ReportLine $lines "- Project root: $ProjectRoot"
    Add-ReportLine $lines "- Decision: $decision"
    Add-ReportLine $lines "- LAN client proof present without obvious placeholders: $lanProofCompleted"
    Add-ReportLine $lines "- Thermal printer proof present without obvious placeholders: $printerProofCompleted"
    Add-ReportLine $lines "- Preflight skipped: $preflightSkipped"
    Add-ReportLine $lines "- Preflight exit code: $preflightExit"
    Add-ReportLine $lines ""

    Add-ReportLine $lines "## Result"
    Add-ReportLine $lines ""
    if ($decision -eq "PRODUCTION_READY") {
        Add-ReportLine $lines "The preflight passed without bypass flags. Keep this report with the completed physical evidence files."
    } else {
        Add-ReportLine $lines "Do not declare PRODUCTION_READY. Keep the system as PRODUCTION_CANDIDATE until every blocker below is closed with real field evidence."
    }
    Add-ReportLine $lines ""

    Add-ReportLine $lines "## Blocking items"
    Add-ReportLine $lines ""
    if (-not $lanProofCompleted) {
        Add-ReportLine $lines "- Missing or incomplete qa/LAN_CLIENT_VALIDATION_PROOF.md from a real second LAN client."
    }
    if (-not $printerProofCompleted) {
        Add-ReportLine $lines "- Missing or incomplete qa/THERMAL_PRINTER_PROOF.md from the real thermal printer."
    }
    if ($preflightSkipped) {
        Add-ReportLine $lines "- Preflight was skipped in this handoff run."
    } elseif ($preflightExit -ne 0) {
        Add-ReportLine $lines "- Production preflight returned exit code $preflightExit."
    }
    if ($lanProofCompleted -and $printerProofCompleted -and -not $preflightSkipped -and $preflightExit -eq 0) {
        Add-ReportLine $lines "- None reported by the handoff script."
    }
    Add-ReportLine $lines ""

    Add-ReportLine $lines "## Next commands"
    Add-ReportLine $lines ""
    Add-ReportLine $lines '```powershell'
    Add-ReportLine $lines "powershell.exe -ExecutionPolicy Bypass -File scripts\validate_lan_client.ps1 -BaseUrl $($BaseUrl.TrimEnd('/')) -EvidencePath qa\LAN_CLIENT_VALIDATION_PROOF.md"
    Add-ReportLine $lines "powershell.exe -ExecutionPolicy Bypass -File scripts\install_backup_tasks_windows.ps1 -UpdateExisting -PhpPath $PhpPath"
    Add-ReportLine $lines "Start-ScheduledTask -TaskName HospitalBillingOS-BackupWorker"
    Add-ReportLine $lines "powershell.exe -ExecutionPolicy Bypass -File scripts\final_production_handoff.ps1 -BaseUrl $($BaseUrl.TrimEnd('/')) -PhpPath $PhpPath"
    Add-ReportLine $lines '```'
    Add-ReportLine $lines ""

    Add-ReportLine $lines "## Backup task status output"
    Add-ReportLine $lines ""
    Add-ReportLine $lines '```text'
    foreach ($line in $backupStatusOutput) {
        Add-ReportLine $lines $line
    }
    Add-ReportLine $lines '```'
    Add-ReportLine $lines ""

    Add-ReportLine $lines "## Preflight output"
    Add-ReportLine $lines ""
    Add-ReportLine $lines '```text'
    foreach ($line in $preflightOutput) {
        Add-ReportLine $lines $line
    }
    Add-ReportLine $lines '```'

    $reportDir = Split-Path -Parent $path
    if (-not (Test-Path -LiteralPath $reportDir)) {
        New-Item -ItemType Directory -Path $reportDir -Force | Out-Null
    }

    Set-Content -LiteralPath $path -Value $lines -Encoding ASCII
    Write-Host "Wrote handoff report: $path"
}

Assert-ScriptExists $preflightScript
Assert-ScriptExists $proofInitScript
Assert-ScriptExists $backupTasksScript

Write-Host "Sistema de Caja Hospitalaria final production handoff"
Write-Host "ProjectRoot: $ProjectRoot"
Write-Host "BaseUrl: $($BaseUrl.TrimEnd('/'))"
Write-Host "PhpPath: $PhpPath"

Write-Section "Proof files"
if ($InitializeProofFiles) {
    & powershell.exe -ExecutionPolicy Bypass -File $proofInitScript -ProjectRoot $ProjectRoot
}

$lanProofCompleted = Test-ProofLooksCompleted $lanProofPath
$printerProofCompleted = Test-ProofLooksCompleted $printerProofPath
Write-Result $lanProofCompleted "Second-client LAN proof file looks present; preflight performs strict validation."
Write-Result $printerProofCompleted "Physical printer proof file looks present; preflight performs strict validation."

if (-not $lanProofCompleted) {
    Write-Host "Run from the second LAN client:"
    Write-Host "powershell.exe -ExecutionPolicy Bypass -File scripts\validate_lan_client.ps1 -BaseUrl $($BaseUrl.TrimEnd('/')) -EvidencePath qa\LAN_CLIENT_VALIDATION_PROOF.md"
}

if (-not $printerProofCompleted) {
    Write-Host "Print real media carta/carta/A5 samples, then complete qa\THERMAL_PRINTER_PROOF.md with physical evidence."
}

Write-Section "Backup automation"
$backupStatusOutput = @(& powershell.exe -ExecutionPolicy Bypass -File $backupTasksScript -ProjectRoot $ProjectRoot -PhpPath $PhpPath -Status 2>&1 | ForEach-Object { $_.ToString() })
$backupStatusOutput | ForEach-Object { Write-Host $_ }
Write-Host "If tasks are missing or stale, run elevated PowerShell:"
Write-Host "powershell.exe -ExecutionPolicy Bypass -File scripts\install_backup_tasks_windows.ps1 -UpdateExisting -PhpPath $PhpPath"
Write-Host "Start-ScheduledTask -TaskName HospitalBillingOS-BackupWorker"
Write-Host "powershell.exe -ExecutionPolicy Bypass -File scripts\install_backup_tasks_windows.ps1 -Status -PhpPath $PhpPath"

if ($SkipPreflight) {
    Write-Section "Preflight skipped"
    Write-Host "SkipPreflight was used. This run cannot approve PRODUCTION_READY."
    Write-HandoffReport `
        -path $ReportPath `
        -lanProofCompleted $lanProofCompleted `
        -printerProofCompleted $printerProofCompleted `
        -backupStatusOutput $backupStatusOutput `
        -preflightOutput @("Preflight skipped by -SkipPreflight.") `
        -preflightExit 2 `
        -preflightSkipped $true
    exit 2
}

Write-Section "Production preflight"
$preflightOutput = @(& powershell.exe -ExecutionPolicy Bypass -File $preflightScript -ProjectRoot $ProjectRoot -BaseUrl $BaseUrl 2>&1 | ForEach-Object { $_.ToString() })
$preflightExit = $LASTEXITCODE
$preflightOutput | ForEach-Object { Write-Host $_ }

Write-HandoffReport `
    -path $ReportPath `
    -lanProofCompleted $lanProofCompleted `
    -printerProofCompleted $printerProofCompleted `
    -backupStatusOutput $backupStatusOutput `
    -preflightOutput $preflightOutput `
    -preflightExit $preflightExit `
    -preflightSkipped $false

if ($preflightExit -eq 0) {
    Write-Host ""
    Write-Host "PRODUCTION_READY evidence gate passed." -ForegroundColor Green
    exit 0
}

Write-Host ""
Write-Host "PRODUCTION_READY remains blocked. Keep status as PRODUCTION_CANDIDATE and close the missing evidence above." -ForegroundColor Yellow
exit $preflightExit
