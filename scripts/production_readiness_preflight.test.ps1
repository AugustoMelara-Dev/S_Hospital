$ErrorActionPreference = "Stop"

$scriptPath = Join-Path $PSScriptRoot "production_readiness_preflight.ps1"
$content = Get-Content -LiteralPath $scriptPath -Raw
$lanClientPath = Join-Path $PSScriptRoot "validate_lan_client.ps1"
$lanClientContent = Get-Content -LiteralPath $lanClientPath -Raw
$operationalUrlSafetyPath = Join-Path $PSScriptRoot "lib\operational_url_safety.ps1"

if (-not (Test-Path -LiteralPath $operationalUrlSafetyPath -PathType Leaf)) {
    throw "Expected shared operational URL safety library: $operationalUrlSafetyPath"
}

function Assert-Contains([string] $needle) {
    if (-not $content.Contains($needle)) {
        throw "Expected production preflight to contain: $needle"
    }
}

function Assert-NotContains([string] $needle) {
    if ($content.Contains($needle)) {
        throw "Expected production preflight not to contain: $needle"
    }
}

function Assert-LanClientContains([string] $needle) {
    if (-not $lanClientContent.Contains($needle)) {
        throw "Expected LAN client validator to contain: $needle"
    }
}

function Assert-LanClientNotContains([string] $needle) {
    if ($lanClientContent.Contains($needle)) {
        throw "Expected LAN client validator not to contain: $needle"
    }
}

Assert-Contains "qa\LOCAL_SERVER_VALIDATION_PROOF.md"
Assert-Contains "local server browser"
Assert-Contains "BaseUrl uses loopback; validating single-machine local mode"
Assert-NotContains "BaseUrl must be the final LAN IP or local domain, not localhost"
Assert-Contains "qa\INSTITUTIONAL_RECEIPT_PRINT_PROOF.md"
Assert-Contains "primary institutional receipt printer"
Assert-Contains "Media carta result"
Assert-Contains "Carta result"
Assert-Contains "A5 result"
Assert-Contains "Media carta"
Assert-Contains "Carta"
Assert-Contains "A5"
Assert-NotContains "qa\THERMAL_PRINTER_PROOF.md"
Assert-NotContains "80mm result"
Assert-NotContains "58mm result"
Assert-Contains '[string] $EnvFile = ""'
Assert-Contains '[ValidateSet("Auto", "Docker", "WindowsTasks")]'
Assert-Contains '[string] $DockerProject = ""'
Assert-Contains 'Test-DockerRuntimeServices'
Assert-Contains 'Read-DockerRuntimeEnv'
Assert-Contains 'Join-Path $ProjectRoot ".env"'
Assert-Contains '@("mysql", "backend", "nginx", "queue-worker", "realtime-worker", "scheduler")'
Assert-Contains 'Docker runtime service ''$requiredService'' is running'
Assert-Contains 'function Test-ServedFrontendBuild'
Assert-Contains 'Test-ServedFrontendBuild $BaseUrl'
Assert-Contains 'PUSHER_CLIENT_PORT'
Assert-Contains 'Invoke-WebSocketHandshake $pusherClientHost $pusherClientPort $pusherClientScheme $pusherAppKey'
Assert-Contains 'CloseOutputAsync'
Assert-NotContains '.CloseAsync('
Assert-LanClientContains 'CloseOutputAsync'
Assert-LanClientNotContains '.CloseAsync('
Assert-LanClientContains 'SOKETI_PORT'
Assert-LanClientContains 'New-WebSocketCheckResult $pusherClientHost $pusherClientPort $pusherClientScheme $pusherAppKey'
Assert-Contains 'DefinitionsOnly'
Assert-Contains 'function Test-DockerDatabaseTooling'
Assert-Contains 'function Test-HostDatabaseTooling'
Assert-Contains 'Test-HostDatabaseTooling -ConfiguredDumpBinary $configuredDumpBinary'
Assert-Contains '-ComposeFile (Join-Path $ProjectRoot "docker-compose.prod.yml")'
Assert-Contains 'exec", "-T"'
Assert-Contains 'function Test-BackupWindowsTaskAutomation'
Assert-Contains 'Test-BackupWindowsTaskAutomation'
Assert-Contains 'Test-BackupScheduledTask "HospitalBillingOS-Scheduler" @("Ready", "Running") -RequireMinuteRepetition'
Assert-Contains 'Test-BackupScheduledTask "HospitalBillingOS-BackupWorker" @("Running")'
Assert-NotContains 'Test-BackupScheduledTask "HospitalBillingOS-BackupWorker" @("Ready", "Running")'
Assert-Contains "Legacy scheduled task 'HospitalBillingOS-DailyBackup' is still installed"
Assert-NotContains 'Test-BackupScheduledTask "HospitalBillingOS-DailyBackup"'

# --- Prueba funcional con runner inyectado: Docker-only sin binarios host ---
. $scriptPath -BaseUrl "http://127.0.0.1:8000" -DefinitionsOnly

$script:FunctionalChecks = 0

function Assert-PreflightFunctional {
    param([bool] $Condition, [string] $Message)
    $script:FunctionalChecks++
    if (-not $Condition) {
        throw $Message
    }
}

foreach ($requiredFunction in @('Invoke-PreflightCommand', 'Test-DockerContainerTool', 'Test-DockerDatabaseTooling', 'Test-HostDatabaseTooling')) {
    Assert-PreflightFunctional ($null -ne (Get-Command $requiredFunction -ErrorAction SilentlyContinue)) "DefinitionsOnly must expose $requiredFunction."
}

$script:RunnerCalls = New-Object System.Collections.ArrayList
$successRunner = {
    param([string] $FilePath, [string[]] $Arguments)
    [void] $script:RunnerCalls.Add([pscustomobject]@{ FilePath = $FilePath; Arguments = @($Arguments) })
    return [pscustomobject]@{ ExitCode = 0; Output = @("fake-version") }
}

$failures.Clear()
$warnings.Clear()
Test-DockerDatabaseTooling -ComposeFile "C:\hospital\docker-compose.prod.yml" -EnvFile "C:\hospital\.env" -Runner $successRunner
Assert-PreflightFunctional ($failures.Count -eq 0) "Docker tooling must not add failures when container checks pass. Failures: $($failures -join ' | ')"
Assert-PreflightFunctional (@($script:RunnerCalls | Where-Object { $_.FilePath -ne 'docker' }).Count -eq 0) 'Docker tooling must never fall back to host binaries.'
Assert-PreflightFunctional (@($script:RunnerCalls | Where-Object { ($_.Arguments -join ' ') -match 'exec -T backend php --version' }).Count -ge 1) 'Docker tooling must check php inside the backend container.'
Assert-PreflightFunctional (@($script:RunnerCalls | Where-Object { ($_.Arguments -join ' ') -match 'exec -T mysql (mariadb|mysql) --version' }).Count -ge 1) 'Docker tooling must check the mysql client inside the mysql container.'
Assert-PreflightFunctional (@($script:RunnerCalls | Where-Object { ($_.Arguments -join ' ') -match 'exec -T mysql (mariadb-dump|mysqldump) --version' }).Count -ge 1) 'Docker tooling must check the dump tool inside the mysql container.'
Assert-PreflightFunctional (@($script:RunnerCalls | Where-Object { ($_.Arguments -join ' ') -match 'exec -T backend (mariadb-dump|mysqldump) --version' }).Count -ge 1) 'Docker tooling must check the dump tool used by scheduled backups inside the backend container.'

$failures.Clear()
$missingPhpRunner = {
    param([string] $FilePath, [string[]] $Arguments)
    if (($Arguments -join ' ') -match 'exec -T backend php') {
        return [pscustomobject]@{ ExitCode = 127; Output = @('php: not found') }
    }
    return [pscustomobject]@{ ExitCode = 0; Output = @('fake-version') }
}
Test-DockerDatabaseTooling -ComposeFile "C:\hospital\docker-compose.prod.yml" -EnvFile "C:\hospital\.env" -Runner $missingPhpRunner
Assert-PreflightFunctional (@($failures | Where-Object { $_ -match "php is not available inside the Docker 'backend' container" }).Count -eq 1) 'Missing container php must fail closed with an actionable message.'
Assert-PreflightFunctional (@($failures | Where-Object { $_ -match 'mysql or mariadb client' }).Count -eq 0) 'Successful fallback probes must not add failures.'

$failures.Clear()
$allMissingRunner = {
    param([string] $FilePath, [string[]] $Arguments)
    return [pscustomobject]@{ ExitCode = 127; Output = @('not found') }
}
Test-DockerDatabaseTooling -ComposeFile "C:\hospital\docker-compose.prod.yml" -EnvFile "C:\hospital\.env" -Runner $allMissingRunner
Assert-PreflightFunctional ($failures.Count -eq 4) "All missing container tools must produce 4 failures, got $($failures.Count)."

# --- Prueba funcional: gate bare-metal de tareas Windows (mock CIM, sin tocar el Programador real) ---
$script:FakeWindowsTasks = @{}
function Get-ScheduledTask {
    [CmdletBinding()]
    param([string] $TaskName)
    if ($script:FakeWindowsTasks.ContainsKey($TaskName)) {
        return $script:FakeWindowsTasks[$TaskName]
    }
    return $null
}
function Get-ScheduledTaskInfo {
    [CmdletBinding()]
    param([string] $TaskName)
    return [pscustomobject]@{
        LastRunTime = (Get-Date).AddMinutes(-1)
        LastTaskResult = 0
        NextRunTime = (Get-Date).AddMinutes(1)
    }
}

$fakeWorkerTask = [pscustomobject]@{
    State = 'Running'
    Triggers = @()
    Settings = [pscustomobject]@{ Enabled = $true; MultipleInstances = 'IgnoreNew' }
}
$fakeSchedulerTask = [pscustomobject]@{
    State = 'Ready'
    Triggers = @([pscustomobject]@{ Repetition = [pscustomobject]@{ Interval = 'PT1M' } })
    Settings = [pscustomobject]@{ Enabled = $true; MultipleInstances = 'IgnoreNew' }
}
$fakeLegacyTask = [pscustomobject]@{
    State = 'Ready'
    Triggers = @([pscustomobject]@{ Repetition = $null })
    Settings = [pscustomobject]@{ Enabled = $true; MultipleInstances = 'IgnoreNew' }
}

$script:FakeWindowsTasks = @{
    'HospitalBillingOS-BackupWorker' = $fakeWorkerTask
    'HospitalBillingOS-Scheduler' = $fakeSchedulerTask
}
$failures.Clear()
$warnings.Clear()
Test-BackupWindowsTaskAutomation
Assert-PreflightFunctional ($failures.Count -eq 0) "Scheduler valid + Worker Running must pass the bare-metal gate. Failures: $($failures -join ' | ')"
Assert-PreflightFunctional ($warnings.Count -eq 0) "Scheduler+Worker without legacy must not warn. Warnings: $($warnings -join ' | ')"

# H1 (RV-T3-016): a valid Scheduler with a Worker in State 'Ready' must fail the
# release gate. 'Ready' means the always-on consumer of the UI backup queue is
# not executing; only 'Running' certifies it.
$fakeWorkerReadyTask = [pscustomobject]@{
    State = 'Ready'
    Triggers = @()
    Settings = [pscustomobject]@{ Enabled = $true; MultipleInstances = 'IgnoreNew' }
}
$script:FakeWindowsTasks = @{
    'HospitalBillingOS-BackupWorker' = $fakeWorkerReadyTask
    'HospitalBillingOS-Scheduler' = $fakeSchedulerTask
}
$failures.Clear()
$warnings.Clear()
Test-BackupWindowsTaskAutomation
Assert-PreflightFunctional ($failures.Count -eq 1) "Scheduler valid + Worker Ready must fail the release gate exactly once. Failures: $($failures -join ' | ')"
Assert-PreflightFunctional ((@($failures)[0] -match 'HospitalBillingOS-BackupWorker') -and (@($failures)[0] -match "current state is 'Ready'")) "Worker Ready failure must name the task and show the real state. Failures: $($failures -join ' | ')"
Assert-PreflightFunctional ($warnings.Count -eq 0) "Scheduler valid + Worker Ready must not add warnings. Warnings: $($warnings -join ' | ')"

$script:FakeWindowsTasks = @{ 'HospitalBillingOS-BackupWorker' = $fakeWorkerTask }
$failures.Clear()
$warnings.Clear()
Test-BackupWindowsTaskAutomation
Assert-PreflightFunctional ($failures.Count -eq 1) "Worker alone must fail the release gate exactly once. Failures: $($failures -join ' | ')"
Assert-PreflightFunctional (@($failures)[0] -match 'HospitalBillingOS-Scheduler') "Worker alone must name the missing Scheduler task. Failures: $($failures -join ' | ')"

$script:FakeWindowsTasks = @{}
$failures.Clear()
$warnings.Clear()
Test-BackupWindowsTaskAutomation
Assert-PreflightFunctional ($failures.Count -eq 2) "No tasks must fail closed with Worker and Scheduler failures. Failures: $($failures -join ' | ')"
Assert-PreflightFunctional ((@($failures -join ' ') -match 'HospitalBillingOS-BackupWorker') -and (@($failures -join ' ') -match 'HospitalBillingOS-Scheduler')) "No tasks must report both missing tasks."

$fakeSlowScheduler = [pscustomobject]@{
    State = 'Ready'
    Triggers = @([pscustomobject]@{ Repetition = [pscustomobject]@{ Interval = 'PT5M' } })
    Settings = [pscustomobject]@{ Enabled = $true; MultipleInstances = 'IgnoreNew' }
}
$script:FakeWindowsTasks = @{ 'HospitalBillingOS-BackupWorker' = $fakeWorkerTask; 'HospitalBillingOS-Scheduler' = $fakeSlowScheduler }
$failures.Clear()
$warnings.Clear()
Test-BackupWindowsTaskAutomation
Assert-PreflightFunctional ($failures.Count -eq 1 -and (@($failures)[0] -match 'repeat every 1 minute')) "Scheduler must be rejected when it does not repeat every minute. Failures: $($failures -join ' | ')"

$fakeOverlapScheduler = [pscustomobject]@{
    State = 'Ready'
    Triggers = @([pscustomobject]@{ Repetition = [pscustomobject]@{ Interval = 'PT1M' } })
    Settings = [pscustomobject]@{ Enabled = $true; MultipleInstances = 'Parallel' }
}
$script:FakeWindowsTasks = @{ 'HospitalBillingOS-BackupWorker' = $fakeWorkerTask; 'HospitalBillingOS-Scheduler' = $fakeOverlapScheduler }
$failures.Clear()
$warnings.Clear()
Test-BackupWindowsTaskAutomation
Assert-PreflightFunctional ($failures.Count -eq 1 -and (@($failures)[0] -match 'IgnoreNew')) "Scheduler must be rejected without MultipleInstances IgnoreNew. Failures: $($failures -join ' | ')"

$script:FakeWindowsTasks = @{
    'HospitalBillingOS-BackupWorker' = $fakeWorkerTask
    'HospitalBillingOS-Scheduler' = $fakeSchedulerTask
    'HospitalBillingOS-DailyBackup' = $fakeLegacyTask
}
$failures.Clear()
$warnings.Clear()
Test-BackupWindowsTaskAutomation
Assert-PreflightFunctional ($failures.Count -eq 0) "Legacy DailyBackup must not fail the gate when Scheduler is valid. Failures: $($failures -join ' | ')"
Assert-PreflightFunctional ($warnings.Count -eq 1 -and (@($warnings)[0] -match 'UpdateExisting')) "Legacy DailyBackup must warn with -UpdateExisting guidance. Warnings: $($warnings -join ' | ')"

Write-Host "[ OK ] production readiness preflight requires receipt proof and validates Docker workers"
Write-Host "[ OK ] production readiness preflight Docker-only toolchain checks passed: $script:FunctionalChecks checks"

