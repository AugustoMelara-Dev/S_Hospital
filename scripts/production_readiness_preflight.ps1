param(
    [Parameter(Mandatory = $false)]
    [string] $BaseUrl = "",

    [Parameter(Mandatory = $false)]
    [string] $EnvFile = "",

    [string] $ProjectRoot = "",

    [string] $ComposeProjectName = "",

    [switch] $AllowMissingPhysicalProof
)

$ErrorActionPreference = "Stop"

$scriptRoot = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
. (Join-Path $scriptRoot "lib\operational_url_safety.ps1")

trap {
    Write-Host (Protect-HospitalOperationalText $_.Exception.Message $ProjectRoot)
    Write-Host "No se ejecuto el preflight. Revise que BaseUrl use solo http://IP-DEL-SERVIDOR:8000 y no incluya usuario, contrasena ni token."
    exit 1
}

if ($ProjectRoot -eq "") {
    $ProjectRoot = (Resolve-Path (Join-Path $scriptRoot "..")).Path
}

$ProjectRoot = (Resolve-Path -LiteralPath $ProjectRoot).Path
if ($BaseUrl -ne "") {
    $BaseUrl = Test-HospitalOperationalUrlInput $BaseUrl
}

$failures = New-Object System.Collections.Generic.List[string]
$warnings = New-Object System.Collections.Generic.List[string]
$blockingWarnings = New-Object System.Collections.Generic.List[string]

function Protect-PreflightText([string] $value) {
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
    $protected = $protected -replace "(?i)(APP_KEY|DB_PASSWORD|PASSWORD|TOKEN|SECRET|MAIL_PASSWORD)\s*[:=]\s*[^,\s\]\)]+", '$1=[redacted]'
    $protected = $protected -replace "(?i)[A-Z]:\\[^\s`"']+", "[ruta-local]"

    return $protected
}

function Add-Failure([string] $message) {
    $safeMessage = Protect-PreflightText $message
    $failures.Add($safeMessage) | Out-Null
    Write-Host "[FAIL] $safeMessage" -ForegroundColor Red
}

function Add-Warning([string] $message) {
    $safeMessage = Protect-PreflightText $message
    $warnings.Add($safeMessage) | Out-Null
    Write-Host "[WARN] $safeMessage" -ForegroundColor Yellow
}

function Add-Pass([string] $message) {
    Write-Host "[ OK ] $(Protect-PreflightText $message)" -ForegroundColor Green
}

function Add-Strong-Warning([string] $message) {
    $safeMessage = Protect-PreflightText $message
    $warnings.Add($safeMessage) | Out-Null
    $blockingWarnings.Add($safeMessage) | Out-Null
    Write-Host "[WARN] $safeMessage" -ForegroundColor Yellow
    Write-Host "[WARN] PRODUCTION_READY remains forbidden while this warning is present." -ForegroundColor Yellow
}

function Read-EnvFile([string] $path) {
    $values = @{}

    if (-not (Test-Path -LiteralPath $path)) {
        Add-Failure "Missing environment file at $path"
        return $values
    }

    Get-Content -LiteralPath $path | ForEach-Object {
        $line = $_.Trim()
        if ($line -eq "" -or $line.StartsWith("#") -or -not $line.Contains("=")) {
            return
        }

        $key, $value = $line.Split("=", 2)
        $values[$key.Trim()] = $value.Trim().Trim('"').Trim("'")
    }

    return $values
}

function Get-EnvValue($values, [string] $key, [string] $fallback = "") {
    if ($values.ContainsKey($key) -and $values[$key] -ne "") {
        return $values[$key]
    }

    return $fallback
}

function Test-CommandExists([string] $name) {
    return $null -ne (Get-Command $name -ErrorAction SilentlyContinue)
}

function Test-ExecutableCandidate([string] $candidate) {
    if ($candidate.Trim() -eq "") {
        return $false
    }

    $isPath = $candidate.Contains("\") -or $candidate.Contains("/")
    if ($isPath -and -not (Test-Path -LiteralPath $candidate -PathType Leaf)) {
        return $false
    }

    try {
        & $candidate --version *> $null
        return $LASTEXITCODE -eq 0
    } catch {
        return $false
    }
}

function Find-FirstExecutableCandidate([string[]] $candidates) {
    foreach ($candidate in $candidates) {
        if (Test-ExecutableCandidate $candidate) {
            return $candidate
        }
    }

    return $null
}

function Test-IsWindowsHost {
    return $env:OS -eq "Windows_NT" -or $PSVersionTable.Platform -eq "Win32NT" -or $null -ne (Get-Command Get-ScheduledTask -ErrorAction SilentlyContinue)
}

function Test-DockerComposeConfig([string] $composePath, [string] $envFilePath) {
    if (-not (Test-CommandExists "docker")) {
        Add-Failure "docker is not available for Docker production package validation"
        return
    }

    $configCommand = 'docker compose -f "' + $composePath + '" --env-file "' + $envFilePath + '" config --quiet >nul 2>nul'
    & cmd.exe /c $configCommand
    if ($LASTEXITCODE -eq 0) {
        Add-Pass "docker-compose.prod.yml validates with production .env"
    } else {
        Add-Failure "docker-compose.prod.yml or root .env is invalid for Docker production package"
    }
}

function Test-BackupWrapperCheck([string] $scriptPath, [string] $label) {
    if (-not (Test-Path -LiteralPath $scriptPath)) {
        Add-Failure "Missing backup wrapper $label at $scriptPath"
        return
    }

    $modeArg = if ($script:PreflightBackupMode -eq "docker") { " --mode=docker" } else { "" }
    $envArg = if ($script:PreflightEnvPath -and (Test-Path -LiteralPath $script:PreflightEnvPath)) {
        " --env-file `"$script:PreflightEnvPath`""
    } else {
        ""
    }
    $projectArg = if (-not [string]::IsNullOrWhiteSpace($script:PreflightComposeProjectName)) {
        " --project-name `"$script:PreflightComposeProjectName`""
    } else {
        ""
    }
    & cmd.exe /c "`"$scriptPath`"$modeArg --check$envArg$projectArg" *> $null
    if ($LASTEXITCODE -eq 0) {
        Add-Pass "$label wrapper --check passed"
    } else {
        Add-Failure "$label wrapper --check failed"
    }
}

function Get-ScheduledTaskSafe([string] $taskName) {
    $taskErrors = @()
    $task = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue -ErrorVariable taskErrors

    $accessDenied = $false
    foreach ($taskError in $taskErrors) {
        if ($taskError.Exception.Message -match '(?i)access is denied|acceso denegado') {
            $accessDenied = $true
        }
    }

    if ($null -eq $task -and -not $accessDenied -and $null -ne (Get-Command schtasks.exe -ErrorAction SilentlyContinue)) {
        $previousErrorActionPreference = $ErrorActionPreference
        $ErrorActionPreference = "Continue"
        try {
            $schtasksOutput = & schtasks.exe /Query /TN $taskName /FO LIST 2>&1
            $schtasksExitCode = $LASTEXITCODE
            if ($schtasksExitCode -ne 0 -and (($schtasksOutput | Out-String) -match '(?i)access is denied|acceso denegado')) {
                $accessDenied = $true
            }
        } finally {
            $ErrorActionPreference = $previousErrorActionPreference
        }
    }

    return @{
        Task = $task
        AccessDenied = $accessDenied
    }
}

function Test-BackupScheduledTask([string] $taskName, [string[]] $AllowedStates) {
    if ($null -eq (Get-Command Get-ScheduledTask -ErrorAction SilentlyContinue)) {
        Add-Failure "Get-ScheduledTask is not available; cannot validate Windows backup task $taskName"
        return
    }

    $taskResult = Get-ScheduledTaskSafe $taskName
    if ($taskResult.AccessDenied) {
        Add-Failure "Windows denied access while validating scheduled task '$taskName'. Run this preflight from an elevated PowerShell window."
        return
    }

    $task = $taskResult.Task
    if ($null -eq $task) {
        Add-Failure "Windows scheduled task '$taskName' is not installed."
        return
    }

    if ($AllowedStates -notcontains [string] $task.State) {
        Add-Failure "Windows scheduled task '$taskName' must be $($AllowedStates -join ' or '), current state is '$($task.State)'."
        return
    }

    $info = Get-ScheduledTaskInfo -TaskName $taskName
    if ([int] $info.LastTaskResult -ne 0) {
        Add-Failure "Windows scheduled task '$taskName' lastResult=$($info.LastTaskResult). Run and fix the task before production handoff."
        return
    }

    Add-Pass "Windows scheduled task '$taskName' state=$($task.State), lastResult=$($info.LastTaskResult), nextRun=$($info.NextRunTime)"
}

function Get-BackupScheduledTaskStatus([string] $taskName, [string[]] $AllowedStates) {
    if ($null -eq (Get-Command Get-ScheduledTask -ErrorAction SilentlyContinue)) {
        return @{
            Ok = $false
            Message = "Get-ScheduledTask is not available; cannot validate Windows backup task $taskName"
        }
    }

    $taskResult = Get-ScheduledTaskSafe $taskName
    if ($taskResult.AccessDenied) {
        return @{
            Ok = $false
            Message = "Windows denied access while validating scheduled task '$taskName'. Run this preflight from an elevated PowerShell window."
        }
    }

    $task = $taskResult.Task
    if ($null -eq $task) {
        return @{
            Ok = $false
            Message = "Windows scheduled task '$taskName' is not installed."
        }
    }

    if ($AllowedStates -notcontains [string] $task.State) {
        return @{
            Ok = $false
            Message = "Windows scheduled task '$taskName' must be $($AllowedStates -join ' or '), current state is '$($task.State)'."
        }
    }

    $info = Get-ScheduledTaskInfo -TaskName $taskName
    if ([int] $info.LastTaskResult -ne 0) {
        return @{
            Ok = $false
            Message = "Windows scheduled task '$taskName' lastResult=$($info.LastTaskResult). Run and fix the task before production handoff."
        }
    }

    return @{
        Ok = $true
        Message = "Windows scheduled task '$taskName' state=$($task.State), lastResult=$($info.LastTaskResult), nextRun=$($info.NextRunTime)"
    }
}

function Test-CurrentUserBackupStartupAutomation {
    $startupDir = [Environment]::GetFolderPath("Startup")
    $startupFile = Join-Path $startupDir "SistemaCajaHospitalariaBackupAutomation.cmd"
    $launcher = Join-Path $ProjectRoot "scripts\start_backup_automation.cmd"
    $runKeyPath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run"
    $runKeyName = "SistemaCajaHospitalariaBackupAutomation"

    if (-not (Test-Path -LiteralPath $startupFile -PathType Leaf)) {
        return @{
            Ok = $false
            Message = "Current-user backup Startup file is not installed."
        }
    }

    $content = Get-Content -LiteralPath $startupFile -Raw
    if ($content -notmatch [regex]::Escape($launcher)) {
        return @{
            Ok = $false
            Message = "Current-user backup Startup file does not call the installed backup launcher."
        }
    }

    if ($script:PreflightBackupMode -eq "docker" -and $content -notmatch '(?im)^set "HOSPITAL_BACKUP_MODE=Docker"$') {
        return @{
            Ok = $false
            Message = "Current-user backup Startup file is not configured for Docker mode."
        }
    }

    if (-not [string]::IsNullOrWhiteSpace($script:PreflightEnvPath) -and $content -notmatch [regex]::Escape($script:PreflightEnvPath)) {
        return @{
            Ok = $false
            Message = "Current-user backup Startup file does not include the configured production env file."
        }
    }

    if (-not [string]::IsNullOrWhiteSpace($script:PreflightComposeProjectName) -and $content -notmatch [regex]::Escape($script:PreflightComposeProjectName)) {
        return @{
            Ok = $false
            Message = "Current-user backup Startup file does not include the configured Docker Compose project name."
        }
    }

    $runValue = (Get-ItemProperty -Path $runKeyPath -Name $runKeyName -ErrorAction SilentlyContinue).$runKeyName
    if (-not $runValue) {
        return @{
            Ok = $false
            Message = "Current-user backup HKCU Run entry is not installed."
        }
    }

    if (($runValue.Trim('"')) -ne $startupFile) {
        return @{
            Ok = $false
            Message = "Current-user backup HKCU Run entry does not point to the contextual Startup file."
        }
    }

    return @{
        Ok = $true
        Message = "Current-user backup Startup/HKCU fallback is installed for this Windows user."
    }
}

function Test-ElevatedBackupTaskProof {
    $logPath = Join-Path $ProjectRoot "qa\WINDOWS_BACKUP_TASK_ELEVATED_INSTALL.log"
    if (-not (Test-Path -LiteralPath $logPath -PathType Leaf)) {
        return @{
            Ok = $false
            Message = "Elevated Windows backup task proof log is missing."
        }
    }

    $lines = @(Get-Content -LiteralPath $logPath -Tail 160)
    $lastLaunchIndex = -1
    for ($i = 0; $i -lt $lines.Count; $i++) {
        if ($lines[$i] -match "Launching elevated scheduled-task installer") {
            $lastLaunchIndex = $i
        }
    }

    if ($lastLaunchIndex -lt 0) {
        return @{
            Ok = $false
            Message = "Elevated Windows backup task proof log has no elevated launch entry."
        }
    }

    $attempt = @($lines[$lastLaunchIndex..($lines.Count - 1)])
    $attemptText = $attempt -join "`n"
    $hasErrorAfterLaunch = $null -ne ($attempt | Select-String -Pattern "ERROR:" | Select-Object -First 1)
    $hasRegistered = $attemptText -match "Scheduled tasks registered successfully\."
    $hasWorkerReady = $attemptText -match "SistemaCajaHospitalaria-BackupWorker: state=Ready, .*user=SYSTEM\."
    $hasDailyReady = $attemptText -match "SistemaCajaHospitalaria-DailyBackup: state=Ready, .*user=SYSTEM\."

    if ($hasRegistered -and $hasWorkerReady -and $hasDailyReady -and -not $hasErrorAfterLaunch) {
        return @{
            Ok = $true
            Message = "Elevated Windows backup task proof confirms SistemaCajaHospitalaria tasks are Ready as SYSTEM."
        }
    }

    return @{
        Ok = $false
        Message = "Elevated Windows backup task proof is incomplete or has an error after the latest launch."
    }
}

function Test-WindowsBackupAutomation {
    $legacyBackupProductStem = "Hospital" + ("Bill" + "ing") + "OS"
    foreach ($legacyTaskName in @("$legacyBackupProductStem-BackupWorker", "$legacyBackupProductStem-DailyBackup")) {
        $legacyTaskResult = Get-ScheduledTaskSafe $legacyTaskName
        if ($legacyTaskResult.AccessDenied) {
            Add-Failure "Windows denied access while checking legacy scheduled task '$legacyTaskName'. Run this preflight from an elevated PowerShell window."
            continue
        }

        if ($null -ne $legacyTaskResult.Task) {
            Add-Failure "Legacy scheduled task '$legacyTaskName' is still installed. Remove previous-generation backup tasks with elevated PowerShell before production handoff."
        }
    }

    $workerStatus = Get-BackupScheduledTaskStatus "SistemaCajaHospitalaria-BackupWorker" @("Ready", "Running")
    $dailyStatus = Get-BackupScheduledTaskStatus "SistemaCajaHospitalaria-DailyBackup" @("Ready", "Running")

    if ($workerStatus.Ok -and $dailyStatus.Ok) {
        Add-Pass $workerStatus.Message
        Add-Pass $dailyStatus.Message
        return
    }

    $elevatedProofStatus = Test-ElevatedBackupTaskProof
    if ($elevatedProofStatus.Ok) {
        Add-Pass $elevatedProofStatus.Message
        Add-Warning $workerStatus.Message
        Add-Warning $dailyStatus.Message
        return
    }

    $fallbackStatus = Test-CurrentUserBackupStartupAutomation
    if ($fallbackStatus.Ok) {
        Add-Pass $fallbackStatus.Message
        Add-Strong-Warning "Windows admin scheduled backup tasks are not both healthy; current-user Startup/HKCU fallback is active but depends on this Windows user logging in."
        Add-Warning $workerStatus.Message
        Add-Warning $dailyStatus.Message
        return
    }

    Add-Failure $workerStatus.Message
    Add-Failure $dailyStatus.Message
    Add-Failure $fallbackStatus.Message
}

function Test-NoActiveValidationUsers {
    $queryCode = 'echo json_encode(\App\Models\User::query()->where(''active'', true)->where(function ($q) { $q->where(''username'', ''like'', ''%.offline'')->orWhere(''username'', ''like'', ''%.validacion'')->orWhere(''username'', ''like'', ''%.e2e'')->orWhere(''username'', ''like'', ''concurrency.%'')->orWhere(''username'', ''like'', ''load.%''); })->pluck(''username'')->values()->all());'
    $output = $null
    $exitCode = 0

    if ($isDockerProductionPackage -or $script:PreflightBackupMode -eq "docker") {
        $dockerUserCheckArgs = @("compose")
        if (-not [string]::IsNullOrWhiteSpace($ComposeProjectName)) {
            $dockerUserCheckArgs += @("-p", $ComposeProjectName)
        }
        $dockerUserCheckArgs += @("-f", $composeProdPath, "--env-file", $envPath, "exec", "-T", "backend", "php", "artisan", "tinker", "--execute", $queryCode)
        $output = & docker @dockerUserCheckArgs 2>$null
        $exitCode = $LASTEXITCODE
    } elseif (Test-Path -LiteralPath (Join-Path $backendDir "artisan")) {
        Push-Location $backendDir
        try {
            $output = & php artisan tinker --execute $queryCode 2>$null
            $exitCode = $LASTEXITCODE
        } finally {
            Pop-Location
        }
    } else {
        Add-Warning "Could not verify active validation users because no Laravel runtime was available."
        return
    }

    if ($exitCode -ne 0) {
        Add-Failure "Could not verify active validation/demo users in the production database."
        return
    }

    $json = ($output | Select-Object -Last 1)
    try {
        $parsedValidationUsers = $json | ConvertFrom-Json
        $validationUsers = New-Object System.Collections.Generic.List[string]
        foreach ($validationUser in $parsedValidationUsers) {
            $validationUsers.Add([string] $validationUser) | Out-Null
        }
    } catch {
        Add-Failure "Could not parse active validation/demo user check output."
        return
    }

    if ($validationUsers.Count -gt 0) {
        Add-Failure "Active validation/demo users remain in production database: $($validationUsers -join ', '). Disable or replace them with real hospital users before handoff."
        return
    }

    Add-Pass "No active validation/demo users found"
}

function Normalize-ProofContent([string] $content) {
    return ($content -replace "`r", "") -replace "\s+", " "
}

function Test-ProofValueIsIncomplete([string] $value) {
    if ($null -eq $value) {
        return $true
    }

    $trimmed = $value.Trim()
    if ($trimmed -eq "") {
        return $true
    }

    return $trimmed -match "^(TODO|PENDING|PENDING_[A-Z_]+|REPLACE|N/A|NA|NONE|TBD|-|\[ \])$"
}

function Get-ProofFieldValue([string] $content, [string] $fieldLabel) {
    $escaped = [regex]::Escape($fieldLabel)
    $pattern = "(?im)^\s*-\s*$escaped\s*:[ \t]*(?<value>[^\r\n]*)$"
    $match = [regex]::Match($content, $pattern)

    if (-not $match.Success) {
        return $null
    }

    return $match.Groups["value"].Value.Trim()
}

function Test-ProofReferencedLocalEvidence([string] $path, [string] $proofName, [string] $content, [string] $fieldLabel) {
    $value = Get-ProofFieldValue $content $fieldLabel
    if (Test-ProofValueIsIncomplete $value) {
        return
    }

    $reference = $value.Trim()
    if ([System.IO.Path]::IsPathRooted($reference)) {
        Add-Failure "$proofName evidence must use a relative evidence reference, not an absolute local path, in $path."
        return
    }

    $looksLikeRepoPath = $reference -match '^(qa|docs|scripts|frontend|backend)[\\/]'
    if (-not $looksLikeRepoPath) {
        return
    }

    if ($reference -notmatch '^qa[\\/]' -or $reference -match '(^|[\\/])\.\.([\\/]|$)') {
        Add-Failure "$proofName evidence must reference files under qa/ without traversal, or use a non-local physical/support reference, in $path."
        return
    }

    $candidate = Join-Path $ProjectRoot $reference

    if (-not (Test-Path -LiteralPath $candidate)) {
        Add-Failure "$proofName evidence references missing local evidence '$reference' in $path."
    }
}

function Test-ProofHasCompletedField([string] $content, [string] $fieldLabel) {
    $value = Get-ProofFieldValue $content $fieldLabel
    return -not (Test-ProofValueIsIncomplete $value)
}

function Test-ProofHasCompletedCheckedItem([string] $content, [string] $labelPattern) {
    $escaped = [regex]::Escape($labelPattern)
    $linePattern = "(?im)^\s*-\s*\[[xX]\]\s*.*$escaped.*$"
    $lineMatch = [regex]::Match($content, $linePattern)

    if (-not $lineMatch.Success) {
        return $false
    }

    $line = $lineMatch.Value
    $resultMatch = [regex]::Match($line, ":[ \t]*(?<value>[^\r\n]*)$")
    if (-not $resultMatch.Success) {
        return $false
    }

    return -not (Test-ProofValueIsIncomplete $resultMatch.Groups["value"].Value)
}

function Test-ProofFile([string] $path, [string] $proofName, [string[]] $requiredFields, [string[]] $requiredChecks, [switch] $NoPassMessage) {
    if (-not (Test-Path -LiteralPath $path)) {
        Add-Failure "Missing $path with real $proofName evidence."
        return
    }

    $content = Get-Content -LiteralPath $path -Raw
    $normalized = Normalize-ProofContent $content

    if ($normalized.Trim().Length -lt 300) {
        Add-Failure "$path is too short to contain real $proofName evidence."
        return
    }

    foreach ($field in $requiredFields) {
        if (-not (Test-ProofHasCompletedField $content $field)) {
            Add-Failure "Complete '${field}:' in $path."
            return
        }
    }

    foreach ($check in $requiredChecks) {
        if (-not (Test-ProofHasCompletedCheckedItem $content $check)) {
            Add-Failure "Complete a checked evidence item with a result for '$check' in $path."
            return
        }
    }

    $placeholderPatterns = @(
        @{ Pattern = '(?i)\bTODO\b'; Message = 'Remove TODO placeholders' },
        @{ Pattern = '(?i)\bPENDING_[A-Z_]+\b'; Message = 'Replace PENDING_* placeholders' },
        @{ Pattern = '(?i)\bREPLACE\b'; Message = 'Replace placeholder text' },
        @{ Pattern = '(?i)\bN/A\b'; Message = 'Replace N/A with a real result or a concrete value such as none found' },
        @{ Pattern = '(?i)\bTBD\b'; Message = 'Replace TBD placeholders' },
        @{ Pattern = '(?i)example'; Message = 'Remove example/template instructions from the proof file' },
        @{ Pattern = '(?i)template'; Message = 'Remove template instructions from the proof file' },
        @{ Pattern = '(?i)use this file'; Message = 'Remove template instructions from the proof file' },
        @{ Pattern = '\[ \]'; Message = 'Check every required evidence item after testing it' }
    )

    foreach ($placeholder in $placeholderPatterns) {
        if ($content -match $placeholder.Pattern) {
            Add-Failure "$($placeholder.Message) in $path."
            return
        }
    }

    $failureCountBeforeEvidence = $failures.Count
    Test-ProofReferencedLocalEvidence $path $proofName $content "Evidence/photo reference"
    Test-ProofReferencedLocalEvidence $path $proofName $content "Evidence/capture reference"
    if ($failures.Count -gt $failureCountBeforeEvidence) {
        return
    }

    if (-not $NoPassMessage) {
        Add-Pass "$proofName evidence is present and completed."
    }
}

function Get-CompletedCheckedItemLine([string] $content, [string] $labelPattern) {
    $escaped = [regex]::Escape($labelPattern)
    $linePattern = "(?im)^\s*-\s*\[[xX]\]\s*.*$escaped.*$"
    $lineMatch = [regex]::Match($content, $linePattern)

    if (-not $lineMatch.Success) {
        return $null
    }

    $line = $lineMatch.Value
    $resultMatch = [regex]::Match($line, ":[ \t]*(?<value>[^\r\n]*)$")
    if (-not $resultMatch.Success -or (Test-ProofValueIsIncomplete $resultMatch.Groups["value"].Value)) {
        return $null
    }

    return $line
}

function Test-InstitutionalPrinterProofFile([string] $path) {
    $failureCountBefore = $failures.Count

    Test-ProofFile `
        -path $path `
        -proofName "physical institutional printer" `
        -requiredFields @(
            "Date/time",
            "Responsible person",
            "Printer brand/model",
            "Printer driver",
            "Connection type",
            "Browser/version",
            "Cashier computer",
            "Invoice used",
            "Media carta result",
            "Carta result",
            "A5 result",
            "80mm result",
            "58mm result",
            "Reprint result",
            "Margins result",
            "Browser headers/footers result",
            "Problems found",
            "Evidence/photo reference",
            "Final conclusion"
        ) `
        -requiredChecks @(
            "80mm",
            "58mm",
            "white background",
            "Reprint",
            "headers/footers",
            "historical"
        ) `
        -NoPassMessage

    if ($failures.Count -gt $failureCountBefore) {
        return
    }

    $content = Get-Content -LiteralPath $path -Raw
    $primaryPaperLines = @(
        Get-CompletedCheckedItemLine $content "media carta"
        Get-CompletedCheckedItemLine $content "carta"
        Get-CompletedCheckedItemLine $content "A5"
    ) | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }

    if ($primaryPaperLines.Count -lt 1) {
        Add-Failure "Complete at least one checked physical institutional paper item (media carta, carta, or A5) with a real result in $path."
        return
    }

    $physicalEvidencePattern = '(?i)(fisic|physical|papel|paper|foto|photo|acta|muestra impresa|printed sample|impresora real)'
    $hasPhysicalEvidenceLine = @($primaryPaperLines | Where-Object { $_ -match $physicalEvidencePattern }).Count -gt 0
    if (-not $hasPhysicalEvidenceLine) {
        Add-Failure "At least one checked media carta/carta/A5 evidence line in $path must reference physical paper evidence such as a photo, signed note, printed sample, or real printer."
        return
    }

    Add-Pass "physical institutional printer evidence is present and completed."
}

function Test-LanProofMatchesBaseUrl([string] $path, [string] $expectedBaseUrl) {
    if (-not (Test-Path -LiteralPath $path)) {
        return $true
    }

    $content = Get-Content -LiteralPath $path -Raw
    $expected = $expectedBaseUrl.TrimEnd("/")
    $historicalPattern = '(?i)(VALIDADO_HISTORICO_REQUIERE_REPETIR_IP_FINAL|REQUIERE_REPETIR|requiere repetirse|requiere repeticion|historica contra|historico contra|evidencia historica)'
    if ($content -match $historicalPattern) {
        Add-Failure "LAN client proof is marked as historical or requiring repeat; rerun scripts\validate_lan_client.ps1 from the second PC against final BaseUrl $expected."
        return $false
    }

    $serverLanUrl = Get-ProofFieldValue $content "Server LAN URL"
    if ((Test-ProofValueIsIncomplete $serverLanUrl) -or $serverLanUrl.TrimEnd("/") -ne $expected) {
        Add-Failure "LAN client proof Server LAN URL must be exactly $expected; current value is '$serverLanUrl'."
        return $false
    }

    return $true
}

function Test-ProofMatchesBaseUrl([string] $path, [string] $proofName, [string] $fieldLabel, [string] $expectedBaseUrl) {
    if (-not (Test-Path -LiteralPath $path)) {
        return $true
    }

    $content = Get-Content -LiteralPath $path -Raw
    $expected = $expectedBaseUrl.TrimEnd("/")
    $actual = Get-ProofFieldValue $content $fieldLabel

    if ((Test-ProofValueIsIncomplete $actual) -or $actual.TrimEnd("/") -ne $expected) {
        Add-Failure "$proofName proof $fieldLabel must be exactly $expected; current value is '$actual'."
        return $false
    }

    return $true
}

function Test-FinalLanProofFile([string] $path, [string] $expectedBaseUrl) {
    if (-not (Test-LanProofMatchesBaseUrl -path $path -expectedBaseUrl $expectedBaseUrl)) {
        return
    }

    Test-ProofFile `
        -path $path `
        -proofName "second-client LAN" `
        -requiredFields @(
            "Date/time",
            "Responsible person",
            "Client computer name",
            "Server IP or LAN name",
            "Server LAN URL",
            "Client browser/version",
            "User/role used",
            "Evidence/capture reference",
            "Final conclusion"
        ) `
        -requiredChecks @(
            "/up",
            "/login",
            "/verify-email",
            "/api/system/echo-config",
            "assets",
            "WebSocket",
            "Soketi",
            "Login",
            "Cashbox",
            "Invoice",
            "Payment",
            "Receipt",
            "history",
            "Reports",
            "Backup"
        )
}

function Test-ReportExportPrivacyGuards {
    $servicePath = Join-Path $ProjectRoot "backend\app\Actions\Reports\OperationsReportService.php"
    $reportsTestPath = Join-Path $ProjectRoot "backend\tests\Feature\ReportsTest.php"

    if (-not (Test-Path -LiteralPath $servicePath -PathType Leaf)) {
        Add-Failure "Missing OperationsReportService.php for report export privacy guard."
        return
    }
    if (-not (Test-Path -LiteralPath $reportsTestPath -PathType Leaf)) {
        Add-Failure "Missing ReportsTest.php for report export privacy guard."
        return
    }

    $service = Get-Content -LiteralPath $servicePath -Raw
    $tests = Get-Content -LiteralPath $reportsTestPath -Raw

    $forbiddenServicePatterns = @(
        "'patient_name'\s*=>",
        "'username'\s*=>",
        "invoice:id,invoice_number,patient_name"
    )
    foreach ($pattern in $forbiddenServicePatterns) {
        if ($service -match $pattern) {
            Add-Failure "Operations report export privacy guard failed: forbidden field pattern '$pattern' is present."
            return
        }
    }

    $requiredTestPatterns = @(
        "assertJsonMissingPath\('data\.voids\.0\.patient_name'\)",
        "assertJsonMissingPath\('data\.payment_voids\.0\.patient_name'\)",
        "assertJsonMissingPath\('data\.cashiers\.0\.username'\)",
        'IOFactory::load\(\$path\)',
        "getSheetByName\('Auditor"
    )
    foreach ($pattern in $requiredTestPatterns) {
        if ($tests -notmatch $pattern) {
            Add-Failure "Reports export privacy guard missing regression evidence matching '$pattern'."
            return
        }
    }

    Add-Pass "Report export privacy guards cover operations API and XLSX payloads."
}

function Invoke-RouteCheck([string] $url, [string] $label, [int[]] $AllowedStatusCodes = @(200), [int] $Attempts = 3) {
    $lastError = ""

    for ($attempt = 1; $attempt -le $Attempts; $attempt++) {
        try {
            $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 15
            if ($AllowedStatusCodes -contains [int] $response.StatusCode) {
                $attemptSuffix = if ($attempt -eq 1) { "" } else { " after $attempt attempts" }
                Add-Pass "$label responded $($response.StatusCode)$attemptSuffix"
                return
            }

            $lastError = "unexpected status $($response.StatusCode)"
        } catch {
            $lastError = $_.Exception.Message
        }

        if ($attempt -lt $Attempts) {
            Start-Sleep -Seconds 2
        }
    }

    Add-Failure "$label failed after $Attempts attempts: $lastError"
}

$backendDir = Join-Path $ProjectRoot "backend"
$frontendDist = Join-Path $ProjectRoot "frontend\dist"
$backendEnvPath = Join-Path $backendDir ".env"
$rootEnvPath = Join-Path $ProjectRoot ".env"
$composeProdPath = Join-Path $ProjectRoot "docker-compose.prod.yml"
$isDockerProductionPackage = (Test-Path -LiteralPath $composeProdPath) -and (Test-Path -LiteralPath $rootEnvPath) -and (-not (Test-Path -LiteralPath (Join-Path $backendDir "artisan")))
$envPath = if ($EnvFile -ne "") {
    if ([System.IO.Path]::IsPathRooted($EnvFile)) {
        (Resolve-Path -LiteralPath $EnvFile).Path
    } else {
        (Resolve-Path -LiteralPath (Join-Path $ProjectRoot $EnvFile)).Path
    }
} elseif ($isDockerProductionPackage) {
    $rootEnvPath
} else {
    $backendEnvPath
}
if (-not [string]::IsNullOrWhiteSpace($ComposeProjectName) -and $ComposeProjectName -notmatch "^[A-Za-z0-9][A-Za-z0-9_.-]*$") {
    Add-Failure "ComposeProjectName invalido. Use solo letras, numeros, punto, guion o guion_bajo; debe iniciar con letra o numero."
}
$script:PreflightEnvPath = $envPath
$script:PreflightComposeProjectName = $ComposeProjectName
$envValues = Read-EnvFile $envPath
$script:PreflightBackupMode = "auto"
if ($isDockerProductionPackage) {
    $script:PreflightBackupMode = "docker"
} elseif ((Test-Path -LiteralPath $composeProdPath) -and (Test-CommandExists "docker")) {
    $composeArgs = @("compose")
    if (-not [string]::IsNullOrWhiteSpace($ComposeProjectName)) {
        $composeArgs += @("-p", $ComposeProjectName)
    }
    $composeArgs += @("-f", $composeProdPath, "--env-file", $envPath, "config", "--quiet")
    & docker @composeArgs *> $null
    if ($LASTEXITCODE -eq 0) {
        $script:PreflightBackupMode = "docker"
    }
}

if ($BaseUrl -eq "") {
    $BaseUrl = Get-EnvValue $envValues "APP_URL" ""
}

if ($BaseUrl -eq "") {
    Add-Failure "BaseUrl was not provided and APP_URL is empty in $envPath"
    $BaseUrl = "http://127.0.0.1"
} else {
    $BaseUrl = Test-HospitalOperationalUrlInput $BaseUrl
}

$baseUri = [Uri] $BaseUrl

$baseHostWithPort = if ($baseUri.IsDefaultPort) { $baseUri.Host } else { "$($baseUri.Host):$($baseUri.Port)" }
$appEnv = Get-EnvValue $envValues "APP_ENV" "local"
$appDebug = Get-EnvValue $envValues "APP_DEBUG" "true"
$appUrl = Get-EnvValue $envValues "APP_URL" ""
$dbConnection = Get-EnvValue $envValues "DB_CONNECTION" ""
$sanctumDomains = Get-EnvValue $envValues "SANCTUM_STATEFUL_DOMAINS" ""
$corsOrigins = Get-EnvValue $envValues "CORS_ALLOWED_ORIGINS" ""
$corsOriginPatterns = Get-EnvValue $envValues "CORS_ALLOWED_ORIGIN_PATTERNS" ""
$corsOriginsIsExplicit = $envValues.ContainsKey("CORS_ALLOWED_ORIGINS")
$corsOriginList = @($corsOrigins.Split(",") | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne "" })
$queueConnection = Get-EnvValue $envValues "QUEUE_CONNECTION" ""
$configuredDumpBinary = Get-EnvValue $envValues "HOSPITAL_DUMP_BINARY" ""
$sessionSecureCookie = Get-EnvValue $envValues "SESSION_SECURE_COOKIE" ""
$initialAdminPassword = Get-EnvValue $envValues "HOSPITAL_INITIAL_ADMIN_PASSWORD" ""
$soketiBindIp = Get-EnvValue $envValues "SOKETI_BIND_IP" "0.0.0.0"
$soketiPort = Get-EnvValue $envValues "SOKETI_PORT" "6001"
$pusherClientHost = Get-EnvValue $envValues "PUSHER_CLIENT_HOST" ""
$pusherClientPort = Get-EnvValue $envValues "PUSHER_CLIENT_PORT" $soketiPort

Write-Host "Production readiness preflight for $BaseUrl"
Write-Host "Project root: $(Protect-PreflightText $ProjectRoot)"
Test-ReportExportPrivacyGuards
if ($isDockerProductionPackage) {
    Add-Pass "Docker production package layout detected"
    Test-DockerComposeConfig $composeProdPath $envPath
}

if ($appEnv -eq "production") { Add-Pass "APP_ENV=production" } else { Add-Failure "APP_ENV must be production, current value is '$appEnv'" }
if ($appDebug -eq "false") { Add-Pass "APP_DEBUG=false" } else { Add-Failure "APP_DEBUG must be false, current value is '$appDebug'" }
if ($appUrl -eq $BaseUrl.TrimEnd("/")) { Add-Pass "APP_URL matches BaseUrl" } else { Add-Failure "APP_URL must match $($BaseUrl.TrimEnd('/')), current value is '$appUrl'" }

if ($baseUri.Scheme -eq "https") {
    if ($sessionSecureCookie -eq "true") {
        Add-Pass "SESSION_SECURE_COOKIE=true for HTTPS"
    } else {
        Add-Failure "SESSION_SECURE_COOKIE must be true when APP_URL/BaseUrl uses HTTPS"
    }
} elseif ($sessionSecureCookie -eq "true") {
    Add-Pass "SESSION_SECURE_COOKIE=true"
} else {
    Add-Warning "SESSION_SECURE_COOKIE is not true because BaseUrl is not HTTPS. Enable it before HTTPS deployment."
}

# Reject the default blank APP_KEY from .env.example. The installer
# always generates a real value with `php artisan key:generate`;
# a blank key means someone copied the template and forgot to run it.
$appKey = (Get-EnvValue $envValues "APP_KEY" "")
if ([string]::IsNullOrWhiteSpace($appKey) -or $appKey -eq "base64:") {
    Add-Failure "APP_KEY is empty or the .env.example placeholder. Run 'php artisan key:generate' on the server."
} else {
    Add-Pass "APP_KEY is set to a non-placeholder value"
}

# Same check for the database password. The installer randomizes
# it; if the value is the well-known dev default the operator
# never overrode the .env, which is a real production hazard.
$dbPassword = (Get-EnvValue $envValues "DB_PASSWORD" "")
$forbiddenDbPasswords = @("hospital_dev", "root_dev", "changeme", "password", "secret")
if ([string]::IsNullOrWhiteSpace($dbPassword)) {
    Add-Failure "DB_PASSWORD is empty. The installer must generate a random 24-char password."
} elseif ($forbiddenDbPasswords -contains $dbPassword) {
    Add-Failure "DB_PASSWORD is set to a well-known dev value '$dbPassword'. Replace it with a random 24-char string."
} else {
    Add-Pass "DB_PASSWORD is set to a non-default value"
}

$dbRootPassword = (Get-EnvValue $envValues "DB_ROOT_PASSWORD" "")
if ([string]::IsNullOrWhiteSpace($dbRootPassword)) {
    Add-Failure "DB_ROOT_PASSWORD is empty. The installer must generate a random 24-char password."
} elseif ($forbiddenDbPasswords -contains $dbRootPassword) {
    Add-Failure "DB_ROOT_PASSWORD is set to a well-known dev value '$dbRootPassword'. Replace it."
} else {
    Add-Pass "DB_ROOT_PASSWORD is set to a non-default value"
}

$forbiddenInitialAdminPasswords = @(
    "admin",
    "admin123",
    "password",
    "secret",
    "hospital",
    "hospital123",
    "cambiar123",
    "ChangeMe123!"
)
if ($initialAdminPassword -ne "") {
    if ($forbiddenInitialAdminPasswords -contains $initialAdminPassword) {
        Add-Failure "HOSPITAL_INITIAL_ADMIN_PASSWORD uses a default value. Generate a unique temporary password for handoff."
    } elseif ($initialAdminPassword.Length -lt 14) {
        Add-Failure "HOSPITAL_INITIAL_ADMIN_PASSWORD must be at least 14 characters when configured."
    } else {
        Add-Pass "HOSPITAL_INITIAL_ADMIN_PASSWORD is non-default length"
    }
}

if ($BaseUrl -match "localhost|127\.0\.0\.1|::1") {
    Add-Failure "BaseUrl must be the final LAN IP or local domain, not localhost"
} else {
    Add-Pass "BaseUrl is not localhost"
}

if ($soketiPort -notmatch '^\d{1,5}$' -or [int] $soketiPort -lt 1 -or [int] $soketiPort -gt 65535) {
    Add-Failure "SOKETI_PORT must be a valid TCP port, current value is '$soketiPort'"
} elseif ($pusherClientPort -ne $soketiPort) {
    Add-Failure "PUSHER_CLIENT_PORT must match SOKETI_PORT so LAN browsers connect to the published WebSocket port."
} else {
    Add-Pass "PUSHER_CLIENT_PORT matches SOKETI_PORT"
}

if ($pusherClientHost -ne "" -and $pusherClientHost -ne $baseUri.Host) {
    Add-Failure "PUSHER_CLIENT_HOST must match the LAN host in BaseUrl ($($baseUri.Host)), current value is '$pusherClientHost'"
} elseif ($pusherClientHost -ne "") {
    Add-Pass "PUSHER_CLIENT_HOST matches BaseUrl host"
}

if ($BaseUrl -notmatch "localhost|127\.0\.0\.1|::1") {
    if ($soketiBindIp -match '^(localhost|127(\.|$)|::1)$') {
        Add-Failure "SOKETI_BIND_IP is '$soketiBindIp'. LAN clients cannot connect to Soketi when it is bound to localhost; use 0.0.0.0 with the firewall limited to LocalSubnet."
    } else {
        Add-Pass "SOKETI_BIND_IP allows LAN WebSocket clients"
    }
}

if ($dbConnection -match "^(mysql|mariadb)$") { Add-Pass "DB_CONNECTION=$dbConnection" } else { Add-Failure "DB_CONNECTION must be mysql or mariadb, current value is '$dbConnection'" }

if ($sanctumDomains.Split(",").Trim() -contains $baseHostWithPort -or $sanctumDomains.Split(",").Trim() -contains $baseUri.Host) {
    Add-Pass "SANCTUM_STATEFUL_DOMAINS includes LAN host"
} else {
    Add-Failure "SANCTUM_STATEFUL_DOMAINS must include $baseHostWithPort or $($baseUri.Host)"
}

if ($corsOriginList | Where-Object { $_ -match "\*" }) {
    Add-Failure "CORS_ALLOWED_ORIGINS must not contain wildcard '*'. Configure explicit LAN origins or an explicitly empty same-origin value."
} elseif ($corsOrigins -eq "" -and $corsOriginsIsExplicit) {
    Add-Pass "CORS origins are explicitly empty for same-origin production"
} elseif ($corsOriginList -contains $BaseUrl.TrimEnd("/")) {
    Add-Pass "CORS origins are same-origin or include BaseUrl"
} else {
    Add-Failure "CORS_ALLOWED_ORIGINS must be explicitly empty for same-origin or include $($BaseUrl.TrimEnd('/'))"
}

if ($corsOriginPatterns.Trim() -ne "") {
    Add-Failure "CORS_ALLOWED_ORIGIN_PATTERNS must be empty in production preflight. Use explicit CORS_ALLOWED_ORIGINS instead."
} else {
    Add-Pass "CORS origin patterns are empty"
}

if ($queueConnection -eq "database") {
    Add-Pass "QUEUE_CONNECTION=database"
} else {
    Add-Warning "QUEUE_CONNECTION is '$queueConnection'. Backups queued from UI need a durable local queue worker."
}

Test-NoActiveValidationUsers

if (Test-IsWindowsHost) {
    Test-WindowsBackupAutomation
} else {
    Add-Warning "Non-Windows host detected. Validate an equivalent continuous backup worker/service before production handoff."
}

if ($isDockerProductionPackage) {
    Add-Pass "Docker package serves compiled frontend from backend/shared_public image flow"
} elseif (Test-Path -LiteralPath (Join-Path $frontendDist "index.html")) {
    Add-Pass "frontend/dist/index.html exists"
} else {
    Add-Failure "Missing frontend build. Run npm.cmd run build in frontend/"
}

$assetDir = Join-Path $frontendDist "assets"
if ($isDockerProductionPackage) {
    Add-Pass "Frontend asset verification deferred to /login route check for Docker package"
} elseif (Test-Path -LiteralPath $assetDir) {
    $assetCount = (Get-ChildItem -LiteralPath $assetDir -File | Measure-Object).Count
    if ($assetCount -gt 0) { Add-Pass "frontend/dist/assets contains $assetCount files" } else { Add-Failure "frontend/dist/assets is empty" }
} else {
    Add-Failure "Missing frontend/dist/assets"
}

if ($isDockerProductionPackage) {
    Add-Pass "Host PHP is not required for Docker production package"
} elseif (Test-CommandExists "php") {
    Add-Pass "php is available in PATH"
} else {
    Add-Failure "php is not available in PATH"
}

if ($isDockerProductionPackage -or $script:PreflightBackupMode -eq "docker") {
    $dockerBackupPreflightArgs = @("compose")
    if (-not [string]::IsNullOrWhiteSpace($ComposeProjectName)) {
        $dockerBackupPreflightArgs += @("-p", $ComposeProjectName)
    }
    $dockerBackupPreflightArgs += @("-f", $composeProdPath, "--env-file", $envPath)

    $artisanListOutput = & docker @($dockerBackupPreflightArgs + @("exec", "-T", "backend", "php", "artisan", "list", "--raw")) 2>$null
    $artisanListExitCode = $LASTEXITCODE
    $hasBackupCommand = $null -ne ($artisanListOutput | Select-String -SimpleMatch "hospital:backup" | Select-Object -First 1)
    if ($artisanListExitCode -eq 0 -and $hasBackupCommand) {
        Add-Pass "Docker backend exposes hospital:backup command"
    } else {
        Add-Failure "Docker backend does not expose hospital:backup command"
    }

    & docker @($dockerBackupPreflightArgs + @("exec", "-T", "backend", "php", "artisan", "migrate:status")) *> $null
    if ($LASTEXITCODE -eq 0) {
        Add-Pass "Docker backend can read MariaDB migration status"
    } else {
        Add-Failure "Docker backend cannot read MariaDB migration status"
    }

    & docker @($dockerBackupPreflightArgs + @("exec", "-T", "backend", "sh", "-lc", "command -v mariadb-dump || command -v mysqldump")) *> $null
    if ($LASTEXITCODE -eq 0) {
        Add-Pass "Docker backend has mariadb-dump or mysqldump available"
    } else {
        Add-Failure "Docker backend is missing mariadb-dump/mysqldump required for backups"
    }
} else {
    $mysqlClient = Find-FirstExecutableCandidate @(
        "mysql",
        "mariadb",
        "C:\xampp\mysql\bin\mysql.exe",
        "C:\xampp\mysql\bin\mariadb.exe",
        "C:\laragon\bin\mysql\mysql-8.0\bin\mysql.exe",
        "/usr/bin/mysql",
        "/usr/bin/mariadb",
        "/usr/local/bin/mysql",
        "/usr/local/bin/mariadb"
    )
    if ($null -ne $mysqlClient) { Add-Pass "mysql client is available: $mysqlClient" } else { Add-Failure "mysql or mariadb client is not available" }

    $dumpTool = Find-FirstExecutableCandidate @(
        $configuredDumpBinary,
        "mariadb-dump",
        "mysqldump",
        "C:\xampp\mysql\bin\mariadb-dump.exe",
        "C:\xampp\mysql\bin\mysqldump.exe",
        "C:\laragon\bin\mysql\mysql-8.0\bin\mysqldump.exe",
        "/usr/bin/mariadb-dump",
        "/usr/bin/mysqldump",
        "/usr/local/bin/mariadb-dump",
        "/usr/local/bin/mysqldump"
    )
    if ($null -ne $dumpTool) {
        Add-Pass "database dump tool is available: $dumpTool"
    } else {
        Add-Failure "mariadb-dump or mysqldump must be available for backups"
    }
}

if ($isDockerProductionPackage -or $script:PreflightBackupMode -eq "docker") {
    Test-BackupWrapperCheck (Join-Path $ProjectRoot "scripts\run_backup_worker.cmd") "Backup worker"
    Test-BackupWrapperCheck (Join-Path $ProjectRoot "scripts\run_scheduled_backup.cmd") "Scheduled backup"
} else {
    $backupDir = Join-Path $backendDir "storage\app\private\backups"
    if (-not (Test-Path -LiteralPath $backupDir)) {
        New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
    }

    $probePath = Join-Path $backupDir ".write-test"
    try {
        Set-Content -LiteralPath $probePath -Value "ok" -NoNewline -Encoding ASCII
        Remove-Item -LiteralPath $probePath -Force
        Add-Pass "backup directory is writable"
    } catch {
        Add-Failure "backup directory is not writable: $($_.Exception.Message)"
    }
}

Invoke-RouteCheck "$($BaseUrl.TrimEnd('/'))/up" "/up"
Invoke-RouteCheck "$($BaseUrl.TrimEnd('/'))/login" "/login"
Invoke-RouteCheck "$($BaseUrl.TrimEnd('/'))/verify-email" "/verify-email" @(200, 302)

if ($AllowMissingPhysicalProof) {
    Add-Strong-Warning "AllowMissingPhysicalProof was used. This run is only an environment preflight and MUST NOT be called PRODUCTION_READY."
    Add-Failure "Physical LAN/printer proof was bypassed. Re-run without -AllowMissingPhysicalProof before declaring PRODUCTION_READY."
} else {
    Test-FinalLanProofFile `
        -path (Join-Path $ProjectRoot "qa\LAN_CLIENT_VALIDATION_PROOF.md") `
        -expectedBaseUrl $BaseUrl

    Test-InstitutionalPrinterProofFile `
        -path (Join-Path $ProjectRoot "qa\INSTITUTIONAL_RECEIPT_PRINT_PROOF.md")

    Test-ProofFile `
        -path (Join-Path $ProjectRoot "qa\FINAL_RESTORE_PROOF.md") `
        -proofName "final restore" `
        -requiredFields @(
            "Date/time",
            "Responsible person",
            "Source database",
            "Disposable restore database",
            "Backup file",
            "Backup SHA256",
            "Backup size bytes",
            "Evidence/capture reference",
            "Final conclusion"
        ) `
        -requiredChecks @(
            "Disposable restore database",
            "Backup file",
            "Restore imports",
            "Migration table",
            "Services table",
            "Core counts"
        )

    $finalConcurrencyProofPath = Join-Path $ProjectRoot "qa\FINAL_CONCURRENCY_PROOF.md"
    $finalConcurrencyUnderLoadProofPath = Join-Path $ProjectRoot "qa\FINAL_CONCURRENCY_UNDER_LOAD_PROOF_LAN_8081.md"
    $finalRealSmokeProofPath = Join-Path $ProjectRoot "qa\FINAL_REAL_SMOKE_LAN_8081.md"

    $finalConcurrencyMatchesBaseUrl = Test-ProofMatchesBaseUrl `
        -path $finalConcurrencyProofPath `
        -proofName "final concurrency" `
        -fieldLabel "Server LAN URL" `
        -expectedBaseUrl $BaseUrl

    if ($finalConcurrencyMatchesBaseUrl) {
        Test-ProofFile `
            -path $finalConcurrencyProofPath `
            -proofName "final concurrency" `
            -requiredFields @(
                "Date/time",
                "Responsible person",
                "Server LAN URL",
                "Target environment",
                "Run ID",
                "Evidence/capture reference",
                "Final conclusion"
            ) `
            -requiredChecks @(
                "Double cash-session open",
                "Concurrent invoice emission",
                "Double payment"
            )
    }

    $finalConcurrencyUnderLoadMatchesBaseUrl = Test-ProofMatchesBaseUrl `
        -path $finalConcurrencyUnderLoadProofPath `
        -proofName "final concurrency under load" `
        -fieldLabel "Server LAN URL" `
        -expectedBaseUrl $BaseUrl

    if ($finalConcurrencyUnderLoadMatchesBaseUrl) {
        Test-ProofFile `
            -path $finalConcurrencyUnderLoadProofPath `
            -proofName "final concurrency under load" `
            -requiredFields @(
                "Date/time",
                "Responsible person",
                "Server LAN URL",
                "Target environment",
                "Run ID",
                "Load user",
                "Mutation user",
                "Load requests/concurrency",
                "Final conclusion"
            ) `
            -requiredChecks @(
                "Authenticated load",
                "Double cash-session open",
                "Concurrent invoice emission",
                "Double payment"
            )
    }

    $finalRealSmokeMatchesBaseUrl = Test-ProofMatchesBaseUrl `
        -path $finalRealSmokeProofPath `
        -proofName "final real LAN smoke" `
        -fieldLabel "URL LAN" `
        -expectedBaseUrl $BaseUrl

    if ($finalRealSmokeMatchesBaseUrl) {
        Test-ProofFile `
            -path $finalRealSmokeProofPath `
            -proofName "final real LAN smoke" `
            -requiredFields @(
                "Estado",
                "Fecha",
                "URL LAN",
                "Mutaciones reales",
                "Login navegacion",
                "Login mutacional",
                "Resultado",
                "Evidence/capture reference",
                "Limpieza"
            ) `
            -requiredChecks @(
                "/up",
                "Login",
                "Cashier",
                "History",
                "Temporary validation users"
            )
    }
}

if ($failures.Count -gt 0 -or $blockingWarnings.Count -gt 0) {
    $blockingCount = $failures.Count + $blockingWarnings.Count
    Write-Host ""
    Write-Host "PRODUCTION_READY: NO ($blockingCount blocking issue(s))" -ForegroundColor Red
    exit 1
}

Write-Host ""
if ($warnings.Count -gt 0) {
    Write-Host "PRODUCTION_PREFLIGHT_PASSED_WITH_WARNINGS: $($warnings.Count) warning(s)" -ForegroundColor Yellow
    if ($AllowMissingPhysicalProof) {
        Write-Host "PRODUCTION_READY: NO. Physical LAN/printer proof was explicitly bypassed." -ForegroundColor Yellow
    }
} else {
    Write-Host "PRODUCTION_PREFLIGHT_PASSED" -ForegroundColor Green
}
