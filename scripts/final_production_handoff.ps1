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
$offlineReleaseBuilderScript = Join-Path $scriptsDir "make_offline_release.ps1"
$backupTasksScript = Join-Path $scriptsDir "install_backup_tasks_windows.ps1"
$releaseGuardScript = Join-Path $scriptsDir "assert_offline_release_clean.ps1"
$evidenceIndexScript = Join-Path $scriptsDir "validate_ops_evidence_index.ps1"
$dependencyManifestScript = Join-Path $scriptsDir "validate_dependency_manifest.ps1"
$productionLicenseSaltGuardScript = Join-Path $scriptsDir "validate_production_license_salt_guard.ps1"
$trainingSafetyScript = Join-Path $scriptsDir "validate_training_safety.ps1"
$trainingAcceptanceProofGuardScript = Join-Path $scriptsDir "validate_training_acceptance_proof.ps1"
$fieldProofTemplatesSafetyScript = Join-Path $scriptsDir "validate_field_proof_templates.ps1"
$proofInitializationSafetyScript = Join-Path $scriptsDir "validate_proof_initialization_safety.ps1"
$operationsObjectiveAuditScript = Join-Path $scriptsDir "validate_operations_objective_audit.ps1"
$handoffGuardCoverageScript = Join-Path $scriptsDir "validate_handoff_guard_coverage.ps1"
$offlineReleaseStagingSafetyScript = Join-Path $scriptsDir "validate_offline_release_staging_safety.ps1"
$supportPacketSafetyScript = Join-Path $scriptsDir "validate_support_packet_safety.ps1"
$firstLevelSupportSafetyScript = Join-Path $scriptsDir "validate_first_level_support_safety.ps1"
$productionReadyGateSafetyScript = Join-Path $scriptsDir "validate_production_ready_gate_safety.ps1"
$finalFieldBlockersSafetyScript = Join-Path $scriptsDir "validate_final_field_blockers_safety.ps1"
$browserSmokeEvidenceScript = Join-Path $scriptsDir "validate_browser_smoke_evidence.ps1"
$startupRepairSafetyScript = Join-Path $scriptsDir "validate_startup_repair_safety.ps1"
$operatorManualsSafetyScript = Join-Path $scriptsDir "validate_operator_manuals_safety.ps1"
$backupRestoreDocsSafetyScript = Join-Path $scriptsDir "validate_backup_restore_docs_safety.ps1"
$backupStartupCurrentUserSafetyScript = Join-Path $scriptsDir "validate_backup_startup_current_user_safety.ps1"
$restoreWindowsSafetyScript = Join-Path $scriptsDir "validate_restore_windows_safety.ps1"
$installationDocsSafetyScript = Join-Path $scriptsDir "validate_installation_docs_safety.ps1"
$helpScreenSafetyScript = Join-Path $scriptsDir "validate_help_screen_safety.ps1"
$systemDiagnosticsSafetyScript = Join-Path $scriptsDir "validate_system_diagnostics_safety.ps1"
$doubleActionSafetyScript = Join-Path $scriptsDir "validate_double_action_safety.ps1"
$realtimeOwnEventSafetyScript = Join-Path $scriptsDir "validate_realtime_own_event_safety.ps1"
$installerLegacySafetyScript = Join-Path $scriptsDir "validate_installer_legacy_safety.ps1"
$lanRecoverySafetyScript = Join-Path $scriptsDir "validate_lan_recovery_safety.ps1"
$lanLoadtestSafetyScript = Join-Path $scriptsDir "validate_lan_loadtest_safety.ps1"
$knownLimitationsSafetyScript = Join-Path $scriptsDir "validate_known_limitations_safety.ps1"
$maintenanceModeSafetyScript = Join-Path $scriptsDir "validate_maintenance_mode_safety.ps1"
$permissionAuditSafetyScript = Join-Path $scriptsDir "validate_permission_audit_safety.ps1"
$rateLimitSafetyScript = Join-Path $scriptsDir "validate_rate_limit_safety.ps1"
$shiftIncidentRecoverySafetyScript = Join-Path $scriptsDir "validate_shift_incident_recovery_safety.ps1"
$newInvoiceMaintainabilityScript = Join-Path $scriptsDir "validate_new_invoice_maintainability.ps1"
$finalHandoffCompletenessScript = Join-Path $scriptsDir "validate_final_handoff_completeness.ps1"
$lanProofPath = Join-Path $qaDir "LAN_CLIENT_VALIDATION_PROOF.md"
$printerProofPath = Join-Path $qaDir "INSTITUTIONAL_RECEIPT_PRINT_PROOF.md"
$restoreProofPath = Join-Path $qaDir "FINAL_RESTORE_PROOF.md"
$concurrencyProofPath = Join-Path $qaDir "FINAL_CONCURRENCY_PROOF.md"
$trainingAcceptanceProofPath = Join-Path $qaDir "TRAINING_ACCEPTANCE_PROOF.md"

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
    $output = @(& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $evidenceIndexScript -ProjectRoot $ProjectRoot -HandoffPath $handoffPath 2>&1 | ForEach-Object { $_.ToString() })
    $exitCode = $LASTEXITCODE
    $output | ForEach-Object { Write-Host (Protect-HandoffText $_) }

    return @{
        Output = $output
        ExitCode = $exitCode
    }
}

function Invoke-TrainingSafetyGuard {
    Write-Section "Training safety validation"
    $output = @(& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $trainingSafetyScript -ProjectRoot $ProjectRoot 2>&1 | ForEach-Object { $_.ToString() })
    $exitCode = $LASTEXITCODE
    $output | ForEach-Object { Write-Host (Protect-HandoffText $_) }

    return @{
        Output = $output
        ExitCode = $exitCode
    }
}

function Invoke-SupportPacketSafetyGuard {
    Write-Section "Support packet safety validation"
    $output = @(& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $supportPacketSafetyScript -ProjectRoot $ProjectRoot 2>&1 | ForEach-Object { $_.ToString() })
    $exitCode = $LASTEXITCODE
    $output | ForEach-Object { Write-Host (Protect-HandoffText $_) }

    return @{
        Output = $output
        ExitCode = $exitCode
    }
}

function Invoke-FirstLevelSupportSafetyGuard {
    Write-Section "First-level support safety validation"
    $output = @(& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $firstLevelSupportSafetyScript -ProjectRoot $ProjectRoot 2>&1 | ForEach-Object { $_.ToString() })
    $exitCode = $LASTEXITCODE
    $output | ForEach-Object { Write-Host (Protect-HandoffText $_) }

    return @{
        Output = $output
        ExitCode = $exitCode
    }
}

function Invoke-ProductionReadyGateSafetyGuard {
    Write-Section "Production ready gate safety validation"
    $output = @(& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $productionReadyGateSafetyScript -ProjectRoot $ProjectRoot 2>&1 | ForEach-Object { $_.ToString() })
    $exitCode = $LASTEXITCODE
    $output | ForEach-Object { Write-Host (Protect-HandoffText $_) }

    return @{
        Output = $output
        ExitCode = $exitCode
    }
}

function Invoke-FinalFieldBlockersSafetySelfTestGuard {
    Write-Section "Final field blockers safety self-test"
    $output = @(& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $finalFieldBlockersSafetyScript -ProjectRoot $ProjectRoot -SelfTest 2>&1 | ForEach-Object { $_.ToString() })
    $exitCode = $LASTEXITCODE
    $output | ForEach-Object { Write-Host (Protect-HandoffText $_) }

    return @{
        Output = $output
        ExitCode = $exitCode
    }
}

function Invoke-FieldProofTemplatesSafetyGuard {
    Write-Section "Field proof templates safety validation"
    $output = @(& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $fieldProofTemplatesSafetyScript -ProjectRoot $ProjectRoot 2>&1 | ForEach-Object { $_.ToString() })
    $exitCode = $LASTEXITCODE
    $output | ForEach-Object { Write-Host (Protect-HandoffText $_) }

    return @{
        Output = $output
        ExitCode = $exitCode
    }
}

function Invoke-ProofInitializationSafetyGuard {
    Write-Section "Proof initialization safety validation"
    $output = @(& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $proofInitializationSafetyScript -ProjectRoot $ProjectRoot 2>&1 | ForEach-Object { $_.ToString() })
    $exitCode = $LASTEXITCODE
    $output | ForEach-Object { Write-Host (Protect-HandoffText $_) }

    return @{
        Output = $output
        ExitCode = $exitCode
    }
}

function Invoke-OperationsObjectiveAuditGuard {
    Write-Section "Operations objective audit validation"
    $output = @(& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $operationsObjectiveAuditScript -ProjectRoot $ProjectRoot 2>&1 | ForEach-Object { $_.ToString() })
    $exitCode = $LASTEXITCODE
    $output | ForEach-Object { Write-Host (Protect-HandoffText $_) }

    return @{
        Output = $output
        ExitCode = $exitCode
    }
}

function Invoke-HandoffGuardCoverageGuard {
    Write-Section "Handoff guard coverage validation"
    $output = @(& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $handoffGuardCoverageScript -ProjectRoot $ProjectRoot 2>&1 | ForEach-Object { $_.ToString() })
    $exitCode = $LASTEXITCODE
    $output | ForEach-Object { Write-Host (Protect-HandoffText $_) }

    return @{
        Output = $output
        ExitCode = $exitCode
    }
}

function Invoke-OfflineReleaseStagingSafetyGuard {
    Write-Section "Offline release staging safety validation"
    $output = @(& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $offlineReleaseStagingSafetyScript -ProjectRoot $ProjectRoot 2>&1 | ForEach-Object { $_.ToString() })
    $exitCode = $LASTEXITCODE
    $output | ForEach-Object { Write-Host (Protect-HandoffText $_) }

    return @{
        Output = $output
        ExitCode = $exitCode
    }
}

function Invoke-OfflineReleaseBuilderSelfTestGuard {
    Write-Section "Offline release builder self-test"
    $output = @(& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $offlineReleaseBuilderScript -ProjectRoot $ProjectRoot -SelfTest 2>&1 | ForEach-Object { $_.ToString() })
    $exitCode = $LASTEXITCODE
    $output | ForEach-Object { Write-Host (Protect-HandoffText $_) }

    return @{
        Output = $output
        ExitCode = $exitCode
    }
}

function Invoke-OfflineReleaseGuardSelfTest {
    Write-Section "Offline release guard self-test"
    $output = @(& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $releaseGuardScript -ProjectRoot $ProjectRoot -SelfTest 2>&1 | ForEach-Object { $_.ToString() })
    $exitCode = $LASTEXITCODE
    $output | ForEach-Object { Write-Host (Protect-HandoffText $_) }

    return @{
        Output = $output
        ExitCode = $exitCode
    }
}

function Invoke-DependencyManifestGuard {
    Write-Section "Dependency manifest validation"
    $output = @(& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $dependencyManifestScript -ProjectRoot $ProjectRoot 2>&1 | ForEach-Object { $_.ToString() })
    $exitCode = $LASTEXITCODE
    $output | ForEach-Object { Write-Host (Protect-HandoffText $_) }

    return @{
        Output = $output
        ExitCode = $exitCode
    }
}

function Invoke-BrowserSmokeEvidenceGuard {
    Write-Section "Browser smoke evidence validation"
    $output = @(& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $browserSmokeEvidenceScript -ProjectRoot $ProjectRoot 2>&1 | ForEach-Object { $_.ToString() })
    $exitCode = $LASTEXITCODE
    $output | ForEach-Object { Write-Host (Protect-HandoffText $_) }

    return @{
        Output = $output
        ExitCode = $exitCode
    }
}

function Invoke-StartupRepairSafetyGuard {
    Write-Section "Startup and repair safety validation"
    $output = @(& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $startupRepairSafetyScript -ProjectRoot $ProjectRoot 2>&1 | ForEach-Object { $_.ToString() })
    $exitCode = $LASTEXITCODE
    $output | ForEach-Object { Write-Host (Protect-HandoffText $_) }

    return @{
        Output = $output
        ExitCode = $exitCode
    }
}

function Invoke-OperatorManualsSafetyGuard {
    Write-Section "Operator manuals safety validation"
    $output = @(& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $operatorManualsSafetyScript -ProjectRoot $ProjectRoot 2>&1 | ForEach-Object { $_.ToString() })
    $exitCode = $LASTEXITCODE
    $output | ForEach-Object { Write-Host (Protect-HandoffText $_) }

    return @{
        Output = $output
        ExitCode = $exitCode
    }
}

function Invoke-BackupRestoreDocsSafetyGuard {
    Write-Section "Backup and restore docs safety validation"
    $output = @(& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $backupRestoreDocsSafetyScript -ProjectRoot $ProjectRoot 2>&1 | ForEach-Object { $_.ToString() })
    $exitCode = $LASTEXITCODE
    $output | ForEach-Object { Write-Host (Protect-HandoffText $_) }

    return @{
        Output = $output
        ExitCode = $exitCode
    }
}

function Invoke-BackupStartupCurrentUserSafetyGuard {
    Write-Section "Backup startup current-user safety validation"
    $output = @(& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $backupStartupCurrentUserSafetyScript -ProjectRoot $ProjectRoot 2>&1 | ForEach-Object { $_.ToString() })
    $exitCode = $LASTEXITCODE
    $output | ForEach-Object { Write-Host (Protect-HandoffText $_) }

    return @{
        Output = $output
        ExitCode = $exitCode
    }
}

function Invoke-RestoreWindowsSafetyGuard {
    Write-Section "Windows restore safety validation"
    $output = @(& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $restoreWindowsSafetyScript -ProjectRoot $ProjectRoot 2>&1 | ForEach-Object { $_.ToString() })
    $exitCode = $LASTEXITCODE
    $output | ForEach-Object { Write-Host (Protect-HandoffText $_) }

    return @{
        Output = $output
        ExitCode = $exitCode
    }
}

function Invoke-InstallationDocsSafetyGuard {
    Write-Section "Installation docs safety validation"
    $output = @(& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $installationDocsSafetyScript -ProjectRoot $ProjectRoot 2>&1 | ForEach-Object { $_.ToString() })
    $exitCode = $LASTEXITCODE
    $output | ForEach-Object { Write-Host (Protect-HandoffText $_) }

    return @{
        Output = $output
        ExitCode = $exitCode
    }
}

function Invoke-HelpScreenSafetyGuard {
    Write-Section "Help screen safety validation"
    $output = @(& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $helpScreenSafetyScript -ProjectRoot $ProjectRoot 2>&1 | ForEach-Object { $_.ToString() })
    $exitCode = $LASTEXITCODE
    $output | ForEach-Object { Write-Host (Protect-HandoffText $_) }

    return @{
        Output = $output
        ExitCode = $exitCode
    }
}

function Invoke-SystemDiagnosticsSafetyGuard {
    Write-Section "System diagnostics safety validation"
    $output = @(& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $systemDiagnosticsSafetyScript -ProjectRoot $ProjectRoot 2>&1 | ForEach-Object { $_.ToString() })
    $exitCode = $LASTEXITCODE
    $output | ForEach-Object { Write-Host (Protect-HandoffText $_) }

    return @{
        Output = $output
        ExitCode = $exitCode
    }
}

function Invoke-DoubleActionSafetyGuard {
    Write-Section "Double-action safety validation"
    $output = @(& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $doubleActionSafetyScript -ProjectRoot $ProjectRoot 2>&1 | ForEach-Object { $_.ToString() })
    $exitCode = $LASTEXITCODE
    $output | ForEach-Object { Write-Host (Protect-HandoffText $_) }

    return @{
        Output = $output
        ExitCode = $exitCode
    }
}

function Invoke-RealtimeOwnEventSafetyGuard {
    Write-Section "Realtime own-event safety validation"
    $output = @(& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $realtimeOwnEventSafetyScript -ProjectRoot $ProjectRoot 2>&1 | ForEach-Object { $_.ToString() })
    $exitCode = $LASTEXITCODE
    $output | ForEach-Object { Write-Host (Protect-HandoffText $_) }

    return @{
        Output = $output
        ExitCode = $exitCode
    }
}

function Invoke-InstallerLegacySafetyGuard {
    Write-Section "Installer legacy safety validation"
    $output = @(& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $installerLegacySafetyScript -ProjectRoot $ProjectRoot 2>&1 | ForEach-Object { $_.ToString() })
    $exitCode = $LASTEXITCODE
    $output | ForEach-Object { Write-Host (Protect-HandoffText $_) }

    return @{
        Output = $output
        ExitCode = $exitCode
    }
}

function Invoke-LanRecoverySafetyGuard {
    Write-Section "LAN recovery safety validation"
    $output = @(& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $lanRecoverySafetyScript -ProjectRoot $ProjectRoot 2>&1 | ForEach-Object { $_.ToString() })
    $exitCode = $LASTEXITCODE
    $output | ForEach-Object { Write-Host (Protect-HandoffText $_) }

    return @{
        Output = $output
        ExitCode = $exitCode
    }
}

function Invoke-LanLoadtestSafetyGuard {
    Write-Section "LAN loadtest safety validation"
    $output = @(& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $lanLoadtestSafetyScript -Root $ProjectRoot 2>&1 | ForEach-Object { $_.ToString() })
    $exitCode = $LASTEXITCODE
    $output | ForEach-Object { Write-Host (Protect-HandoffText $_) }

    return @{
        Output = $output
        ExitCode = $exitCode
    }
}

function Invoke-KnownLimitationsSafetyGuard {
    Write-Section "Known limitations safety validation"
    $output = @(& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $knownLimitationsSafetyScript -ProjectRoot $ProjectRoot 2>&1 | ForEach-Object { $_.ToString() })
    $exitCode = $LASTEXITCODE
    $output | ForEach-Object { Write-Host (Protect-HandoffText $_) }

    return @{
        Output = $output
        ExitCode = $exitCode
    }
}

function Invoke-MaintenanceModeSafetyGuard {
    Write-Section "Maintenance mode safety validation"
    $output = @(& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $maintenanceModeSafetyScript -ProjectRoot $ProjectRoot 2>&1 | ForEach-Object { $_.ToString() })
    $exitCode = $LASTEXITCODE
    $output | ForEach-Object { Write-Host (Protect-HandoffText $_) }

    return @{
        Output = $output
        ExitCode = $exitCode
    }
}

function Invoke-PermissionAuditSafetyGuard {
    Write-Section "Permission audit safety validation"
    $output = @(& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $permissionAuditSafetyScript -ProjectRoot $ProjectRoot 2>&1 | ForEach-Object { $_.ToString() })
    $exitCode = $LASTEXITCODE
    $output | ForEach-Object { Write-Host (Protect-HandoffText $_) }

    return @{
        Output = $output
        ExitCode = $exitCode
    }
}

function Invoke-RateLimitSafetyGuard {
    Write-Section "Rate-limit safety validation"
    $output = @(& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $rateLimitSafetyScript -ProjectRoot $ProjectRoot 2>&1 | ForEach-Object { $_.ToString() })
    $exitCode = $LASTEXITCODE
    $output | ForEach-Object { Write-Host (Protect-HandoffText $_) }

    return @{
        Output = $output
        ExitCode = $exitCode
    }
}

function Invoke-ShiftIncidentRecoverySafetyGuard {
    Write-Section "Shift incident recovery safety validation"
    $output = @(& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $shiftIncidentRecoverySafetyScript -ProjectRoot $ProjectRoot 2>&1 | ForEach-Object { $_.ToString() })
    $exitCode = $LASTEXITCODE
    $output | ForEach-Object { Write-Host (Protect-HandoffText $_) }

    return @{
        Output = $output
        ExitCode = $exitCode
    }
}

function Invoke-NewInvoiceMaintainabilityGuard {
    Write-Section "New invoice maintainability validation"
    $output = @(& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $newInvoiceMaintainabilityScript -ProjectRoot $ProjectRoot 2>&1 | ForEach-Object { $_.ToString() })
    $exitCode = $LASTEXITCODE
    $output | ForEach-Object { Write-Host (Protect-HandoffText $_) }

    return @{
        Output = $output
        ExitCode = $exitCode
    }
}

function Invoke-ProductionLicenseSaltGuard {
    Write-Section "Production license salt guard validation"
    $output = @(& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $productionLicenseSaltGuardScript -ProjectRoot $ProjectRoot 2>&1 | ForEach-Object { $_.ToString() })
    $exitCode = $LASTEXITCODE
    $output | ForEach-Object { Write-Host (Protect-HandoffText $_) }

    return @{
        Output = $output
        ExitCode = $exitCode
    }
}

function Invoke-FinalHandoffCompletenessGuard([string] $handoffPath) {
    Write-Section "Final handoff completeness validation"
    $output = @(& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $finalHandoffCompletenessScript -ProjectRoot $ProjectRoot -HandoffPath $handoffPath 2>&1 | ForEach-Object { $_.ToString() })
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

function Test-GuardExitCodesPassed([int[]] $exitCodes) {
    foreach ($exitCode in $exitCodes) {
        if ($exitCode -ne 0) {
            return $false
        }
    }

    return $true
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

function Test-BackupTasksReady([string[]] $backupStatusOutput) {
    $statusText = ($backupStatusOutput -join "`n")
    if ([string]::IsNullOrWhiteSpace($statusText)) {
        return $false
    }

    $workerReady = $statusText -match 'SistemaCajaHospitalaria-BackupWorker:\s*estado=(Ready|Running)'
    $dailyReady = $statusText -match 'SistemaCajaHospitalaria-DailyBackup:\s*estado=(Ready|Running)'
    $missingTask = $statusText -match '(?i)no instalada|not installed|Get-ScheduledTask is not available'

    return $workerReady -and $dailyReady -and -not $missingTask
}

function Write-HandoffReport(
    [string] $path,
    [bool] $lanProofCompleted,
    [bool] $printerProofCompleted,
    [bool] $restoreProofCompleted,
    [bool] $concurrencyProofCompleted,
    [bool] $trainingAcceptanceProofCompleted,
    [string[]] $backupStatusOutput,
    [string[]] $releaseGuardOutput,
    [int] $releaseGuardExit,
    [string[]] $supportPacketSafetyOutput,
    [int] $supportPacketSafetyExit,
    [string[]] $firstLevelSupportSafetyOutput,
    [int] $firstLevelSupportSafetyExit,
    [string[]] $productionReadyGateSafetyOutput,
    [int] $productionReadyGateSafetyExit,
    [string[]] $finalFieldBlockersSafetyOutput,
    [int] $finalFieldBlockersSafetyExit,
    [string[]] $browserSmokeEvidenceOutput,
    [int] $browserSmokeEvidenceExit,
    [string[]] $startupRepairSafetyOutput,
    [int] $startupRepairSafetyExit,
    [string[]] $operatorManualsSafetyOutput,
    [int] $operatorManualsSafetyExit,
    [string[]] $backupRestoreDocsSafetyOutput,
    [int] $backupRestoreDocsSafetyExit,
    [string[]] $backupStartupCurrentUserSafetyOutput,
    [int] $backupStartupCurrentUserSafetyExit,
    [string[]] $restoreWindowsSafetyOutput,
    [int] $restoreWindowsSafetyExit,
    [string[]] $installationDocsSafetyOutput,
    [int] $installationDocsSafetyExit,
    [string[]] $helpScreenSafetyOutput,
    [int] $helpScreenSafetyExit,
    [string[]] $systemDiagnosticsSafetyOutput,
    [int] $systemDiagnosticsSafetyExit,
    [string[]] $doubleActionSafetyOutput,
    [int] $doubleActionSafetyExit,
    [string[]] $realtimeOwnEventSafetyOutput,
    [int] $realtimeOwnEventSafetyExit,
    [string[]] $installerLegacySafetyOutput,
    [int] $installerLegacySafetyExit,
    [string[]] $lanRecoverySafetyOutput,
    [int] $lanRecoverySafetyExit,
    [string[]] $lanLoadtestSafetyOutput,
    [int] $lanLoadtestSafetyExit,
    [string[]] $knownLimitationsSafetyOutput,
    [int] $knownLimitationsSafetyExit,
    [string[]] $maintenanceModeSafetyOutput,
    [int] $maintenanceModeSafetyExit,
    [string[]] $permissionAuditSafetyOutput,
    [int] $permissionAuditSafetyExit,
    [string[]] $rateLimitSafetyOutput,
    [int] $rateLimitSafetyExit,
    [string[]] $shiftIncidentRecoverySafetyOutput,
    [int] $shiftIncidentRecoverySafetyExit,
    [string[]] $newInvoiceMaintainabilityOutput,
    [int] $newInvoiceMaintainabilityExit,
    [string[]] $trainingSafetyOutput,
    [int] $trainingSafetyExit,
    [string[]] $fieldProofTemplatesSafetyOutput,
    [int] $fieldProofTemplatesSafetyExit,
    [string[]] $proofInitializationSafetyOutput,
    [int] $proofInitializationSafetyExit,
    [string[]] $operationsObjectiveAuditOutput,
    [int] $operationsObjectiveAuditExit,
    [string[]] $handoffGuardCoverageOutput,
    [int] $handoffGuardCoverageExit,
    [string[]] $offlineReleaseStagingSafetyOutput,
    [int] $offlineReleaseStagingSafetyExit,
    [string[]] $offlineReleaseBuilderSelfTestOutput,
    [int] $offlineReleaseBuilderSelfTestExit,
    [string[]] $offlineReleaseGuardSelfTestOutput,
    [int] $offlineReleaseGuardSelfTestExit,
    [string[]] $dependencyManifestOutput,
    [int] $dependencyManifestExit,
    [string[]] $productionLicenseSaltGuardOutput,
    [int] $productionLicenseSaltGuardExit,
    [string[]] $finalHandoffCompletenessOutput,
    [int] $finalHandoffCompletenessExit,
    [string[]] $evidenceIndexOutput,
    [int] $evidenceIndexExit,
    [string[]] $preflightOutput,
    [int] $preflightExit,
    [bool] $preflightSkipped
) {
    $now = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $lines = New-Object System.Collections.Generic.List[string]
    $allProofsCompleted = $lanProofCompleted -and $printerProofCompleted -and $restoreProofCompleted -and $concurrencyProofCompleted -and $trainingAcceptanceProofCompleted
    $backupTasksReady = Test-BackupTasksReady $backupStatusOutput
    $allAutomatedGuardsPassed = Test-GuardExitCodesPassed @(
        $releaseGuardExit,
        $supportPacketSafetyExit,
        $firstLevelSupportSafetyExit,
        $productionReadyGateSafetyExit,
        $finalFieldBlockersSafetyExit,
        $browserSmokeEvidenceExit,
        $startupRepairSafetyExit,
        $operatorManualsSafetyExit,
        $backupRestoreDocsSafetyExit,
        $backupStartupCurrentUserSafetyExit,
        $restoreWindowsSafetyExit,
        $installationDocsSafetyExit,
        $helpScreenSafetyExit,
        $systemDiagnosticsSafetyExit,
        $doubleActionSafetyExit,
        $realtimeOwnEventSafetyExit,
        $installerLegacySafetyExit,
        $lanRecoverySafetyExit,
        $lanLoadtestSafetyExit,
        $knownLimitationsSafetyExit,
        $maintenanceModeSafetyExit,
        $permissionAuditSafetyExit,
        $rateLimitSafetyExit,
        $shiftIncidentRecoverySafetyExit,
        $newInvoiceMaintainabilityExit,
        $trainingSafetyExit,
        $fieldProofTemplatesSafetyExit,
        $proofInitializationSafetyExit,
        $operationsObjectiveAuditExit,
        $handoffGuardCoverageExit,
        $offlineReleaseStagingSafetyExit,
        $offlineReleaseBuilderSelfTestExit,
        $offlineReleaseGuardSelfTestExit,
        $dependencyManifestExit,
        $productionLicenseSaltGuardExit,
        $finalHandoffCompletenessExit,
        $evidenceIndexExit
    )
    $decision = if ($allProofsCompleted -and $backupTasksReady -and $allAutomatedGuardsPassed -and -not $preflightSkipped -and $preflightExit -eq 0) { "PRODUCTION_READY" } else { "PRODUCTION_CANDIDATE" }

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
    Add-ReportLine $lines "- Supervised training acceptance proof present without obvious placeholders: $trainingAcceptanceProofCompleted"
    Add-ReportLine $lines "- Backup scheduled tasks ready in status output: $backupTasksReady"
    Add-ReportLine $lines '- LAN client proof file: `qa/LAN_CLIENT_VALIDATION_PROOF.md`'
    Add-ReportLine $lines '- Institutional receipt print proof file: `qa/INSTITUTIONAL_RECEIPT_PRINT_PROOF.md`'
    Add-ReportLine $lines '- Final restore proof file: `qa/FINAL_RESTORE_PROOF.md`'
    Add-ReportLine $lines '- Final concurrency proof file: `qa/FINAL_CONCURRENCY_PROOF.md`'
    Add-ReportLine $lines '- Supervised training acceptance proof file: `qa/TRAINING_ACCEPTANCE_PROOF.md`'
    Add-ReportLine $lines "- Offline release artifact guard exit code: $releaseGuardExit"
    Add-ReportLine $lines "- Support packet safety guard exit code: $supportPacketSafetyExit"
    Add-ReportLine $lines "- First-level support safety guard exit code: $firstLevelSupportSafetyExit"
    Add-ReportLine $lines "- Production ready gate safety guard exit code: $productionReadyGateSafetyExit"
    Add-ReportLine $lines "- Final field blockers safety self-test exit code: $finalFieldBlockersSafetyExit"
    Add-ReportLine $lines "- Browser smoke evidence guard exit code: $browserSmokeEvidenceExit"
    Add-ReportLine $lines "- Startup and repair safety guard exit code: $startupRepairSafetyExit"
    Add-ReportLine $lines "- Operator manuals safety guard exit code: $operatorManualsSafetyExit"
    Add-ReportLine $lines "- Backup and restore docs safety guard exit code: $backupRestoreDocsSafetyExit"
    Add-ReportLine $lines "- Backup startup current-user safety guard exit code: $backupStartupCurrentUserSafetyExit"
    Add-ReportLine $lines "- Windows restore safety guard exit code: $restoreWindowsSafetyExit"
    Add-ReportLine $lines "- Installation docs safety guard exit code: $installationDocsSafetyExit"
    Add-ReportLine $lines "- Help screen safety guard exit code: $helpScreenSafetyExit"
    Add-ReportLine $lines "- System diagnostics safety guard exit code: $systemDiagnosticsSafetyExit"
    Add-ReportLine $lines "- Double-action safety guard exit code: $doubleActionSafetyExit"
    Add-ReportLine $lines "- Realtime own-event safety guard exit code: $realtimeOwnEventSafetyExit"
    Add-ReportLine $lines "- Installer legacy safety guard exit code: $installerLegacySafetyExit"
    Add-ReportLine $lines "- LAN recovery safety guard exit code: $lanRecoverySafetyExit"
    Add-ReportLine $lines "- LAN loadtest safety guard exit code: $lanLoadtestSafetyExit"
    Add-ReportLine $lines "- Known limitations safety guard exit code: $knownLimitationsSafetyExit"
    Add-ReportLine $lines "- Maintenance mode safety guard exit code: $maintenanceModeSafetyExit"
    Add-ReportLine $lines "- Permission audit safety guard exit code: $permissionAuditSafetyExit"
    Add-ReportLine $lines "- Rate-limit safety guard exit code: $rateLimitSafetyExit"
    Add-ReportLine $lines "- Shift incident recovery safety guard exit code: $shiftIncidentRecoverySafetyExit"
    Add-ReportLine $lines "- New invoice maintainability guard exit code: $newInvoiceMaintainabilityExit"
    Add-ReportLine $lines "- Training safety guard exit code: $trainingSafetyExit"
    Add-ReportLine $lines "- Field proof templates safety guard exit code: $fieldProofTemplatesSafetyExit"
    Add-ReportLine $lines "- Proof initialization safety guard exit code: $proofInitializationSafetyExit"
    Add-ReportLine $lines "- Operations objective audit guard exit code: $operationsObjectiveAuditExit"
    Add-ReportLine $lines "- Handoff guard coverage guard exit code: $handoffGuardCoverageExit"
    Add-ReportLine $lines "- Offline release staging safety guard exit code: $offlineReleaseStagingSafetyExit"
    Add-ReportLine $lines "- Offline release builder self-test exit code: $offlineReleaseBuilderSelfTestExit"
    Add-ReportLine $lines "- Offline release guard self-test exit code: $offlineReleaseGuardSelfTestExit"
    Add-ReportLine $lines "- Dependency manifest guard exit code: $dependencyManifestExit"
    Add-ReportLine $lines "- Production license salt guard exit code: $productionLicenseSaltGuardExit"
    Add-ReportLine $lines "- Final handoff completeness guard exit code: $finalHandoffCompletenessExit"
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
    if (-not $trainingAcceptanceProofCompleted) {
        Add-ReportLine $lines '- Missing or incomplete `qa/TRAINING_ACCEPTANCE_PROOF.md` from supervised role training in a safe practice environment.'
    }
    if (-not $backupTasksReady) {
        Add-ReportLine $lines '- Install or update Windows scheduled backup tasks `SistemaCajaHospitalaria-BackupWorker` and `SistemaCajaHospitalaria-DailyBackup`, then confirm a manual UI backup moves from pending to success.'
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
    if ($firstLevelSupportSafetyExit -ne 0) {
        Add-ReportLine $lines "- First-level support safety validation returned exit code $firstLevelSupportSafetyExit."
    }
    if ($productionReadyGateSafetyExit -ne 0) {
        Add-ReportLine $lines "- Production ready gate safety validation returned exit code $productionReadyGateSafetyExit."
    }
    if ($finalFieldBlockersSafetyExit -ne 0) {
        Add-ReportLine $lines "- Final field blockers safety self-test returned exit code $finalFieldBlockersSafetyExit."
    }
    if ($browserSmokeEvidenceExit -ne 0) {
        Add-ReportLine $lines "- Browser smoke evidence validation returned exit code $browserSmokeEvidenceExit."
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
    if ($backupStartupCurrentUserSafetyExit -ne 0) {
        Add-ReportLine $lines "- Backup startup current-user safety validation returned exit code $backupStartupCurrentUserSafetyExit."
    }
    if ($restoreWindowsSafetyExit -ne 0) {
        Add-ReportLine $lines "- Windows restore safety validation returned exit code $restoreWindowsSafetyExit."
    }
    if ($installationDocsSafetyExit -ne 0) {
        Add-ReportLine $lines "- Installation docs safety validation returned exit code $installationDocsSafetyExit."
    }
    if ($helpScreenSafetyExit -ne 0) {
        Add-ReportLine $lines "- Help screen safety validation returned exit code $helpScreenSafetyExit."
    }
    if ($systemDiagnosticsSafetyExit -ne 0) {
        Add-ReportLine $lines "- System diagnostics safety validation returned exit code $systemDiagnosticsSafetyExit."
    }
    if ($doubleActionSafetyExit -ne 0) {
        Add-ReportLine $lines "- Double-action safety validation returned exit code $doubleActionSafetyExit."
    }
    if ($realtimeOwnEventSafetyExit -ne 0) {
        Add-ReportLine $lines "- Realtime own-event safety validation returned exit code $realtimeOwnEventSafetyExit."
    }
    if ($installerLegacySafetyExit -ne 0) {
        Add-ReportLine $lines "- Installer legacy safety validation returned exit code $installerLegacySafetyExit."
    }
    if ($lanRecoverySafetyExit -ne 0) {
        Add-ReportLine $lines "- LAN recovery safety validation returned exit code $lanRecoverySafetyExit."
    }
    if ($lanLoadtestSafetyExit -ne 0) {
        Add-ReportLine $lines "- LAN loadtest safety validation returned exit code $lanLoadtestSafetyExit."
    }
    if ($knownLimitationsSafetyExit -ne 0) {
        Add-ReportLine $lines "- Known limitations safety validation returned exit code $knownLimitationsSafetyExit."
    }
    if ($maintenanceModeSafetyExit -ne 0) {
        Add-ReportLine $lines "- Maintenance mode safety validation returned exit code $maintenanceModeSafetyExit."
    }
    if ($permissionAuditSafetyExit -ne 0) {
        Add-ReportLine $lines "- Permission audit safety validation returned exit code $permissionAuditSafetyExit."
    }
    if ($rateLimitSafetyExit -ne 0) {
        Add-ReportLine $lines "- Rate-limit safety validation returned exit code $rateLimitSafetyExit."
    }
    if ($shiftIncidentRecoverySafetyExit -ne 0) {
        Add-ReportLine $lines "- Shift incident recovery safety validation returned exit code $shiftIncidentRecoverySafetyExit."
    }
    if ($newInvoiceMaintainabilityExit -ne 0) {
        Add-ReportLine $lines "- New invoice maintainability validation returned exit code $newInvoiceMaintainabilityExit."
    }
    if ($trainingSafetyExit -ne 0) {
        Add-ReportLine $lines "- Training safety validation returned exit code $trainingSafetyExit."
    }
    if ($fieldProofTemplatesSafetyExit -ne 0) {
        Add-ReportLine $lines "- Field proof templates safety validation returned exit code $fieldProofTemplatesSafetyExit."
    }
    if ($proofInitializationSafetyExit -ne 0) {
        Add-ReportLine $lines "- Proof initialization safety validation returned exit code $proofInitializationSafetyExit."
    }
    if ($operationsObjectiveAuditExit -ne 0) {
        Add-ReportLine $lines "- Operations objective audit validation returned exit code $operationsObjectiveAuditExit."
    }
    if ($handoffGuardCoverageExit -ne 0) {
        Add-ReportLine $lines "- Handoff guard coverage validation returned exit code $handoffGuardCoverageExit."
    }
    if ($offlineReleaseStagingSafetyExit -ne 0) {
        Add-ReportLine $lines "- Offline release staging safety validation returned exit code $offlineReleaseStagingSafetyExit."
    }
    if ($offlineReleaseBuilderSelfTestExit -ne 0) {
        Add-ReportLine $lines "- Offline release builder self-test returned exit code $offlineReleaseBuilderSelfTestExit."
    }
    if ($offlineReleaseGuardSelfTestExit -ne 0) {
        Add-ReportLine $lines "- Offline release guard self-test returned exit code $offlineReleaseGuardSelfTestExit."
    }
    if ($dependencyManifestExit -ne 0) {
        Add-ReportLine $lines "- Dependency manifest validation returned exit code $dependencyManifestExit."
    }
    if ($productionLicenseSaltGuardExit -ne 0) {
        Add-ReportLine $lines "- Production license salt guard validation returned exit code $productionLicenseSaltGuardExit."
    }
    if ($finalHandoffCompletenessExit -ne 0) {
        Add-ReportLine $lines "- Final handoff completeness validation returned exit code $finalHandoffCompletenessExit."
    }
    if ($evidenceIndexExit -ne 0) {
        Add-ReportLine $lines "- Final handoff evidence index validation returned exit code $evidenceIndexExit."
    }
    if ($allProofsCompleted -and $allAutomatedGuardsPassed -and -not $preflightSkipped -and $preflightExit -eq 0) {
        Add-ReportLine $lines "- None reported by the handoff script."
    }
    Add-ReportLine $lines ""

    Add-ReportLine $lines "## Evidence completed in this hardening front"
    Add-ReportLine $lines ""
    Add-ReportLine $lines '- Browser smoke screenshots: `qa/browser-smoke-2026-06-03/rc-e2e-mocked-report.json` and `qa/BROWSER_SMOKE_EVIDENCE_2026_06_03.md`.'
    Add-ReportLine $lines '- System diagnostics and Help/support guards: `qa/SYSTEM_DIAGNOSTICS_SAFETY_2026_06_03.md`, `qa/HELP_SCREEN_SAFETY_2026_06_03.md`, `qa/SUPPORT_PACKET_SAFETY_2026_06_03.md`, `qa/FIRST_LEVEL_SUPPORT_SAFETY_2026_06_04.md`.'
    Add-ReportLine $lines '- Backup worker, current-user startup and restore evidence: `qa/BACKUP_WORKER_SMOKE_2026_06_03.md`, `qa/BACKUP_STARTUP_CURRENT_USER_SAFETY_2026_06_04.md`, `qa/FINAL_RESTORE_PROOF.md`, `qa/FINAL_RESTORE_PROOF_2026_06_03.md` and `qa/RESTORE_WINDOWS_SAFETY_2026_06_04.md`.'
    Add-ReportLine $lines '- Concurrency, double-action and realtime own-event evidence: `qa/FINAL_CONCURRENCY_PROOF.md`, `qa/DOUBLE_ACTION_SAFETY_2026_06_03.md` and `qa/REALTIME_OWN_EVENT_SAFETY_2026_06_04.md`.'
    Add-ReportLine $lines '- Startup, installation, LAN, known-limitations, maintenance, permission audit, rate-limit and shift incident recovery guards: `qa/STARTUP_REPAIR_SAFETY_2026_06_03.md`, `qa/INSTALLATION_DOCS_SAFETY_2026_06_03.md`, `qa/LAN_RECOVERY_SAFETY_2026_06_03.md`, `qa/LAN_LOADTEST_SAFETY_2026_06_04.md`, `qa/KNOWN_LIMITATIONS_SAFETY_2026_06_03.md`, `qa/MAINTENANCE_MODE_SAFETY_2026_06_03.md`, `qa/PERMISSION_AUDIT_SAFETY_2026_06_03.md`, `qa/RATE_LIMIT_SAFETY_2026_06_03.md`, `qa/SHIFT_INCIDENT_RECOVERY_SAFETY_2026_06_03.md`.'
    Add-ReportLine $lines '- New invoice maintainability guard: `qa/NEW_INVOICE_MAINTAINABILITY_2026_06_04.md` and `scripts/validate_new_invoice_maintainability.ps1` preserve a short cashier-facing invoice flow.'
    Add-ReportLine $lines '- Operator and training evidence: `qa/OPERATOR_MANUALS_SAFETY_2026_06_03.md`, `qa/TRAINING_SAFETY_2026_06_03.md`, `qa/TRAINING_ACCEPTANCE_PROOF.example.md` and `qa/TRAINING_ACCEPTANCE_PROOF.md`.'
    Add-ReportLine $lines '- Field proof, final blockers, LAN/loadtest, proof initialization, handoff guard coverage, offline release staging, offline builder, offline release guard, offline regeneration, objective, release and index evidence: `qa/FIELD_PROOF_TEMPLATES_SAFETY_2026_06_03.md`, `qa/FINAL_FIELD_BLOCKERS_SAFETY_2026_06_04.md`, `qa/LAN_LOADTEST_SAFETY_2026_06_04.md`, `qa/LAN_LOADTEST_HANDOFF_2026_06_04.md`, `qa/PROOF_INITIALIZATION_SAFETY_2026_06_03.md`, `qa/HANDOFF_GUARD_COVERAGE_2026_06_04.md`, `qa/OFFLINE_RELEASE_STAGING_SAFETY_2026_06_04.md`, `qa/OFFLINE_RELEASE_BUILDER_SELFTEST_2026_06_03.md`, `qa/OFFLINE_RELEASE_GUARD_2026_06_03.md`, `qa/OFFLINE_RELEASE_REGEN_2026_06_04.md`, `qa/PRODUCTION_READY_GATE_VALIDATOR_2026_06_04.md`, `qa/PRODUCTION_LICENSE_SALT_GUARD_2026_06_04.md`, `qa/OPERATIONS_OBJECTIVE_AUDIT_2026_06_03.md`, `qa/OPS_EVIDENCE_INDEX_2026_06_03.md`.'
    Add-ReportLine $lines ""

    Add-ReportLine $lines "## Tests and gates to preserve"
    Add-ReportLine $lines ""
    Add-ReportLine $lines '- Backend static/format: `docker compose exec -T backend ./vendor/bin/pint --test`.'
    Add-ReportLine $lines '- Backend static analysis: `docker compose exec -T backend ./vendor/bin/phpstan analyse --memory-limit=1G`.'
    Add-ReportLine $lines '- Backend suite: `docker compose exec -T backend php artisan test`.'
    Add-ReportLine $lines '- Frontend gates: `npm.cmd run lint`, `npm.cmd run typecheck`, `npm.cmd run test -- --run`, `npm.cmd run build`, `scripts\check-branding.ps1`.'
    Add-ReportLine $lines '- Browser and operational smoke: mocked E2E screenshots, `npm.cmd run smoke:real`, backup worker smoke, disposable restore, concurrency validation and `scripts\production_readiness_preflight.ps1`.'
    Add-ReportLine $lines ""

    Add-ReportLine $lines "## Files changed in this handoff front"
    Add-ReportLine $lines ""
    Add-ReportLine $lines '- In-app support and diagnostics: `frontend/src/features/help/HelpView.tsx`, `frontend/src/features/about/AboutView.tsx`, `frontend/src/hooks/useServerStatus.ts`, `frontend/src/lib/support/clientIssueLog.ts`, `backend/app/Http/Controllers/SystemStatusController.php`.'
    Add-ReportLine $lines '- Startup, installer and support scripts: `scripts/deploy_hospital_lan.ps1`, `scripts/start_hospital_services.ps1`, `scripts/open_hospital_system.ps1`, `scripts/repair_hospital_system.ps1`, `scripts/restore_hospital_windows.ps1`, `scripts/collect_support_packet.ps1`, `scripts/install_hospital_startup_shortcut.ps1`, `scripts/install_stack_autostart_windows.ps1`, `scripts/install_backup_tasks_windows.ps1`, `scripts/install_backup_startup_current_user.ps1`, `scripts/start_backup_automation.cmd`, `scripts/run_backup_scheduler_loop.ps1`, `scripts/init_production_proofs.ps1`, `scripts/refresh_lan_ip.ps1`, `scripts/make_offline_release.ps1`, `scripts/final_production_handoff.ps1`.'
    Add-ReportLine $lines '- Evidence guards: `scripts/assert_offline_release_clean.ps1`, `scripts/validate_browser_smoke_evidence.ps1`, `scripts/validate_startup_repair_safety.ps1`, `scripts/validate_operator_manuals_safety.ps1`, `scripts/validate_backup_restore_docs_safety.ps1`, `scripts/validate_backup_startup_current_user_safety.ps1`, `scripts/validate_restore_windows_safety.ps1`, `scripts/validate_installation_docs_safety.ps1`, `scripts/validate_help_screen_safety.ps1`, `scripts/validate_system_diagnostics_safety.ps1`, `scripts/validate_support_packet_safety.ps1`, `scripts/validate_first_level_support_safety.ps1`, `scripts/validate_production_ready_gate_safety.ps1`, `scripts/validate_final_field_blockers_safety.ps1`, `scripts/validate_double_action_safety.ps1`, `scripts/validate_realtime_own_event_safety.ps1`, `scripts/validate_installer_legacy_safety.ps1`, `scripts/validate_lan_recovery_safety.ps1`, `scripts/validate_lan_loadtest_safety.ps1`, `scripts/validate_known_limitations_safety.ps1`, `scripts/validate_maintenance_mode_safety.ps1`, `scripts/validate_permission_audit_safety.ps1`, `scripts/validate_rate_limit_safety.ps1`, `scripts/validate_shift_incident_recovery_safety.ps1`, `scripts/validate_new_invoice_maintainability.ps1`, `scripts/validate_training_safety.ps1`, `scripts/validate_training_acceptance_proof.ps1`, `scripts/validate_field_proof_templates.ps1`, `scripts/validate_proof_initialization_safety.ps1`, `scripts/validate_operations_objective_audit.ps1`, `scripts/validate_handoff_guard_coverage.ps1`, `scripts/validate_offline_release_staging_safety.ps1`, `scripts/validate_dependency_manifest.ps1`, `scripts/validate_production_license_salt_guard.ps1`, `scripts/validate_ops_evidence_index.ps1`, `scripts/validate_final_handoff_completeness.ps1`.'
    Add-ReportLine $lines '- Operator material and evidence: `docs/manuales`, `docs/RELEASE_CHECKLIST.md`, `qa/TRAINING_ACCEPTANCE_PROOF.example.md`, QA evidence files dated 2026-06-03 and `qa/browser-smoke-2026-06-03`.'
    Add-ReportLine $lines ""

    Add-ReportLine $lines "## Risks and limits"
    Add-ReportLine $lines ""
    Add-ReportLine $lines "- Local Docker and mocked browser evidence do not replace final second-client LAN proof, real MariaDB/server proof or physical printer proof."
    Add-ReportLine $lines "- The offline release package must still be copied to the final server and verified there before production use."
    Add-ReportLine $lines "- Final production environment must be verified with `APP_ENV=production` and `APP_DEBUG=false` before production handoff."
    Add-ReportLine $lines '- Windows scheduled tasks `SistemaCajaHospitalaria-BackupWorker` and `SistemaCajaHospitalaria-DailyBackup` must be installed or updated on the final server.'
    Add-ReportLine $lines "- Fiscal sequences/settings require administrative validation in the real environment; fiscal compliance was not invented by this report."
    Add-ReportLine $lines "- Any restore or concurrency validation must use a disposable target or explicitly approved validation database, never the active production database."
    Add-ReportLine $lines ""

    Add-ReportLine $lines "## Safety notes"
    Add-ReportLine $lines ""
    Add-ReportLine $lines '- No `.env` file was deleted.'
    Add-ReportLine $lines '- No database volume was reset.'
    Add-ReportLine $lines '- No production data was restored over.'
    Add-ReportLine $lines '- No push was performed.'
    Add-ReportLine $lines '- Secrets were not printed in evidence files.'
    Add-ReportLine $lines '- Fiscal compliance was not invented; fiscal sequences/settings still require real administrative validation before production use.'
    Add-ReportLine $lines ""

    Add-ReportLine $lines "## Next commands"
    Add-ReportLine $lines ""
    Add-ReportLine $lines '```powershell'
    Add-ReportLine $lines "powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\validate_lan_client.ps1 -BaseUrl $($BaseUrl.TrimEnd('/')) -EvidencePath qa\LAN_CLIENT_VALIDATION_PROOF.md"
    Add-ReportLine $lines "powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\init_production_proofs.ps1 -WhatIfOnly"
    Add-ReportLine $lines "powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\install_stack_autostart_windows.ps1 -UpdateExisting"
    Add-ReportLine $lines "powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\install_stack_autostart_windows.ps1 -Status"
    Add-ReportLine $lines "powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\install_backup_tasks_windows.ps1 -UpdateExisting -PhpPath $(Protect-HandoffText $PhpPath)"
    Add-ReportLine $lines "Start-ScheduledTask -TaskName SistemaCajaHospitalaria-BackupWorker"
    Add-ReportLine $lines "powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\install_backup_tasks_windows.ps1 -Status -PhpPath $(Protect-HandoffText $PhpPath)"
    Add-ReportLine $lines "# Then create one manual backup from the admin UI and confirm it moves from pending to success."
    Add-ReportLine $lines 'bash -lc "HOSPITAL_VALIDATE_RESTORE_MYSQL=1 RESTORE_TEST_DATABASE=hospital_restore_validation_test HOSPITAL_CONFIRM_RESTORE_DATABASE=hospital_restore_validation_test scripts/validate_restore_mysql.sh"'
    Add-ReportLine $lines "# Set HOSPITAL_CONCURRENCY_LOGIN and HOSPITAL_CONCURRENCY_PASSWORD for a temporary validation account outside this report."
    Add-ReportLine $lines "bash -lc `"HOSPITAL_VALIDATE_REAL_MYSQL=1 HOSPITAL_CONFIRM_CONCURRENCY_TARGET=$($BaseUrl.TrimEnd('/')) HOSPITAL_CONCURRENCY_BASE_URL=$($BaseUrl.TrimEnd('/')) HOSPITAL_CONCURRENCY_TARGET_ENV=validation HOSPITAL_CONCURRENCY_EVIDENCE_PATH=qa/FINAL_CONCURRENCY_PROOF.md scripts/validate_mysql_concurrency.sh`""
    Add-ReportLine $lines "powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\validate_support_packet_safety.ps1"
    Add-ReportLine $lines "powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\validate_first_level_support_safety.ps1"
    Add-ReportLine $lines "powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\validate_production_ready_gate_safety.ps1"
    Add-ReportLine $lines "powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\validate_final_field_blockers_safety.ps1 -SelfTest"
    Add-ReportLine $lines "powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\validate_browser_smoke_evidence.ps1"
    Add-ReportLine $lines "powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\validate_startup_repair_safety.ps1"
    Add-ReportLine $lines "powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\validate_operator_manuals_safety.ps1"
    Add-ReportLine $lines "powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\validate_backup_restore_docs_safety.ps1"
    Add-ReportLine $lines "powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\validate_backup_startup_current_user_safety.ps1"
    Add-ReportLine $lines "powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\validate_restore_windows_safety.ps1"
    Add-ReportLine $lines "powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\validate_installation_docs_safety.ps1"
    Add-ReportLine $lines "powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\validate_help_screen_safety.ps1"
    Add-ReportLine $lines "powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\validate_system_diagnostics_safety.ps1"
    Add-ReportLine $lines "powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\validate_double_action_safety.ps1"
    Add-ReportLine $lines "powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\validate_realtime_own_event_safety.ps1"
    Add-ReportLine $lines "powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\validate_installer_legacy_safety.ps1"
    Add-ReportLine $lines "powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\validate_lan_recovery_safety.ps1"
    Add-ReportLine $lines "powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\validate_lan_loadtest_safety.ps1"
    Add-ReportLine $lines "powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\validate_known_limitations_safety.ps1"
    Add-ReportLine $lines "powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\validate_maintenance_mode_safety.ps1"
    Add-ReportLine $lines "powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\validate_permission_audit_safety.ps1"
    Add-ReportLine $lines "powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\validate_rate_limit_safety.ps1"
    Add-ReportLine $lines "powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\validate_shift_incident_recovery_safety.ps1"
    Add-ReportLine $lines "powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\validate_new_invoice_maintainability.ps1"
    Add-ReportLine $lines "powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\validate_training_safety.ps1"
    Add-ReportLine $lines "powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\validate_training_acceptance_proof.ps1"
    Add-ReportLine $lines "powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\validate_field_proof_templates.ps1"
    Add-ReportLine $lines "powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\validate_proof_initialization_safety.ps1"
    Add-ReportLine $lines "powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\make_offline_release.ps1 -SelfTest"
    Add-ReportLine $lines "powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\assert_offline_release_clean.ps1 -SelfTest"
    Add-ReportLine $lines "powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\validate_operations_objective_audit.ps1"
    Add-ReportLine $lines "powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\validate_handoff_guard_coverage.ps1"
    Add-ReportLine $lines "powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\validate_offline_release_staging_safety.ps1"
    Add-ReportLine $lines "powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\validate_dependency_manifest.ps1"
    Add-ReportLine $lines "powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\validate_production_license_salt_guard.ps1"
    Add-ReportLine $lines "powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\validate_final_handoff_completeness.ps1 -HandoffPath $(Protect-HandoffText $path)"
    Add-ReportLine $lines "powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\validate_ops_evidence_index.ps1 -HandoffPath $(Protect-HandoffText $path)"
    Add-ReportLine $lines "powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\production_readiness_preflight.ps1 -BaseUrl $($BaseUrl.TrimEnd('/'))"
    Add-ReportLine $lines "powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\final_production_handoff.ps1 -BaseUrl $($BaseUrl.TrimEnd('/')) -PhpPath $(Protect-HandoffText $PhpPath)"
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

    Add-ReportLine $lines "## First-level support safety validation output"
    Add-ReportLine $lines ""
    Add-ReportLine $lines '```text'
    foreach ($line in $firstLevelSupportSafetyOutput) {
        Add-ReportLine $lines (Protect-HandoffText $line)
    }
    Add-ReportLine $lines '```'
    Add-ReportLine $lines ""

    Add-ReportLine $lines "## Production ready gate safety validation output"
    Add-ReportLine $lines ""
    Add-ReportLine $lines '```text'
    foreach ($line in $productionReadyGateSafetyOutput) {
        Add-ReportLine $lines (Protect-HandoffText $line)
    }
    Add-ReportLine $lines '```'
    Add-ReportLine $lines ""

    Add-ReportLine $lines "## Final field blockers safety self-test output"
    Add-ReportLine $lines ""
    Add-ReportLine $lines '```text'
    foreach ($line in $finalFieldBlockersSafetyOutput) {
        Add-ReportLine $lines (Protect-HandoffText $line)
    }
    Add-ReportLine $lines '```'
    Add-ReportLine $lines ""

    Add-ReportLine $lines "## Browser smoke evidence validation output"
    Add-ReportLine $lines ""
    Add-ReportLine $lines '```text'
    foreach ($line in $browserSmokeEvidenceOutput) {
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

    Add-ReportLine $lines "## Field proof templates safety validation output"
    Add-ReportLine $lines ""
    Add-ReportLine $lines '```text'
    foreach ($line in $fieldProofTemplatesSafetyOutput) {
        Add-ReportLine $lines (Protect-HandoffText $line)
    }
    Add-ReportLine $lines '```'
    Add-ReportLine $lines ""

    Add-ReportLine $lines "## Proof initialization safety validation output"
    Add-ReportLine $lines ""
    Add-ReportLine $lines '```text'
    foreach ($line in $proofInitializationSafetyOutput) {
        Add-ReportLine $lines (Protect-HandoffText $line)
    }
    Add-ReportLine $lines '```'
    Add-ReportLine $lines ""

    Add-ReportLine $lines "## Operations objective audit validation output"
    Add-ReportLine $lines ""
    Add-ReportLine $lines '```text'
    foreach ($line in $operationsObjectiveAuditOutput) {
        Add-ReportLine $lines (Protect-HandoffText $line)
    }
    Add-ReportLine $lines '```'
    Add-ReportLine $lines ""

    Add-ReportLine $lines "## Handoff guard coverage validation output"
    Add-ReportLine $lines ""
    Add-ReportLine $lines '```text'
    foreach ($line in $handoffGuardCoverageOutput) {
        Add-ReportLine $lines (Protect-HandoffText $line)
    }
    Add-ReportLine $lines '```'
    Add-ReportLine $lines ""

    Add-ReportLine $lines "## Offline release staging safety validation output"
    Add-ReportLine $lines ""
    Add-ReportLine $lines '```text'
    foreach ($line in $offlineReleaseStagingSafetyOutput) {
        Add-ReportLine $lines (Protect-HandoffText $line)
    }
    Add-ReportLine $lines '```'
    Add-ReportLine $lines ""

    Add-ReportLine $lines "## Offline release builder self-test output"
    Add-ReportLine $lines ""
    Add-ReportLine $lines '```text'
    foreach ($line in $offlineReleaseBuilderSelfTestOutput) {
        Add-ReportLine $lines (Protect-HandoffText $line)
    }
    Add-ReportLine $lines '```'
    Add-ReportLine $lines ""

    Add-ReportLine $lines "## Offline release guard self-test output"
    Add-ReportLine $lines ""
    Add-ReportLine $lines '```text'
    foreach ($line in $offlineReleaseGuardSelfTestOutput) {
        Add-ReportLine $lines (Protect-HandoffText $line)
    }
    Add-ReportLine $lines '```'
    Add-ReportLine $lines ""

    Add-ReportLine $lines "## Dependency manifest validation output"
    Add-ReportLine $lines ""
    Add-ReportLine $lines '```text'
    foreach ($line in $dependencyManifestOutput) {
        Add-ReportLine $lines (Protect-HandoffText $line)
    }
    Add-ReportLine $lines '```'
    Add-ReportLine $lines ""

    Add-ReportLine $lines "## Production license salt guard validation output"
    Add-ReportLine $lines ""
    Add-ReportLine $lines '```text'
    foreach ($line in $productionLicenseSaltGuardOutput) {
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

    Add-ReportLine $lines "## Backup startup current-user safety validation output"
    Add-ReportLine $lines ""
    Add-ReportLine $lines '```text'
    foreach ($line in $backupStartupCurrentUserSafetyOutput) {
        Add-ReportLine $lines (Protect-HandoffText $line)
    }
    Add-ReportLine $lines '```'
    Add-ReportLine $lines ""

    Add-ReportLine $lines "## Windows restore safety validation output"
    Add-ReportLine $lines ""
    Add-ReportLine $lines '```text'
    foreach ($line in $restoreWindowsSafetyOutput) {
        Add-ReportLine $lines (Protect-HandoffText $line)
    }
    Add-ReportLine $lines '```'
    Add-ReportLine $lines ""

    Add-ReportLine $lines "## Installation docs safety validation output"
    Add-ReportLine $lines ""
    Add-ReportLine $lines '```text'
    foreach ($line in $installationDocsSafetyOutput) {
        Add-ReportLine $lines (Protect-HandoffText $line)
    }
    Add-ReportLine $lines '```'
    Add-ReportLine $lines ""

    Add-ReportLine $lines "## Help screen safety validation output"
    Add-ReportLine $lines ""
    Add-ReportLine $lines '```text'
    foreach ($line in $helpScreenSafetyOutput) {
        Add-ReportLine $lines (Protect-HandoffText $line)
    }
    Add-ReportLine $lines '```'
    Add-ReportLine $lines ""

    Add-ReportLine $lines "## System diagnostics safety validation output"
    Add-ReportLine $lines ""
    Add-ReportLine $lines '```text'
    foreach ($line in $systemDiagnosticsSafetyOutput) {
        Add-ReportLine $lines (Protect-HandoffText $line)
    }
    Add-ReportLine $lines '```'
    Add-ReportLine $lines ""

    Add-ReportLine $lines "## Double-action safety validation output"
    Add-ReportLine $lines ""
    Add-ReportLine $lines '```text'
    foreach ($line in $doubleActionSafetyOutput) {
        Add-ReportLine $lines (Protect-HandoffText $line)
    }
    Add-ReportLine $lines '```'
    Add-ReportLine $lines ""

    Add-ReportLine $lines "## Realtime own-event safety validation output"
    Add-ReportLine $lines ""
    Add-ReportLine $lines '```text'
    foreach ($line in $realtimeOwnEventSafetyOutput) {
        Add-ReportLine $lines (Protect-HandoffText $line)
    }
    Add-ReportLine $lines '```'
    Add-ReportLine $lines ""

    Add-ReportLine $lines "## Installer legacy safety validation output"
    Add-ReportLine $lines ""
    Add-ReportLine $lines '```text'
    foreach ($line in $installerLegacySafetyOutput) {
        Add-ReportLine $lines (Protect-HandoffText $line)
    }
    Add-ReportLine $lines '```'
    Add-ReportLine $lines ""

    Add-ReportLine $lines "## LAN recovery safety validation output"
    Add-ReportLine $lines ""
    Add-ReportLine $lines '```text'
    foreach ($line in $lanRecoverySafetyOutput) {
        Add-ReportLine $lines (Protect-HandoffText $line)
    }
    Add-ReportLine $lines '```'
    Add-ReportLine $lines ""

    Add-ReportLine $lines "## LAN loadtest safety validation output"
    Add-ReportLine $lines ""
    Add-ReportLine $lines '```text'
    foreach ($line in $lanLoadtestSafetyOutput) {
        Add-ReportLine $lines (Protect-HandoffText $line)
    }
    Add-ReportLine $lines '```'
    Add-ReportLine $lines ""

    Add-ReportLine $lines "## Known limitations safety validation output"
    Add-ReportLine $lines ""
    Add-ReportLine $lines '```text'
    foreach ($line in $knownLimitationsSafetyOutput) {
        Add-ReportLine $lines (Protect-HandoffText $line)
    }
    Add-ReportLine $lines '```'
    Add-ReportLine $lines ""

    Add-ReportLine $lines "## Maintenance mode safety validation output"
    Add-ReportLine $lines ""
    Add-ReportLine $lines '```text'
    foreach ($line in $maintenanceModeSafetyOutput) {
        Add-ReportLine $lines (Protect-HandoffText $line)
    }
    Add-ReportLine $lines '```'
    Add-ReportLine $lines ""

    Add-ReportLine $lines "## Permission audit safety validation output"
    Add-ReportLine $lines ""
    Add-ReportLine $lines '```text'
    foreach ($line in $permissionAuditSafetyOutput) {
        Add-ReportLine $lines (Protect-HandoffText $line)
    }
    Add-ReportLine $lines '```'
    Add-ReportLine $lines ""

    Add-ReportLine $lines "## Rate-limit safety validation output"
    Add-ReportLine $lines ""
    Add-ReportLine $lines '```text'
    foreach ($line in $rateLimitSafetyOutput) {
        Add-ReportLine $lines (Protect-HandoffText $line)
    }
    Add-ReportLine $lines '```'
    Add-ReportLine $lines ""

    Add-ReportLine $lines "## Shift incident recovery safety validation output"
    Add-ReportLine $lines ""
    Add-ReportLine $lines '```text'
    foreach ($line in $shiftIncidentRecoverySafetyOutput) {
        Add-ReportLine $lines (Protect-HandoffText $line)
    }
    Add-ReportLine $lines '```'
    Add-ReportLine $lines ""

    Add-ReportLine $lines "## New invoice maintainability validation output"
    Add-ReportLine $lines ""
    Add-ReportLine $lines '```text'
    foreach ($line in $newInvoiceMaintainabilityOutput) {
        Add-ReportLine $lines (Protect-HandoffText $line)
    }
    Add-ReportLine $lines '```'
    Add-ReportLine $lines ""

    Add-ReportLine $lines "## Final handoff completeness validation output"
    Add-ReportLine $lines ""
    Add-ReportLine $lines '```text'
    foreach ($line in $finalHandoffCompletenessOutput) {
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
Assert-ScriptExists $offlineReleaseBuilderScript
Assert-ScriptExists $backupTasksScript
Assert-ScriptExists $releaseGuardScript
Assert-ScriptExists $evidenceIndexScript
Assert-ScriptExists $dependencyManifestScript
Assert-ScriptExists $productionLicenseSaltGuardScript
Assert-ScriptExists $trainingSafetyScript
Assert-ScriptExists $trainingAcceptanceProofGuardScript
Assert-ScriptExists $fieldProofTemplatesSafetyScript
Assert-ScriptExists $proofInitializationSafetyScript
Assert-ScriptExists $operationsObjectiveAuditScript
Assert-ScriptExists $handoffGuardCoverageScript
Assert-ScriptExists $offlineReleaseStagingSafetyScript
Assert-ScriptExists $supportPacketSafetyScript
Assert-ScriptExists $firstLevelSupportSafetyScript
Assert-ScriptExists $productionReadyGateSafetyScript
Assert-ScriptExists $finalFieldBlockersSafetyScript
Assert-ScriptExists $browserSmokeEvidenceScript
Assert-ScriptExists $startupRepairSafetyScript
Assert-ScriptExists $operatorManualsSafetyScript
Assert-ScriptExists $backupRestoreDocsSafetyScript
Assert-ScriptExists $backupStartupCurrentUserSafetyScript
Assert-ScriptExists $restoreWindowsSafetyScript
Assert-ScriptExists $installationDocsSafetyScript
Assert-ScriptExists $helpScreenSafetyScript
Assert-ScriptExists $systemDiagnosticsSafetyScript
Assert-ScriptExists $doubleActionSafetyScript
Assert-ScriptExists $realtimeOwnEventSafetyScript
Assert-ScriptExists $installerLegacySafetyScript
Assert-ScriptExists $lanRecoverySafetyScript
Assert-ScriptExists $lanLoadtestSafetyScript
Assert-ScriptExists $knownLimitationsSafetyScript
Assert-ScriptExists $maintenanceModeSafetyScript
Assert-ScriptExists $permissionAuditSafetyScript
Assert-ScriptExists $rateLimitSafetyScript
Assert-ScriptExists $shiftIncidentRecoverySafetyScript
Assert-ScriptExists $newInvoiceMaintainabilityScript
Assert-ScriptExists $finalHandoffCompletenessScript

Write-Host "Sistema de Caja Hospitalaria final production handoff"
Write-Host "ProjectRoot: $(Protect-HandoffText $ProjectRoot)"
Write-Host "BaseUrl: $($BaseUrl.TrimEnd('/'))"
Write-Host "PhpPath: $(Protect-HandoffText $PhpPath)"

Write-Section "Proof files"
if ($InitializeProofFiles) {
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $proofInitScript -ProjectRoot $ProjectRoot
}

$lanProofCompleted = Test-ProofLooksCompleted $lanProofPath
$printerProofCompleted = Test-ProofLooksCompleted $printerProofPath
$restoreProofCompleted = Test-ProofLooksCompleted $restoreProofPath
$concurrencyProofCompleted = Test-ProofLooksCompleted $concurrencyProofPath
$trainingAcceptanceProofCompleted = Test-ProofLooksCompleted $trainingAcceptanceProofPath
$allHandoffProofsCompleted = $lanProofCompleted -and $printerProofCompleted -and $restoreProofCompleted -and $concurrencyProofCompleted -and $trainingAcceptanceProofCompleted
Write-Result $lanProofCompleted "Second-client LAN proof file has required handoff fields; preflight performs strict validation." "Second-client LAN proof is missing, incomplete, has placeholders, or references missing evidence."
Write-Result $printerProofCompleted "Physical printer proof file has required handoff fields; preflight performs strict validation." "Physical printer proof is missing, incomplete, has placeholders, or references missing evidence."
Write-Result $restoreProofCompleted "Final restore proof file has required handoff fields; preflight performs strict validation." "Final restore proof is missing, incomplete, has placeholders, or references missing evidence."
Write-Result $concurrencyProofCompleted "Final concurrency proof file has required handoff fields; preflight performs strict validation." "Final concurrency proof is missing, incomplete, has placeholders, or references missing evidence."
Write-Result $trainingAcceptanceProofCompleted "Supervised training acceptance proof file has required handoff fields; preflight performs strict validation." "Training acceptance proof is missing, incomplete, has placeholders, or references missing evidence."

if (-not $lanProofCompleted) {
    Write-Host "Run from the second LAN client:"
    Write-Host "powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\validate_lan_client.ps1 -BaseUrl $($BaseUrl.TrimEnd('/')) -EvidencePath qa\LAN_CLIENT_VALIDATION_PROOF.md"
}

if (-not $printerProofCompleted) {
    Write-Host "Print real media carta/carta/A5 samples, then complete qa\INSTITUTIONAL_RECEIPT_PRINT_PROOF.md with physical evidence."
}

if (-not $restoreProofCompleted) {
    Write-Host "Run restore validation into a disposable database, then complete qa\FINAL_RESTORE_PROOF.md."
}

if (-not $concurrencyProofCompleted) {
    Write-Host "Run concurrency validation against a disposable target, then complete qa\FINAL_CONCURRENCY_PROOF.md."
}

if (-not $trainingAcceptanceProofCompleted) {
    Write-Host "Run supervised role training in a safe practice environment, then complete qa\TRAINING_ACCEPTANCE_PROOF.md without names, patient data or secrets."
}

Write-Section "Backup automation"
$backupStatusOutput = @(& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $backupTasksScript -ProjectRoot $ProjectRoot -PhpPath $PhpPath -Status 2>&1 | ForEach-Object { $_.ToString() })
$backupStatusOutput | ForEach-Object { Write-Host (Protect-HandoffText $_) }
Write-Host "If tasks are missing or stale, run elevated PowerShell:"
Write-Host "powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\install_stack_autostart_windows.ps1 -UpdateExisting"
Write-Host "powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\install_stack_autostart_windows.ps1 -Status"
Write-Host "powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\install_backup_tasks_windows.ps1 -UpdateExisting -PhpPath $(Protect-HandoffText $PhpPath)"
Write-Host "Start-ScheduledTask -TaskName SistemaCajaHospitalaria-BackupWorker"
Write-Host "powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\install_backup_tasks_windows.ps1 -Status -PhpPath $(Protect-HandoffText $PhpPath)"

Write-Section "Offline release artifact"
$releaseGuardOutput = @(& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $releaseGuardScript -ProjectRoot $ProjectRoot -RequireCurrentCommit 2>&1 | ForEach-Object { $_.ToString() })
$releaseGuardExit = $LASTEXITCODE
$releaseGuardOutput | ForEach-Object { Write-Host (Protect-HandoffText $_) }

$supportPacketSafety = Invoke-SupportPacketSafetyGuard
$firstLevelSupportSafety = Invoke-FirstLevelSupportSafetyGuard
$productionReadyGateSafety = Invoke-ProductionReadyGateSafetyGuard
$finalFieldBlockersSafety = Invoke-FinalFieldBlockersSafetySelfTestGuard
$browserSmokeEvidence = Invoke-BrowserSmokeEvidenceGuard
$startupRepairSafety = Invoke-StartupRepairSafetyGuard
$operatorManualsSafety = Invoke-OperatorManualsSafetyGuard
$backupRestoreDocsSafety = Invoke-BackupRestoreDocsSafetyGuard
$backupStartupCurrentUserSafety = Invoke-BackupStartupCurrentUserSafetyGuard
$restoreWindowsSafety = Invoke-RestoreWindowsSafetyGuard
$installationDocsSafety = Invoke-InstallationDocsSafetyGuard
$helpScreenSafety = Invoke-HelpScreenSafetyGuard
$systemDiagnosticsSafety = Invoke-SystemDiagnosticsSafetyGuard
$doubleActionSafety = Invoke-DoubleActionSafetyGuard
$realtimeOwnEventSafety = Invoke-RealtimeOwnEventSafetyGuard
$installerLegacySafety = Invoke-InstallerLegacySafetyGuard
$lanRecoverySafety = Invoke-LanRecoverySafetyGuard
$lanLoadtestSafety = Invoke-LanLoadtestSafetyGuard
$knownLimitationsSafety = Invoke-KnownLimitationsSafetyGuard
$maintenanceModeSafety = Invoke-MaintenanceModeSafetyGuard
$permissionAuditSafety = Invoke-PermissionAuditSafetyGuard
$rateLimitSafety = Invoke-RateLimitSafetyGuard
$shiftIncidentRecoverySafety = Invoke-ShiftIncidentRecoverySafetyGuard
$newInvoiceMaintainability = Invoke-NewInvoiceMaintainabilityGuard
$trainingSafety = Invoke-TrainingSafetyGuard
$fieldProofTemplatesSafety = Invoke-FieldProofTemplatesSafetyGuard
$proofInitializationSafety = Invoke-ProofInitializationSafetyGuard
$operationsObjectiveAudit = Invoke-OperationsObjectiveAuditGuard
$handoffGuardCoverage = Invoke-HandoffGuardCoverageGuard
$offlineReleaseStagingSafety = Invoke-OfflineReleaseStagingSafetyGuard
$offlineReleaseBuilderSelfTest = Invoke-OfflineReleaseBuilderSelfTestGuard
$offlineReleaseGuardSelfTest = Invoke-OfflineReleaseGuardSelfTest
$dependencyManifest = Invoke-DependencyManifestGuard
$productionLicenseSaltGuard = Invoke-ProductionLicenseSaltGuard

if ($SkipPreflight) {
    Write-Section "Preflight skipped"
    Write-Host "SkipPreflight was used. This run cannot approve PRODUCTION_READY."
    Write-HandoffReport `
        -path $ReportPath `
        -lanProofCompleted $lanProofCompleted `
        -printerProofCompleted $printerProofCompleted `
        -restoreProofCompleted $restoreProofCompleted `
        -concurrencyProofCompleted $concurrencyProofCompleted `
        -trainingAcceptanceProofCompleted $trainingAcceptanceProofCompleted `
        -backupStatusOutput $backupStatusOutput `
        -releaseGuardOutput $releaseGuardOutput `
        -releaseGuardExit $releaseGuardExit `
        -supportPacketSafetyOutput $supportPacketSafety.Output `
        -supportPacketSafetyExit $supportPacketSafety.ExitCode `
        -firstLevelSupportSafetyOutput $firstLevelSupportSafety.Output `
        -firstLevelSupportSafetyExit $firstLevelSupportSafety.ExitCode `
        -productionReadyGateSafetyOutput $productionReadyGateSafety.Output `
        -productionReadyGateSafetyExit $productionReadyGateSafety.ExitCode `
        -finalFieldBlockersSafetyOutput $finalFieldBlockersSafety.Output `
        -finalFieldBlockersSafetyExit $finalFieldBlockersSafety.ExitCode `
        -browserSmokeEvidenceOutput $browserSmokeEvidence.Output `
        -browserSmokeEvidenceExit $browserSmokeEvidence.ExitCode `
        -startupRepairSafetyOutput $startupRepairSafety.Output `
        -startupRepairSafetyExit $startupRepairSafety.ExitCode `
        -operatorManualsSafetyOutput $operatorManualsSafety.Output `
        -operatorManualsSafetyExit $operatorManualsSafety.ExitCode `
        -backupRestoreDocsSafetyOutput $backupRestoreDocsSafety.Output `
        -backupRestoreDocsSafetyExit $backupRestoreDocsSafety.ExitCode `
        -backupStartupCurrentUserSafetyOutput $backupStartupCurrentUserSafety.Output `
        -backupStartupCurrentUserSafetyExit $backupStartupCurrentUserSafety.ExitCode `
        -restoreWindowsSafetyOutput $restoreWindowsSafety.Output `
        -restoreWindowsSafetyExit $restoreWindowsSafety.ExitCode `
        -installationDocsSafetyOutput $installationDocsSafety.Output `
        -installationDocsSafetyExit $installationDocsSafety.ExitCode `
        -helpScreenSafetyOutput $helpScreenSafety.Output `
        -helpScreenSafetyExit $helpScreenSafety.ExitCode `
        -systemDiagnosticsSafetyOutput $systemDiagnosticsSafety.Output `
        -systemDiagnosticsSafetyExit $systemDiagnosticsSafety.ExitCode `
        -doubleActionSafetyOutput $doubleActionSafety.Output `
        -doubleActionSafetyExit $doubleActionSafety.ExitCode `
        -realtimeOwnEventSafetyOutput $realtimeOwnEventSafety.Output `
        -realtimeOwnEventSafetyExit $realtimeOwnEventSafety.ExitCode `
        -installerLegacySafetyOutput $installerLegacySafety.Output `
        -installerLegacySafetyExit $installerLegacySafety.ExitCode `
        -lanRecoverySafetyOutput $lanRecoverySafety.Output `
        -lanRecoverySafetyExit $lanRecoverySafety.ExitCode `
        -lanLoadtestSafetyOutput $lanLoadtestSafety.Output `
        -lanLoadtestSafetyExit $lanLoadtestSafety.ExitCode `
        -knownLimitationsSafetyOutput $knownLimitationsSafety.Output `
        -knownLimitationsSafetyExit $knownLimitationsSafety.ExitCode `
        -maintenanceModeSafetyOutput $maintenanceModeSafety.Output `
        -maintenanceModeSafetyExit $maintenanceModeSafety.ExitCode `
        -permissionAuditSafetyOutput $permissionAuditSafety.Output `
        -permissionAuditSafetyExit $permissionAuditSafety.ExitCode `
        -rateLimitSafetyOutput $rateLimitSafety.Output `
        -rateLimitSafetyExit $rateLimitSafety.ExitCode `
        -shiftIncidentRecoverySafetyOutput $shiftIncidentRecoverySafety.Output `
        -shiftIncidentRecoverySafetyExit $shiftIncidentRecoverySafety.ExitCode `
        -newInvoiceMaintainabilityOutput $newInvoiceMaintainability.Output `
        -newInvoiceMaintainabilityExit $newInvoiceMaintainability.ExitCode `
        -trainingSafetyOutput $trainingSafety.Output `
        -trainingSafetyExit $trainingSafety.ExitCode `
        -fieldProofTemplatesSafetyOutput $fieldProofTemplatesSafety.Output `
        -fieldProofTemplatesSafetyExit $fieldProofTemplatesSafety.ExitCode `
        -proofInitializationSafetyOutput $proofInitializationSafety.Output `
        -proofInitializationSafetyExit $proofInitializationSafety.ExitCode `
        -operationsObjectiveAuditOutput $operationsObjectiveAudit.Output `
        -operationsObjectiveAuditExit $operationsObjectiveAudit.ExitCode `
        -handoffGuardCoverageOutput $handoffGuardCoverage.Output `
        -handoffGuardCoverageExit $handoffGuardCoverage.ExitCode `
        -offlineReleaseStagingSafetyOutput $offlineReleaseStagingSafety.Output `
        -offlineReleaseStagingSafetyExit $offlineReleaseStagingSafety.ExitCode `
        -offlineReleaseBuilderSelfTestOutput $offlineReleaseBuilderSelfTest.Output `
        -offlineReleaseBuilderSelfTestExit $offlineReleaseBuilderSelfTest.ExitCode `
        -offlineReleaseGuardSelfTestOutput $offlineReleaseGuardSelfTest.Output `
        -offlineReleaseGuardSelfTestExit $offlineReleaseGuardSelfTest.ExitCode `
        -dependencyManifestOutput $dependencyManifest.Output `
        -dependencyManifestExit $dependencyManifest.ExitCode `
        -productionLicenseSaltGuardOutput $productionLicenseSaltGuard.Output `
        -productionLicenseSaltGuardExit $productionLicenseSaltGuard.ExitCode `
        -finalHandoffCompletenessOutput @("Final handoff completeness validation pending until the handoff report is written.") `
        -finalHandoffCompletenessExit 2 `
        -evidenceIndexOutput @("Evidence index validation pending until the handoff report is written.") `
        -evidenceIndexExit 2 `
        -preflightOutput @("Preflight skipped by -SkipPreflight.") `
        -preflightExit 2 `
        -preflightSkipped $true

    $finalHandoffCompleteness = Invoke-FinalHandoffCompletenessGuard $ReportPath
    $evidenceIndex = Invoke-EvidenceIndexGuard $ReportPath
    Write-HandoffReport `
        -path $ReportPath `
        -lanProofCompleted $lanProofCompleted `
        -printerProofCompleted $printerProofCompleted `
        -restoreProofCompleted $restoreProofCompleted `
        -concurrencyProofCompleted $concurrencyProofCompleted `
        -trainingAcceptanceProofCompleted $trainingAcceptanceProofCompleted `
        -backupStatusOutput $backupStatusOutput `
        -releaseGuardOutput $releaseGuardOutput `
        -releaseGuardExit $releaseGuardExit `
        -supportPacketSafetyOutput $supportPacketSafety.Output `
        -supportPacketSafetyExit $supportPacketSafety.ExitCode `
        -firstLevelSupportSafetyOutput $firstLevelSupportSafety.Output `
        -firstLevelSupportSafetyExit $firstLevelSupportSafety.ExitCode `
        -productionReadyGateSafetyOutput $productionReadyGateSafety.Output `
        -productionReadyGateSafetyExit $productionReadyGateSafety.ExitCode `
        -finalFieldBlockersSafetyOutput $finalFieldBlockersSafety.Output `
        -finalFieldBlockersSafetyExit $finalFieldBlockersSafety.ExitCode `
        -browserSmokeEvidenceOutput $browserSmokeEvidence.Output `
        -browserSmokeEvidenceExit $browserSmokeEvidence.ExitCode `
        -startupRepairSafetyOutput $startupRepairSafety.Output `
        -startupRepairSafetyExit $startupRepairSafety.ExitCode `
        -operatorManualsSafetyOutput $operatorManualsSafety.Output `
        -operatorManualsSafetyExit $operatorManualsSafety.ExitCode `
        -backupRestoreDocsSafetyOutput $backupRestoreDocsSafety.Output `
        -backupRestoreDocsSafetyExit $backupRestoreDocsSafety.ExitCode `
        -backupStartupCurrentUserSafetyOutput $backupStartupCurrentUserSafety.Output `
        -backupStartupCurrentUserSafetyExit $backupStartupCurrentUserSafety.ExitCode `
        -restoreWindowsSafetyOutput $restoreWindowsSafety.Output `
        -restoreWindowsSafetyExit $restoreWindowsSafety.ExitCode `
        -installationDocsSafetyOutput $installationDocsSafety.Output `
        -installationDocsSafetyExit $installationDocsSafety.ExitCode `
        -helpScreenSafetyOutput $helpScreenSafety.Output `
        -helpScreenSafetyExit $helpScreenSafety.ExitCode `
        -systemDiagnosticsSafetyOutput $systemDiagnosticsSafety.Output `
        -systemDiagnosticsSafetyExit $systemDiagnosticsSafety.ExitCode `
        -doubleActionSafetyOutput $doubleActionSafety.Output `
        -doubleActionSafetyExit $doubleActionSafety.ExitCode `
        -realtimeOwnEventSafetyOutput $realtimeOwnEventSafety.Output `
        -realtimeOwnEventSafetyExit $realtimeOwnEventSafety.ExitCode `
        -installerLegacySafetyOutput $installerLegacySafety.Output `
        -installerLegacySafetyExit $installerLegacySafety.ExitCode `
        -lanRecoverySafetyOutput $lanRecoverySafety.Output `
        -lanRecoverySafetyExit $lanRecoverySafety.ExitCode `
        -lanLoadtestSafetyOutput $lanLoadtestSafety.Output `
        -lanLoadtestSafetyExit $lanLoadtestSafety.ExitCode `
        -knownLimitationsSafetyOutput $knownLimitationsSafety.Output `
        -knownLimitationsSafetyExit $knownLimitationsSafety.ExitCode `
        -maintenanceModeSafetyOutput $maintenanceModeSafety.Output `
        -maintenanceModeSafetyExit $maintenanceModeSafety.ExitCode `
        -permissionAuditSafetyOutput $permissionAuditSafety.Output `
        -permissionAuditSafetyExit $permissionAuditSafety.ExitCode `
        -rateLimitSafetyOutput $rateLimitSafety.Output `
        -rateLimitSafetyExit $rateLimitSafety.ExitCode `
        -shiftIncidentRecoverySafetyOutput $shiftIncidentRecoverySafety.Output `
        -shiftIncidentRecoverySafetyExit $shiftIncidentRecoverySafety.ExitCode `
        -newInvoiceMaintainabilityOutput $newInvoiceMaintainability.Output `
        -newInvoiceMaintainabilityExit $newInvoiceMaintainability.ExitCode `
        -trainingSafetyOutput $trainingSafety.Output `
        -trainingSafetyExit $trainingSafety.ExitCode `
        -fieldProofTemplatesSafetyOutput $fieldProofTemplatesSafety.Output `
        -fieldProofTemplatesSafetyExit $fieldProofTemplatesSafety.ExitCode `
        -proofInitializationSafetyOutput $proofInitializationSafety.Output `
        -proofInitializationSafetyExit $proofInitializationSafety.ExitCode `
        -operationsObjectiveAuditOutput $operationsObjectiveAudit.Output `
        -operationsObjectiveAuditExit $operationsObjectiveAudit.ExitCode `
        -handoffGuardCoverageOutput $handoffGuardCoverage.Output `
        -handoffGuardCoverageExit $handoffGuardCoverage.ExitCode `
        -offlineReleaseStagingSafetyOutput $offlineReleaseStagingSafety.Output `
        -offlineReleaseStagingSafetyExit $offlineReleaseStagingSafety.ExitCode `
        -offlineReleaseBuilderSelfTestOutput $offlineReleaseBuilderSelfTest.Output `
        -offlineReleaseBuilderSelfTestExit $offlineReleaseBuilderSelfTest.ExitCode `
        -offlineReleaseGuardSelfTestOutput $offlineReleaseGuardSelfTest.Output `
        -offlineReleaseGuardSelfTestExit $offlineReleaseGuardSelfTest.ExitCode `
        -dependencyManifestOutput $dependencyManifest.Output `
        -dependencyManifestExit $dependencyManifest.ExitCode `
        -productionLicenseSaltGuardOutput $productionLicenseSaltGuard.Output `
        -productionLicenseSaltGuardExit $productionLicenseSaltGuard.ExitCode `
        -finalHandoffCompletenessOutput $finalHandoffCompleteness.Output `
        -finalHandoffCompletenessExit $finalHandoffCompleteness.ExitCode `
        -evidenceIndexOutput $evidenceIndex.Output `
        -evidenceIndexExit $evidenceIndex.ExitCode `
        -preflightOutput @("Preflight skipped by -SkipPreflight.") `
        -preflightExit 2 `
        -preflightSkipped $true
    exit 2
}

Write-Section "Production preflight"
$preflightOutput = @(& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $preflightScript -ProjectRoot $ProjectRoot -BaseUrl $BaseUrl 2>&1 | ForEach-Object { $_.ToString() })
$preflightExit = $LASTEXITCODE
$preflightOutput | ForEach-Object { Write-Host (Protect-HandoffText $_) }

Write-HandoffReport `
    -path $ReportPath `
    -lanProofCompleted $lanProofCompleted `
    -printerProofCompleted $printerProofCompleted `
    -restoreProofCompleted $restoreProofCompleted `
    -concurrencyProofCompleted $concurrencyProofCompleted `
    -trainingAcceptanceProofCompleted $trainingAcceptanceProofCompleted `
    -backupStatusOutput $backupStatusOutput `
    -releaseGuardOutput $releaseGuardOutput `
    -releaseGuardExit $releaseGuardExit `
    -supportPacketSafetyOutput $supportPacketSafety.Output `
    -supportPacketSafetyExit $supportPacketSafety.ExitCode `
    -firstLevelSupportSafetyOutput $firstLevelSupportSafety.Output `
    -firstLevelSupportSafetyExit $firstLevelSupportSafety.ExitCode `
    -productionReadyGateSafetyOutput $productionReadyGateSafety.Output `
    -productionReadyGateSafetyExit $productionReadyGateSafety.ExitCode `
    -finalFieldBlockersSafetyOutput $finalFieldBlockersSafety.Output `
    -finalFieldBlockersSafetyExit $finalFieldBlockersSafety.ExitCode `
    -browserSmokeEvidenceOutput $browserSmokeEvidence.Output `
    -browserSmokeEvidenceExit $browserSmokeEvidence.ExitCode `
    -startupRepairSafetyOutput $startupRepairSafety.Output `
    -startupRepairSafetyExit $startupRepairSafety.ExitCode `
    -operatorManualsSafetyOutput $operatorManualsSafety.Output `
    -operatorManualsSafetyExit $operatorManualsSafety.ExitCode `
    -backupRestoreDocsSafetyOutput $backupRestoreDocsSafety.Output `
    -backupRestoreDocsSafetyExit $backupRestoreDocsSafety.ExitCode `
    -backupStartupCurrentUserSafetyOutput $backupStartupCurrentUserSafety.Output `
    -backupStartupCurrentUserSafetyExit $backupStartupCurrentUserSafety.ExitCode `
    -restoreWindowsSafetyOutput $restoreWindowsSafety.Output `
    -restoreWindowsSafetyExit $restoreWindowsSafety.ExitCode `
    -installationDocsSafetyOutput $installationDocsSafety.Output `
    -installationDocsSafetyExit $installationDocsSafety.ExitCode `
    -helpScreenSafetyOutput $helpScreenSafety.Output `
    -helpScreenSafetyExit $helpScreenSafety.ExitCode `
    -systemDiagnosticsSafetyOutput $systemDiagnosticsSafety.Output `
    -systemDiagnosticsSafetyExit $systemDiagnosticsSafety.ExitCode `
    -doubleActionSafetyOutput $doubleActionSafety.Output `
    -doubleActionSafetyExit $doubleActionSafety.ExitCode `
    -realtimeOwnEventSafetyOutput $realtimeOwnEventSafety.Output `
    -realtimeOwnEventSafetyExit $realtimeOwnEventSafety.ExitCode `
    -installerLegacySafetyOutput $installerLegacySafety.Output `
    -installerLegacySafetyExit $installerLegacySafety.ExitCode `
    -lanRecoverySafetyOutput $lanRecoverySafety.Output `
    -lanRecoverySafetyExit $lanRecoverySafety.ExitCode `
    -lanLoadtestSafetyOutput $lanLoadtestSafety.Output `
    -lanLoadtestSafetyExit $lanLoadtestSafety.ExitCode `
    -knownLimitationsSafetyOutput $knownLimitationsSafety.Output `
    -knownLimitationsSafetyExit $knownLimitationsSafety.ExitCode `
    -maintenanceModeSafetyOutput $maintenanceModeSafety.Output `
    -maintenanceModeSafetyExit $maintenanceModeSafety.ExitCode `
    -permissionAuditSafetyOutput $permissionAuditSafety.Output `
    -permissionAuditSafetyExit $permissionAuditSafety.ExitCode `
    -rateLimitSafetyOutput $rateLimitSafety.Output `
    -rateLimitSafetyExit $rateLimitSafety.ExitCode `
    -shiftIncidentRecoverySafetyOutput $shiftIncidentRecoverySafety.Output `
    -shiftIncidentRecoverySafetyExit $shiftIncidentRecoverySafety.ExitCode `
    -newInvoiceMaintainabilityOutput $newInvoiceMaintainability.Output `
    -newInvoiceMaintainabilityExit $newInvoiceMaintainability.ExitCode `
    -trainingSafetyOutput $trainingSafety.Output `
    -trainingSafetyExit $trainingSafety.ExitCode `
    -fieldProofTemplatesSafetyOutput $fieldProofTemplatesSafety.Output `
    -fieldProofTemplatesSafetyExit $fieldProofTemplatesSafety.ExitCode `
    -proofInitializationSafetyOutput $proofInitializationSafety.Output `
    -proofInitializationSafetyExit $proofInitializationSafety.ExitCode `
    -operationsObjectiveAuditOutput $operationsObjectiveAudit.Output `
    -operationsObjectiveAuditExit $operationsObjectiveAudit.ExitCode `
    -handoffGuardCoverageOutput $handoffGuardCoverage.Output `
    -handoffGuardCoverageExit $handoffGuardCoverage.ExitCode `
    -offlineReleaseStagingSafetyOutput $offlineReleaseStagingSafety.Output `
    -offlineReleaseStagingSafetyExit $offlineReleaseStagingSafety.ExitCode `
    -offlineReleaseBuilderSelfTestOutput $offlineReleaseBuilderSelfTest.Output `
    -offlineReleaseBuilderSelfTestExit $offlineReleaseBuilderSelfTest.ExitCode `
    -offlineReleaseGuardSelfTestOutput $offlineReleaseGuardSelfTest.Output `
    -offlineReleaseGuardSelfTestExit $offlineReleaseGuardSelfTest.ExitCode `
    -dependencyManifestOutput $dependencyManifest.Output `
    -dependencyManifestExit $dependencyManifest.ExitCode `
    -productionLicenseSaltGuardOutput $productionLicenseSaltGuard.Output `
    -productionLicenseSaltGuardExit $productionLicenseSaltGuard.ExitCode `
    -finalHandoffCompletenessOutput @("Final handoff completeness validation pending until the handoff report is written.") `
    -finalHandoffCompletenessExit 2 `
    -evidenceIndexOutput @("Evidence index validation pending until the handoff report is written.") `
    -evidenceIndexExit 2 `
    -preflightOutput $preflightOutput `
    -preflightExit $preflightExit `
    -preflightSkipped $false

$finalHandoffCompleteness = Invoke-FinalHandoffCompletenessGuard $ReportPath
$evidenceIndex = Invoke-EvidenceIndexGuard $ReportPath
Write-HandoffReport `
    -path $ReportPath `
    -lanProofCompleted $lanProofCompleted `
    -printerProofCompleted $printerProofCompleted `
    -restoreProofCompleted $restoreProofCompleted `
    -concurrencyProofCompleted $concurrencyProofCompleted `
    -trainingAcceptanceProofCompleted $trainingAcceptanceProofCompleted `
    -backupStatusOutput $backupStatusOutput `
    -releaseGuardOutput $releaseGuardOutput `
    -releaseGuardExit $releaseGuardExit `
    -supportPacketSafetyOutput $supportPacketSafety.Output `
    -supportPacketSafetyExit $supportPacketSafety.ExitCode `
    -firstLevelSupportSafetyOutput $firstLevelSupportSafety.Output `
    -firstLevelSupportSafetyExit $firstLevelSupportSafety.ExitCode `
    -productionReadyGateSafetyOutput $productionReadyGateSafety.Output `
    -productionReadyGateSafetyExit $productionReadyGateSafety.ExitCode `
    -finalFieldBlockersSafetyOutput $finalFieldBlockersSafety.Output `
    -finalFieldBlockersSafetyExit $finalFieldBlockersSafety.ExitCode `
    -browserSmokeEvidenceOutput $browserSmokeEvidence.Output `
    -browserSmokeEvidenceExit $browserSmokeEvidence.ExitCode `
    -startupRepairSafetyOutput $startupRepairSafety.Output `
    -startupRepairSafetyExit $startupRepairSafety.ExitCode `
    -operatorManualsSafetyOutput $operatorManualsSafety.Output `
    -operatorManualsSafetyExit $operatorManualsSafety.ExitCode `
    -backupRestoreDocsSafetyOutput $backupRestoreDocsSafety.Output `
    -backupRestoreDocsSafetyExit $backupRestoreDocsSafety.ExitCode `
    -backupStartupCurrentUserSafetyOutput $backupStartupCurrentUserSafety.Output `
    -backupStartupCurrentUserSafetyExit $backupStartupCurrentUserSafety.ExitCode `
    -restoreWindowsSafetyOutput $restoreWindowsSafety.Output `
    -restoreWindowsSafetyExit $restoreWindowsSafety.ExitCode `
    -installationDocsSafetyOutput $installationDocsSafety.Output `
    -installationDocsSafetyExit $installationDocsSafety.ExitCode `
    -helpScreenSafetyOutput $helpScreenSafety.Output `
    -helpScreenSafetyExit $helpScreenSafety.ExitCode `
    -systemDiagnosticsSafetyOutput $systemDiagnosticsSafety.Output `
    -systemDiagnosticsSafetyExit $systemDiagnosticsSafety.ExitCode `
    -doubleActionSafetyOutput $doubleActionSafety.Output `
    -doubleActionSafetyExit $doubleActionSafety.ExitCode `
    -realtimeOwnEventSafetyOutput $realtimeOwnEventSafety.Output `
    -realtimeOwnEventSafetyExit $realtimeOwnEventSafety.ExitCode `
    -installerLegacySafetyOutput $installerLegacySafety.Output `
    -installerLegacySafetyExit $installerLegacySafety.ExitCode `
    -lanRecoverySafetyOutput $lanRecoverySafety.Output `
    -lanRecoverySafetyExit $lanRecoverySafety.ExitCode `
    -lanLoadtestSafetyOutput $lanLoadtestSafety.Output `
    -lanLoadtestSafetyExit $lanLoadtestSafety.ExitCode `
    -knownLimitationsSafetyOutput $knownLimitationsSafety.Output `
    -knownLimitationsSafetyExit $knownLimitationsSafety.ExitCode `
    -maintenanceModeSafetyOutput $maintenanceModeSafety.Output `
    -maintenanceModeSafetyExit $maintenanceModeSafety.ExitCode `
    -permissionAuditSafetyOutput $permissionAuditSafety.Output `
    -permissionAuditSafetyExit $permissionAuditSafety.ExitCode `
    -rateLimitSafetyOutput $rateLimitSafety.Output `
    -rateLimitSafetyExit $rateLimitSafety.ExitCode `
    -shiftIncidentRecoverySafetyOutput $shiftIncidentRecoverySafety.Output `
    -shiftIncidentRecoverySafetyExit $shiftIncidentRecoverySafety.ExitCode `
    -newInvoiceMaintainabilityOutput $newInvoiceMaintainability.Output `
    -newInvoiceMaintainabilityExit $newInvoiceMaintainability.ExitCode `
    -trainingSafetyOutput $trainingSafety.Output `
    -trainingSafetyExit $trainingSafety.ExitCode `
    -fieldProofTemplatesSafetyOutput $fieldProofTemplatesSafety.Output `
    -fieldProofTemplatesSafetyExit $fieldProofTemplatesSafety.ExitCode `
    -proofInitializationSafetyOutput $proofInitializationSafety.Output `
    -proofInitializationSafetyExit $proofInitializationSafety.ExitCode `
    -operationsObjectiveAuditOutput $operationsObjectiveAudit.Output `
    -operationsObjectiveAuditExit $operationsObjectiveAudit.ExitCode `
    -handoffGuardCoverageOutput $handoffGuardCoverage.Output `
    -handoffGuardCoverageExit $handoffGuardCoverage.ExitCode `
    -offlineReleaseStagingSafetyOutput $offlineReleaseStagingSafety.Output `
    -offlineReleaseStagingSafetyExit $offlineReleaseStagingSafety.ExitCode `
    -offlineReleaseBuilderSelfTestOutput $offlineReleaseBuilderSelfTest.Output `
    -offlineReleaseBuilderSelfTestExit $offlineReleaseBuilderSelfTest.ExitCode `
    -offlineReleaseGuardSelfTestOutput $offlineReleaseGuardSelfTest.Output `
    -offlineReleaseGuardSelfTestExit $offlineReleaseGuardSelfTest.ExitCode `
    -dependencyManifestOutput $dependencyManifest.Output `
    -dependencyManifestExit $dependencyManifest.ExitCode `
    -productionLicenseSaltGuardOutput $productionLicenseSaltGuard.Output `
    -productionLicenseSaltGuardExit $productionLicenseSaltGuard.ExitCode `
    -finalHandoffCompletenessOutput $finalHandoffCompleteness.Output `
    -finalHandoffCompletenessExit $finalHandoffCompleteness.ExitCode `
    -evidenceIndexOutput $evidenceIndex.Output `
    -evidenceIndexExit $evidenceIndex.ExitCode `
    -preflightOutput $preflightOutput `
    -preflightExit $preflightExit `
    -preflightSkipped $false

$allFinalAutomatedGuardsPassed = Test-GuardExitCodesPassed @(
    $preflightExit,
    $releaseGuardExit,
    $supportPacketSafety.ExitCode,
    $firstLevelSupportSafety.ExitCode,
    $productionReadyGateSafety.ExitCode,
    $finalFieldBlockersSafety.ExitCode,
    $browserSmokeEvidence.ExitCode,
    $startupRepairSafety.ExitCode,
    $operatorManualsSafety.ExitCode,
    $backupRestoreDocsSafety.ExitCode,
    $backupStartupCurrentUserSafety.ExitCode,
    $restoreWindowsSafety.ExitCode,
    $installationDocsSafety.ExitCode,
    $helpScreenSafety.ExitCode,
    $systemDiagnosticsSafety.ExitCode,
    $doubleActionSafety.ExitCode,
    $realtimeOwnEventSafety.ExitCode,
    $installerLegacySafety.ExitCode,
    $lanRecoverySafety.ExitCode,
    $lanLoadtestSafety.ExitCode,
    $knownLimitationsSafety.ExitCode,
    $maintenanceModeSafety.ExitCode,
    $permissionAuditSafety.ExitCode,
    $rateLimitSafety.ExitCode,
    $shiftIncidentRecoverySafety.ExitCode,
    $newInvoiceMaintainability.ExitCode,
    $trainingSafety.ExitCode,
    $fieldProofTemplatesSafety.ExitCode,
    $proofInitializationSafety.ExitCode,
    $operationsObjectiveAudit.ExitCode,
    $handoffGuardCoverage.ExitCode,
    $offlineReleaseStagingSafety.ExitCode,
    $offlineReleaseBuilderSelfTest.ExitCode,
    $offlineReleaseGuardSelfTest.ExitCode,
    $dependencyManifest.ExitCode,
    $productionLicenseSaltGuard.ExitCode,
    $finalHandoffCompleteness.ExitCode,
    $evidenceIndex.ExitCode
)

if ($allFinalAutomatedGuardsPassed -and $allHandoffProofsCompleted) {
    Write-Host ""
    Write-Host "PRODUCTION_READY evidence gate passed." -ForegroundColor Green
    exit 0
}

Write-Host ""
Write-Host "PRODUCTION_READY remains blocked. Keep status as PRODUCTION_CANDIDATE and close the missing evidence above." -ForegroundColor Yellow
if ($allFinalAutomatedGuardsPassed) {
    exit 1
}
if ($releaseGuardExit -ne 0) {
    exit $releaseGuardExit
}
if ($supportPacketSafety.ExitCode -ne 0) {
    exit $supportPacketSafety.ExitCode
}
if ($firstLevelSupportSafety.ExitCode -ne 0) {
    exit $firstLevelSupportSafety.ExitCode
}
if ($productionReadyGateSafety.ExitCode -ne 0) {
    exit $productionReadyGateSafety.ExitCode
}
if ($finalFieldBlockersSafety.ExitCode -ne 0) {
    exit $finalFieldBlockersSafety.ExitCode
}
if ($browserSmokeEvidence.ExitCode -ne 0) {
    exit $browserSmokeEvidence.ExitCode
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
if ($backupStartupCurrentUserSafety.ExitCode -ne 0) {
    exit $backupStartupCurrentUserSafety.ExitCode
}
if ($restoreWindowsSafety.ExitCode -ne 0) {
    exit $restoreWindowsSafety.ExitCode
}
if ($installationDocsSafety.ExitCode -ne 0) {
    exit $installationDocsSafety.ExitCode
}
if ($helpScreenSafety.ExitCode -ne 0) {
    exit $helpScreenSafety.ExitCode
}
if ($systemDiagnosticsSafety.ExitCode -ne 0) {
    exit $systemDiagnosticsSafety.ExitCode
}
if ($doubleActionSafety.ExitCode -ne 0) {
    exit $doubleActionSafety.ExitCode
}
if ($realtimeOwnEventSafety.ExitCode -ne 0) {
    exit $realtimeOwnEventSafety.ExitCode
}
if ($installerLegacySafety.ExitCode -ne 0) {
    exit $installerLegacySafety.ExitCode
}
if ($lanRecoverySafety.ExitCode -ne 0) {
    exit $lanRecoverySafety.ExitCode
}
if ($lanLoadtestSafety.ExitCode -ne 0) {
    exit $lanLoadtestSafety.ExitCode
}
if ($knownLimitationsSafety.ExitCode -ne 0) {
    exit $knownLimitationsSafety.ExitCode
}
if ($maintenanceModeSafety.ExitCode -ne 0) {
    exit $maintenanceModeSafety.ExitCode
}
if ($permissionAuditSafety.ExitCode -ne 0) {
    exit $permissionAuditSafety.ExitCode
}
if ($rateLimitSafety.ExitCode -ne 0) {
    exit $rateLimitSafety.ExitCode
}
if ($shiftIncidentRecoverySafety.ExitCode -ne 0) {
    exit $shiftIncidentRecoverySafety.ExitCode
}
if ($newInvoiceMaintainability.ExitCode -ne 0) {
    exit $newInvoiceMaintainability.ExitCode
}
if ($trainingSafety.ExitCode -ne 0) {
    exit $trainingSafety.ExitCode
}
if ($fieldProofTemplatesSafety.ExitCode -ne 0) {
    exit $fieldProofTemplatesSafety.ExitCode
}
if ($proofInitializationSafety.ExitCode -ne 0) {
    exit $proofInitializationSafety.ExitCode
}
if ($operationsObjectiveAudit.ExitCode -ne 0) {
    exit $operationsObjectiveAudit.ExitCode
}
if ($handoffGuardCoverage.ExitCode -ne 0) {
    exit $handoffGuardCoverage.ExitCode
}
if ($offlineReleaseStagingSafety.ExitCode -ne 0) {
    exit $offlineReleaseStagingSafety.ExitCode
}
if ($offlineReleaseBuilderSelfTest.ExitCode -ne 0) {
    exit $offlineReleaseBuilderSelfTest.ExitCode
}
if ($offlineReleaseGuardSelfTest.ExitCode -ne 0) {
    exit $offlineReleaseGuardSelfTest.ExitCode
}
if ($dependencyManifest.ExitCode -ne 0) {
    exit $dependencyManifest.ExitCode
}
if ($productionLicenseSaltGuard.ExitCode -ne 0) {
    exit $productionLicenseSaltGuard.ExitCode
}
if ($finalHandoffCompleteness.ExitCode -ne 0) {
    exit $finalHandoffCompleteness.ExitCode
}
if ($evidenceIndex.ExitCode -ne 0) {
    exit $evidenceIndex.ExitCode
}
exit $preflightExit
