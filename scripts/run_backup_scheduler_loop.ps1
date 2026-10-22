param(
    [string] $ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path,
    [string] $PhpPath = "C:\xampp\php\php.exe",
    [string] $DailyBackupTime = "02:00"
)

# Bare-metal backup automation loop (F027 / T3-003).
#
# Each 60-second iteration:
#   1. supervises the `backups` queue worker and restarts it when it stops;
#   2. runs the Laravel scheduler: `schedule:run --no-interaction`;
#   3. records the scheduler heartbeat: `hospital:scheduler-tick --result=ok`
#      on success, or `--result=fail --message=schedule:run failed` when
#      `schedule:run` exits non-zero. This replicates the scheduler sidecar
#      contract of docker-compose.prod.yml so the system status endpoint sees
#      bare-metal scheduler activity.
#
# All scheduled jobs (daily backup, 06:00-18:00 operational backups, backup
# health, verification, external copy and pruning) live in
# backend/routes/console.php and are executed by `schedule:run` only. This
# loop no longer runs its own daily backup, so the Laravel schedule is the
# single owner of backup automation. The daily backup hour comes from backend
# config `hospital.schedule.daily_backup_time` (env HOSPITAL_DAILY_BACKUP_TIME
# in backend/.env). The -DailyBackupTime parameter is accepted for
# compatibility with scripts/start_backup_automation.cmd and
# scripts/install_backup_startup_current_user.ps1, but it no longer governs
# the schedule.
#
# A named local mutex guarantees a single loop instance, and all activity is
# appended to backend/storage/logs/backup-automation.log.
#
# Native php invocations merge stderr with `2>&1`, so Invoke-Artisan relaxes
# $ErrorActionPreference only around the call: in Windows PowerShell 5.1 a
# stderr line merged into the success stream becomes a NativeCommandError that
# would otherwise abort the iteration before the fail tick is recorded. The
# worker script path is quoted explicitly because PS 5.1 Start-Process joins
# -ArgumentList elements without quoting them (a ProjectRoot with spaces would
# otherwise break the queue worker).

$ErrorActionPreference = "Stop"

$ProjectRoot = (Resolve-Path -LiteralPath $ProjectRoot).Path
$backendDir = Join-Path $ProjectRoot "backend"
$artisanPath = Join-Path $backendDir "artisan"
$logDir = Join-Path $backendDir "storage\logs"
$logFile = Join-Path $logDir "backup-automation.log"

function Write-AutomationLog([string] $Message) {
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Add-Content -LiteralPath $logFile -Value "[$timestamp] $Message"
}

if (-not (Test-Path -LiteralPath $PhpPath)) {
    $PhpPath = "php"
}

if (-not (Test-Path -LiteralPath $artisanPath)) {
    throw "Missing artisan under $backendDir"
}

New-Item -ItemType Directory -Force -Path $logDir | Out-Null

$createdMutex = $false
$mutex = New-Object System.Threading.Mutex($true, "Local\HospitalBillingOSBackupAutomation", [ref] $createdMutex)
if (-not $createdMutex) {
    Write-AutomationLog "Another backup automation loop is already running. Exiting."
    exit 0
}

Write-AutomationLog "Starting backup automation loop. ProjectRoot=$ProjectRoot PhpPath=$PhpPath DailyBackupTime=$DailyBackupTime (legacy; daily hour comes from backend config hospital.schedule.daily_backup_time)."

$quotedArtisanPath = '"' + $artisanPath + '"'
$workerArgs = @(
    $quotedArtisanPath,
    "queue:work",
    "--queue=backups",
    "--tries=1",
    "--timeout=600"
)

function Start-BackupWorker {
    $process = Start-Process -FilePath $PhpPath -ArgumentList $workerArgs -WorkingDirectory $backendDir -WindowStyle Hidden -PassThru
    Write-AutomationLog "Backup queue worker started. Pid=$($process.Id)"

    return $process
}

function Invoke-Artisan {
    param([string[]] $Arguments)

    # stderr is merged into the captured output, but under the global
    # $ErrorActionPreference='Stop' a NativeCommandError in PS 5.1 would abort
    # the iteration before the scheduler tick is recorded. Relax the preference
    # only around the native call and restore it afterwards.
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

function Write-SchedulerOutput {
    param([object[]] $Output)

    foreach ($line in $Output) {
        $text = ([string] $line).Trim()
        if ($text -eq "") { continue }
        if ($text -eq "No scheduled commands are ready to run.") { continue }

        Write-AutomationLog "schedule:run: $text"
    }
}

function Write-SchedulerFailure {
    param([string] $Reason)

    try {
        Write-AutomationLog "schedule:run failure: $Reason"
    }
    catch {
        # Logging must never prevent the fail tick from being attempted.
    }

    try {
        [void] (Invoke-Artisan -Arguments @("hospital:scheduler-tick", "--result=fail", "--message=schedule:run failed"))
    }
    catch {
        try {
            Write-AutomationLog "hospital:scheduler-tick --result=fail could not be recorded: $($_.Exception.Message)"
        }
        catch { }
    }
}

function Invoke-LaravelScheduler {
    $scheduled = $null
    try {
        $scheduled = Invoke-Artisan -Arguments @("schedule:run", "--no-interaction")
    }
    catch {
        # Even when the native invocation itself fails (php missing, stderr
        # explosion, etc.) the Docker-parity fail tick must be recorded.
        Write-SchedulerFailure "invocation error: $($_.Exception.Message)"
        return
    }

    if ($scheduled.ExitCode -eq 0) {
        Write-SchedulerOutput -Output $scheduled.Output
        try {
            [void] (Invoke-Artisan -Arguments @("hospital:scheduler-tick", "--result=ok"))
        }
        catch {
            Write-AutomationLog "hospital:scheduler-tick --result=ok could not be recorded: $($_.Exception.Message)"
        }
    }
    else {
        try {
            Write-AutomationLog "schedule:run exited with code $($scheduled.ExitCode)."
            Write-SchedulerOutput -Output $scheduled.Output
        }
        catch {
            Write-AutomationLog "schedule:run output could not be recorded: $($_.Exception.Message)"
        }

        Write-SchedulerFailure "exit code $($scheduled.ExitCode)"
    }
}

$workerProcess = Start-BackupWorker
$lastHeartbeat = Get-Date

while ($true) {
    try {
        if ($null -eq $workerProcess -or $workerProcess.HasExited) {
            if ($null -ne $workerProcess) {
                Write-AutomationLog "Backup queue worker stopped with code $($workerProcess.ExitCode). Restarting."
            }

            $workerProcess = Start-BackupWorker
        }

        Invoke-LaravelScheduler

        $now = Get-Date
        if (($now - $lastHeartbeat).TotalMinutes -ge 5) {
            Write-AutomationLog "Heartbeat. WorkerPid=$($workerProcess.Id) WorkerExited=$($workerProcess.HasExited)"
            $lastHeartbeat = $now
        }
    }
    catch {
        Write-AutomationLog "Automation loop error: $($_.Exception.Message)"
    }

    Start-Sleep -Seconds 60
}
