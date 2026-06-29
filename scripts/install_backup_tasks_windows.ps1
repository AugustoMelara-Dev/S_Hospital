param(
    [string] $ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path,
    [string] $PhpPath = "php",
    [string] $TaskPrefix = "HospitalBillingOS",
    [string] $DailyBackupTime = "02:00",
    [switch] $WhatIfOnly,
    [switch] $UpdateExisting,
    [switch] $Uninstall,
    [switch] $Status
)

$ErrorActionPreference = "Stop"

$backendDir = Join-Path $ProjectRoot "backend"
$artisanPath = Join-Path $backendDir "artisan"

if (-not (Test-Path -LiteralPath $artisanPath)) {
    throw "Missing artisan at $artisanPath"
}

$workerTaskName = "$TaskPrefix-BackupWorker"
$dailyTaskName = "$TaskPrefix-DailyBackup"
$workerScript = Join-Path $ProjectRoot "scripts\run_backup_worker.cmd"
$dailyScript = Join-Path $ProjectRoot "scripts\run_scheduled_backup.cmd"

if (-not (Test-Path -LiteralPath $workerScript)) {
    throw "Missing backup worker wrapper at $workerScript"
}

if (-not (Test-Path -LiteralPath $dailyScript)) {
    throw "Missing scheduled backup wrapper at $dailyScript"
}

function Test-IsAdmin {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)

    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Get-TaskIfExists([string] $taskName) {
    return Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
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

$workerArgs = "/c `"$workerScript`" `"$PhpPath`""
$backupArgs = "/c `"$dailyScript`" `"$PhpPath`""

Write-Host "Preparing Windows scheduled tasks for Hospital Billing OS backups."
Write-Host "ProjectRoot: $ProjectRoot"
Write-Host "PhpPath: $PhpPath"
Write-Host "Worker wrapper: $workerScript"
Write-Host "Daily backup wrapper: $dailyScript"
Write-Host "Worker task: $workerTaskName"
Write-Host "Daily backup task: $dailyTaskName at $DailyBackupTime"

if ($Status) {
    Show-TaskStatus $workerTaskName
    Show-TaskStatus $dailyTaskName
    Write-Host "Confirm the worker is running with: Get-ScheduledTask -TaskName '$workerTaskName'"
    Write-Host "Confirm UI backups finish by creating a backup and checking it changes from pending to success."
    exit 0
}

if ($WhatIfOnly) {
    Write-Host "WhatIfOnly enabled. No tasks were registered."
    Write-Host "Worker command: cmd.exe $workerArgs"
    Write-Host "Daily backup command: cmd.exe $backupArgs"
    Write-Host "Update existing tasks with: -UpdateExisting"
    Write-Host "Remove tasks with: -Uninstall"
    Write-Host "Check tasks with: -Status"
    exit 0
}

if (-not (Test-IsAdmin)) {
    throw "Administrator permissions are required to register, update, or uninstall Windows scheduled tasks. Re-run PowerShell as Administrator."
}

if ($Uninstall) {
    foreach ($taskName in @($workerTaskName, $dailyTaskName)) {
        if (Get-TaskIfExists $taskName) {
            Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
            Write-Host "Removed scheduled task: $taskName"
        } else {
            Write-Host "Scheduled task was not installed: $taskName"
        }
    }

    exit 0
}

foreach ($taskName in @($workerTaskName, $dailyTaskName)) {
    if ((Get-TaskIfExists $taskName) -and -not $UpdateExisting) {
        throw "Scheduled task '$taskName' already exists. Re-run with -UpdateExisting to replace it, or use -Uninstall first."
    }
}

if ($UpdateExisting) {
    Write-Host "UpdateExisting enabled. Existing Hospital Billing OS backup tasks will be replaced."
    foreach ($taskName in @($workerTaskName, $dailyTaskName)) {
        if (Get-TaskIfExists $taskName) {
            Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
            Write-Host "Removed existing scheduled task before update: $taskName"
        }
    }
}

$workerAction = New-ScheduledTaskAction -Execute "cmd.exe" -Argument $workerArgs -WorkingDirectory $ProjectRoot
$workerTrigger = New-ScheduledTaskTrigger -AtStartup
$workerSettings = New-ScheduledTaskSettingsSet -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 5) -ExecutionTimeLimit (New-TimeSpan -Hours 0)

Register-ScheduledTask `
    -TaskName $workerTaskName `
    -Action $workerAction `
    -Trigger $workerTrigger `
    -Settings $workerSettings `
    -Description "Hospital Billing OS continuous backup queue worker." | Out-Null

$dailyAction = New-ScheduledTaskAction -Execute "cmd.exe" -Argument $backupArgs -WorkingDirectory $ProjectRoot
$dailyTrigger = New-ScheduledTaskTrigger -Daily -At $DailyBackupTime
$dailySettings = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Hours 2)

Register-ScheduledTask `
    -TaskName $dailyTaskName `
    -Action $dailyAction `
    -Trigger $dailyTrigger `
    -Settings $dailySettings `
    -Description "Hospital Billing OS scheduled local database backup." | Out-Null

Write-Host "Registered scheduled tasks."
Write-Host "Start the worker now with: Start-ScheduledTask -TaskName '$workerTaskName'"
Write-Host "Check task status with: powershell.exe -ExecutionPolicy Bypass -File scripts\install_backup_tasks_windows.ps1 -Status"
Write-Host "Update tasks with: powershell.exe -ExecutionPolicy Bypass -File scripts\install_backup_tasks_windows.ps1 -UpdateExisting"
Write-Host "Uninstall tasks with: powershell.exe -ExecutionPolicy Bypass -File scripts\install_backup_tasks_windows.ps1 -Uninstall"
Write-Host "Validate a UI backup changes from pending to success before production handoff."
