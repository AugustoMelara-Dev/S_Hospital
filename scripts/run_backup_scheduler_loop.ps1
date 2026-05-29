param(
    [string] $ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path,
    [string] $PhpPath = "C:\xampp\php\php.exe",
    [string] $DailyBackupTime = "02:00"
)

$ErrorActionPreference = "Stop"

$backendDir = Join-Path $ProjectRoot "backend"
$stateDir = Join-Path $backendDir "storage\app\private\backups"
$stateFile = Join-Path $stateDir ".last-scheduled-backup-date"
$logDir = Join-Path $backendDir "storage\logs"
$logFile = Join-Path $logDir "backup-automation.log"

function Write-AutomationLog([string] $Message) {
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Add-Content -LiteralPath $logFile -Value "[$timestamp] $Message"
}

if (-not (Test-Path -LiteralPath $PhpPath)) {
    $PhpPath = "php"
}

if (-not (Test-Path -LiteralPath (Join-Path $backendDir "artisan"))) {
    throw "Missing artisan under $backendDir"
}

New-Item -ItemType Directory -Force -Path $stateDir | Out-Null
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

$createdMutex = $false
$mutex = New-Object System.Threading.Mutex($true, "Local\SistemaCajaHospitalariaBackupAutomation", [ref] $createdMutex)
if (-not $createdMutex) {
    Write-AutomationLog "Another backup automation loop is already running. Exiting."
    exit 0
}

Write-AutomationLog "Starting backup automation loop. ProjectRoot=$ProjectRoot PhpPath=$PhpPath DailyBackupTime=$DailyBackupTime"

$workerArgs = @(
    "artisan",
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

        $now = Get-Date
        if (($now - $lastHeartbeat).TotalMinutes -ge 5) {
            Write-AutomationLog "Heartbeat. WorkerPid=$($workerProcess.Id) WorkerExited=$($workerProcess.HasExited)"
            $lastHeartbeat = $now
        }

        $target = [DateTime]::ParseExact($DailyBackupTime, "HH:mm", [Globalization.CultureInfo]::InvariantCulture)
        $targetToday = Get-Date -Hour $target.Hour -Minute $target.Minute -Second 0
        $lastRunDate = if (Test-Path -LiteralPath $stateFile) {
            (Get-Content -LiteralPath $stateFile -Raw).Trim()
        } else {
            ""
        }

        if ($now -ge $targetToday -and $lastRunDate -ne $now.ToString("yyyy-MM-dd")) {
            Write-AutomationLog "Running scheduled backup for $($now.ToString("yyyy-MM-dd"))."
            $backupOutput = & $PhpPath artisan hospital:backup --type=scheduled 2>&1
            $exitCode = $LASTEXITCODE
            foreach ($line in $backupOutput) {
                Write-AutomationLog "backup: $line"
            }

            if ($exitCode -eq 0) {
                Set-Content -LiteralPath $stateFile -Value $now.ToString("yyyy-MM-dd")
                Write-AutomationLog "Scheduled backup completed successfully."
            } else {
                Write-AutomationLog "Scheduled backup exited with code $exitCode."
            }
        }
    } catch {
        Write-AutomationLog "Automation loop error: $($_.Exception.Message)"
    }

    Start-Sleep -Seconds 60
}
