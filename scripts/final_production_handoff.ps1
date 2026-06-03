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

$scriptRoot = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
. (Join-Path $scriptRoot "lib\operational_url_safety.ps1")

trap {
    Write-Host (Protect-HospitalOperationalText $_.Exception.Message $ProjectRoot)
    Write-Host "No se genero handoff final. Revise que BaseUrl use solo http://IP-DEL-SERVIDOR:8000 y no incluya usuario, contrasena ni token."
    exit 1
}

if ($ProjectRoot -eq "") {
    $ProjectRoot = (Resolve-Path (Join-Path $scriptRoot "..")).Path
}

$BaseUrl = Test-HospitalOperationalUrlInput $BaseUrl

$scriptsDir = Join-Path $ProjectRoot "scripts"
$qaDir = Join-Path $ProjectRoot "qa"
$preflightScript = Join-Path $scriptsDir "production_readiness_preflight.ps1"
$proofInitScript = Join-Path $scriptsDir "init_production_proofs.ps1"
$backupTasksScript = Join-Path $scriptsDir "install_backup_tasks_windows.ps1"
$releaseGuardScript = Join-Path $scriptsDir "assert_offline_release_clean.ps1"
$evidenceIndexScript = Join-Path $scriptsDir "validate_ops_evidence_index.ps1"
$trainingSafetyScript = Join-Path $scriptsDir "validate_training_safety.ps1"
$supportPacketSafetyScript = Join-Path $scriptsDir "validate_support_packet_safety.ps1"
$startupRepairSafetyScript = Join-Path $scriptsDir "validate_startup_repair_safety.ps1"
$operatorManualsSafetyScript = Join-Path $scriptsDir "validate_operator_manuals_safety.ps1"
$backupRestoreDocsSafetyScript = Join-Path $scriptsDir "validate_backup_restore_docs_safety.ps1"
$lanProofPath = Join-Path $qaDir "LAN_CLIENT_VALIDATION_PROOF.md"
$printerProofPath = Join-Path $qaDir "INSTITUTIONAL_RECEIPT_PRINT_PROOF.md"
$restoreProofPath = Join-Path $qaDir "FINAL_RESTORE_PROOF.md"
$concurrencyProofPath = Join-Path $qaDir "FINAL_CONCURRENCY_PROOF.md"

if ($ReportPath -eq "") {
    $ReportPath = Join-Path $qaDir "FINAL_PRODUCTION_HANDOFF_RESULT.md"
}

function Resolve-HandoffReportPath([string] $path) {
    if ([string]::IsNullOrWhiteSpace($path)) {
        Write-Host "ReportPath es obligatorio."
        exit 1
    }

    if ([System.IO.Path]::GetExtension($path) -ne ".md") {
        Write-Host "ReportPath debe ser un archivo Markdown (.md) dentro de qa."
        exit 1
    }

    $candidate = if ([System.IO.Path]::IsPathRooted($path)) {
        $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($path)
    } else {
        Join-Path $ProjectRoot $path
    }

    $fullPath = [System.IO.Path]::GetFullPath($candidate)
    $qaRoot = [System.IO.Path]::GetFullPath($qaDir)
    $qaPrefix = $qaRoot.TrimEnd("\") + "\"

    if ($fullPath -eq $qaRoot -or -not $fullPath.StartsWith($qaPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
        Write-Host "ReportPath debe quedarse dentro de la carpeta qa del sistema."
        exit 1
    }

    return $fullPath
}

$ReportPath = Resolve-HandoffReportPath $ReportPath

function Write-Section([string] $title) {
    Write-Host ""
    Write-Host "== $title ==" -ForegroundColor Cyan
}

function Write-Result([bool] $passed, [string] $passedMessage, [string] $failedMessage) {
    if ($passed) {
        Write-Host "[ OK ] $passedMessage" -ForegroundColor Green
    } else {
        Write-Host "[MISS] $failedMessage" -ForegroundColor Yellow
    }
}

function Get-ProofFieldValue([string] $content, [string] $fieldLabel) {
    $prefix = "- ${fieldLabel}:"
    foreach ($line in ($content -split "`r?`n")) {
        $trimmed = $line.Trim()
        if ($trimmed.StartsWith($prefix, [System.StringComparison]::OrdinalIgnoreCase)) {
            return $trimmed.Substring($prefix.Length).Trim()
        }
    }

    return $null
}

function Test-ProofReferencedLocalEvidenceExists([string] $content, [string] $fieldLabel) {
    $value = Get-ProofFieldValue $content $fieldLabel
    if ($null -eq $value -or $value.Trim() -eq "") {
        return $true
    }

    $reference = $value.Trim()
    if ([System.IO.Path]::IsPathRooted($reference)) {
        return $false
    }

    $looksLikeRepoPath = $reference -match '^(qa|docs|scripts|frontend|backend)[\\/]'
    if (-not $looksLikeRepoPath) {
        return $true
    }

    if ($reference -notmatch '^qa[\\/]' -or $reference -match '(^|[\\/])\.\.([\\/]|$)') {
        return $false
    }

    $candidate = Join-Path $ProjectRoot $reference

    return Test-Path -LiteralPath $candidate
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

    if (-not (Test-ProofReferencedLocalEvidenceExists $content "Evidence/capture reference")) {
        return $false
    }

    if (-not (Test-ProofReferencedLocalEvidenceExists $content "Evidence/photo reference")) {
        return $false
    }

    return $true
}

function Assert-ScriptExists([string] $path) {
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        throw "Missing required script: $path"
    }
}

function Invoke-EvidenceIndexGuard([string] $handoffPath) {
    Write-Section "Evidence index validation"
    $output = @(& powershell.exe -ExecutionPolicy Bypass -File $evidenceIndexScript -ProjectRoot $ProjectRoot -HandoffPath $handoffPath 2>&1 | ForEach-Object { $_.ToString() })
    $exitCode = $LASTEXITCODE
    $output | ForEach-Object { Write-Host (Protect-HandoffText $_) }

    return @{
        Output = $output
        ExitCode = $exitCode
    }
}

function Invoke-TrainingSafetyGuard {
    Write-Section "Training safety validation"
    $output = @(& powershell.exe -ExecutionPolicy Bypass -File $trainingSafetyScript -ProjectRoot $ProjectRoot 2>&1 | ForEach-Object { $_.ToString() })
    $exitCode = $LASTEXITCODE
    $output | ForEach-Object { Write-Host (Protect-HandoffText $_) }

    return @{
        Output = $output
        ExitCode = $exitCode
    }
}

function Invoke-SupportPacketSafetyGuard {
    Write-Section "Support packet safety validation"
    $output = @(& powershell.exe -ExecutionPolicy Bypass -File $supportPacketSafetyScript -ProjectRoot $ProjectRoot 2>&1 | ForEach-Object { $_.ToString() })
    $exitCode = $LASTEXITCODE
    $output | ForEach-Object { Write-Host (Protect-HandoffText $_) }

    return @{
        Output = $output
        ExitCode = $exitCode
    }
}

function Invoke-StartupRepairSafetyGuard {
    Write-Section "Startup and repair safety validation"
    $output = @(& powershell.exe -ExecutionPolicy Bypass -File $startupRepairSafetyScript -ProjectRoot $ProjectRoot 2>&1 | ForEach-Object { $_.ToString() })
    $exitCode = $LASTEXITCODE
    $output | ForEach-Object { Write-Host (Protect-HandoffText $_) }

    return @{
        Output = $output
        ExitCode = $exitCode
    }
}

function Invoke-OperatorManualsSafetyGuard {
    Write-Section "Operator manuals safety validation"
    $output = @(& powershell.exe -ExecutionPolicy Bypass -File $operatorManualsSafetyScript -ProjectRoot $ProjectRoot 2>&1 | ForEach-Object { $_.ToString() })
    $exitCode = $LASTEXITCODE
    $output | ForEach-Object { Write-Host (Protect-HandoffText $_) }

    return @{
        Output = $output
        ExitCode = $exitCode
    }
}

function Invoke-BackupRestoreDocsSafetyGuard {
    Write-Section "Backup and restore docs safety validation"
    $output = @(& powershell.exe -ExecutionPolicy Bypass -File $backupRestoreDocsSafetyScript -ProjectRoot $ProjectRoot 2>&1 | ForEach-Object { $_.ToString() })
    $exitCode = $LASTEXITCODE
    $output | ForEach-Object { Write-Host (Protect-HandoffText $_) }

    return @{
        Output = $output
        ExitCode = $exitCode
    }
}

function Add-ReportLine([System.Collections.Generic.List[string]] $lines, [string] $line = "") {
    $lines.Add($line) | Out-Null
}

function Protect-HandoffText([string] $value) {
    $protected = $value

    if (-not [string]::IsNullOrWhiteSpace($ProjectRoot)) {
        $protected = $protected -replace [regex]::Escape($ProjectRoot), "%PROJECT_ROOT%"
        $protected = $protected -replace [regex]::Escape(($ProjectRoot -replace "\\", "/")), "%PROJECT_ROOT%"
    }

    if (-not [string]::IsNullOrWhiteSpace($env:USERPROFILE)) {
        $protected = $protected -replace [regex]::Escape($env:USERPROFILE), "%USERPROFILE%"
        $protected = $protected -replace [regex]::Escape(($env:USERPROFILE -replace "\\", "/")), "%USERPROFILE%"
    }

    $protected = $protected -replace "(?i)(APP_KEY|DB_PASSWORD|PASSWORD|TOKEN|SECRET|MAIL_PASSWORD)\s*[:=]\s*[^,\s\]\)]+", '$1=[redacted]'
    $protected = $protected -replace "(?i)[A-Z]:\\[^\s`"']+", "[ruta-local]"

    return $protected
}

function Write-HandoffReport(
    [string] $path,
    [bool] $lanProofCompleted,
    [bool] $printerProofCompleted,
    [bool] $restoreProofCompleted,
    [bool] $concurrencyProofCompleted,
    [string[]] $backupStatusOutput,
    [string[]] $releaseGuardOutput,
    [int] $releaseGuardExit,
    [string[]] $supportPacketSafetyOutput,
    [int] $supportPacketSafetyExit,
    [string[]] $startupRepairSafetyOutput,
    [int] $startupRepairSafetyExit,
    [string[]] $operatorManualsSafetyOutput,
    [int] $operatorManualsSafetyExit,
    [string[]] $backupRestoreDocsSafetyOutput,
    [int] $backupRestoreDocsSafetyExit,
    [string[]] $trainingSafetyOutput,
    [int] $trainingSafetyExit,
    [string[]] $evidenceIndexOutput,
    [int] $evidenceIndexExit,
    [string[]] $preflightOutput,
    [int] $preflightExit,
    [bool] $preflightSkipped
) {
    $now = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $lines = New-Object System.Collections.Generic.List[string]
    $allProofsCompleted = $lanProofCompleted -and $printerProofCompleted -and $restoreProofCompleted -and $concurrencyProofCompleted
    $decision = if ($allProofsCompleted -and $releaseGuardExit -eq 0 -and $supportPacketSafetyExit -eq 0 -and $startupRepairSafetyExit -eq 0 -and $operatorManualsSafetyExit -eq 0 -and $backupRestoreDocsSafetyExit -eq 0 -and $trainingSafetyExit -eq 0 -and $evidenceIndexExit -eq 0 -and -not $preflightSkipped -and $preflightExit -eq 0) { "PRODUCTION_READY" } else { "PRODUCTION_CANDIDATE" }

    Add-ReportLine $lines "# Final production handoff result"
    Add-ReportLine $lines ""
    Add-ReportLine $lines "- Generated at: $now"
    Add-ReportLine $lines "- Base URL: $($BaseUrl.TrimEnd('/'))"
    Add-ReportLine $lines "- Project root: $(Protect-HandoffText $ProjectRoot)"
    Add-ReportLine $lines "- Decision: $decision"
    Add-ReportLine $lines "- LAN client proof present without obvious placeholders: $lanProofCompleted"
    Add-ReportLine $lines "- Institutional receipt print proof present without obvious placeholders: $printerProofCompleted"
    Add-ReportLine $lines "- Final restore proof present without obvious placeholders: $restoreProofCompleted"
    Add-ReportLine $lines "- Final concurrency proof present without obvious placeholders: $concurrencyProofCompleted"
    Add-ReportLine $lines '- LAN client proof file: `qa/LAN_CLIENT_VALIDATION_PROOF.md`'
    Add-ReportLine $lines '- Institutional receipt print proof file: `qa/INSTITUTIONAL_RECEIPT_PRINT_PROOF.md`'
    Add-ReportLine $lines '- Final restore proof file: `qa/FINAL_RESTORE_PROOF.md`'
    Add-ReportLine $lines '- Final concurrency proof file: `qa/FINAL_CONCURRENCY_PROOF.md`'
    Add-ReportLine $lines "- Offline release artifact guard exit code: $releaseGuardExit"
    Add-ReportLine $lines "- Support packet safety guard exit code: $supportPacketSafetyExit"
    Add-ReportLine $lines "- Startup and repair safety guard exit code: $startupRepairSafetyExit"
    Add-ReportLine $lines "- Operator manuals safety guard exit code: $operatorManualsSafetyExit"
    Add-ReportLine $lines "- Backup and restore docs safety guard exit code: $backupRestoreDocsSafetyExit"
    Add-ReportLine $lines "- Training safety guard exit code: $trainingSafetyExit"
    Add-ReportLine $lines "- Evidence index guard exit code: $evidenceIndexExit"
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
        Add-ReportLine $lines '- Missing or incomplete `qa/LAN_CLIENT_VALIDATION_PROOF.md` from a real second LAN client.'
    }
    if (-not $printerProofCompleted) {
        Add-ReportLine $lines '- Missing or incomplete `qa/INSTITUTIONAL_RECEIPT_PRINT_PROOF.md` from the real cashier printer.'
    }
    if (-not $restoreProofCompleted) {
        Add-ReportLine $lines '- Missing or incomplete `qa/FINAL_RESTORE_PROOF.md` from a disposable restore database on the final server.'
    }
    if (-not $concurrencyProofCompleted) {
        Add-ReportLine $lines '- Missing or incomplete `qa/FINAL_CONCURRENCY_PROOF.md` from a disposable concurrency target.'
    }
    if ($preflightSkipped) {
        Add-ReportLine $lines "- Preflight was skipped in this handoff run."
    } elseif ($preflightExit -ne 0) {
        Add-ReportLine $lines "- Production preflight returned exit code $preflightExit."
    }
    if ($releaseGuardExit -ne 0) {
        Add-ReportLine $lines "- Offline release artifact is missing, stale, or contains forbidden files."
    }
    if ($supportPacketSafetyExit -ne 0) {
        Add-ReportLine $lines "- Support packet safety validation returned exit code $supportPacketSafetyExit."
    }
    if ($startupRepairSafetyExit -ne 0) {
        Add-ReportLine $lines "- Startup and repair safety validation returned exit code $startupRepairSafetyExit."
    }
    if ($operatorManualsSafetyExit -ne 0) {
        Add-ReportLine $lines "- Operator manuals safety validation returned exit code $operatorManualsSafetyExit."
    }
    if ($backupRestoreDocsSafetyExit -ne 0) {
        Add-ReportLine $lines "- Backup and restore docs safety validation returned exit code $backupRestoreDocsSafetyExit."
    }
    if ($trainingSafetyExit -ne 0) {
        Add-ReportLine $lines "- Training safety validation returned exit code $trainingSafetyExit."
    }
    if ($evidenceIndexExit -ne 0) {
        Add-ReportLine $lines "- Final handoff evidence index validation returned exit code $evidenceIndexExit."
    }
    if ($lanProofCompleted -and $printerProofCompleted -and $restoreProofCompleted -and $concurrencyProofCompleted -and $releaseGuardExit -eq 0 -and $supportPacketSafetyExit -eq 0 -and $startupRepairSafetyExit -eq 0 -and $operatorManualsSafetyExit -eq 0 -and $backupRestoreDocsSafetyExit -eq 0 -and $trainingSafetyExit -eq 0 -and $evidenceIndexExit -eq 0 -and -not $preflightSkipped -and $preflightExit -eq 0) {
        Add-ReportLine $lines "- None reported by the handoff script."
    }
    Add-ReportLine $lines ""

    Add-ReportLine $lines "## Next commands"
    Add-ReportLine $lines ""
    Add-ReportLine $lines '```powershell'
    Add-ReportLine $lines "powershell.exe -ExecutionPolicy Bypass -File scripts\validate_lan_client.ps1 -BaseUrl $($BaseUrl.TrimEnd('/')) -EvidencePath qa\LAN_CLIENT_VALIDATION_PROOF.md"
    Add-ReportLine $lines "powershell.exe -ExecutionPolicy Bypass -File scripts\install_backup_tasks_windows.ps1 -UpdateExisting -PhpPath $(Protect-HandoffText $PhpPath)"
    Add-ReportLine $lines "Start-ScheduledTask -TaskName SistemaCajaHospitalaria-BackupWorker"
    Add-ReportLine $lines 'bash -lc "HOSPITAL_VALIDATE_RESTORE_MYSQL=1 RESTORE_TEST_DATABASE=hospital_restore_validation_test HOSPITAL_CONFIRM_RESTORE_DATABASE=hospital_restore_validation_test scripts/validate_restore_mysql.sh"'
    Add-ReportLine $lines "# Set HOSPITAL_CONCURRENCY_LOGIN and HOSPITAL_CONCURRENCY_PASSWORD for a temporary validation account outside this report."
    Add-ReportLine $lines "bash -lc `"HOSPITAL_VALIDATE_REAL_MYSQL=1 HOSPITAL_CONFIRM_CONCURRENCY_TARGET=$($BaseUrl.TrimEnd('/')) HOSPITAL_CONCURRENCY_BASE_URL=$($BaseUrl.TrimEnd('/')) HOSPITAL_CONCURRENCY_TARGET_ENV=validation HOSPITAL_CONCURRENCY_EVIDENCE_PATH=qa/FINAL_CONCURRENCY_PROOF.md scripts/validate_mysql_concurrency.sh`""
    Add-ReportLine $lines "powershell.exe -ExecutionPolicy Bypass -File scripts\validate_support_packet_safety.ps1"
    Add-ReportLine $lines "powershell.exe -ExecutionPolicy Bypass -File scripts\validate_startup_repair_safety.ps1"
    Add-ReportLine $lines "powershell.exe -ExecutionPolicy Bypass -File scripts\validate_operator_manuals_safety.ps1"
    Add-ReportLine $lines "powershell.exe -ExecutionPolicy Bypass -File scripts\validate_backup_restore_docs_safety.ps1"
    Add-ReportLine $lines "powershell.exe -ExecutionPolicy Bypass -File scripts\validate_training_safety.ps1"
    Add-ReportLine $lines "powershell.exe -ExecutionPolicy Bypass -File scripts\validate_ops_evidence_index.ps1 -HandoffPath $(Protect-HandoffText $path)"
    Add-ReportLine $lines "powershell.exe -ExecutionPolicy Bypass -File scripts\production_readiness_preflight.ps1 -BaseUrl $($BaseUrl.TrimEnd('/'))"
    Add-ReportLine $lines "powershell.exe -ExecutionPolicy Bypass -File scripts\final_production_handoff.ps1 -BaseUrl $($BaseUrl.TrimEnd('/')) -PhpPath $(Protect-HandoffText $PhpPath)"
    Add-ReportLine $lines '```'
    Add-ReportLine $lines ""

    Add-ReportLine $lines "## Backup task status output"
    Add-ReportLine $lines ""
    Add-ReportLine $lines '```text'
    foreach ($line in $backupStatusOutput) {
        Add-ReportLine $lines (Protect-HandoffText $line)
    }
    Add-ReportLine $lines '```'
    Add-ReportLine $lines ""

    Add-ReportLine $lines "## Offline release artifact guard output"
    Add-ReportLine $lines ""
    Add-ReportLine $lines '```text'
    foreach ($line in $releaseGuardOutput) {
        Add-ReportLine $lines (Protect-HandoffText $line)
    }
    Add-ReportLine $lines '```'
    Add-ReportLine $lines ""

    Add-ReportLine $lines "## Support packet safety validation output"
    Add-ReportLine $lines ""
    Add-ReportLine $lines '```text'
    foreach ($line in $supportPacketSafetyOutput) {
        Add-ReportLine $lines (Protect-HandoffText $line)
    }
    Add-ReportLine $lines '```'
    Add-ReportLine $lines ""

    Add-ReportLine $lines "## Startup and repair safety validation output"
    Add-ReportLine $lines ""
    Add-ReportLine $lines '```text'
    foreach ($line in $startupRepairSafetyOutput) {
        Add-ReportLine $lines (Protect-HandoffText $line)
    }
    Add-ReportLine $lines '```'
    Add-ReportLine $lines ""

    Add-ReportLine $lines "## Training safety validation output"
    Add-ReportLine $lines ""
    Add-ReportLine $lines '```text'
    foreach ($line in $trainingSafetyOutput) {
        Add-ReportLine $lines (Protect-HandoffText $line)
    }
    Add-ReportLine $lines '```'
    Add-ReportLine $lines ""

    Add-ReportLine $lines "## Operator manuals safety validation output"
    Add-ReportLine $lines ""
    Add-ReportLine $lines '```text'
    foreach ($line in $operatorManualsSafetyOutput) {
        Add-ReportLine $lines (Protect-HandoffText $line)
    }
    Add-ReportLine $lines '```'
    Add-ReportLine $lines ""

    Add-ReportLine $lines "## Backup and restore docs safety validation output"
    Add-ReportLine $lines ""
    Add-ReportLine $lines '```text'
    foreach ($line in $backupRestoreDocsSafetyOutput) {
        Add-ReportLine $lines (Protect-HandoffText $line)
    }
    Add-ReportLine $lines '```'
    Add-ReportLine $lines ""

    Add-ReportLine $lines "## Evidence index validation output"
    Add-ReportLine $lines ""
    Add-ReportLine $lines '```text'
    foreach ($line in $evidenceIndexOutput) {
        Add-ReportLine $lines (Protect-HandoffText $line)
    }
    Add-ReportLine $lines '```'
    Add-ReportLine $lines ""

    Add-ReportLine $lines "## Preflight output"
    Add-ReportLine $lines ""
    Add-ReportLine $lines '```text'
    foreach ($line in $preflightOutput) {
        Add-ReportLine $lines (Protect-HandoffText $line)
    }
    Add-ReportLine $lines '```'

    $reportDir = Split-Path -Parent $path
    if (-not (Test-Path -LiteralPath $reportDir)) {
        New-Item -ItemType Directory -Path $reportDir -Force | Out-Null
    }

    Set-Content -LiteralPath $path -Value $lines -Encoding ASCII
    Write-Host "Wrote handoff report: $(Protect-HandoffText $path)"
}

Assert-ScriptExists $preflightScript
Assert-ScriptExists $proofInitScript
Assert-ScriptExists $backupTasksScript
Assert-ScriptExists $releaseGuardScript
Assert-ScriptExists $evidenceIndexScript
Assert-ScriptExists $trainingSafetyScript
Assert-ScriptExists $supportPacketSafetyScript
Assert-ScriptExists $startupRepairSafetyScript
Assert-ScriptExists $operatorManualsSafetyScript
Assert-ScriptExists $backupRestoreDocsSafetyScript

Write-Host "Sistema de Caja Hospitalaria final production handoff"
Write-Host "ProjectRoot: $(Protect-HandoffText $ProjectRoot)"
Write-Host "BaseUrl: $($BaseUrl.TrimEnd('/'))"
Write-Host "PhpPath: $(Protect-HandoffText $PhpPath)"

Write-Section "Proof files"
if ($InitializeProofFiles) {
    & powershell.exe -ExecutionPolicy Bypass -File $proofInitScript -ProjectRoot $ProjectRoot
}

$lanProofCompleted = Test-ProofLooksCompleted $lanProofPath
$printerProofCompleted = Test-ProofLooksCompleted $printerProofPath
$restoreProofCompleted = Test-ProofLooksCompleted $restoreProofPath
$concurrencyProofCompleted = Test-ProofLooksCompleted $concurrencyProofPath
$allHandoffProofsCompleted = $lanProofCompleted -and $printerProofCompleted -and $restoreProofCompleted -and $concurrencyProofCompleted
Write-Result $lanProofCompleted "Second-client LAN proof file has required handoff fields; preflight performs strict validation." "Second-client LAN proof is missing, incomplete, has placeholders, or references missing evidence."
Write-Result $printerProofCompleted "Physical printer proof file has required handoff fields; preflight performs strict validation." "Physical printer proof is missing, incomplete, has placeholders, or references missing evidence."
Write-Result $restoreProofCompleted "Final restore proof file has required handoff fields; preflight performs strict validation." "Final restore proof is missing, incomplete, has placeholders, or references missing evidence."
Write-Result $concurrencyProofCompleted "Final concurrency proof file has required handoff fields; preflight performs strict validation." "Final concurrency proof is missing, incomplete, has placeholders, or references missing evidence."

if (-not $lanProofCompleted) {
    Write-Host "Run from the second LAN client:"
    Write-Host "powershell.exe -ExecutionPolicy Bypass -File scripts\validate_lan_client.ps1 -BaseUrl $($BaseUrl.TrimEnd('/')) -EvidencePath qa\LAN_CLIENT_VALIDATION_PROOF.md"
}

if (-not $printerProofCompleted) {
    Write-Host "Print real media carta/carta/A5/80mm/58mm samples, then complete qa\INSTITUTIONAL_RECEIPT_PRINT_PROOF.md with physical evidence."
}

if (-not $restoreProofCompleted) {
    Write-Host "Run restore validation into a disposable database, then complete qa\FINAL_RESTORE_PROOF.md."
}

if (-not $concurrencyProofCompleted) {
    Write-Host "Run concurrency validation against a disposable target, then complete qa\FINAL_CONCURRENCY_PROOF.md."
}

Write-Section "Backup automation"
$backupStatusOutput = @(& powershell.exe -ExecutionPolicy Bypass -File $backupTasksScript -ProjectRoot $ProjectRoot -PhpPath $PhpPath -Status 2>&1 | ForEach-Object { $_.ToString() })
$backupStatusOutput | ForEach-Object { Write-Host (Protect-HandoffText $_) }
Write-Host "If tasks are missing or stale, run elevated PowerShell:"
Write-Host "powershell.exe -ExecutionPolicy Bypass -File scripts\install_backup_tasks_windows.ps1 -UpdateExisting -PhpPath $(Protect-HandoffText $PhpPath)"
Write-Host "Start-ScheduledTask -TaskName SistemaCajaHospitalaria-BackupWorker"
Write-Host "powershell.exe -ExecutionPolicy Bypass -File scripts\install_backup_tasks_windows.ps1 -Status -PhpPath $(Protect-HandoffText $PhpPath)"

Write-Section "Offline release artifact"
$releaseGuardOutput = @(& powershell.exe -ExecutionPolicy Bypass -File $releaseGuardScript -ProjectRoot $ProjectRoot -RequireCurrentCommit 2>&1 | ForEach-Object { $_.ToString() })
$releaseGuardExit = $LASTEXITCODE
$releaseGuardOutput | ForEach-Object { Write-Host (Protect-HandoffText $_) }

$supportPacketSafety = Invoke-SupportPacketSafetyGuard
$startupRepairSafety = Invoke-StartupRepairSafetyGuard
$operatorManualsSafety = Invoke-OperatorManualsSafetyGuard
$backupRestoreDocsSafety = Invoke-BackupRestoreDocsSafetyGuard
$trainingSafety = Invoke-TrainingSafetyGuard

if ($SkipPreflight) {
    Write-Section "Preflight skipped"
    Write-Host "SkipPreflight was used. This run cannot approve PRODUCTION_READY."
    Write-HandoffReport `
        -path $ReportPath `
        -lanProofCompleted $lanProofCompleted `
        -printerProofCompleted $printerProofCompleted `
        -restoreProofCompleted $restoreProofCompleted `
        -concurrencyProofCompleted $concurrencyProofCompleted `
        -backupStatusOutput $backupStatusOutput `
        -releaseGuardOutput $releaseGuardOutput `
        -releaseGuardExit $releaseGuardExit `
        -supportPacketSafetyOutput $supportPacketSafety.Output `
        -supportPacketSafetyExit $supportPacketSafety.ExitCode `
        -startupRepairSafetyOutput $startupRepairSafety.Output `
        -startupRepairSafetyExit $startupRepairSafety.ExitCode `
        -operatorManualsSafetyOutput $operatorManualsSafety.Output `
        -operatorManualsSafetyExit $operatorManualsSafety.ExitCode `
        -backupRestoreDocsSafetyOutput $backupRestoreDocsSafety.Output `
        -backupRestoreDocsSafetyExit $backupRestoreDocsSafety.ExitCode `
        -trainingSafetyOutput $trainingSafety.Output `
        -trainingSafetyExit $trainingSafety.ExitCode `
        -evidenceIndexOutput @("Evidence index validation pending until the handoff report is written.") `
        -evidenceIndexExit 2 `
        -preflightOutput @("Preflight skipped by -SkipPreflight.") `
        -preflightExit 2 `
        -preflightSkipped $true

    $evidenceIndex = Invoke-EvidenceIndexGuard $ReportPath
    Write-HandoffReport `
        -path $ReportPath `
        -lanProofCompleted $lanProofCompleted `
        -printerProofCompleted $printerProofCompleted `
        -restoreProofCompleted $restoreProofCompleted `
        -concurrencyProofCompleted $concurrencyProofCompleted `
        -backupStatusOutput $backupStatusOutput `
        -releaseGuardOutput $releaseGuardOutput `
        -releaseGuardExit $releaseGuardExit `
        -supportPacketSafetyOutput $supportPacketSafety.Output `
        -supportPacketSafetyExit $supportPacketSafety.ExitCode `
        -startupRepairSafetyOutput $startupRepairSafety.Output `
        -startupRepairSafetyExit $startupRepairSafety.ExitCode `
        -operatorManualsSafetyOutput $operatorManualsSafety.Output `
        -operatorManualsSafetyExit $operatorManualsSafety.ExitCode `
        -backupRestoreDocsSafetyOutput $backupRestoreDocsSafety.Output `
        -backupRestoreDocsSafetyExit $backupRestoreDocsSafety.ExitCode `
        -trainingSafetyOutput $trainingSafety.Output `
        -trainingSafetyExit $trainingSafety.ExitCode `
        -evidenceIndexOutput $evidenceIndex.Output `
        -evidenceIndexExit $evidenceIndex.ExitCode `
        -preflightOutput @("Preflight skipped by -SkipPreflight.") `
        -preflightExit 2 `
        -preflightSkipped $true
    exit 2
}

Write-Section "Production preflight"
$preflightOutput = @(& powershell.exe -ExecutionPolicy Bypass -File $preflightScript -ProjectRoot $ProjectRoot -BaseUrl $BaseUrl 2>&1 | ForEach-Object { $_.ToString() })
$preflightExit = $LASTEXITCODE
$preflightOutput | ForEach-Object { Write-Host (Protect-HandoffText $_) }

Write-HandoffReport `
    -path $ReportPath `
    -lanProofCompleted $lanProofCompleted `
    -printerProofCompleted $printerProofCompleted `
    -restoreProofCompleted $restoreProofCompleted `
    -concurrencyProofCompleted $concurrencyProofCompleted `
    -backupStatusOutput $backupStatusOutput `
    -releaseGuardOutput $releaseGuardOutput `
    -releaseGuardExit $releaseGuardExit `
    -supportPacketSafetyOutput $supportPacketSafety.Output `
    -supportPacketSafetyExit $supportPacketSafety.ExitCode `
    -startupRepairSafetyOutput $startupRepairSafety.Output `
    -startupRepairSafetyExit $startupRepairSafety.ExitCode `
    -operatorManualsSafetyOutput $operatorManualsSafety.Output `
    -operatorManualsSafetyExit $operatorManualsSafety.ExitCode `
    -backupRestoreDocsSafetyOutput $backupRestoreDocsSafety.Output `
    -backupRestoreDocsSafetyExit $backupRestoreDocsSafety.ExitCode `
    -trainingSafetyOutput $trainingSafety.Output `
    -trainingSafetyExit $trainingSafety.ExitCode `
    -evidenceIndexOutput @("Evidence index validation pending until the handoff report is written.") `
    -evidenceIndexExit 2 `
    -preflightOutput $preflightOutput `
    -preflightExit $preflightExit `
    -preflightSkipped $false

$evidenceIndex = Invoke-EvidenceIndexGuard $ReportPath
Write-HandoffReport `
    -path $ReportPath `
    -lanProofCompleted $lanProofCompleted `
    -printerProofCompleted $printerProofCompleted `
    -restoreProofCompleted $restoreProofCompleted `
    -concurrencyProofCompleted $concurrencyProofCompleted `
    -backupStatusOutput $backupStatusOutput `
    -releaseGuardOutput $releaseGuardOutput `
    -releaseGuardExit $releaseGuardExit `
    -supportPacketSafetyOutput $supportPacketSafety.Output `
    -supportPacketSafetyExit $supportPacketSafety.ExitCode `
    -startupRepairSafetyOutput $startupRepairSafety.Output `
    -startupRepairSafetyExit $startupRepairSafety.ExitCode `
    -operatorManualsSafetyOutput $operatorManualsSafety.Output `
    -operatorManualsSafetyExit $operatorManualsSafety.ExitCode `
    -backupRestoreDocsSafetyOutput $backupRestoreDocsSafety.Output `
    -backupRestoreDocsSafetyExit $backupRestoreDocsSafety.ExitCode `
    -trainingSafetyOutput $trainingSafety.Output `
    -trainingSafetyExit $trainingSafety.ExitCode `
    -evidenceIndexOutput $evidenceIndex.Output `
    -evidenceIndexExit $evidenceIndex.ExitCode `
    -preflightOutput $preflightOutput `
    -preflightExit $preflightExit `
    -preflightSkipped $false

if ($preflightExit -eq 0 -and $releaseGuardExit -eq 0 -and $supportPacketSafety.ExitCode -eq 0 -and $startupRepairSafety.ExitCode -eq 0 -and $operatorManualsSafety.ExitCode -eq 0 -and $backupRestoreDocsSafety.ExitCode -eq 0 -and $trainingSafety.ExitCode -eq 0 -and $evidenceIndex.ExitCode -eq 0 -and $allHandoffProofsCompleted) {
    Write-Host ""
    Write-Host "PRODUCTION_READY evidence gate passed." -ForegroundColor Green
    exit 0
}

Write-Host ""
Write-Host "PRODUCTION_READY remains blocked. Keep status as PRODUCTION_CANDIDATE and close the missing evidence above." -ForegroundColor Yellow
if ($preflightExit -eq 0 -and $supportPacketSafety.ExitCode -eq 0 -and $startupRepairSafety.ExitCode -eq 0 -and $operatorManualsSafety.ExitCode -eq 0 -and $backupRestoreDocsSafety.ExitCode -eq 0 -and $trainingSafety.ExitCode -eq 0 -and $evidenceIndex.ExitCode -eq 0) {
    exit 1
}
if ($supportPacketSafety.ExitCode -ne 0) {
    exit $supportPacketSafety.ExitCode
}
if ($startupRepairSafety.ExitCode -ne 0) {
    exit $startupRepairSafety.ExitCode
}
if ($operatorManualsSafety.ExitCode -ne 0) {
    exit $operatorManualsSafety.ExitCode
}
if ($backupRestoreDocsSafety.ExitCode -ne 0) {
    exit $backupRestoreDocsSafety.ExitCode
}
if ($trainingSafety.ExitCode -ne 0) {
    exit $trainingSafety.ExitCode
}
if ($evidenceIndex.ExitCode -ne 0) {
    exit $evidenceIndex.ExitCode
}
exit $preflightExit
