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

$workerArgs = "-NoProfile -ExecutionPolicy Bypass -Command `"cd '$backendDir'; & '$PhpPath' artisan queue:work --queue=backups --tries=1 --timeout=600`""
$backupArgs = "-NoProfile -ExecutionPolicy Bypass -Command `"cd '$backendDir'; & '$PhpPath' artisan hospital:backup --type=scheduled`""

Write-Host "Preparing Windows scheduled tasks for Hospital Billing OS backups."
Write-Host "ProjectRoot: $ProjectRoot"
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
    Write-Host "Worker command: powershell.exe $workerArgs"
    Write-Host "Daily backup command: powershell.exe $backupArgs"
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

$workerAction = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $workerArgs -WorkingDirectory $backendDir
$workerTrigger = New-ScheduledTaskTrigger -AtStartup
$workerSettings = New-ScheduledTaskSettingsSet -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 5) -ExecutionTimeLimit (New-TimeSpan -Hours 0)

Register-ScheduledTask `
    -TaskName $workerTaskName `
    -Action $workerAction `
    -Trigger $workerTrigger `
    -Settings $workerSettings `
    -Description "Hospital Billing OS continuous backup queue worker." | Out-Null

$dailyAction = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $backupArgs -WorkingDirectory $backendDir
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
