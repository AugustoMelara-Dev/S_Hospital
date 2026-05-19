param(
    [string] $ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path,
    [string] $PhpPath = "php",
    [string] $TaskPrefix = "HospitalBillingOS",
    [string] $DailyBackupTime = "02:00",
    [switch] $WhatIfOnly
)

$ErrorActionPreference = "Stop"

$backendDir = Join-Path $ProjectRoot "backend"
$artisanPath = Join-Path $backendDir "artisan"

if (-not (Test-Path -LiteralPath $artisanPath)) {
    throw "Missing artisan at $artisanPath"
}

$workerTaskName = "$TaskPrefix-BackupWorker"
$dailyTaskName = "$TaskPrefix-DailyBackup"

$workerArgs = "-NoProfile -ExecutionPolicy Bypass -Command `"cd '$backendDir'; & '$PhpPath' artisan queue:work --queue=backups --tries=1 --timeout=600`""
$backupArgs = "-NoProfile -ExecutionPolicy Bypass -Command `"cd '$backendDir'; & '$PhpPath' artisan hospital:backup --type=scheduled`""

Write-Host "Preparing Windows scheduled tasks for Hospital Billing OS backups."
Write-Host "ProjectRoot: $ProjectRoot"
Write-Host "Worker task: $workerTaskName"
Write-Host "Daily backup task: $dailyTaskName at $DailyBackupTime"

if ($WhatIfOnly) {
    Write-Host "WhatIfOnly enabled. No tasks were registered."
    Write-Host "Worker command: powershell.exe $workerArgs"
    Write-Host "Daily backup command: powershell.exe $backupArgs"
    exit 0
}

$workerAction = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $workerArgs -WorkingDirectory $backendDir
$workerTrigger = New-ScheduledTaskTrigger -AtStartup
$workerSettings = New-ScheduledTaskSettingsSet -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 5) -ExecutionTimeLimit (New-TimeSpan -Hours 0)

Register-ScheduledTask `
    -TaskName $workerTaskName `
    -Action $workerAction `
    -Trigger $workerTrigger `
    -Settings $workerSettings `
    -Description "Hospital Billing OS continuous backup queue worker." `
    -Force | Out-Null

$dailyAction = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $backupArgs -WorkingDirectory $backendDir
$dailyTrigger = New-ScheduledTaskTrigger -Daily -At $DailyBackupTime
$dailySettings = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Hours 2)

Register-ScheduledTask `
    -TaskName $dailyTaskName `
    -Action $dailyAction `
    -Trigger $dailyTrigger `
    -Settings $dailySettings `
    -Description "Hospital Billing OS scheduled local database backup." `
    -Force | Out-Null

Write-Host "Registered scheduled tasks."
Write-Host "Start the worker now with: Start-ScheduledTask -TaskName '$workerTaskName'"
Write-Host "Validate a UI backup changes from pending to success before production handoff."
