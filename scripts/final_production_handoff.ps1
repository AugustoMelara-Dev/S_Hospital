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
$lanClientProofGuardScript = Join-Path $scriptsDir "validate_lan_client_proof.ps1"
$finalStartupTaskProofGuardScript = Join-Path $scriptsDir "validate_final_startup_task_proof.ps1"
$finalBackupTaskProofGuardScript = Join-Path $scriptsDir "validate_final_backup_task_proof.ps1"
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
$institutionalReceiptPrintProofGuardScript = Join-Path $scriptsDir "validate_institutional_receipt_print_proof.ps1"
$permissionAuditSafetyScript = Join-Path $scriptsDir "validate_permission_audit_safety.ps1"
$rateLimitSafetyScript = Join-Path $scriptsDir "validate_rate_limit_safety.ps1"
$shiftIncidentRecoverySafetyScript = Join-Path $scriptsDir "validate_shift_incident_recovery_safety.ps1"
$newInvoiceMaintainabilityScript = Join-Path $scriptsDir "validate_new_invoice_maintainability.ps1"
$finalHandoffCompletenessScript = Join-Path $scriptsDir "validate_final_handoff_completeness.ps1"
$lanProofPath = Join-Path $qaDir "LAN_CLIENT_VALIDATION_PROOF.md"
$printerProofPath = Join-Path $qaDir "INSTITUTIONAL_RECEIPT_PRINT_PROOF.md"
$startupTaskProofPath = Join-Path $qaDir "FINAL_STARTUP_TASK_PROOF.md"
$restoreProofPath = Join-Path $qaDir "FINAL_RESTORE_PROOF.md"
$backupTaskProofPath = Join-Path $qaDir "FINAL_BACKUP_TASK_PROOF.md"
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

function Invoke-FinalPhysicalProofCandidateGuardSuite {
    Write-Section "Final physical proof candidate guard suite"
    $combinedOutput = New-Object System.Collections.Generic.List[string]
    $suiteExitCode = 0
    $checks = @(
        @{
            Title = "LAN client proof pending validation"
            Script = $lanClientProofGuardScript
            Arguments = @("-AllowPendingFinalField")
        },
        @{
            Title = "Institutional receipt print proof pending validation"
            Script = $institutionalReceiptPrintProofGuardScript
            Arguments = @("-AllowPendingHardwareValidation")
        },
        @{
            Title = "Final startup task proof pending validation"
            Script = $finalStartupTaskProofGuardScript
            Arguments = @("-AllowPendingFinalField")
        },
        @{
            Title = "Final backup task proof pending validation"
            Script = $finalBackupTaskProofGuardScript
            Arguments = @("-AllowPendingFinalField")
        },
        @{
            Title = "Training acceptance proof pending validation"
            Script = $trainingAcceptanceProofGuardScript
            Arguments = @("-AllowPendingFinalField")
        }
    )

    foreach ($check in $checks) {
        $header = "== $($check.Title) =="
        $combinedOutput.Add($header) | Out-Null
        Write-Host $header

        $arguments = @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", $check.Script, "-ProjectRoot", $ProjectRoot) + $check.Arguments
        $output = @(& powershell.exe @arguments 2>&1 | ForEach-Object { $_.ToString() })
        $exitCode = $LASTEXITCODE
        $output | ForEach-Object {
            $line = Protect-HandoffText $_
            Write-Host $line
            $combinedOutput.Add($line) | Out-Null
        }

        $exitLine = "Exit code: $exitCode"
        Write-Host $exitLine
        $combinedOutput.Add($exitLine) | Out-Null
        $combinedOutput.Add("") | Out-Null

        if ($exitCode -ne 0) {
            $suiteExitCode = $exitCode
        }
    }

    return @{
        Output = @($combinedOutput)
        ExitCode = $suiteExitCode
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
    $lines.Add($line.TrimEnd()) | Out-Null
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
    [bool] $startupTaskProofCompleted,
    [bool] $restoreProofCompleted,
    [bool] $backupTaskProofCompleted,
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
    [string[]] $finalPhysicalProofCandidateGuardOutput,
    [int] $finalPhysicalProofCandidateGuardExit,
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
    $allProofsCompleted = $lanProofCompleted -and $printerProofCompleted -and $startupTaskProofCompleted -and $restoreProofCompleted -and $backupTaskProofCompleted -and $concurrencyProofCompleted -and $trainingAcceptanceProofCompleted
    $backupTasksReady = Test-BackupTasksReady $backupStatusOutput
    $allAutomatedGuardsPassed = Test-GuardExitCodesPassed @(
        $releaseGuardExit,
        $supportPacketSafetyExit,
        $firstLevelSupportSafetyExit,
        $productionReadyGateSafetyExit,
        $finalFieldBlockersSafetyExit,
        $finalPhysicalProofCandidateGuardExit,
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

    Add-ReportLine $lines "# Resultado de handoff final de produccion"
    Add-ReportLine $lines ""
    Add-ReportLine $lines "- Generado: $now"
    Add-ReportLine $lines "- URL base: $($BaseUrl.TrimEnd('/'))"
    Add-ReportLine $lines "- Carpeta del sistema: $(Protect-HandoffText $ProjectRoot)"
    Add-ReportLine $lines "- Decision: $decision"
    Add-ReportLine $lines "- Evidencia de cliente LAN sin marcadores obvios: $lanProofCompleted"
    Add-ReportLine $lines "- Evidencia de impresion institucional sin marcadores obvios: $printerProofCompleted"
    Add-ReportLine $lines "- Evidencia final de autoarranque sin marcadores obvios: $startupTaskProofCompleted"
    Add-ReportLine $lines "- Evidencia final de restore sin marcadores obvios: $restoreProofCompleted"
    Add-ReportLine $lines "- Evidencia final de respaldos sin marcadores obvios: $backupTaskProofCompleted"
    Add-ReportLine $lines "- Evidencia final de concurrencia sin marcadores obvios: $concurrencyProofCompleted"
    Add-ReportLine $lines "- Evidencia de capacitacion supervisada sin marcadores obvios: $trainingAcceptanceProofCompleted"
    Add-ReportLine $lines "- Tareas programadas de respaldo listas segun status: $backupTasksReady"
    Add-ReportLine $lines '- Archivo de evidencia de cliente LAN: `qa/LAN_CLIENT_VALIDATION_PROOF.md`'
    Add-ReportLine $lines '- Archivo de evidencia de impresion institucional: `qa/INSTITUTIONAL_RECEIPT_PRINT_PROOF.md`'
    Add-ReportLine $lines '- Archivo de evidencia final de autoarranque: `qa/FINAL_STARTUP_TASK_PROOF.md`'
    Add-ReportLine $lines '- Archivo de evidencia final de restore: `qa/FINAL_RESTORE_PROOF.md`'
    Add-ReportLine $lines '- Archivo de evidencia final de respaldos: `qa/FINAL_BACKUP_TASK_PROOF.md`'
    Add-ReportLine $lines '- Archivo de evidencia final de concurrencia: `qa/FINAL_CONCURRENCY_PROOF.md`'
    Add-ReportLine $lines '- Archivo de evidencia de capacitacion supervisada: `qa/TRAINING_ACCEPTANCE_PROOF.md`'
    Add-ReportLine $lines "- Offline release artifact guard exit code: $releaseGuardExit"
    Add-ReportLine $lines "- Support packet safety guard exit code: $supportPacketSafetyExit"
    Add-ReportLine $lines "- First-level support safety guard exit code: $firstLevelSupportSafetyExit"
    Add-ReportLine $lines "- Production ready gate safety guard exit code: $productionReadyGateSafetyExit"
    Add-ReportLine $lines "- Final field blockers safety self-test exit code: $finalFieldBlockersSafetyExit"
    Add-ReportLine $lines "- Final physical proof candidate guard suite exit code: $finalPhysicalProofCandidateGuardExit"
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
    Add-ReportLine $lines "- Preflight omitido: $preflightSkipped"
    Add-ReportLine $lines "- Codigo de salida de preflight: $preflightExit"
    Add-ReportLine $lines ""

    Add-ReportLine $lines "## Resultado"
    Add-ReportLine $lines ""
    if ($decision -eq "PRODUCTION_READY") {
        Add-ReportLine $lines "El preflight paso sin banderas de omision. Conserve este reporte junto con las evidencias fisicas completadas."
    } else {
        Add-ReportLine $lines "No declare PRODUCTION_READY. Mantenga el sistema como PRODUCTION_CANDIDATE hasta cerrar cada pendiente con evidencia real de campo."
    }
    Add-ReportLine $lines ""

    Add-ReportLine $lines "## Pendientes bloqueantes"
    Add-ReportLine $lines ""
    if (-not $lanProofCompleted) {
        Add-ReportLine $lines '- Falta o esta incompleto `qa/LAN_CLIENT_VALIDATION_PROOF.md` desde una segunda computadora real en LAN.'
    }
    if (-not $printerProofCompleted) {
        Add-ReportLine $lines '- Falta o esta incompleto `qa/INSTITUTIONAL_RECEIPT_PRINT_PROOF.md` desde la impresora real de caja.'
    }
    if (-not $startupTaskProofCompleted) {
        Add-ReportLine $lines '- Falta o esta incompleto `qa/FINAL_STARTUP_TASK_PROOF.md` despues de instalar autoarranque y confirmar que el servidor abre `/up` y login al iniciar.'
    }
    if (-not $restoreProofCompleted) {
        Add-ReportLine $lines '- Falta o esta incompleto `qa/FINAL_RESTORE_PROOF.md` desde una base descartable de restore en el servidor final.'
    }
    if (-not $backupTaskProofCompleted) {
        Add-ReportLine $lines '- Falta o esta incompleto `qa/FINAL_BACKUP_TASK_PROOF.md` despues de instalar tareas de respaldo y confirmar que un respaldo manual de la UI cambia de Pendiente a Protegido.'
    }
    if (-not $concurrencyProofCompleted) {
        Add-ReportLine $lines '- Falta o esta incompleto `qa/FINAL_CONCURRENCY_PROOF.md` desde un destino descartable de concurrencia.'
    }
    if (-not $trainingAcceptanceProofCompleted) {
        Add-ReportLine $lines '- Falta o esta incompleto `qa/TRAINING_ACCEPTANCE_PROOF.md` desde capacitacion supervisada por rol en un ambiente seguro de practica.'
    }
    if (-not $backupTasksReady) {
        Add-ReportLine $lines '- Instalar o actualizar las tareas Windows `SistemaCajaHospitalaria-BackupWorker` y `SistemaCajaHospitalaria-DailyBackup`, luego confirmar que un respaldo manual de la UI cambia de Pendiente a Protegido.'
    }
    if ($preflightSkipped) {
        Add-ReportLine $lines "- El preflight fue omitido en esta ejecucion de handoff."
    } elseif ($preflightExit -ne 0) {
        Add-ReportLine $lines "- El preflight de produccion devolvio codigo de salida $preflightExit."
    }
    if ($releaseGuardExit -ne 0) {
        Add-ReportLine $lines "- El artefacto de release offline falta, esta desactualizado o contiene archivos no permitidos."
    }
    if ($supportPacketSafetyExit -ne 0) {
        Add-ReportLine $lines "- La validacion de paquete seguro de soporte devolvio codigo de salida $supportPacketSafetyExit."
    }
    if ($firstLevelSupportSafetyExit -ne 0) {
        Add-ReportLine $lines "- La validacion de soporte de primer nivel devolvio codigo de salida $firstLevelSupportSafetyExit."
    }
    if ($productionReadyGateSafetyExit -ne 0) {
        Add-ReportLine $lines "- La validacion del gate PRODUCTION_READY devolvio codigo de salida $productionReadyGateSafetyExit."
    }
    if ($finalFieldBlockersSafetyExit -ne 0) {
        Add-ReportLine $lines "- El self-test de bloqueantes finales de campo devolvio codigo de salida $finalFieldBlockersSafetyExit."
    }
    if ($finalPhysicalProofCandidateGuardExit -ne 0) {
        Add-ReportLine $lines "- La suite de guards candidatos de evidencia fisica final devolvio codigo de salida $finalPhysicalProofCandidateGuardExit."
    }
    if ($browserSmokeEvidenceExit -ne 0) {
        Add-ReportLine $lines "- La validacion de evidencia de navegador devolvio codigo de salida $browserSmokeEvidenceExit."
    }
    if ($startupRepairSafetyExit -ne 0) {
        Add-ReportLine $lines "- La validacion de arranque y reparacion segura devolvio codigo de salida $startupRepairSafetyExit."
    }
    if ($operatorManualsSafetyExit -ne 0) {
        Add-ReportLine $lines "- La validacion de manuales de operador devolvio codigo de salida $operatorManualsSafetyExit."
    }
    if ($backupRestoreDocsSafetyExit -ne 0) {
        Add-ReportLine $lines "- La validacion de documentos de respaldo y restore devolvio codigo de salida $backupRestoreDocsSafetyExit."
    }
    if ($backupStartupCurrentUserSafetyExit -ne 0) {
        Add-ReportLine $lines "- La validacion de arranque de respaldos por usuario devolvio codigo de salida $backupStartupCurrentUserSafetyExit."
    }
    if ($restoreWindowsSafetyExit -ne 0) {
        Add-ReportLine $lines "- La validacion de restore seguro en Windows devolvio codigo de salida $restoreWindowsSafetyExit."
    }
    if ($installationDocsSafetyExit -ne 0) {
        Add-ReportLine $lines "- La validacion de documentos de instalacion devolvio codigo de salida $installationDocsSafetyExit."
    }
    if ($helpScreenSafetyExit -ne 0) {
        Add-ReportLine $lines "- La validacion de pantalla de ayuda devolvio codigo de salida $helpScreenSafetyExit."
    }
    if ($systemDiagnosticsSafetyExit -ne 0) {
        Add-ReportLine $lines "- La validacion de diagnostico del sistema devolvio codigo de salida $systemDiagnosticsSafetyExit."
    }
    if ($doubleActionSafetyExit -ne 0) {
        Add-ReportLine $lines "- La validacion contra doble accion devolvio codigo de salida $doubleActionSafetyExit."
    }
    if ($realtimeOwnEventSafetyExit -ne 0) {
        Add-ReportLine $lines "- La validacion de eventos propios en tiempo real devolvio codigo de salida $realtimeOwnEventSafetyExit."
    }
    if ($installerLegacySafetyExit -ne 0) {
        Add-ReportLine $lines "- La validacion del instalador heredado devolvio codigo de salida $installerLegacySafetyExit."
    }
    if ($lanRecoverySafetyExit -ne 0) {
        Add-ReportLine $lines "- La validacion de recuperacion LAN devolvio codigo de salida $lanRecoverySafetyExit."
    }
    if ($lanLoadtestSafetyExit -ne 0) {
        Add-ReportLine $lines "- La validacion de carga LAN devolvio codigo de salida $lanLoadtestSafetyExit."
    }
    if ($knownLimitationsSafetyExit -ne 0) {
        Add-ReportLine $lines "- La validacion de limitaciones conocidas devolvio codigo de salida $knownLimitationsSafetyExit."
    }
    if ($maintenanceModeSafetyExit -ne 0) {
        Add-ReportLine $lines "- La validacion de modo mantenimiento devolvio codigo de salida $maintenanceModeSafetyExit."
    }
    if ($permissionAuditSafetyExit -ne 0) {
        Add-ReportLine $lines "- La validacion de auditoria de permisos devolvio codigo de salida $permissionAuditSafetyExit."
    }
    if ($rateLimitSafetyExit -ne 0) {
        Add-ReportLine $lines "- La validacion de limites de uso devolvio codigo de salida $rateLimitSafetyExit."
    }
    if ($shiftIncidentRecoverySafetyExit -ne 0) {
        Add-ReportLine $lines "- La validacion de recuperacion de incidentes de turno devolvio codigo de salida $shiftIncidentRecoverySafetyExit."
    }
    if ($newInvoiceMaintainabilityExit -ne 0) {
        Add-ReportLine $lines "- La validacion de mantenibilidad de nueva factura devolvio codigo de salida $newInvoiceMaintainabilityExit."
    }
    if ($trainingSafetyExit -ne 0) {
        Add-ReportLine $lines "- La validacion de capacitacion segura devolvio codigo de salida $trainingSafetyExit."
    }
    if ($fieldProofTemplatesSafetyExit -ne 0) {
        Add-ReportLine $lines "- La validacion de plantillas de evidencia de campo devolvio codigo de salida $fieldProofTemplatesSafetyExit."
    }
    if ($proofInitializationSafetyExit -ne 0) {
        Add-ReportLine $lines "- La validacion de inicializacion de evidencias devolvio codigo de salida $proofInitializationSafetyExit."
    }
    if ($operationsObjectiveAuditExit -ne 0) {
        Add-ReportLine $lines "- La auditoria del objetivo operativo devolvio codigo de salida $operationsObjectiveAuditExit."
    }
    if ($handoffGuardCoverageExit -ne 0) {
        Add-ReportLine $lines "- La validacion de cobertura de guards de handoff devolvio codigo de salida $handoffGuardCoverageExit."
    }
    if ($offlineReleaseStagingSafetyExit -ne 0) {
        Add-ReportLine $lines "- La validacion de staging del release offline devolvio codigo de salida $offlineReleaseStagingSafetyExit."
    }
    if ($offlineReleaseBuilderSelfTestExit -ne 0) {
        Add-ReportLine $lines "- El self-test del constructor offline devolvio codigo de salida $offlineReleaseBuilderSelfTestExit."
    }
    if ($offlineReleaseGuardSelfTestExit -ne 0) {
        Add-ReportLine $lines "- El self-test del guard del release offline devolvio codigo de salida $offlineReleaseGuardSelfTestExit."
    }
    if ($dependencyManifestExit -ne 0) {
        Add-ReportLine $lines "- La validacion del manifiesto de dependencias devolvio codigo de salida $dependencyManifestExit."
    }
    if ($productionLicenseSaltGuardExit -ne 0) {
        Add-ReportLine $lines "- El guard de secreto de licencia de produccion devolvio codigo de salida $productionLicenseSaltGuardExit."
    }
    if ($finalHandoffCompletenessExit -ne 0) {
        Add-ReportLine $lines "- La validacion de completitud de handoff final devolvio codigo de salida $finalHandoffCompletenessExit."
    }
    if ($evidenceIndexExit -ne 0) {
        Add-ReportLine $lines "- La validacion del indice de evidencias de handoff final devolvio codigo de salida $evidenceIndexExit."
    }
    if ($allProofsCompleted -and $allAutomatedGuardsPassed -and -not $preflightSkipped -and $preflightExit -eq 0) {
        Add-ReportLine $lines "- Ninguno reportado por el script de handoff."
    }
    Add-ReportLine $lines ""

    Add-ReportLine $lines "## Evidencia completada en este frente de endurecimiento"
    Add-ReportLine $lines ""
    Add-ReportLine $lines '- Capturas controladas de navegador vigentes: `qa/browser-smoke-2026-06-08/` y `qa/BROWSER_SMOKE_EVIDENCE_2026_06_08.md`.'
    Add-ReportLine $lines '- Diagnostico del sistema y guardas de Ayuda/soporte: `qa/SYSTEM_DIAGNOSTICS_SAFETY_2026_06_03.md`, `qa/HELP_SCREEN_SAFETY_2026_06_03.md`, `qa/SUPPORT_PACKET_SAFETY_2026_06_03.md`, `qa/FIRST_LEVEL_SUPPORT_SAFETY_2026_06_04.md`.'
    Add-ReportLine $lines '- Tarea continua de respaldos, autoarranque, respaldo final y restore: `qa/BACKUP_WORKER_SMOKE_2026_06_03.md`, `qa/BACKUP_STARTUP_CURRENT_USER_SAFETY_2026_06_04.md`, `qa/FINAL_STARTUP_TASK_PROOF.example.md`, `qa/FINAL_STARTUP_TASK_PROOF.md`, `qa/FINAL_BACKUP_TASK_PROOF.example.md`, `qa/FINAL_BACKUP_TASK_PROOF.md`, `qa/FINAL_RESTORE_PROOF.md`, `qa/FINAL_RESTORE_PROOF_2026_06_03.md` y `qa/RESTORE_WINDOWS_SAFETY_2026_06_04.md`.'
    Add-ReportLine $lines '- Concurrencia, doble accion y eventos propios en tiempo real: `qa/FINAL_CONCURRENCY_PROOF.md`, `qa/DOUBLE_ACTION_SAFETY_2026_06_03.md` y `qa/REALTIME_OWN_EVENT_SAFETY_2026_06_04.md`.'
    Add-ReportLine $lines '- Guardas de arranque, instalacion, LAN, limitaciones conocidas, mantenimiento, auditoria de permisos, limites de uso y recuperacion de incidentes de turno: `qa/STARTUP_REPAIR_SAFETY_2026_06_03.md`, `qa/INSTALLATION_DOCS_SAFETY_2026_06_03.md`, `qa/LAN_RECOVERY_SAFETY_2026_06_03.md`, `qa/LAN_LOADTEST_SAFETY_2026_06_04.md`, `qa/KNOWN_LIMITATIONS_SAFETY_2026_06_03.md`, `qa/MAINTENANCE_MODE_SAFETY_2026_06_03.md`, `qa/PERMISSION_AUDIT_SAFETY_2026_06_03.md`, `qa/RATE_LIMIT_SAFETY_2026_06_03.md`, `qa/SHIFT_INCIDENT_RECOVERY_SAFETY_2026_06_03.md`.'
    Add-ReportLine $lines '- Guarda de mantenibilidad de nueva factura: `qa/NEW_INVOICE_MAINTAINABILITY_2026_06_04.md` y `scripts/validate_new_invoice_maintainability.ps1` conservan un flujo corto para caja.'
    Add-ReportLine $lines '- Evidencia de operador y capacitacion: `qa/OPERATOR_MANUALS_SAFETY_2026_06_03.md`, `qa/TRAINING_SAFETY_2026_06_03.md`, `qa/TRAINING_ACCEPTANCE_PROOF.example.md` y `qa/TRAINING_ACCEPTANCE_PROOF.md`.'
    Add-ReportLine $lines '- Evidencia de campo, bloqueantes finales, cliente LAN, carga LAN, inicializacion de evidencias, migracion MariaDB, cobertura de handoff, staging del release offline, constructor offline, guard del release offline, regeneracion offline, objetivo, release e indice: `qa/FIELD_PROOF_TEMPLATES_SAFETY_2026_06_03.md`, `qa/FINAL_FIELD_BLOCKERS_SAFETY_2026_06_04.md`, `qa/LAN_CLIENT_PROOF_GUARD_2026_06_05.md`, `qa/LAN_LOADTEST_SAFETY_2026_06_04.md`, `qa/LAN_LOADTEST_HANDOFF_2026_06_04.md`, `qa/PROOF_INITIALIZATION_SAFETY_2026_06_03.md`, `qa/MARIADB_MIGRATION_VALIDATION_2026_06_07.md`, `qa/HANDOFF_GUARD_COVERAGE_2026_06_04.md`, `qa/OFFLINE_RELEASE_STAGING_SAFETY_2026_06_04.md`, `qa/OFFLINE_RELEASE_BUILDER_SELFTEST_2026_06_03.md`, `qa/OFFLINE_RELEASE_GUARD_2026_06_03.md`, `qa/OFFLINE_RELEASE_REGEN_2026_06_04.md`, `qa/PRODUCTION_READY_GATE_VALIDATOR_2026_06_04.md`, `qa/PRODUCTION_LICENSE_SALT_GUARD_2026_06_04.md`, `qa/OPERATIONS_OBJECTIVE_AUDIT_2026_06_03.md`, `qa/OPS_EVIDENCE_INDEX_2026_06_03.md`.'
    Add-ReportLine $lines ""

    Add-ReportLine $lines "## Pruebas y gates a preservar"
    Add-ReportLine $lines ""
    Add-ReportLine $lines '- Formato backend: `docker compose exec -T backend ./vendor/bin/pint --test`.'
    Add-ReportLine $lines '- Analisis estatico backend: `docker compose exec -T backend ./vendor/bin/phpstan analyse --memory-limit=1G`.'
    Add-ReportLine $lines '- Pruebas backend: `docker compose exec -T backend php artisan test`.'
    Add-ReportLine $lines '- Gates frontend: `npm.cmd run lint`, `npm.cmd run typecheck`, `npm.cmd run test -- --run`, `npm.cmd run build`, `scripts\check-branding.ps1`.'
    Add-ReportLine $lines '- Smoke de navegador y operacion: capturas controladas de navegador, `npm.cmd run smoke:real`, smoke de tarea continua de respaldos, restore descartable, validacion de concurrencia y `scripts\production_readiness_preflight.ps1`.'
    Add-ReportLine $lines ""

    Add-ReportLine $lines "## Archivos modificados en este frente de handoff"
    Add-ReportLine $lines ""
    Add-ReportLine $lines '- Soporte y diagnostico dentro del sistema: `frontend/src/features/help/HelpView.tsx`, `frontend/src/features/about/AboutView.tsx`, `frontend/src/hooks/useServerStatus.ts`, `frontend/src/lib/support/clientIssueLog.ts`, `backend/app/Http/Controllers/SystemStatusController.php`.'
    Add-ReportLine $lines '- Scripts de arranque, instalacion y soporte: `scripts/deploy_hospital_lan.ps1`, `scripts/start_hospital_services.ps1`, `scripts/open_hospital_system.ps1`, `scripts/repair_hospital_system.ps1`, `scripts/restore_hospital_windows.ps1`, `scripts/collect_support_packet.ps1`, `scripts/install_hospital_startup_shortcut.ps1`, `scripts/install_stack_autostart_windows.ps1`, `scripts/install_backup_tasks_windows.ps1`, `scripts/install_backup_startup_current_user.ps1`, `scripts/start_backup_automation.cmd`, `scripts/run_backup_scheduler_loop.ps1`, `scripts/init_production_proofs.ps1`, `scripts/refresh_lan_ip.ps1`, `scripts/make_offline_release.ps1`, `scripts/final_production_handoff.ps1`.'
    Add-ReportLine $lines '- Guardas de evidencia: `scripts/assert_offline_release_clean.ps1`, `scripts/validate_browser_smoke_evidence.ps1`, `scripts/validate_startup_repair_safety.ps1`, `scripts/validate_operator_manuals_safety.ps1`, `scripts/validate_backup_restore_docs_safety.ps1`, `scripts/validate_backup_startup_current_user_safety.ps1`, `scripts/validate_restore_windows_safety.ps1`, `scripts/validate_installation_docs_safety.ps1`, `scripts/validate_help_screen_safety.ps1`, `scripts/validate_system_diagnostics_safety.ps1`, `scripts/validate_support_packet_safety.ps1`, `scripts/validate_first_level_support_safety.ps1`, `scripts/validate_production_ready_gate_safety.ps1`, `scripts/validate_final_field_blockers_safety.ps1`, `scripts/validate_double_action_safety.ps1`, `scripts/validate_realtime_own_event_safety.ps1`, `scripts/validate_installer_legacy_safety.ps1`, `scripts/validate_lan_recovery_safety.ps1`, `scripts/validate_lan_client.ps1`, `scripts/validate_lan_client_proof.ps1`, `scripts/validate_lan_loadtest_safety.ps1`, `scripts/validate_institutional_receipt_print_proof.ps1`, `scripts/validate_known_limitations_safety.ps1`, `scripts/validate_maintenance_mode_safety.ps1`, `scripts/validate_permission_audit_safety.ps1`, `scripts/validate_rate_limit_safety.ps1`, `scripts/validate_shift_incident_recovery_safety.ps1`, `scripts/validate_new_invoice_maintainability.ps1`, `scripts/validate_training_safety.ps1`, `scripts/validate_final_startup_task_proof.ps1`, `scripts/validate_final_backup_task_proof.ps1`, `scripts/validate_training_acceptance_proof.ps1`, `scripts/validate_field_proof_templates.ps1`, `scripts/validate_proof_initialization_safety.ps1`, `scripts/validate_operations_objective_audit.ps1`, `scripts/validate_handoff_guard_coverage.ps1`, `scripts/validate_offline_release_staging_safety.ps1`, `scripts/validate_dependency_manifest.ps1`, `scripts/validate_production_license_salt_guard.ps1`, `scripts/validate_ops_evidence_index.ps1`, `scripts/validate_final_handoff_completeness.ps1`.'
    Add-ReportLine $lines '- Material y evidencia de operacion: `docs/manuales`, `docs/RELEASE_CHECKLIST.md`, `qa/TRAINING_ACCEPTANCE_PROOF.example.md`, evidencias QA de seguridad historicas y capturas RC vigentes en `qa/browser-smoke-2026-06-08`.'
    Add-ReportLine $lines ""

    Add-ReportLine $lines "## Riesgos y limites"
    Add-ReportLine $lines ""
    Add-ReportLine $lines "- Docker local y la evidencia controlada de navegador no sustituyen la prueba final desde segunda PC LAN, MariaDB/servidor real ni impresora fisica."
    Add-ReportLine $lines "- El paquete offline todavia debe copiarse al servidor final y verificarse alli antes de uso productivo."
    Add-ReportLine $lines "- Si este reporte se commitea, el commit cambia despues de generar la evidencia; la prueba autoritativa del paquete es ejecutar `scripts\assert_offline_release_clean.ps1 -RequireCurrentCommit` despues del ultimo commit y antes del handoff fisico."
    Add-ReportLine $lines "- El entorno final de produccion debe verificarse con `APP_ENV=production` y `APP_DEBUG=false` antes del handoff productivo."
    Add-ReportLine $lines '- Las tareas Windows `SistemaCajaHospitalaria-BackupWorker` y `SistemaCajaHospitalaria-DailyBackup` deben instalarse o actualizarse en el servidor final.'
    Add-ReportLine $lines "- Las secuencias/configuraciones fiscales requieren validacion administrativa en el entorno real; este reporte no inventa cumplimiento fiscal."
    Add-ReportLine $lines "- Cualquier validacion de restore o concurrencia debe usar un destino descartable o una base de validacion aprobada explicitamente, nunca la base activa de produccion."
    Add-ReportLine $lines ""

    Add-ReportLine $lines "## Notas de seguridad"
    Add-ReportLine $lines ""
    Add-ReportLine $lines '- No se borro ningun archivo `.env`.'
    Add-ReportLine $lines '- No se reinicio ningun volumen de base de datos.'
    Add-ReportLine $lines '- No se sobrescribieron datos de produccion con un restore.'
    Add-ReportLine $lines '- No se hizo push.'
    Add-ReportLine $lines '- No se imprimieron secretos en archivos de evidencia.'
    Add-ReportLine $lines '- No se invento cumplimiento fiscal; las secuencias/configuraciones fiscales todavia requieren validacion administrativa real antes de operar en produccion.'
    Add-ReportLine $lines ""

    Add-ReportLine $lines "## Proximos comandos"
    Add-ReportLine $lines ""
    Add-ReportLine $lines '```powershell'
    Add-ReportLine $lines "powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\validate_lan_client.ps1 -BaseUrl $($BaseUrl.TrimEnd('/')) -EvidencePath qa\LAN_CLIENT_VALIDATION_PROOF.md"
    Add-ReportLine $lines "powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\init_production_proofs.ps1 -WhatIfOnly"
    Add-ReportLine $lines "powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\install_stack_autostart_windows.ps1 -UpdateExisting"
    Add-ReportLine $lines "powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\install_stack_autostart_windows.ps1 -Status"
    Add-ReportLine $lines "# Luego observe un arranque/reinicio del servidor o un inicio manual supervisado de la tarea, confirme /up y login, y complete qa\FINAL_STARTUP_TASK_PROOF.md."
    Add-ReportLine $lines "powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\install_backup_tasks_windows.ps1 -UpdateExisting -PhpPath $(Protect-HandoffText $PhpPath)"
    Add-ReportLine $lines "Start-ScheduledTask -TaskName SistemaCajaHospitalaria-BackupWorker"
    Add-ReportLine $lines "powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\install_backup_tasks_windows.ps1 -Status -PhpPath $(Protect-HandoffText $PhpPath)"
    Add-ReportLine $lines "# Crear un respaldo manual desde la UI administrativa, confirmar que cambia de Pendiente a Protegido y completar qa\FINAL_BACKUP_TASK_PROOF.md."
    Add-ReportLine $lines 'bash -lc "HOSPITAL_VALIDATE_RESTORE_MYSQL=1 RESTORE_TEST_DATABASE=hospital_restore_validation_test HOSPITAL_CONFIRM_RESTORE_DATABASE=hospital_restore_validation_test scripts/validate_restore_mysql.sh"'
    Add-ReportLine $lines "# Defina HOSPITAL_CONCURRENCY_LOGIN y HOSPITAL_CONCURRENCY_PASSWORD para una cuenta temporal de validacion fuera de este reporte."
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
    Add-ReportLine $lines "powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\validate_lan_client_proof.ps1 -AllowPendingFinalField"
    Add-ReportLine $lines "powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\validate_known_limitations_safety.ps1"
    Add-ReportLine $lines "powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\validate_maintenance_mode_safety.ps1"
    Add-ReportLine $lines "powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\validate_institutional_receipt_print_proof.ps1 -AllowPendingHardwareValidation"
    Add-ReportLine $lines "powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\validate_permission_audit_safety.ps1"
    Add-ReportLine $lines "powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\validate_rate_limit_safety.ps1"
    Add-ReportLine $lines "powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\validate_shift_incident_recovery_safety.ps1"
    Add-ReportLine $lines "powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\validate_new_invoice_maintainability.ps1"
    Add-ReportLine $lines "powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\validate_training_safety.ps1"
    Add-ReportLine $lines "powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\validate_final_startup_task_proof.ps1 -AllowPendingFinalField"
    Add-ReportLine $lines "powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\validate_final_backup_task_proof.ps1 -AllowPendingFinalField"
    Add-ReportLine $lines "powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\validate_training_acceptance_proof.ps1"
    Add-ReportLine $lines "powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\validate_field_proof_templates.ps1"
    Add-ReportLine $lines "powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\validate_proof_initialization_safety.ps1"
    Add-ReportLine $lines "powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\make_offline_release.ps1 -SelfTest"
    Add-ReportLine $lines "powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\assert_offline_release_clean.ps1 -SelfTest"
    Add-ReportLine $lines "powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\assert_offline_release_clean.ps1 -RequireCurrentCommit"
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

    Add-ReportLine $lines "## Salida de estado de tareas de respaldo"
    Add-ReportLine $lines ""
    Add-ReportLine $lines '```text'
    foreach ($line in $backupStatusOutput) {
        Add-ReportLine $lines (Protect-HandoffText $line)
    }
    Add-ReportLine $lines '```'
    Add-ReportLine $lines ""

    Add-ReportLine $lines "## Salida del guard del artefacto offline"
    Add-ReportLine $lines ""
    Add-ReportLine $lines '```text'
    foreach ($line in $releaseGuardOutput) {
        Add-ReportLine $lines (Protect-HandoffText $line)
    }
    Add-ReportLine $lines '```'
    Add-ReportLine $lines ""

    Add-ReportLine $lines "## Salida de validacion del paquete seguro de soporte"
    Add-ReportLine $lines ""
    Add-ReportLine $lines '```text'
    foreach ($line in $supportPacketSafetyOutput) {
        Add-ReportLine $lines (Protect-HandoffText $line)
    }
    Add-ReportLine $lines '```'
    Add-ReportLine $lines ""

    Add-ReportLine $lines "## Salida de validacion de soporte de primer nivel"
    Add-ReportLine $lines ""
    Add-ReportLine $lines '```text'
    foreach ($line in $firstLevelSupportSafetyOutput) {
        Add-ReportLine $lines (Protect-HandoffText $line)
    }
    Add-ReportLine $lines '```'
    Add-ReportLine $lines ""

    Add-ReportLine $lines "## Salida de validacion del gate PRODUCTION_READY"
    Add-ReportLine $lines ""
    Add-ReportLine $lines '```text'
    foreach ($line in $productionReadyGateSafetyOutput) {
        Add-ReportLine $lines (Protect-HandoffText $line)
    }
    Add-ReportLine $lines '```'
    Add-ReportLine $lines ""

    Add-ReportLine $lines "## Salida del self-test de bloqueantes finales de campo"
    Add-ReportLine $lines ""
    Add-ReportLine $lines '```text'
    foreach ($line in $finalFieldBlockersSafetyOutput) {
        Add-ReportLine $lines (Protect-HandoffText $line)
    }
    Add-ReportLine $lines '```'
    Add-ReportLine $lines ""

    Add-ReportLine $lines "## Salida de guards candidatos de evidencia fisica final"
    Add-ReportLine $lines ""
    Add-ReportLine $lines '```text'
    foreach ($line in $finalPhysicalProofCandidateGuardOutput) {
        Add-ReportLine $lines (Protect-HandoffText $line)
    }
    Add-ReportLine $lines '```'
    Add-ReportLine $lines ""

    Add-ReportLine $lines "## Salida de validacion de evidencia de navegador"
    Add-ReportLine $lines ""
    Add-ReportLine $lines '```text'
    foreach ($line in $browserSmokeEvidenceOutput) {
        Add-ReportLine $lines (Protect-HandoffText $line)
    }
    Add-ReportLine $lines '```'
    Add-ReportLine $lines ""

    Add-ReportLine $lines "## Salida de validacion de arranque y reparacion segura"
    Add-ReportLine $lines ""
    Add-ReportLine $lines '```text'
    foreach ($line in $startupRepairSafetyOutput) {
        Add-ReportLine $lines (Protect-HandoffText $line)
    }
    Add-ReportLine $lines '```'
    Add-ReportLine $lines ""

    Add-ReportLine $lines "## Salida de validacion de capacitacion segura"
    Add-ReportLine $lines ""
    Add-ReportLine $lines '```text'
    foreach ($line in $trainingSafetyOutput) {
        Add-ReportLine $lines (Protect-HandoffText $line)
    }
    Add-ReportLine $lines '```'
    Add-ReportLine $lines ""

    Add-ReportLine $lines "## Salida de validacion de plantillas de evidencia de campo"
    Add-ReportLine $lines ""
    Add-ReportLine $lines '```text'
    foreach ($line in $fieldProofTemplatesSafetyOutput) {
        Add-ReportLine $lines (Protect-HandoffText $line)
    }
    Add-ReportLine $lines '```'
    Add-ReportLine $lines ""

    Add-ReportLine $lines "## Salida de validacion de inicializacion de evidencias"
    Add-ReportLine $lines ""
    Add-ReportLine $lines '```text'
    foreach ($line in $proofInitializationSafetyOutput) {
        Add-ReportLine $lines (Protect-HandoffText $line)
    }
    Add-ReportLine $lines '```'
    Add-ReportLine $lines ""

    Add-ReportLine $lines "## Salida de auditoria del objetivo operativo"
    Add-ReportLine $lines ""
    Add-ReportLine $lines '```text'
    foreach ($line in $operationsObjectiveAuditOutput) {
        Add-ReportLine $lines (Protect-HandoffText $line)
    }
    Add-ReportLine $lines '```'
    Add-ReportLine $lines ""

    Add-ReportLine $lines "## Salida de cobertura de guards de handoff"
    Add-ReportLine $lines ""
    Add-ReportLine $lines '```text'
    foreach ($line in $handoffGuardCoverageOutput) {
        Add-ReportLine $lines (Protect-HandoffText $line)
    }
    Add-ReportLine $lines '```'
    Add-ReportLine $lines ""

    Add-ReportLine $lines "## Salida de validacion de staging del release offline"
    Add-ReportLine $lines ""
    Add-ReportLine $lines '```text'
    foreach ($line in $offlineReleaseStagingSafetyOutput) {
        Add-ReportLine $lines (Protect-HandoffText $line)
    }
    Add-ReportLine $lines '```'
    Add-ReportLine $lines ""

    Add-ReportLine $lines "## Salida del self-test del constructor offline"
    Add-ReportLine $lines ""
    Add-ReportLine $lines '```text'
    foreach ($line in $offlineReleaseBuilderSelfTestOutput) {
        Add-ReportLine $lines (Protect-HandoffText $line)
    }
    Add-ReportLine $lines '```'
    Add-ReportLine $lines ""

    Add-ReportLine $lines "## Salida del self-test del guard del release offline"
    Add-ReportLine $lines ""
    Add-ReportLine $lines '```text'
    foreach ($line in $offlineReleaseGuardSelfTestOutput) {
        Add-ReportLine $lines (Protect-HandoffText $line)
    }
    Add-ReportLine $lines '```'
    Add-ReportLine $lines ""

    Add-ReportLine $lines "## Salida de validacion del manifiesto de dependencias"
    Add-ReportLine $lines ""
    Add-ReportLine $lines '```text'
    foreach ($line in $dependencyManifestOutput) {
        Add-ReportLine $lines (Protect-HandoffText $line)
    }
    Add-ReportLine $lines '```'
    Add-ReportLine $lines ""

    Add-ReportLine $lines "## Salida del guard de secreto de licencia de produccion"
    Add-ReportLine $lines ""
    Add-ReportLine $lines '```text'
    foreach ($line in $productionLicenseSaltGuardOutput) {
        Add-ReportLine $lines (Protect-HandoffText $line)
    }
    Add-ReportLine $lines '```'
    Add-ReportLine $lines ""

    Add-ReportLine $lines "## Salida de validacion de manuales de operador"
    Add-ReportLine $lines ""
    Add-ReportLine $lines '```text'
    foreach ($line in $operatorManualsSafetyOutput) {
        Add-ReportLine $lines (Protect-HandoffText $line)
    }
    Add-ReportLine $lines '```'
    Add-ReportLine $lines ""

    Add-ReportLine $lines "## Salida de validacion de documentos de respaldo y restore"
    Add-ReportLine $lines ""
    Add-ReportLine $lines '```text'
    foreach ($line in $backupRestoreDocsSafetyOutput) {
        Add-ReportLine $lines (Protect-HandoffText $line)
    }
    Add-ReportLine $lines '```'
    Add-ReportLine $lines ""

    Add-ReportLine $lines "## Salida de validacion de arranque de respaldos por usuario"
    Add-ReportLine $lines ""
    Add-ReportLine $lines '```text'
    foreach ($line in $backupStartupCurrentUserSafetyOutput) {
        Add-ReportLine $lines (Protect-HandoffText $line)
    }
    Add-ReportLine $lines '```'
    Add-ReportLine $lines ""

    Add-ReportLine $lines "## Salida de validacion de restore seguro en Windows"
    Add-ReportLine $lines ""
    Add-ReportLine $lines '```text'
    foreach ($line in $restoreWindowsSafetyOutput) {
        Add-ReportLine $lines (Protect-HandoffText $line)
    }
    Add-ReportLine $lines '```'
    Add-ReportLine $lines ""

    Add-ReportLine $lines "## Salida de validacion de documentos de instalacion"
    Add-ReportLine $lines ""
    Add-ReportLine $lines '```text'
    foreach ($line in $installationDocsSafetyOutput) {
        Add-ReportLine $lines (Protect-HandoffText $line)
    }
    Add-ReportLine $lines '```'
    Add-ReportLine $lines ""

    Add-ReportLine $lines "## Salida de validacion de pantalla de ayuda"
    Add-ReportLine $lines ""
    Add-ReportLine $lines '```text'
    foreach ($line in $helpScreenSafetyOutput) {
        Add-ReportLine $lines (Protect-HandoffText $line)
    }
    Add-ReportLine $lines '```'
    Add-ReportLine $lines ""

    Add-ReportLine $lines "## Salida de validacion de diagnostico del sistema"
    Add-ReportLine $lines ""
    Add-ReportLine $lines '```text'
    foreach ($line in $systemDiagnosticsSafetyOutput) {
        Add-ReportLine $lines (Protect-HandoffText $line)
    }
    Add-ReportLine $lines '```'
    Add-ReportLine $lines ""

    Add-ReportLine $lines "## Salida de validacion contra doble accion"
    Add-ReportLine $lines ""
    Add-ReportLine $lines '```text'
    foreach ($line in $doubleActionSafetyOutput) {
        Add-ReportLine $lines (Protect-HandoffText $line)
    }
    Add-ReportLine $lines '```'
    Add-ReportLine $lines ""

    Add-ReportLine $lines "## Salida de validacion de eventos propios en tiempo real"
    Add-ReportLine $lines ""
    Add-ReportLine $lines '```text'
    foreach ($line in $realtimeOwnEventSafetyOutput) {
        Add-ReportLine $lines (Protect-HandoffText $line)
    }
    Add-ReportLine $lines '```'
    Add-ReportLine $lines ""

    Add-ReportLine $lines "## Salida de validacion del instalador heredado"
    Add-ReportLine $lines ""
    Add-ReportLine $lines '```text'
    foreach ($line in $installerLegacySafetyOutput) {
        Add-ReportLine $lines (Protect-HandoffText $line)
    }
    Add-ReportLine $lines '```'
    Add-ReportLine $lines ""

    Add-ReportLine $lines "## Salida de validacion de recuperacion LAN"
    Add-ReportLine $lines ""
    Add-ReportLine $lines '```text'
    foreach ($line in $lanRecoverySafetyOutput) {
        Add-ReportLine $lines (Protect-HandoffText $line)
    }
    Add-ReportLine $lines '```'
    Add-ReportLine $lines ""

    Add-ReportLine $lines "## Salida de validacion de carga LAN"
    Add-ReportLine $lines ""
    Add-ReportLine $lines '```text'
    foreach ($line in $lanLoadtestSafetyOutput) {
        Add-ReportLine $lines (Protect-HandoffText $line)
    }
    Add-ReportLine $lines '```'
    Add-ReportLine $lines ""

    Add-ReportLine $lines "## Salida de validacion de limitaciones conocidas"
    Add-ReportLine $lines ""
    Add-ReportLine $lines '```text'
    foreach ($line in $knownLimitationsSafetyOutput) {
        Add-ReportLine $lines (Protect-HandoffText $line)
    }
    Add-ReportLine $lines '```'
    Add-ReportLine $lines ""

    Add-ReportLine $lines "## Salida de validacion de modo mantenimiento"
    Add-ReportLine $lines ""
    Add-ReportLine $lines '```text'
    foreach ($line in $maintenanceModeSafetyOutput) {
        Add-ReportLine $lines (Protect-HandoffText $line)
    }
    Add-ReportLine $lines '```'
    Add-ReportLine $lines ""

    Add-ReportLine $lines "## Salida de validacion de auditoria de permisos"
    Add-ReportLine $lines ""
    Add-ReportLine $lines '```text'
    foreach ($line in $permissionAuditSafetyOutput) {
        Add-ReportLine $lines (Protect-HandoffText $line)
    }
    Add-ReportLine $lines '```'
    Add-ReportLine $lines ""

    Add-ReportLine $lines "## Salida de validacion de limites de uso"
    Add-ReportLine $lines ""
    Add-ReportLine $lines '```text'
    foreach ($line in $rateLimitSafetyOutput) {
        Add-ReportLine $lines (Protect-HandoffText $line)
    }
    Add-ReportLine $lines '```'
    Add-ReportLine $lines ""

    Add-ReportLine $lines "## Salida de validacion de recuperacion de incidentes de turno"
    Add-ReportLine $lines ""
    Add-ReportLine $lines '```text'
    foreach ($line in $shiftIncidentRecoverySafetyOutput) {
        Add-ReportLine $lines (Protect-HandoffText $line)
    }
    Add-ReportLine $lines '```'
    Add-ReportLine $lines ""

    Add-ReportLine $lines "## Salida de validacion de mantenibilidad de nueva factura"
    Add-ReportLine $lines ""
    Add-ReportLine $lines '```text'
    foreach ($line in $newInvoiceMaintainabilityOutput) {
        Add-ReportLine $lines (Protect-HandoffText $line)
    }
    Add-ReportLine $lines '```'
    Add-ReportLine $lines ""

    Add-ReportLine $lines "## Salida de validacion de completitud de handoff final"
    Add-ReportLine $lines ""
    Add-ReportLine $lines '```text'
    foreach ($line in $finalHandoffCompletenessOutput) {
        Add-ReportLine $lines (Protect-HandoffText $line)
    }
    Add-ReportLine $lines '```'
    Add-ReportLine $lines ""

    Add-ReportLine $lines "## Salida de validacion del indice de evidencias"
    Add-ReportLine $lines ""
    Add-ReportLine $lines '```text'
    foreach ($line in $evidenceIndexOutput) {
        Add-ReportLine $lines (Protect-HandoffText $line)
    }
    Add-ReportLine $lines '```'
    Add-ReportLine $lines ""

    Add-ReportLine $lines "## Salida de preflight"
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

    [System.IO.File]::WriteAllText($path, (($lines -join "`n") + "`n"), [System.Text.Encoding]::ASCII)
    Write-Host "Reporte de handoff escrito en: $(Protect-HandoffText $path)"
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
Assert-ScriptExists $lanClientProofGuardScript
Assert-ScriptExists $finalStartupTaskProofGuardScript
Assert-ScriptExists $finalBackupTaskProofGuardScript
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
Assert-ScriptExists $institutionalReceiptPrintProofGuardScript
Assert-ScriptExists $permissionAuditSafetyScript
Assert-ScriptExists $rateLimitSafetyScript
Assert-ScriptExists $shiftIncidentRecoverySafetyScript
Assert-ScriptExists $newInvoiceMaintainabilityScript
Assert-ScriptExists $finalHandoffCompletenessScript

Write-Host "Sistema de Caja Hospitalaria - handoff final de produccion"
Write-Host "Carpeta del sistema: $(Protect-HandoffText $ProjectRoot)"
Write-Host "URL base: $($BaseUrl.TrimEnd('/'))"
Write-Host "Ruta de PHP: $(Protect-HandoffText $PhpPath)"

Write-Section "Archivos de evidencia"
if ($InitializeProofFiles) {
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $proofInitScript -ProjectRoot $ProjectRoot
}

$lanProofCompleted = Test-ProofLooksCompleted $lanProofPath
$printerProofCompleted = Test-ProofLooksCompleted $printerProofPath
$startupTaskProofCompleted = Test-ProofLooksCompleted $startupTaskProofPath
$restoreProofCompleted = Test-ProofLooksCompleted $restoreProofPath
$backupTaskProofCompleted = Test-ProofLooksCompleted $backupTaskProofPath
$concurrencyProofCompleted = Test-ProofLooksCompleted $concurrencyProofPath
$trainingAcceptanceProofCompleted = Test-ProofLooksCompleted $trainingAcceptanceProofPath
$allHandoffProofsCompleted = $lanProofCompleted -and $printerProofCompleted -and $startupTaskProofCompleted -and $restoreProofCompleted -and $backupTaskProofCompleted -and $concurrencyProofCompleted -and $trainingAcceptanceProofCompleted
Write-Result $lanProofCompleted "La evidencia de segunda computadora LAN tiene los campos requeridos; preflight hara validacion estricta." "La evidencia de segunda computadora LAN falta, esta incompleta, conserva marcadores o referencia evidencia inexistente."
Write-Result $printerProofCompleted "La evidencia de impresora fisica tiene los campos requeridos; preflight hara validacion estricta." "La evidencia de impresora fisica falta, esta incompleta, conserva marcadores o referencia evidencia inexistente."
Write-Result $startupTaskProofCompleted "La evidencia final de autoarranque tiene los campos requeridos; preflight hara validacion estricta." "La evidencia final de autoarranque falta, esta incompleta, conserva marcadores o referencia evidencia inexistente."
Write-Result $restoreProofCompleted "La evidencia final de restore tiene los campos requeridos; preflight hara validacion estricta." "La evidencia final de restore falta, esta incompleta, conserva marcadores o referencia evidencia inexistente."
Write-Result $backupTaskProofCompleted "La evidencia final de respaldos tiene los campos requeridos; preflight hara validacion estricta." "La evidencia final de respaldos falta, esta incompleta, conserva marcadores o referencia evidencia inexistente."
Write-Result $concurrencyProofCompleted "La evidencia final de concurrencia tiene los campos requeridos; preflight hara validacion estricta." "La evidencia final de concurrencia falta, esta incompleta, conserva marcadores o referencia evidencia inexistente."
Write-Result $trainingAcceptanceProofCompleted "La evidencia de capacitacion supervisada tiene los campos requeridos; preflight hara validacion estricta." "La evidencia de capacitacion supervisada falta, esta incompleta, conserva marcadores o referencia evidencia inexistente."

if (-not $lanProofCompleted) {
    Write-Host "Ejecute desde la segunda computadora en LAN:"
    Write-Host "powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\validate_lan_client.ps1 -BaseUrl $($BaseUrl.TrimEnd('/')) -EvidencePath qa\LAN_CLIENT_VALIDATION_PROOF.md"
}

if (-not $printerProofCompleted) {
    Write-Host "Imprima muestras reales en media carta/carta/A5 y complete qa\INSTITUTIONAL_RECEIPT_PRINT_PROOF.md con evidencia fisica."
}

if (-not $startupTaskProofCompleted) {
    Write-Host "Instale o actualice el autoarranque, observe inicio o recuperacion tras reinicio, confirme /up y login, y complete qa\FINAL_STARTUP_TASK_PROOF.md."
}

if (-not $restoreProofCompleted) {
    Write-Host "Ejecute validacion de restore en una base descartable y complete qa\FINAL_RESTORE_PROOF.md."
}

if (-not $backupTaskProofCompleted) {
    Write-Host "Instale o actualice tareas de respaldo, cree un respaldo manual desde la UI, confirme Protegido en administracion y complete qa\FINAL_BACKUP_TASK_PROOF.md."
}

if (-not $concurrencyProofCompleted) {
    Write-Host "Ejecute validacion de concurrencia contra un destino descartable y complete qa\FINAL_CONCURRENCY_PROOF.md."
}

if (-not $trainingAcceptanceProofCompleted) {
    Write-Host "Ejecute capacitacion supervisada por rol en un ambiente seguro de practica y complete qa\TRAINING_ACCEPTANCE_PROOF.md sin nombres, datos de pacientes ni secretos."
}

Write-Section "Backup automation"
$backupStatusOutput = @(& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $backupTasksScript -ProjectRoot $ProjectRoot -PhpPath $PhpPath -Status 2>&1 | ForEach-Object { $_.ToString() })
$backupStatusOutput | ForEach-Object { Write-Host (Protect-HandoffText $_) }
Write-Host "Si faltan tareas o estan desactualizadas, ejecute PowerShell elevado:"
Write-Host "powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\install_stack_autostart_windows.ps1 -UpdateExisting"
Write-Host "powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\install_stack_autostart_windows.ps1 -Status"
Write-Host "Despues de instalar autoarranque, observe inicio o recuperacion tras reinicio y complete qa\FINAL_STARTUP_TASK_PROOF.md."
Write-Host "powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\install_backup_tasks_windows.ps1 -UpdateExisting -PhpPath $(Protect-HandoffText $PhpPath)"
Write-Host "Start-ScheduledTask -TaskName SistemaCajaHospitalaria-BackupWorker"
Write-Host "powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\install_backup_tasks_windows.ps1 -Status -PhpPath $(Protect-HandoffText $PhpPath)"

Write-Section "Artefacto de release offline"
$releaseGuardOutput = @(& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $releaseGuardScript -ProjectRoot $ProjectRoot -RequireCurrentCommit 2>&1 | ForEach-Object { $_.ToString() })
$releaseGuardExit = $LASTEXITCODE
$releaseGuardOutput | ForEach-Object { Write-Host (Protect-HandoffText $_) }

$supportPacketSafety = Invoke-SupportPacketSafetyGuard
$firstLevelSupportSafety = Invoke-FirstLevelSupportSafetyGuard
$productionReadyGateSafety = Invoke-ProductionReadyGateSafetyGuard
$finalFieldBlockersSafety = Invoke-FinalFieldBlockersSafetySelfTestGuard
$finalPhysicalProofCandidateGuards = Invoke-FinalPhysicalProofCandidateGuardSuite
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
    Write-Section "Preflight omitido"
    Write-Host "Se uso SkipPreflight. Esta ejecucion no puede aprobar PRODUCTION_READY."
    Write-HandoffReport `
        -path $ReportPath `
        -lanProofCompleted $lanProofCompleted `
        -printerProofCompleted $printerProofCompleted `
        -startupTaskProofCompleted $startupTaskProofCompleted `
        -restoreProofCompleted $restoreProofCompleted `
        -backupTaskProofCompleted $backupTaskProofCompleted `
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
        -finalPhysicalProofCandidateGuardOutput $finalPhysicalProofCandidateGuards.Output `
        -finalPhysicalProofCandidateGuardExit $finalPhysicalProofCandidateGuards.ExitCode `
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
        -finalHandoffCompletenessOutput @("Validacion de completitud de handoff final pendiente hasta escribir el reporte de handoff.") `
        -finalHandoffCompletenessExit 2 `
        -evidenceIndexOutput @("Validacion del indice de evidencias pendiente hasta escribir el reporte de handoff.") `
        -evidenceIndexExit 2 `
        -preflightOutput @("Preflight omitido por -SkipPreflight.") `
        -preflightExit 2 `
        -preflightSkipped $true

    $finalHandoffCompleteness = Invoke-FinalHandoffCompletenessGuard $ReportPath
    $evidenceIndex = Invoke-EvidenceIndexGuard $ReportPath
    Write-HandoffReport `
        -path $ReportPath `
        -lanProofCompleted $lanProofCompleted `
        -printerProofCompleted $printerProofCompleted `
        -startupTaskProofCompleted $startupTaskProofCompleted `
        -restoreProofCompleted $restoreProofCompleted `
        -backupTaskProofCompleted $backupTaskProofCompleted `
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
        -finalPhysicalProofCandidateGuardOutput $finalPhysicalProofCandidateGuards.Output `
        -finalPhysicalProofCandidateGuardExit $finalPhysicalProofCandidateGuards.ExitCode `
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
        -preflightOutput @("Preflight omitido por -SkipPreflight.") `
        -preflightExit 2 `
        -preflightSkipped $true
    exit 2
}

Write-Section "Preflight de produccion"
$preflightOutput = @(& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $preflightScript -ProjectRoot $ProjectRoot -BaseUrl $BaseUrl 2>&1 | ForEach-Object { $_.ToString() })
$preflightExit = $LASTEXITCODE
$preflightOutput | ForEach-Object { Write-Host (Protect-HandoffText $_) }

Write-HandoffReport `
    -path $ReportPath `
    -lanProofCompleted $lanProofCompleted `
    -printerProofCompleted $printerProofCompleted `
    -startupTaskProofCompleted $startupTaskProofCompleted `
    -restoreProofCompleted $restoreProofCompleted `
    -backupTaskProofCompleted $backupTaskProofCompleted `
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
    -finalPhysicalProofCandidateGuardOutput $finalPhysicalProofCandidateGuards.Output `
    -finalPhysicalProofCandidateGuardExit $finalPhysicalProofCandidateGuards.ExitCode `
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
    -finalHandoffCompletenessOutput @("Validacion de completitud de handoff final pendiente hasta escribir el reporte de handoff.") `
    -finalHandoffCompletenessExit 2 `
    -evidenceIndexOutput @("Validacion del indice de evidencias pendiente hasta escribir el reporte de handoff.") `
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
    -startupTaskProofCompleted $startupTaskProofCompleted `
    -restoreProofCompleted $restoreProofCompleted `
    -backupTaskProofCompleted $backupTaskProofCompleted `
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
    -finalPhysicalProofCandidateGuardOutput $finalPhysicalProofCandidateGuards.Output `
    -finalPhysicalProofCandidateGuardExit $finalPhysicalProofCandidateGuards.ExitCode `
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
    $finalPhysicalProofCandidateGuards.ExitCode,
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
Write-Host "PRODUCTION_READY sigue bloqueado. Mantenga el estado PRODUCTION_CANDIDATE y cierre las evidencias faltantes indicadas arriba." -ForegroundColor Yellow
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
if ($finalPhysicalProofCandidateGuards.ExitCode -ne 0) {
    exit $finalPhysicalProofCandidateGuards.ExitCode
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
