param(
    [string] $ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path,
    [string] $PhpPath = "C:\xampp\php\php.exe",
    [string] $DailyBackupTime = "02:00",
    [switch] $WhatIfOnly
)

$ErrorActionPreference = "Stop"

$originalProjectRoot = $ProjectRoot
try {
    $ProjectRoot = (Resolve-Path -LiteralPath $ProjectRoot).Path
} catch {
    Write-Host "No se pudo ubicar la carpeta del sistema. Revise que este script se ejecute desde la instalacion completa."
    exit 1
}
$backendDir = Join-Path $ProjectRoot "backend"
$stateDir = Join-Path $backendDir "storage\app\private\backups"
$stateFile = Join-Path $stateDir ".last-scheduled-backup-date"
$logDir = Join-Path $backendDir "storage\logs"
$logFile = Join-Path $logDir "backup-automation.log"

function Get-SafeAutomationText([string] $Message) {
    $safe = $Message
    foreach ($path in @($ProjectRoot, $originalProjectRoot, $backendDir, $logDir, $stateDir)) {
        if (-not [string]::IsNullOrWhiteSpace($path)) {
            $safe = $safe -replace [regex]::Escape($path), "%PROJECT_ROOT%"
        }
    }

    $safe = $safe -replace "(?i)[A-Z]:\\Users\\[^\\\s]+", "[perfil-windows]"
    $safe = $safe -replace "(?i)(APP_KEY|DB_PASSWORD|PASSWORD|TOKEN|SECRET)=\S+", '$1=[oculto]'

    return $safe
}

function Write-AutomationLog([string] $Message) {
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Add-Content -LiteralPath $logFile -Value "[$timestamp] $(Get-SafeAutomationText $Message)"
}

function Get-ValidatedDailyBackupTime([string] $value) {
    try {
        return [DateTime]::ParseExact($value, "HH:mm", [Globalization.CultureInfo]::InvariantCulture)
    } catch {
        return $null
    }
}

if (-not (Test-Path -LiteralPath (Join-Path $backendDir "artisan"))) {
    Write-Host "No se encontro la aplicacion del sistema. Revise que este script se ejecute desde la instalacion completa."
    exit 1
}

if (Test-Path -LiteralPath $PhpPath) {
    $PhpPath = (Resolve-Path -LiteralPath $PhpPath).Path
    $phpSource = "archivo configurado"
} else {
    $phpCommand = Get-Command "php" -ErrorAction SilentlyContinue
    if ($null -eq $phpCommand) {
        Write-Host "No se encontro PHP. Instale XAMPP/PHP o indique la ruta correcta antes de iniciar respaldos."
        exit 1
    }

    $PhpPath = $phpCommand.Source
    $phpSource = "PATH del sistema"
}

$dailyBackupTarget = Get-ValidatedDailyBackupTime $DailyBackupTime
if ($null -eq $dailyBackupTarget) {
    $message = "Hora de respaldo invalida '$DailyBackupTime'. Use formato HH:mm de 24 horas, por ejemplo 02:00 o 23:30. No se inicio la automatizacion de respaldos."
    Write-Host $message
    if (-not $WhatIfOnly) {
        New-Item -ItemType Directory -Force -Path $logDir | Out-Null
        Write-AutomationLog $message
    }
    exit 1
}

if ($WhatIfOnly) {
    Write-Host "Verificacion completada. No se inicio worker, no se ejecuto respaldo y no se escribieron archivos."
    Write-Host "Hora diaria validada: $DailyBackupTime"
    Write-Host "PHP disponible: $phpSource"
    exit 0
}

New-Item -ItemType Directory -Force -Path $stateDir | Out-Null
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

$createdMutex = $false
$mutex = New-Object System.Threading.Mutex($true, "Local\SistemaCajaHospitalariaBackupAutomation", [ref] $createdMutex)
if (-not $createdMutex) {
    Write-AutomationLog "Another backup automation loop is already running. Exiting."
    exit 0
}

Write-AutomationLog "Starting backup automation loop. PhpSource=$phpSource DailyBackupTime=$DailyBackupTime"

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

        $targetToday = Get-Date -Hour $dailyBackupTarget.Hour -Minute $dailyBackupTarget.Minute -Second 0
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
        Write-AutomationLog "Automation loop error: $(Get-SafeAutomationText $_.Exception.Message)"
    }

    Start-Sleep -Seconds 60
}
