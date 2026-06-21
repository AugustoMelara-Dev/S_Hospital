$ErrorActionPreference = "Stop"

$scriptRoot = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
$projectRoot = Split-Path -Parent $scriptRoot

function Assert-Contains([string] $Path, [string] $Needle, [string] $Message) {
    $content = [System.IO.File]::ReadAllText($Path)
    if (-not $content.Contains($Needle)) {
        throw $Message
    }
}

function Assert-ExitCodeAndOutput([string] $Command, [int] $ExpectedExitCode, [string] $ExpectedOutput) {
    $output = & cmd.exe /c $Command 2>&1
    $exitCode = $LASTEXITCODE
    if ($exitCode -ne $ExpectedExitCode) {
        throw "Unexpected exit code for '$Command'. Expected $ExpectedExitCode, got $exitCode. Output: $($output -join ' ')"
    }

    $joined = $output -join "`n"
    if (-not $joined.Contains($ExpectedOutput)) {
        throw "Unexpected output for '$Command'. Expected to contain '$ExpectedOutput'. Output: $joined"
    }
}

function New-AutoEvidenceProofSet([string] $Root, [bool] $Ready) {
    $qaDir = Join-Path $Root "qa"
    New-Item -ItemType Directory -Path $qaDir -Force | Out-Null

    $readyProof = @"
# Synthetic proof

## Environment

- Date/time: 2026-06-18 12:00
- Responsible person: Automated test
- Server LAN URL: http://127.0.0.1:8000
- Evidence/capture reference: qa/synthetic-proof.json
- Final conclusion: VALIDATED by automated fixture.

## Required checks

- [x] Synthetic evidence item completed. Result/evidence: Verified by test fixture.

## Evidence

This synthetic evidence intentionally contains more than three hundred characters
so auto_evidence.ps1 cannot accept tiny placeholder files. It represents a
completed proof file with a checked item, no operator placeholders, and no
production-forbidden template words. The content is local to the test fixture.
"@

    $printerProof = if ($Ready) {
        $readyProof
    } else {
        @"
# Synthetic incomplete printer proof

## Environment

- Date/time: 2026-06-18 12:00
- Responsible person: Automated test
- Media carta result: PENDIENTE DE IMPRESION FISICA
- Evidence/capture reference: qa/synthetic-printer-proof.json
- Final conclusion: PARTIAL until physical paper validation.

## Required checks

- [ ] Media carta receipt prints at 100 percent scale. Result/evidence: PENDIENTE DE FOTO.

## Evidence

This incomplete fixture must be rejected by auto_evidence.ps1 because it still
has an unchecked physical printer item and a pending result field. The file is
long enough that the failure proves content validation, not only length checks.
"@
    }

    $handoffDecision = if ($Ready) { "PRODUCTION_READY" } else { "READY_FOR_REAL_LAN_INSTALLATION_TEST" }
    $handoffProof = @"
# Synthetic final handoff

- Date/time: 2026-06-18 12:00
- Responsible person: Automated test
- LAN client evidence: filled
- Printer evidence: filled
- Restore evidence: filled
- Concurrency evidence: filled
- Concurrency-under-load evidence: filled
- Real LAN smoke evidence: filled
- Decision: $handoffDecision

## Evidence

This synthetic handoff contains enough text to prove that auto_evidence.ps1
evaluates the decision line. Only PRODUCTION_READY may pass check mode. A
non-ready decision must fail even if all files exist and have long contents.
"@

    $proofs = @{
        "LAN_CLIENT_VALIDATION_PROOF.md" = $readyProof
        "INSTITUTIONAL_RECEIPT_PRINT_PROOF.md" = $printerProof
        "FINAL_RESTORE_PROOF.md" = $readyProof
        "FINAL_CONCURRENCY_PROOF.md" = $readyProof
        "FINAL_CONCURRENCY_UNDER_LOAD_PROOF_LAN_8081.md" = $readyProof
        "FINAL_REAL_SMOKE_LAN_8081.md" = $readyProof
        "FINAL_PRODUCTION_HANDOFF_RESULT.md" = $handoffProof
    }

    foreach ($name in $proofs.Keys) {
        Set-Content -LiteralPath (Join-Path $qaDir $name) -Value $proofs[$name] -NoNewline
    }
}

function Get-PowerShellHostCommand {
    if (Get-Command pwsh -ErrorAction SilentlyContinue) {
        return (Get-Command pwsh).Source
    }

    if (Get-Command powershell.exe -ErrorAction SilentlyContinue) {
        return (Get-Command powershell.exe).Source
    }

    if (Get-Command powershell -ErrorAction SilentlyContinue) {
        return (Get-Command powershell).Source
    }

    throw "No PowerShell host command was found for auto_evidence.ps1 subprocess tests."
}

function Assert-AutoEvidenceCheck([string] $ScriptPath, [bool] $Ready, [int] $ExpectedExitCode, [string] $ExpectedOutput) {
    $root = Join-Path ([System.IO.Path]::GetTempPath()) ("s-hospital-auto-evidence-test-" + [Guid]::NewGuid().ToString("N"))
    try {
        New-AutoEvidenceProofSet -Root $root -Ready $Ready
        $powerShellHost = Get-PowerShellHostCommand
        $output = & $powerShellHost -NoProfile -ExecutionPolicy Bypass -File $ScriptPath -ProjectRoot $root -Mode check 2>&1
        $exitCode = $LASTEXITCODE
        if ($exitCode -ne $ExpectedExitCode) {
            throw "Unexpected auto_evidence.ps1 exit code. Expected $ExpectedExitCode, got $exitCode. Output: $($output -join ' ')"
        }

        $joined = $output -join "`n"
        if (-not $joined.Contains($ExpectedOutput)) {
            throw "Unexpected auto_evidence.ps1 output. Expected '$ExpectedOutput'. Output: $joined"
        }
    } finally {
        $resolvedRoot = if (Test-Path -LiteralPath $root) { (Resolve-Path -LiteralPath $root).Path } else { $root }
        $tempRoot = [System.IO.Path]::GetTempPath()
        if ($resolvedRoot.StartsWith($tempRoot, [System.StringComparison]::OrdinalIgnoreCase) -and
            (Split-Path -Leaf $resolvedRoot).StartsWith("s-hospital-auto-evidence-test-", [System.StringComparison]::OrdinalIgnoreCase)) {
            Remove-Item -LiteralPath $resolvedRoot -Recurse -Force -ErrorAction SilentlyContinue
        }
    }
}

function Assert-BatchRejectsUnsafeProjectName([string] $Path) {
    $command = 'call "' + $Path + '" --mode=docker --env-file .\.env --project-name "bad^&name" --check'
    $output = & cmd.exe /c $command 2>&1
    $exitCode = $LASTEXITCODE
    if ($exitCode -ne 1) {
        throw "Unexpected exit code for unsafe project name in '$Path'. Expected 1, got $exitCode. Output: $($output -join ' ')"
    }

    $joined = $output -join "`n"
    if (-not $joined.Contains("ERROR: Valor invalido para --project-name.")) {
        throw "Unsafe project name was not rejected cleanly in '$Path'. Output: $joined"
    }

    if ($joined.Contains('"name" no se reconoce') -or $joined.Contains("'name' is not recognized")) {
        throw "Unsafe project name escaped into cmd parsing in '$Path'. Output: $joined"
    }
}

function Assert-StartupLauncherRejectsUnsafeEnv([string] $Path, [string] $VariableName, [string] $ExpectedOutput) {
    $command = "set `"$VariableName=bad^&name`" && call `"$Path`" --check"
    $output = & cmd.exe /c $command 2>&1
    $exitCode = $LASTEXITCODE
    if ($exitCode -ne 1) {
        throw "Unexpected exit code for unsafe $VariableName in '$Path'. Expected 1, got $exitCode. Output: $($output -join ' ')"
    }

    $joined = $output -join "`n"
    if (-not $joined.Contains($ExpectedOutput)) {
        throw "Unsafe $VariableName was not rejected cleanly in '$Path'. Expected '$ExpectedOutput'. Output: $joined"
    }

    if ($joined.Contains('"name" no se reconoce') -or $joined.Contains("'name' is not recognized")) {
        throw "Unsafe $VariableName escaped into cmd parsing in '$Path'. Output: $joined"
    }
}

$installer = Join-Path $scriptRoot "install_backup_tasks_windows.ps1"
$startupInstaller = Join-Path $scriptRoot "install_backup_startup_current_user.ps1"
$startupLauncher = Join-Path $scriptRoot "start_backup_automation.cmd"
$schedulerLoop = Join-Path $scriptRoot "run_backup_scheduler_loop.ps1"
$preflight = Join-Path $scriptRoot "production_readiness_preflight.ps1"
$handoff = Join-Path $scriptRoot "final_production_handoff.ps1"
$worker = Join-Path $scriptRoot "run_backup_worker.cmd"
$scheduled = Join-Path $scriptRoot "run_scheduled_backup.cmd"

Assert-Contains $installer '[System.IO.Path]::IsPathRooted($EnvFile)' "install_backup_tasks_windows.ps1 must resolve relative EnvFile against ProjectRoot."
Assert-Contains $installer 'Join-Path $ProjectRoot $EnvFile' "install_backup_tasks_windows.ps1 must join relative EnvFile to ProjectRoot."
Assert-Contains $installer '[string] $ComposeProjectName = ""' "install_backup_tasks_windows.ps1 must accept ComposeProjectName."
Assert-Contains $installer 'ComposeProjectName invalido' "install_backup_tasks_windows.ps1 must reject unsafe ComposeProjectName values."
Assert-Contains $installer '--project-name' "Scheduled task actions must pass --project-name when ComposeProjectName is set."
Assert-Contains $installer 'Start-ElevatedSelf' "install_backup_tasks_windows.ps1 must support explicit UAC relaunch."
Assert-Contains $installer 'Wait-ForElevatedTaskResult' "install_backup_tasks_windows.ps1 must verify that elevated UAC registration actually changed scheduled tasks."
Assert-Contains $installer 'las tareas programadas no quedaron instaladas' "install_backup_tasks_windows.ps1 must fail clearly when UAC returns without installed tasks."
Assert-Contains $installer 'aunque esta sesion no puede ver tareas SYSTEM' "install_backup_tasks_windows.ps1 must tolerate non-admin sessions that cannot enumerate SYSTEM tasks after UAC succeeds."
Assert-Contains $installer 'ElevatedLogPath' "install_backup_tasks_windows.ps1 must support an elevated diagnostic log."
Assert-Contains $installer 'WINDOWS_BACKUP_TASK_ELEVATED_INSTALL.log' "install_backup_tasks_windows.ps1 must default elevated diagnostics to a supportable qa log."
Assert-Contains $installer '$legacyBackupProductStem = "Hospital" + ("Bill" + "ing") + "OS"' "install_backup_tasks_windows.ps1 must build the previous-generation backup task stem without exposing legacy branding as a contiguous visible string."
Assert-Contains $installer '"$legacyBackupProductStem-BackupWorker"' "install_backup_tasks_windows.ps1 must detect and remove the previous-generation backup worker task during update/uninstall."
Assert-Contains $installer '"$legacyBackupProductStem-DailyBackup"' "install_backup_tasks_windows.ps1 must detect and remove the previous-generation daily backup task during update/uninstall."
Assert-Contains $installer 'backup_worker_task_launch.log' "install_backup_tasks_windows.ps1 must capture scheduled-task launch output for worker diagnostics."
Assert-Contains $installer 'backup_scheduled_task_launch.log' "install_backup_tasks_windows.ps1 must capture scheduled-task launch output for daily backup diagnostics."
Assert-Contains $installer '$workerArgs = ''/d /c '' + $workerCommand' "install_backup_tasks_windows.ps1 must use robust cmd.exe parsing for quoted script paths."
Assert-Contains $installer 'New-ScheduledTaskTrigger -AtStartup' "install_backup_tasks_windows.ps1 worker must start with Windows, not only after interactive logon."
Assert-Contains (Join-Path $scriptRoot 'deploy_hospital_lan.ps1') 'install_backup_startup_current_user.ps1' "deploy_hospital_lan.ps1 must fall back to current-user backup automation when admin tasks cannot be registered."
Assert-Contains (Join-Path $scriptRoot 'deploy_hospital_lan.ps1') '-LaunchElevated' "deploy_hospital_lan.ps1 must request UAC elevation for backup task registration."
Assert-Contains (Join-Path $scriptRoot 'deploy_hospital_lan.ps1') 'Produccion final seguira requiriendo tareas programadas admin' "deploy_hospital_lan.ps1 must warn that fallback is not final production approval."

$legacyInstaller = Join-Path $scriptRoot 'install_hospital_os.ps1'
Assert-Contains $legacyInstaller '[switch]$LegacyUnsupported' "install_hospital_os.ps1 must require an explicit unsupported legacy flag."
Assert-Contains $legacyInstaller 'Instalador legacy bloqueado' "install_hospital_os.ps1 must abort by default instead of continuing into the deprecated flow."

Assert-Contains $startupInstaller '[ValidateSet("Auto", "Docker", "Php")]' "install_backup_startup_current_user.ps1 must accept explicit backup mode."
Assert-Contains $startupInstaller '[System.IO.Path]::IsPathRooted($EnvFile)' "install_backup_startup_current_user.ps1 must resolve relative EnvFile against ProjectRoot."
Assert-Contains $startupInstaller '[string] $ComposeProjectName = ""' "install_backup_startup_current_user.ps1 must accept ComposeProjectName."
Assert-Contains $startupInstaller 'ComposeProjectName invalido' "install_backup_startup_current_user.ps1 must reject unsafe ComposeProjectName values."
Assert-Contains $startupInstaller '$runKeyValue = "`"$startupFile`""' "install_backup_startup_current_user.ps1 HKCU Run must call the contextual startup file, not the bare launcher."
Assert-Contains $startupInstaller 'no requerido en modo Docker' "install_backup_startup_current_user.ps1 must not require host PHP in explicit Docker mode."
Assert-Contains $startupInstaller 'set `"HOSPITAL_ENV_FILE=`"' "install_backup_startup_current_user.ps1 must clear inherited EnvFile when not configured."
Assert-Contains $startupInstaller 'Remove-Item Env:HOSPITAL_ENV_FILE' "install_backup_startup_current_user.ps1 StartNow must clear inherited EnvFile when not configured."
Assert-Contains $startupInstaller 'HOSPITAL_COMPOSE_PROJECT_NAME' "install_backup_startup_current_user.ps1 must pass ComposeProjectName through startup environment."

Assert-Contains $startupLauncher 'HOSPITAL_BACKUP_MODE' "start_backup_automation.cmd must pass backup mode to the scheduler loop."
Assert-Contains $startupLauncher 'HOSPITAL_ENV_FILE' "start_backup_automation.cmd must pass EnvFile to the scheduler loop."
Assert-Contains $startupLauncher 'HOSPITAL_COMPOSE_PROJECT_NAME' "start_backup_automation.cmd must pass ComposeProjectName to the scheduler loop."
Assert-Contains $startupLauncher 'ERROR: Valor invalido para HOSPITAL_ENV_FILE.' "start_backup_automation.cmd must reject unsafe EnvFile values before composing arguments."
Assert-Contains $startupLauncher 'ERROR: Valor invalido para HOSPITAL_COMPOSE_PROJECT_NAME.' "start_backup_automation.cmd must reject unsafe ComposeProjectName values before composing arguments."
Assert-Contains $startupLauncher '-EnvFile "%HOSPITAL_ENV_FILE%"' "start_backup_automation.cmd must pass EnvFile as a quoted argument after validation."
Assert-Contains $startupLauncher '-ComposeProjectName "%HOSPITAL_COMPOSE_PROJECT_NAME%"' "start_backup_automation.cmd must pass ComposeProjectName as a quoted argument after validation."

Assert-Contains $schedulerLoop '[ValidateSet("Auto", "Docker", "Php")]' "run_backup_scheduler_loop.ps1 must support explicit Docker/PHP mode."
Assert-Contains $schedulerLoop '[System.IO.Path]::IsPathRooted($EnvFile)' "run_backup_scheduler_loop.ps1 must resolve relative EnvFile against ProjectRoot."
Assert-Contains $schedulerLoop 'ComposeProjectName invalido' "run_backup_scheduler_loop.ps1 must reject unsafe ComposeProjectName values."
Assert-Contains $schedulerLoop '$dockerComposeArgs += @("-p", $ComposeProjectName)' "run_backup_scheduler_loop.ps1 must include ComposeProjectName in Docker commands."
Assert-Contains $schedulerLoop 'hospital:backup", "--type=scheduled"' "run_backup_scheduler_loop.ps1 must still run scheduled backups through artisan."
Assert-Contains $schedulerLoop 'Push-Location $backendDir' "run_backup_scheduler_loop.ps1 must run PHP scheduled backups from backend directory."

Assert-Contains $preflight '[System.IO.Path]::IsPathRooted($EnvFile)' "production_readiness_preflight.ps1 must resolve relative EnvFile against ProjectRoot."
Assert-Contains $preflight '[string] $ComposeProjectName = ""' "production_readiness_preflight.ps1 must accept ComposeProjectName."
Assert-Contains $preflight 'ComposeProjectName invalido' "production_readiness_preflight.ps1 must reject unsafe ComposeProjectName values."
Assert-Contains $preflight 'PreflightComposeProjectName' "production_readiness_preflight.ps1 must pass ComposeProjectName to wrapper checks."
Assert-Contains $preflight 'LastTaskResult -ne 0' "production_readiness_preflight.ps1 must fail when Windows backup tasks have a non-zero last result."
Assert-Contains $preflight 'Test-CurrentUserBackupStartupAutomation' "production_readiness_preflight.ps1 must validate current-user Startup/HKCU backup fallback."
Assert-Contains $preflight 'Current-user backup Startup/HKCU fallback is installed' "production_readiness_preflight.ps1 must report installed current-user backup fallback."
Assert-Contains $preflight 'depends on this Windows user logging in' "production_readiness_preflight.ps1 must warn when relying on current-user backup fallback."
Assert-Contains $preflight '$blockingWarnings' "production_readiness_preflight.ps1 must treat production-forbidden warnings as blocking."
Assert-Contains $preflight '$blockingWarnings.Add' "production_readiness_preflight.ps1 strong warnings must increment the blocking count."
Assert-Contains $preflight 'Test-WindowsBackupAutomation' "production_readiness_preflight.ps1 must choose between admin scheduled tasks and current-user fallback."
Assert-Contains $preflight 'Test-ElevatedBackupTaskProof' "production_readiness_preflight.ps1 must consider the latest elevated backup-task proof when non-elevated task reads are blocked."
Assert-Contains $preflight 'Scheduled tasks registered successfully\.' "production_readiness_preflight.ps1 elevated proof must require successful task registration."
Assert-Contains $preflight 'SistemaCajaHospitalaria-BackupWorker: state=Ready, .*user=SYSTEM\.' "production_readiness_preflight.ps1 elevated proof must require the worker task Ready as SYSTEM."
Assert-Contains $preflight 'SistemaCajaHospitalaria-DailyBackup: state=Ready, .*user=SYSTEM\.' "production_readiness_preflight.ps1 elevated proof must require the daily task Ready as SYSTEM."
Assert-Contains $preflight 'ERROR:' "production_readiness_preflight.ps1 elevated proof must reject a latest elevated attempt with errors."
Assert-Contains $preflight "Legacy scheduled task" "production_readiness_preflight.ps1 must block previous-generation scheduled tasks."
Assert-Contains $preflight '$legacyBackupProductStem = "Hospital" + ("Bill" + "ing") + "OS"' "production_readiness_preflight.ps1 must build the previous-generation backup task stem without exposing legacy branding as a contiguous visible string."
Assert-Contains $preflight '"$legacyBackupProductStem-BackupWorker"' "production_readiness_preflight.ps1 must explicitly detect the previous-generation backup worker task."
Assert-Contains $preflight '"$legacyBackupProductStem-DailyBackup"' "production_readiness_preflight.ps1 must explicitly detect the previous-generation daily backup task."
Assert-Contains $preflight 'Test-NoActiveValidationUsers' "production_readiness_preflight.ps1 must block active validation/demo users in production."
Assert-Contains $preflight '%.offline' "production_readiness_preflight.ps1 must detect offline validation users."
Assert-Contains $preflight 'concurrency.%' "production_readiness_preflight.ps1 must detect concurrency validation users."
Assert-Contains $preflight 'load.%' "production_readiness_preflight.ps1 must detect load-test validation users."
Assert-Contains $preflight 'Active validation/demo users remain' "production_readiness_preflight.ps1 must fail with an actionable validation-user message."
Assert-Contains $preflight 'command -v mariadb-dump || command -v mysqldump' "production_readiness_preflight.ps1 must validate Docker dump tool availability."
Assert-Contains $preflight 'migrate:status' "production_readiness_preflight.ps1 must validate Docker backend DB connectivity."
Assert-Contains $preflight 'FINAL_CONCURRENCY_UNDER_LOAD_PROOF_LAN_8081.md' "production_readiness_preflight.ps1 must require concurrency-under-load evidence."
Assert-Contains $preflight 'final concurrency under load' "production_readiness_preflight.ps1 must label concurrency-under-load proof distinctly."
Assert-Contains $preflight 'FINAL_REAL_SMOKE_LAN_8081.md' "production_readiness_preflight.ps1 must require real LAN smoke evidence."
Assert-Contains $preflight 'final real LAN smoke' "production_readiness_preflight.ps1 must strictly validate real LAN smoke evidence."
Assert-Contains $preflight 'Test-ReportExportPrivacyGuards' "production_readiness_preflight.ps1 must run report export privacy guards."
Assert-Contains $preflight 'Test-LanProofMatchesBaseUrl' "production_readiness_preflight.ps1 must require second-client LAN evidence to match the final BaseUrl."
Assert-Contains $preflight 'Test-ProofMatchesBaseUrl' "production_readiness_preflight.ps1 must reject stale final evidence tied to an old BaseUrl."
Assert-Contains $preflight 'Test-FinalLanProofFile' "production_readiness_preflight.ps1 must validate the final LAN proof as one unit before reporting it completed."
Assert-Contains $preflight 'return $false' "production_readiness_preflight.ps1 stale LAN proof check must return false so the completed-evidence pass is not printed for old IP evidence."
Assert-Contains $preflight 'LAN client proof is marked as historical or requiring repeat' "production_readiness_preflight.ps1 must reject historical LAN evidence even when it mentions the final BaseUrl."
Assert-Contains $preflight 'LAN client proof Server LAN URL must be exactly' "production_readiness_preflight.ps1 must require the Server LAN URL field to exactly match the final BaseUrl."
Assert-Contains $preflight '-proofName "final real LAN smoke"' "production_readiness_preflight.ps1 must require final real smoke evidence to match BaseUrl."
Assert-Contains $preflight '-fieldLabel "URL LAN"' "production_readiness_preflight.ps1 must require final real smoke URL LAN evidence to match BaseUrl."
Assert-Contains $preflight '-proofName "final concurrency under load"' "production_readiness_preflight.ps1 must require concurrency-under-load evidence to match BaseUrl."
Assert-Contains $preflight '-fieldLabel "Server LAN URL"' "production_readiness_preflight.ps1 must require Server LAN URL evidence to match BaseUrl."
Assert-Contains $preflight "assertJsonMissingPath\('data\.voids\.0\.patient_name'\)" "production_readiness_preflight.ps1 must verify patient names stay out of operations report export payloads."
Assert-Contains $preflight "assertJsonMissingPath\('data\.payment_voids\.0\.patient_name'\)" "production_readiness_preflight.ps1 must verify payment reversal patient names stay out of export payloads."
Assert-Contains $preflight "assertJsonMissingPath\('data\.cashiers\.0\.username'\)" "production_readiness_preflight.ps1 must verify cashier usernames stay out of operations report export payloads."
Assert-Contains $preflight 'IOFactory::load\(\$path\)' "production_readiness_preflight.ps1 must require XLSX export introspection evidence."

Assert-Contains $handoff '[string] $EnvFile = ""' "final_production_handoff.ps1 must accept EnvFile."
Assert-Contains $handoff '[string] $ComposeProjectName = ""' "final_production_handoff.ps1 must accept ComposeProjectName."
Assert-Contains $handoff 'install_backup_startup_current_user.ps1' "final_production_handoff.ps1 must report current-user backup fallback status."
Assert-Contains $handoff 'FINAL_REAL_SMOKE_LAN_8081.md' "final_production_handoff.ps1 must require real LAN smoke evidence."
Assert-Contains $handoff 'FINAL_CONCURRENCY_UNDER_LOAD_PROOF_LAN_8081.md' "final_production_handoff.ps1 must require concurrency-under-load evidence."
Assert-Contains $handoff 'validate_mysql_concurrency_under_load.mjs' "final_production_handoff.ps1 must tell operators how to rerun concurrency-under-load validation."
Assert-Contains $handoff '-Mode Docker' "final_production_handoff.ps1 must include Docker mode when generating backup task install commands for Docker handoff."
Assert-Contains $handoff '-LaunchElevated' "final_production_handoff.ps1 must tell operators to relaunch backup task registration with UAC elevation."
Assert-Contains $handoff 'Get-BackupTaskInstallCommand' "final_production_handoff.ps1 must reuse one contextual backup-task install command in report and console output."
Assert-Contains $handoff 'backupFallbackStatusOutput' "final_production_handoff.ps1 must include fallback status in its report."
Assert-Contains $handoff 'Get-ElevatedBackupTaskProofSummary' "final_production_handoff.ps1 must summarize elevated SYSTEM task proof separately from non-elevated status."
Assert-Contains $handoff '## Elevated backup task proof' "final_production_handoff.ps1 must include elevated backup task proof in the handoff report."
Assert-Contains $handoff 'non-elevated status may report tasks as not installed' "final_production_handoff.ps1 must warn when non-elevated status cannot see SYSTEM tasks."
Assert-Contains $handoff '$preflightArgs += @("-EnvFile", $EnvFile)' "final_production_handoff.ps1 must pass EnvFile to preflight."
Assert-Contains $handoff '$preflightArgs += @("-ComposeProjectName", $ComposeProjectName)' "final_production_handoff.ps1 must pass ComposeProjectName to preflight."
Assert-Contains $handoff 'LAN_CLIENT_VALIDATION_PROOF.md -Force' "final_production_handoff.ps1 must tell operators to use -Force when replacing stale LAN proof for the final BaseUrl."
Assert-Contains $handoff 'VALIDADO_HISTORICO_REQUIERE_REPETIR_IP_FINAL' "final_production_handoff.ps1 must reject historical LAN proof files."
Assert-Contains $handoff 'Get-ProofFieldValue $content "Server LAN URL"' "final_production_handoff.ps1 must validate the Server LAN URL field exactly."
Assert-Contains $handoff 'Test-ProofUrlMatchesBaseUrl' "final_production_handoff.ps1 must reject stale final proof URLs in its summary booleans."
Assert-Contains $handoff 'Test-ProofUrlMatchesBaseUrl $concurrencyUnderLoadProofPath "Server LAN URL"' "final_production_handoff.ps1 must reject stale concurrency-under-load proof URLs."
Assert-Contains $handoff 'Test-ProofUrlMatchesBaseUrl $realSmokeProofPath "URL LAN"' "final_production_handoff.ps1 must reject stale real smoke proof URLs."

$proofInit = Join-Path $scriptRoot "init_production_proofs.ps1"
Assert-Contains $proofInit 'FINAL_CONCURRENCY_UNDER_LOAD_PROOF_LAN_8081.example.md' "init_production_proofs.ps1 must create the concurrency-under-load proof from a template."
Assert-Contains $proofInit 'FINAL_REAL_SMOKE_LAN_8081.example.md' "init_production_proofs.ps1 must create the real LAN smoke proof from a template."

$autoEvidence = Join-Path $scriptRoot "auto_evidence.ps1"
Assert-Contains $autoEvidence 'FINAL_CONCURRENCY_UNDER_LOAD_PROOF_LAN_8081.md' "auto_evidence.ps1 must prepare concurrency-under-load evidence."
Assert-Contains $autoEvidence 'FINAL_REAL_SMOKE_LAN_8081.md' "auto_evidence.ps1 must prepare real LAN smoke evidence."
Assert-Contains $autoEvidence 'Concurrency-under-load evidence' "auto_evidence.ps1 handoff template must expose concurrency-under-load status."
Assert-Contains $autoEvidence 'Real LAN smoke evidence' "auto_evidence.ps1 handoff template must expose real LAN smoke status."
Assert-Contains $autoEvidence 'function Test-EvidenceFileReady' "auto_evidence.ps1 check mode must validate evidence contents, not only existence."
Assert-Contains $autoEvidence 'AUTO_EVIDENCE_READY: NO' "auto_evidence.ps1 check mode must fail loudly when evidence is incomplete."
Assert-Contains $autoEvidence 'handoff decision is not PRODUCTION_READY' "auto_evidence.ps1 check mode must reject non-ready handoff decisions."
Assert-Contains $autoEvidence 'LAN client proof does not reference final app URL $appUrl' "auto_evidence.ps1 check mode must reject stale second-client LAN evidence from an old IP."
Assert-AutoEvidenceCheck -ScriptPath $autoEvidence -Ready $false -ExpectedExitCode 1 -ExpectedOutput "AUTO_EVIDENCE_READY: NO"
Assert-AutoEvidenceCheck -ScriptPath $autoEvidence -Ready $true -ExpectedExitCode 0 -ExpectedOutput "AUTO_EVIDENCE_READY: YES"

foreach ($batch in @($worker, $scheduled)) {
    Assert-Contains $batch 'ERROR: Valor invalido para --mode. Use docker o php.' "$batch must fail on invalid --mode."
    Assert-Contains $batch 'ERROR: Valor invalido para --project-name.' "$batch must fail on unsafe --project-name."
    Assert-Contains $batch '--project-name' "$batch must parse --project-name."
    Assert-Contains $batch 'COMPOSE_PROJECT_ARGS=-p !COMPOSE_PROJECT_NAME_OVERRIDE!' "$batch must use delayed expansion after validating ComposeProjectName."
    Assert-Contains $batch 'set "DOCKER_CONFIG=%LOG_DIR%\docker-config"' "$batch must isolate Docker CLI config from a personal Windows profile when running as SYSTEM."
    Assert-Contains $batch 'docker compose version >nul 2>>"%LOG_FILE%"' "$batch must log Docker CLI bootstrap errors for scheduled-task diagnostics."
    Assert-Contains $batch 'config --services' "$batch must inspect compose services during Docker checks."
    Assert-Contains $batch 'ps --status running -q backend' "$batch must verify backend is running during Docker checks."
    Assert-Contains $batch 'php artisan --version' "$batch must verify backend artisan responds during Docker checks."
}

Assert-Contains $worker 'ps --status running -q queue-worker' "run_backup_worker.cmd must verify queue-worker is running during Docker checks."
Assert-Contains $worker 'exec -T queue-worker php artisan --version' "run_backup_worker.cmd must verify queue-worker can execute artisan during Docker checks."
Assert-Contains $scheduled 'php artisan list --raw' "run_scheduled_backup.cmd must verify hospital:backup exists during Docker checks."
Assert-Contains $scheduled 'migrate:status' "run_scheduled_backup.cmd must verify DB connectivity during Docker checks."
Assert-Contains $scheduled 'command -v mariadb-dump || command -v mysqldump' "run_scheduled_backup.cmd must verify dump tool availability during Docker checks."

Assert-ExitCodeAndOutput "call `"$worker`" --mode dockr --check" 1 "ERROR: Valor invalido para --mode. Use docker o php."
Assert-ExitCodeAndOutput "call `"$scheduled`" --mode dockr --check" 1 "ERROR: Valor invalido para --mode. Use docker o php."
Assert-BatchRejectsUnsafeProjectName $worker
Assert-BatchRejectsUnsafeProjectName $scheduled
Assert-StartupLauncherRejectsUnsafeEnv $startupLauncher "HOSPITAL_ENV_FILE" "ERROR: Valor invalido para HOSPITAL_ENV_FILE."
Assert-StartupLauncherRejectsUnsafeEnv $startupLauncher "HOSPITAL_COMPOSE_PROJECT_NAME" "ERROR: Valor invalido para HOSPITAL_COMPOSE_PROJECT_NAME."

Write-Host "[OK] Backup task EnvFile hardening validation passed."
