param(
    [string] $ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path,
    [string] $PhpPath = "php",
    [string] $TaskPrefix = "HospitalBillingOS",
    [string] $DailyBackupTime = "02:00",
    [switch] $SchedulerTick,
    [switch] $WhatIfOnly,
    [switch] $UpdateExisting,
    [switch] $Uninstall,
    [switch] $Status,
    [switch] $JsonStatus
)

# ============================================================================
# S_Hospital backup automation - Windows scheduled tasks (F027 / T3-011).
#
# Mode matrix - exactly ONE scheduler mechanism per host (never two):
#   * Docker: docker-compose.prod.yml `scheduler` sidecar runs
#     `schedule:run --no-interaction` + `hospital:scheduler-tick` every 60 s.
#   * Bare-metal via user startup: scripts/run_backup_scheduler_loop.ps1
#     (T3-003) does the same every 60 s and supervises the queue worker.
#   * Bare-metal via Windows tasks (this script): `-BackupWorker` (at startup)
#     supervises `queue:work --queue=backups` for UI backups; `-Scheduler`
#     (every minute) runs the same schedule:run + tick contract through the
#     `-SchedulerTick` runtime mode below.
#
# All scheduled jobs (daily backup, 06:00-18:00 operational backups, backup
# health, backup verification, external copy and pruning) live in
# backend/routes/console.php and are executed by `schedule:run` only. This
# registrar therefore does not register any direct `hospital:backup` task: the
# legacy `-DailyBackup` task is retired by `-UpdateExisting`/`-Uninstall` so
# the Laravel schedule stays the single owner of backup automation.
#
# The effective daily backup hour is owned by backend config
# `hospital.schedule.daily_backup_time` (env HOSPITAL_DAILY_BACKUP_TIME in
# backend/.env). `-DailyBackupTime` is accepted only for compatibility with
# existing operator commands; it no longer governs any task trigger.
#
# `-SchedulerTick` mode executes one scheduler tick for the registered
# `-Scheduler` task: `schedule:run --no-interaction`; on success
# `hospital:scheduler-tick --result=ok` (exit 0); on failure it records
# `hospital:scheduler-tick --result=fail --message=schedule:run failed` and
# exits 1, matching the Docker sidecar and the T3-003 loop. Native php output
# is captured with stderr merged (2>&1) under a locally relaxed
# $ErrorActionPreference, so a PS 5.1 NativeCommandError from a stderr line
# can neither abort the tick before the heartbeat nor turn an exit 0 run into
# a false failure (RV-T3-011 / T3-018).
# ============================================================================

$ErrorActionPreference = "Stop"

$backendDir = Join-Path $ProjectRoot "backend"
$artisanPath = Join-Path $backendDir "artisan"

if (-not (Test-Path -LiteralPath $artisanPath)) {
    throw "Missing artisan at $artisanPath"
}

function Invoke-Artisan {
    param([string[]] $Arguments)

    # stderr is merged into the captured output, but under the global
    # $ErrorActionPreference="Stop" a NativeCommandError in PS 5.1 would abort
    # the tick before the heartbeat is recorded (RV-T3-011). Relax the
    # preference only around the native call and restore it afterwards,
    # exactly like the T3-003 loop (run_backup_scheduler_loop.ps1).
    $previousErrorActionPreference = $ErrorActionPreference
    $exitCode = $null
    $output = @()

    Push-Location $backendDir
    try {
        $ErrorActionPreference = "Continue"
        $output = @(& $PhpPath $artisanPath @Arguments 2>&1)
        $exitCode = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $previousErrorActionPreference
        Pop-Location
    }

    return [pscustomobject]@{
        ExitCode = $exitCode
        Output = $output
    }
}

# ---------------------------------------------------------------------------
# Runtime mode for the registered `-Scheduler` task. Registers nothing and
# never requires administrator permissions.
# ---------------------------------------------------------------------------
if ($SchedulerTick) {
    if (-not (Test-Path -LiteralPath $PhpPath)) {
        $PhpPath = "php"
    }

    # Records the Docker-parity fail heartbeat. It is used both when
    # schedule:run exits non-zero and when the native invocation itself fails
    # (php missing/unusable); the inner guard keeps a broken php path from
    # masking the exit-code contract.
    function Write-SchedulerFailure {
        param([string] $Reason)

        Write-Host "schedule:run failure: $Reason"
        try {
            [void] (Invoke-Artisan -Arguments @("hospital:scheduler-tick", "--result=fail", "--message=schedule:run failed"))
        }
        catch {
            Write-Host "hospital:scheduler-tick --result=fail could not be recorded: $($_.Exception.Message)"
        }
    }

    $scheduled = $null
    try {
        $scheduled = Invoke-Artisan -Arguments @("schedule:run", "--no-interaction")
    }
    catch {
        Write-SchedulerFailure "invocation error: $($_.Exception.Message)"
        exit 1
    }

    if ($scheduled.ExitCode -eq 0) {
        try {
            [void] (Invoke-Artisan -Arguments @("hospital:scheduler-tick", "--result=ok"))
        }
        catch {
            Write-Host "hospital:scheduler-tick --result=ok could not be recorded: $($_.Exception.Message)"
        }
        Write-Host "Scheduler tick recorded: ok."
        exit 0
    }

    foreach ($line in @($scheduled.Output)) {
        $text = ([string] $line).Trim()
        if ($text -ne "") {
            Write-Host "schedule:run: $text"
        }
    }

    Write-SchedulerFailure "exit code $($scheduled.ExitCode)"
    Write-Host "schedule:run exited with code $($scheduled.ExitCode); scheduler tick recorded: fail."
    exit 1
}

# ---------------------------------------------------------------------------
# Registration / inspection modes.
# ---------------------------------------------------------------------------
$workerTaskName = "$TaskPrefix-BackupWorker"
$schedulerTaskName = "$TaskPrefix-Scheduler"
$legacyDailyTaskName = "$TaskPrefix-DailyBackup"
$workerScript = Join-Path $ProjectRoot "scripts\run_backup_worker.cmd"

if (-not (Test-Path -LiteralPath $workerScript)) {
    throw "Missing backup worker wrapper at $workerScript"
}

$registrarScript = $PSCommandPath
if ([string]::IsNullOrWhiteSpace($registrarScript)) {
    $registrarScript = Join-Path $PSScriptRoot "install_backup_tasks_windows.ps1"
}

function Test-IsAdmin {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)

    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Get-TaskIfExists([string] $taskName) {
    return Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
}

function Get-TaskStatusRecord([string] $taskName) {
    $task = Get-TaskIfExists $taskName
    if ($null -eq $task) {
        return [pscustomobject]@{
            Installed = $false
            Enabled = $false
            State = 'Missing'
            LastRunTime = $null
            LastTaskResult = $null
            NextRunTime = $null
        }
    }

    $enabled = $true
    try {
        if ($null -ne $task.Settings -and $null -ne $task.Settings.Enabled) {
            $enabled = [bool] $task.Settings.Enabled
        }
    }
    catch { $enabled = $true }
    $info = Get-ScheduledTaskInfo -TaskName $taskName

    return [pscustomobject]@{
        Installed = $true
        Enabled = $enabled
        State = [string] $task.State
        LastRunTime = $info.LastRunTime
        LastTaskResult = $info.LastTaskResult
        NextRunTime = $info.NextRunTime
    }
}

function Show-TaskStatus([string] $taskName) {
    $task = Get-TaskIfExists $taskName
    if ($null -eq $task) {
        Write-Host "${taskName}: not installed"
        return
    }

    $info = Get-ScheduledTaskInfo -TaskName $taskName
    Write-Host "${taskName}: state=$($task.State), lastRun=$($info.LastRunTime), lastResult=$($info.LastTaskResult), nextRun=$($info.NextRunTime)"
}

function Test-UserStartupLoopInstalled {
    $startupDir = [Environment]::GetFolderPath("Startup")
    $startupFile = Join-Path $startupDir "HospitalBillingOSBackupAutomation.cmd"
    if (Test-Path -LiteralPath $startupFile) {
        return $true
    }

    $runKeyPath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run"
    $runValue = (Get-ItemProperty -Path $runKeyPath -Name "HospitalBillingOSBackupAutomation" -ErrorAction SilentlyContinue).HospitalBillingOSBackupAutomation

    return -not [string]::IsNullOrWhiteSpace([string] $runValue)
}

$workerArgs = "/c `"$workerScript`" `"$PhpPath`""
$schedulerArgs = "-NoProfile -ExecutionPolicy Bypass -File `"$registrarScript`" -SchedulerTick -ProjectRoot `"$ProjectRoot`" -PhpPath `"$PhpPath`""

Write-Host "Preparing Windows scheduled tasks for S_Hospital backup automation."
Write-Host "ProjectRoot: $ProjectRoot"
Write-Host "PhpPath: $PhpPath"
Write-Host "Worker wrapper: $workerScript"
Write-Host "Worker task: $workerTaskName (at startup)"
Write-Host "Scheduler task: $schedulerTaskName (every 1 minute)"
Write-Host "Scheduler action: powershell.exe $schedulerArgs"
Write-Host "Backups: the Laravel schedule (schedule:run) owns all backup jobs; no direct backup task is registered."
Write-Host "Daily backup hour: HOSPITAL_DAILY_BACKUP_TIME in backend\.env (config/hospital.php); -DailyBackupTime=$DailyBackupTime is legacy."

if (Test-UserStartupLoopInstalled) {
    Write-Host "[WARN] User-startup automation loop is installed (HospitalBillingOSBackupAutomation). Use only one bare-metal mechanism: the loop or these Windows tasks, never both."
}

if ($Status) {
    $workerStatus = Get-TaskStatusRecord $workerTaskName
    $schedulerStatus = Get-TaskStatusRecord $schedulerTaskName
    $legacyStatus = Get-TaskStatusRecord $legacyDailyTaskName
    if ($JsonStatus) {
        [pscustomobject]@{
            Worker = $workerStatus
            Scheduler = $schedulerStatus
            LegacyDaily = $legacyStatus
        } | ConvertTo-Json -Compress -Depth 4
    }
    else {
        Show-TaskStatus $workerTaskName
        Show-TaskStatus $schedulerTaskName
        if ($legacyStatus.Installed) {
            Show-TaskStatus $legacyDailyTaskName
            Write-Host "Legacy daily backup task detected. It would duplicate the Laravel schedule; run -UpdateExisting to retire it (schedule:run owns backups)."
        }
        Write-Host "Confirm the worker is running with: Get-ScheduledTask -TaskName '$workerTaskName'"
        Write-Host "Confirm the scheduler ran within the last minute: Get-ScheduledTaskInfo -TaskName '$schedulerTaskName'"
        Write-Host "Confirm UI backups finish by creating a backup and checking it changes from pending to success."
    }
    exit 0
}

if ($WhatIfOnly) {
    Write-Host "WhatIfOnly enabled. No tasks were registered."
    Write-Host "Worker command: cmd.exe $workerArgs"
    Write-Host "Scheduler command: powershell.exe $schedulerArgs"
    Write-Host "Scheduler cadence: every 1 minute; action mode -SchedulerTick runs schedule:run --no-interaction then hospital:scheduler-tick --result=ok|fail."
    Write-Host "Backups: the Laravel schedule (schedule:run) owns all backup jobs; daily hour from HOSPITAL_DAILY_BACKUP_TIME. No direct backup task is registered."
    if (Get-TaskIfExists $legacyDailyTaskName) {
        Write-Host "Legacy task '$legacyDailyTaskName' exists and will be retired by -UpdateExisting."
    }
    Write-Host "Update existing tasks with: -UpdateExisting"
    Write-Host "Remove tasks with: -Uninstall"
    Write-Host "Check tasks with: -Status"
    exit 0
}

if (-not (Test-IsAdmin)) {
    throw "Administrator permissions are required to register, update, or uninstall Windows scheduled tasks. Re-run PowerShell as Administrator."
}

if ($Uninstall) {
    foreach ($taskName in @($workerTaskName, $schedulerTaskName, $legacyDailyTaskName)) {
        if (Get-TaskIfExists $taskName) {
            Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
            Write-Host "Removed scheduled task: $taskName"
        } else {
            Write-Host "Scheduled task was not installed: $taskName"
        }
    }

    exit 0
}

foreach ($taskName in @($workerTaskName, $schedulerTaskName, $legacyDailyTaskName)) {
    if ((Get-TaskIfExists $taskName) -and -not $UpdateExisting) {
        throw "Scheduled task '$taskName' already exists. Re-run with -UpdateExisting to replace it, or use -Uninstall first."
    }
}

$workerAction = New-ScheduledTaskAction -Execute "cmd.exe" -Argument $workerArgs -WorkingDirectory $ProjectRoot
$workerTrigger = New-ScheduledTaskTrigger -AtStartup
$workerSettings = New-ScheduledTaskSettingsSet -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 5) -ExecutionTimeLimit (New-TimeSpan -Hours 0)
$schedulerAction = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $schedulerArgs -WorkingDirectory $ProjectRoot
$schedulerTrigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 1) -RepetitionDuration (New-TimeSpan -Days 3650)
$schedulerSettings = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 10)

function Remove-ScheduledTaskIfExists {
    param([string] $TaskName)

    if (Get-TaskIfExists $TaskName) {
        Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
    }
}

function Get-ScheduledTaskSnapshots {
    param([string[]] $TaskNames)

    $snapshots = @{}
    foreach ($taskName in $TaskNames) {
        if (Get-TaskIfExists $taskName) {
            $snapshots[$taskName] = Export-ScheduledTask -TaskName $taskName
        }
    }
    return $snapshots
}

function Restore-ScheduledTaskSnapshots {
    param([hashtable] $Snapshots, [string[]] $TaskNames)

    foreach ($taskName in $TaskNames) {
        Remove-ScheduledTaskIfExists -TaskName $taskName
    }
    foreach ($taskName in @($Snapshots.Keys)) {
        Register-ScheduledTask -TaskName $taskName -Xml ([string] $Snapshots[$taskName]) | Out-Null
    }
}

function Register-HospitalTaskPair {
    param([string] $WorkerName, [string] $SchedulerName)

    Register-ScheduledTask `
        -TaskName $WorkerName `
        -Action $workerAction `
        -Trigger $workerTrigger `
        -Settings $workerSettings `
        -Description "S_Hospital continuous backup queue worker for UI backups." | Out-Null

    Register-ScheduledTask `
        -TaskName $SchedulerName `
        -Action $schedulerAction `
        -Trigger $schedulerTrigger `
        -Settings $schedulerSettings `
        -Description "S_Hospital Laravel scheduler every minute (schedule:run + heartbeat); backups are owned by console.php." | Out-Null
}

$stageToken = [Guid]::NewGuid().ToString('N').Substring(0, 10)
$stageWorkerTaskName = "$workerTaskName-Stage-$stageToken"
$stageSchedulerTaskName = "$schedulerTaskName-Stage-$stageToken"
$managedTaskNames = @($workerTaskName, $schedulerTaskName)
$taskSnapshots = @{}

try {
    # Prove both definitions can be registered before touching active tasks.
    Register-HospitalTaskPair -WorkerName $stageWorkerTaskName -SchedulerName $stageSchedulerTaskName
    if (-not (Get-TaskIfExists $stageWorkerTaskName) -or -not (Get-TaskIfExists $stageSchedulerTaskName)) {
        throw 'Las tareas de ensayo no quedaron registradas.'
    }
}
finally {
    Remove-ScheduledTaskIfExists -TaskName $stageWorkerTaskName
    Remove-ScheduledTaskIfExists -TaskName $stageSchedulerTaskName
}

$taskSnapshots = Get-ScheduledTaskSnapshots -TaskNames $managedTaskNames

try {
    foreach ($taskName in $managedTaskNames) {
        Remove-ScheduledTaskIfExists -TaskName $taskName
    }

    Register-HospitalTaskPair -WorkerName $workerTaskName -SchedulerName $schedulerTaskName
    Start-ScheduledTask -TaskName $workerTaskName
    Start-ScheduledTask -TaskName $schedulerTaskName

    if (-not (Get-TaskIfExists $workerTaskName) -or -not (Get-TaskIfExists $schedulerTaskName)) {
        throw 'Las tareas definitivas no quedaron disponibles despues del arranque.'
    }

    if ($UpdateExisting) {
        foreach ($taskName in @($legacyDailyTaskName)) {
            Remove-ScheduledTaskIfExists -TaskName $taskName
        }
    }
}
catch {
    $registrationFailure = $_
    Restore-ScheduledTaskSnapshots -Snapshots $taskSnapshots -TaskNames $managedTaskNames
    throw "No se pudieron instalar las tareas; se restauro la configuracion anterior. $($registrationFailure.Exception.Message)"
}

Write-Host "Registered scheduled tasks."
Write-Host "Started worker task: $workerTaskName"
Write-Host "Started scheduler task: $schedulerTaskName"
Write-Host "Check task status with: powershell.exe -ExecutionPolicy Bypass -File scripts\install_backup_tasks_windows.ps1 -Status"
Write-Host "Update tasks with: powershell.exe -ExecutionPolicy Bypass -File scripts\install_backup_tasks_windows.ps1 -UpdateExisting"
Write-Host "Uninstall tasks with: powershell.exe -ExecutionPolicy Bypass -File scripts\install_backup_tasks_windows.ps1 -Uninstall"
Write-Host "Validate a UI backup changes from pending to success before production handoff."
