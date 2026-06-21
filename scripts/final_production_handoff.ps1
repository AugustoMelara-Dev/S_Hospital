param(
    [Parameter(Mandatory = $true)]
    [string] $BaseUrl,

    [string] $ProjectRoot = "",

    [string] $PhpPath = "php",

    [string] $EnvFile = "",

    [string] $ComposeProjectName = "",

    [string] $ReportPath = "",

    [switch] $InitializeProofFiles,

    [switch] $SkipPreflight,

    [switch] $RequireCurrentCommit
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
$backupStartupScript = Join-Path $scriptsDir "install_backup_startup_current_user.ps1"
$releaseGuardScript = Join-Path $scriptsDir "assert_offline_release_clean.ps1"
$lanProofPath = Join-Path $qaDir "LAN_CLIENT_VALIDATION_PROOF.md"
$printerProofPath = Join-Path $qaDir "INSTITUTIONAL_RECEIPT_PRINT_PROOF.md"
$restoreProofPath = Join-Path $qaDir "FINAL_RESTORE_PROOF.md"
$concurrencyProofPath = Join-Path $qaDir "FINAL_CONCURRENCY_PROOF.md"
$concurrencyUnderLoadProofPath = Join-Path $qaDir "FINAL_CONCURRENCY_UNDER_LOAD_PROOF_LAN_8081.md"
$realSmokeProofPath = Join-Path $qaDir "FINAL_REAL_SMOKE_LAN_8081.md"
$elevatedBackupTaskProofPath = Join-Path $qaDir "WINDOWS_BACKUP_TASK_ELEVATED_INSTALL.log"

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

function Write-Result([bool] $passed, [string] $message) {
    if ($passed) {
        Write-Host "[ OK ] $message" -ForegroundColor Green
    } else {
        Write-Host "[MISS] $message" -ForegroundColor Yellow
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

function Test-LanProofLooksCompleted([string] $path) {
    if (-not (Test-ProofLooksCompleted $path)) {
        return $false
    }

    $content = Get-Content -LiteralPath $path -Raw
    $historicalPattern = '(?i)(VALIDADO_HISTORICO_REQUIERE_REPETIR_IP_FINAL|REQUIERE_REPETIR|requiere repetirse|requiere repeticion|historica contra|historico contra|evidencia historica)'
    if ($content -match $historicalPattern) {
        return $false
    }

    foreach ($requiredPattern in @(
        '/api/system/echo-config',
        'WebSocket',
        'Soketi',
        'TCP connect OK'
    )) {
        if ($content -notmatch [regex]::Escape($requiredPattern)) {
            return $false
        }
    }

    $expectedBaseUrl = $BaseUrl.TrimEnd("/")
    $serverLanUrl = Get-ProofFieldValue $content "Server LAN URL"
    if ($null -eq $serverLanUrl -or $serverLanUrl.TrimEnd("/") -ne $expectedBaseUrl) {
        return $false
    }

    return $true
}

function Test-ProofUrlMatchesBaseUrl([string] $path, [string] $fieldLabel) {
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        return $false
    }

    $content = Get-Content -LiteralPath $path -Raw
    $url = Get-ProofFieldValue $content $fieldLabel
    if ($null -eq $url) {
        return $false
    }

    return $url.TrimEnd("/") -eq $BaseUrl.TrimEnd("/")
}

function Assert-ScriptExists([string] $path) {
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        throw "Missing required script: $path"
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

function Get-BackupTaskInstallCommand {
    $command = "powershell.exe -ExecutionPolicy Bypass -File scripts\install_backup_tasks_windows.ps1"

    if (-not [string]::IsNullOrWhiteSpace($EnvFile) -or -not [string]::IsNullOrWhiteSpace($ComposeProjectName)) {
        $command += " -Mode Docker"
        if (-not [string]::IsNullOrWhiteSpace($EnvFile)) {
            $command += " -EnvFile $(Protect-HandoffText $EnvFile)"
        }
        if (-not [string]::IsNullOrWhiteSpace($ComposeProjectName)) {
            $command += " -ComposeProjectName $(Protect-HandoffText $ComposeProjectName)"
        }
        $command += " -UpdateExisting -LaunchElevated"

        return $command
    }

    return "$command -UpdateExisting -LaunchElevated -PhpPath $(Protect-HandoffText $PhpPath)"
}

function Get-ElevatedBackupTaskProofSummary {
    if (-not (Test-Path -LiteralPath $elevatedBackupTaskProofPath -PathType Leaf)) {
        return @(
            "Elevated proof log: missing.",
            "Run the backup task installer from elevated PowerShell before final handoff."
        )
    }

    $content = Get-Content -LiteralPath $elevatedBackupTaskProofPath -Raw
    $launchMatches = [regex]::Matches($content, "\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\] Launching elevated scheduled-task installer\.")
    if ($launchMatches.Count -eq 0) {
        return @(
            "Elevated proof log: present but no elevated launch entry was found.",
            "Run the backup task installer from elevated PowerShell before final handoff."
        )
    }

    $latestAttempt = $content.Substring($launchMatches[$launchMatches.Count - 1].Index)
    $hasSuccess = $latestAttempt -match "Scheduled tasks registered successfully\."
    $hasWorker = $latestAttempt -match "SistemaCajaHospitalaria-BackupWorker: state=Ready" -and $latestAttempt -match "SistemaCajaHospitalaria-BackupWorker: .*user=SYSTEM"
    $hasDaily = $latestAttempt -match "SistemaCajaHospitalaria-DailyBackup: state=Ready" -and $latestAttempt -match "SistemaCajaHospitalaria-DailyBackup: .*user=SYSTEM"
    $hasError = $latestAttempt -match "\] ERROR:"

    if ($hasSuccess -and $hasWorker -and $hasDaily -and -not $hasError) {
        return @(
            "Elevated proof log: PASS.",
            "Latest elevated attempt confirms SistemaCajaHospitalaria backup tasks are Ready as SYSTEM.",
            "Note: non-elevated status may report tasks as not installed when Windows hides SYSTEM tasks from this shell."
        )
    }

    return @(
        "Elevated proof log: incomplete or failed.",
        "Run elevated status before final handoff: powershell.exe -ExecutionPolicy Bypass -File scripts\install_backup_tasks_windows.ps1 -Mode Docker -EnvFile [ruta-local] -ComposeProjectName shospital_offlinetest -Status"
    )
}

function Get-LanStandaloneValidationCommand {
    return "powershell.exe -ExecutionPolicy Bypass -File .\validate_lan_client_standalone.ps1 -BaseUrl $($BaseUrl.TrimEnd('/')) -EvidencePath `"`$env:USERPROFILE\Desktop\LAN_CLIENT_VALIDATION_PROOF.md`""
}

function Get-PhysicalPrintProofCommand {
    return 'powershell.exe -ExecutionPolicy Bypass -File scripts\register_physical_receipt_print_proof.ps1 -PrimaryPaperSize "media carta" -ResponsiblePerson "NOMBRE_RESPONSABLE" -PrinterBrandModel "MARCA_MODELO_IMPRESORA_REAL" -PrinterDriver "NOMBRE_DRIVER_WINDOWS" -ConnectionType "USB/LAN/Compartida" -BrowserVersion "Microsoft Edge VERSION" -InvoiceUsed "FACTURA/RECIBO_USADO" -EvidenceReference "qa/evidence/printer-final/foto-media-carta.jpg" -ReprintEvidence "Reimpresion desde historial con motivo auditado y misma informacion historica" -MarginsEvidence "Escala 100%, margenes minimos, contenido centrado y legible" -HeadersFootersEvidence "Encabezados y pies del navegador desactivados" -HistoricalSnapshotEvidence "Servicios, paciente, monto y numero coinciden con la factura historica"'
}

function Get-HandoffRerunCommand {
    $command = "powershell.exe -ExecutionPolicy Bypass -File scripts\final_production_handoff.ps1 -BaseUrl $($BaseUrl.TrimEnd('/')) -PhpPath $(Protect-HandoffText $PhpPath)"
    if (-not [string]::IsNullOrWhiteSpace($EnvFile)) {
        $command += " -EnvFile $(Protect-HandoffText $EnvFile)"
    }
    if (-not [string]::IsNullOrWhiteSpace($ComposeProjectName)) {
        $command += " -ComposeProjectName $(Protect-HandoffText $ComposeProjectName)"
    }

    return $command
}

function Write-HandoffReport(
    [string] $path,
    [bool] $lanProofCompleted,
    [bool] $printerProofCompleted,
    [bool] $restoreProofCompleted,
    [bool] $concurrencyProofCompleted,
    [bool] $concurrencyUnderLoadProofCompleted,
    [bool] $realSmokeProofCompleted,
    [string[]] $elevatedBackupTaskProofSummary,
    [string[]] $backupStatusOutput,
    [string[]] $backupFallbackStatusOutput,
    [string[]] $releaseGuardOutput,
    [int] $releaseGuardExit,
    [string[]] $preflightOutput,
    [int] $preflightExit,
    [bool] $preflightSkipped
) {
    $now = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $lines = New-Object System.Collections.Generic.List[string]
    $allProofsCompleted = $lanProofCompleted -and $printerProofCompleted -and $restoreProofCompleted -and $concurrencyProofCompleted -and $concurrencyUnderLoadProofCompleted -and $realSmokeProofCompleted
    $decision = if ($allProofsCompleted -and $releaseGuardExit -eq 0 -and -not $preflightSkipped -and $preflightExit -eq 0) { "PRODUCTION_READY" } else { "READY_FOR_REAL_LAN_INSTALLATION_TEST" }

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
    Add-ReportLine $lines "- Final concurrency under load proof present without obvious placeholders: $concurrencyUnderLoadProofCompleted"
    Add-ReportLine $lines "- Real LAN smoke proof present without obvious placeholders: $realSmokeProofCompleted"
    Add-ReportLine $lines "- Offline release artifact guard exit code: $releaseGuardExit"
    Add-ReportLine $lines "- Preflight skipped: $preflightSkipped"
    Add-ReportLine $lines "- Preflight exit code: $preflightExit"
    Add-ReportLine $lines ""

    Add-ReportLine $lines "## Result"
    Add-ReportLine $lines ""
    if ($decision -eq "PRODUCTION_READY") {
        Add-ReportLine $lines "The preflight passed without bypass flags. Keep this report with the completed physical evidence files."
    } else {
    Add-ReportLine $lines "Do not declare PRODUCTION_READY. Keep the system as READY_FOR_REAL_LAN_INSTALLATION_TEST only if the offline release guard is clean and the remaining blockers are field/final-validation evidence."
    }
    Add-ReportLine $lines ""

    Add-ReportLine $lines "## Blocking items"
    Add-ReportLine $lines ""
    if (-not $lanProofCompleted) {
        Add-ReportLine $lines "- Missing or incomplete qa/LAN_CLIENT_VALIDATION_PROOF.md from a real second LAN client, including /api/system/echo-config and WebSocket/Soketi TCP evidence."
    }
    if (-not $printerProofCompleted) {
        Add-ReportLine $lines "- Missing or incomplete qa/INSTITUTIONAL_RECEIPT_PRINT_PROOF.md from the real cashier printer."
    }
    if (-not $restoreProofCompleted) {
        Add-ReportLine $lines "- Missing or incomplete qa/FINAL_RESTORE_PROOF.md from a disposable restore database on the final server."
    }
    if (-not $concurrencyProofCompleted) {
        Add-ReportLine $lines "- Missing or incomplete qa/FINAL_CONCURRENCY_PROOF.md from a disposable concurrency target."
    }
    if (-not $concurrencyUnderLoadProofCompleted) {
        Add-ReportLine $lines "- Missing or incomplete qa/FINAL_CONCURRENCY_UNDER_LOAD_PROOF_LAN_8081.md proving cash/invoice/payment races while API load is running."
    }
    if (-not $realSmokeProofCompleted) {
        Add-ReportLine $lines "- Missing or incomplete qa/FINAL_REAL_SMOKE_LAN_8081.md proving real login/navigation/invoice/payment/receipt/history smoke."
    }
    if ($preflightSkipped) {
        Add-ReportLine $lines "- Preflight was skipped in this handoff run."
    } elseif ($preflightExit -ne 0) {
        Add-ReportLine $lines "- Production preflight returned exit code $preflightExit."
    }
    if ($releaseGuardExit -ne 0) {
        Add-ReportLine $lines "- Offline release artifact is missing, stale, or contains forbidden files."
    }
    if ($allProofsCompleted -and $releaseGuardExit -eq 0 -and -not $preflightSkipped -and $preflightExit -eq 0) {
        Add-ReportLine $lines "- None reported by the handoff script."
    }
    Add-ReportLine $lines ""

    Add-ReportLine $lines "## Next commands"
    Add-ReportLine $lines ""
    Add-ReportLine $lines '```powershell'
    Add-ReportLine $lines "powershell.exe -ExecutionPolicy Bypass -File scripts\validate_lan_client.ps1 -BaseUrl $($BaseUrl.TrimEnd('/')) -EvidencePath qa\LAN_CLIENT_VALIDATION_PROOF.md -Force"
    Add-ReportLine $lines "# The LAN proof must include /api/system/echo-config and WebSocket/Soketi TCP connect OK from the second PC."
    Add-ReportLine $lines "# If the second PC does not have the project, copy offline-release\scripts\validate_lan_client_standalone.ps1 to that PC and run:"
    Add-ReportLine $lines (Get-LanStandaloneValidationCommand)
    Add-ReportLine $lines "# After printing the institutional receipt on real paper, register physical evidence:"
    Add-ReportLine $lines (Get-PhysicalPrintProofCommand)
    Add-ReportLine $lines (Get-BackupTaskInstallCommand)
    Add-ReportLine $lines "powershell.exe -ExecutionPolicy Bypass -File scripts\install_backup_startup_current_user.ps1 -Status"
    Add-ReportLine $lines "# Run mocked non-mutating UI/a11y/button smoke."
    Add-ReportLine $lines "cd frontend; npm.cmd run smoke:buttons"
    Add-ReportLine $lines "# Run non-production release E2E: cashier invoice/payment/receipt/report plus admin RBAC exact module access."
    Add-ReportLine $lines "cd frontend; npm.cmd run e2e"
    Add-ReportLine $lines "# Run frontend real smoke with E2E_REAL_* environment variables set outside this report."
    Add-ReportLine $lines "cd frontend; npm.cmd run smoke:real"
    Add-ReportLine $lines "Start-ScheduledTask -TaskName SistemaCajaHospitalaria-BackupWorker"
    Add-ReportLine $lines 'bash -lc "HOSPITAL_VALIDATE_RESTORE_MYSQL=1 RESTORE_TEST_DATABASE=hospital_restore_validation_test HOSPITAL_CONFIRM_RESTORE_DATABASE=hospital_restore_validation_test scripts/validate_restore_mysql.sh"'
    Add-ReportLine $lines "# Set HOSPITAL_CONCURRENCY_LOGIN and HOSPITAL_CONCURRENCY_PASSWORD for a temporary validation account outside this report."
    Add-ReportLine $lines "bash -lc `"HOSPITAL_VALIDATE_REAL_MYSQL=1 HOSPITAL_CONFIRM_CONCURRENCY_TARGET=$($BaseUrl.TrimEnd('/')) HOSPITAL_CONCURRENCY_BASE_URL=$($BaseUrl.TrimEnd('/')) HOSPITAL_CONCURRENCY_TARGET_ENV=validation HOSPITAL_CONCURRENCY_EVIDENCE_PATH=qa/FINAL_CONCURRENCY_PROOF.md scripts/validate_mysql_concurrency.sh`""
    Add-ReportLine $lines "node scripts\validate_mysql_concurrency_under_load.mjs"
    Add-ReportLine $lines (Get-HandoffRerunCommand)
    Add-ReportLine $lines '```'
    Add-ReportLine $lines ""

    Add-ReportLine $lines "## Backup current-user fallback status output"
    Add-ReportLine $lines ""
    Add-ReportLine $lines '```text'
    foreach ($line in $backupFallbackStatusOutput) {
        Add-ReportLine $lines (Protect-HandoffText $line)
    }
    Add-ReportLine $lines '```'
    Add-ReportLine $lines ""

    Add-ReportLine $lines "## Elevated backup task proof"
    Add-ReportLine $lines ""
    Add-ReportLine $lines '```text'
    foreach ($line in $elevatedBackupTaskProofSummary) {
        Add-ReportLine $lines (Protect-HandoffText $line)
    }
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
Assert-ScriptExists $backupStartupScript
Assert-ScriptExists $releaseGuardScript

Write-Host "Sistema de Caja Hospitalaria final production handoff"
Write-Host "ProjectRoot: $(Protect-HandoffText $ProjectRoot)"
Write-Host "BaseUrl: $($BaseUrl.TrimEnd('/'))"
Write-Host "PhpPath: $(Protect-HandoffText $PhpPath)"
if (-not [string]::IsNullOrWhiteSpace($EnvFile)) {
    Write-Host "EnvFile: $(Protect-HandoffText $EnvFile)"
}
if (-not [string]::IsNullOrWhiteSpace($ComposeProjectName)) {
    Write-Host "ComposeProjectName: [compose-proyecto]"
}

Write-Section "Proof files"
if ($InitializeProofFiles) {
    & powershell.exe -ExecutionPolicy Bypass -File $proofInitScript -ProjectRoot $ProjectRoot
}

$lanProofCompleted = Test-LanProofLooksCompleted $lanProofPath
$printerProofCompleted = Test-ProofLooksCompleted $printerProofPath
$restoreProofCompleted = Test-ProofLooksCompleted $restoreProofPath
$concurrencyProofCompleted = (Test-ProofLooksCompleted $concurrencyProofPath) -and (Test-ProofUrlMatchesBaseUrl $concurrencyProofPath "Server LAN URL")
$concurrencyUnderLoadProofCompleted = (Test-ProofLooksCompleted $concurrencyUnderLoadProofPath) -and (Test-ProofUrlMatchesBaseUrl $concurrencyUnderLoadProofPath "Server LAN URL")
$realSmokeProofCompleted = (Test-ProofLooksCompleted $realSmokeProofPath) -and (Test-ProofUrlMatchesBaseUrl $realSmokeProofPath "URL LAN")
$allHandoffProofsCompleted = $lanProofCompleted -and $printerProofCompleted -and $restoreProofCompleted -and $concurrencyProofCompleted -and $concurrencyUnderLoadProofCompleted -and $realSmokeProofCompleted
Write-Result $lanProofCompleted "Second-client LAN proof file looks present; preflight performs strict validation."
Write-Result $printerProofCompleted "Physical printer proof file looks present; preflight performs strict validation."
Write-Result $restoreProofCompleted "Final restore proof file looks present; preflight performs strict validation."
Write-Result $concurrencyProofCompleted "Final concurrency proof file looks present; preflight performs strict validation."
Write-Result $concurrencyUnderLoadProofCompleted "Final concurrency under load proof file looks present; preflight performs strict validation."
Write-Result $realSmokeProofCompleted "Real LAN smoke proof file looks present."

if (-not $lanProofCompleted) {
    Write-Host "Run from the second LAN client:"
    Write-Host "powershell.exe -ExecutionPolicy Bypass -File scripts\validate_lan_client.ps1 -BaseUrl $($BaseUrl.TrimEnd('/')) -EvidencePath qa\LAN_CLIENT_VALIDATION_PROOF.md -Force"
    Write-Host "If the second PC does not have the project, copy offline-release\scripts\validate_lan_client_standalone.ps1 to that PC and run:"
    Write-Host (Get-LanStandaloneValidationCommand)
}

if (-not $printerProofCompleted) {
    Write-Host "Print the real institutional receipt on media carta/carta/A5 paper, then complete qa\INSTITUTIONAL_RECEIPT_PRINT_PROOF.md with physical evidence. Validate 80mm/58mm only if the hospital configured a secondary thermal printer."
    Write-Host (Get-PhysicalPrintProofCommand)
}

if (-not $restoreProofCompleted) {
    Write-Host "Run restore validation into a disposable database, then complete qa\FINAL_RESTORE_PROOF.md."
}

if (-not $concurrencyProofCompleted) {
    Write-Host "Run concurrency validation against a disposable target, then complete qa\FINAL_CONCURRENCY_PROOF.md."
}

if (-not $concurrencyUnderLoadProofCompleted) {
    Write-Host "Run concurrency-under-load validation against a disposable target, then complete qa\FINAL_CONCURRENCY_UNDER_LOAD_PROOF_LAN_8081.md."
}

if (-not $realSmokeProofCompleted) {
    Write-Host "Run frontend real smoke against the LAN server, then complete qa\FINAL_REAL_SMOKE_LAN_8081.md."
}

Write-Section "Backup automation"
$backupTaskStatusArgs = @("-ExecutionPolicy", "Bypass", "-File", $backupTasksScript, "-ProjectRoot", $ProjectRoot, "-PhpPath", $PhpPath, "-Status")
if (-not [string]::IsNullOrWhiteSpace($EnvFile)) {
    $backupTaskStatusArgs += @("-EnvFile", $EnvFile)
}
if (-not [string]::IsNullOrWhiteSpace($ComposeProjectName)) {
    $backupTaskStatusArgs += @("-ComposeProjectName", $ComposeProjectName)
}
$backupStatusOutput = @(& powershell.exe @backupTaskStatusArgs 2>&1 | ForEach-Object { $_.ToString() })
$backupStatusOutput | ForEach-Object { Write-Host (Protect-HandoffText $_) }
Write-Host ""
Write-Host "Current-user fallback:"
$backupFallbackStatusOutput = @(& powershell.exe -ExecutionPolicy Bypass -File $backupStartupScript -ProjectRoot $ProjectRoot -Status 2>&1 | ForEach-Object { $_.ToString() })
$backupFallbackStatusOutput | ForEach-Object { Write-Host (Protect-HandoffText $_) }
$elevatedBackupTaskProofSummary = @(Get-ElevatedBackupTaskProofSummary)
Write-Host ""
Write-Host "Elevated backup task proof:"
$elevatedBackupTaskProofSummary | ForEach-Object { Write-Host (Protect-HandoffText $_) }
Write-Host "If tasks are missing or stale, run elevated PowerShell:"
Write-Host (Get-BackupTaskInstallCommand)
Write-Host "Start-ScheduledTask -TaskName SistemaCajaHospitalaria-BackupWorker"
Write-Host "powershell.exe -ExecutionPolicy Bypass -File scripts\install_backup_tasks_windows.ps1 -Status -PhpPath $(Protect-HandoffText $PhpPath)"

Write-Section "Offline release artifact"
$releaseGuardArgs = @("-ExecutionPolicy", "Bypass", "-File", $releaseGuardScript, "-ProjectRoot", $ProjectRoot)
if ($RequireCurrentCommit) {
    $releaseGuardArgs += "-RequireCurrentCommit"
}
$releaseGuardOutput = @(& powershell.exe @releaseGuardArgs 2>&1 | ForEach-Object { $_.ToString() })
$releaseGuardExit = $LASTEXITCODE
$releaseGuardOutput | ForEach-Object { Write-Host (Protect-HandoffText $_) }

if ($SkipPreflight) {
    Write-Section "Preflight skipped"
    Write-Host "SkipPreflight was used. This run cannot approve PRODUCTION_READY."
    Write-HandoffReport `
        -path $ReportPath `
        -lanProofCompleted $lanProofCompleted `
        -printerProofCompleted $printerProofCompleted `
        -restoreProofCompleted $restoreProofCompleted `
        -concurrencyProofCompleted $concurrencyProofCompleted `
        -concurrencyUnderLoadProofCompleted $concurrencyUnderLoadProofCompleted `
        -realSmokeProofCompleted $realSmokeProofCompleted `
        -elevatedBackupTaskProofSummary $elevatedBackupTaskProofSummary `
        -backupStatusOutput $backupStatusOutput `
        -backupFallbackStatusOutput $backupFallbackStatusOutput `
        -releaseGuardOutput $releaseGuardOutput `
        -releaseGuardExit $releaseGuardExit `
        -preflightOutput @("Preflight skipped by -SkipPreflight.") `
        -preflightExit 2 `
        -preflightSkipped $true
    exit 2
}

Write-Section "Production preflight"
$preflightArgs = @("-ExecutionPolicy", "Bypass", "-File", $preflightScript, "-ProjectRoot", $ProjectRoot, "-BaseUrl", $BaseUrl)
if (-not [string]::IsNullOrWhiteSpace($EnvFile)) {
    $preflightArgs += @("-EnvFile", $EnvFile)
}
if (-not [string]::IsNullOrWhiteSpace($ComposeProjectName)) {
    $preflightArgs += @("-ComposeProjectName", $ComposeProjectName)
}
$preflightOutput = @(& powershell.exe @preflightArgs 2>&1 | ForEach-Object { $_.ToString() })
$preflightExit = $LASTEXITCODE
$preflightOutput | ForEach-Object { Write-Host (Protect-HandoffText $_) }

Write-HandoffReport `
    -path $ReportPath `
    -lanProofCompleted $lanProofCompleted `
    -printerProofCompleted $printerProofCompleted `
    -restoreProofCompleted $restoreProofCompleted `
    -concurrencyProofCompleted $concurrencyProofCompleted `
    -concurrencyUnderLoadProofCompleted $concurrencyUnderLoadProofCompleted `
    -realSmokeProofCompleted $realSmokeProofCompleted `
    -elevatedBackupTaskProofSummary $elevatedBackupTaskProofSummary `
    -backupStatusOutput $backupStatusOutput `
    -backupFallbackStatusOutput $backupFallbackStatusOutput `
    -releaseGuardOutput $releaseGuardOutput `
    -releaseGuardExit $releaseGuardExit `
    -preflightOutput $preflightOutput `
    -preflightExit $preflightExit `
    -preflightSkipped $false

if ($preflightExit -eq 0 -and $releaseGuardExit -eq 0 -and $allHandoffProofsCompleted) {
    Write-Host ""
    Write-Host "PRODUCTION_READY evidence gate passed." -ForegroundColor Green
    exit 0
}

Write-Host ""
Write-Host "PRODUCTION_READY remains blocked. Keep status as READY_FOR_REAL_LAN_INSTALLATION_TEST only while the remaining blockers are field/final-validation evidence." -ForegroundColor Yellow
if ($preflightExit -eq 0) {
    exit 1
}
exit $preflightExit
