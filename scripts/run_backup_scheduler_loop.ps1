param(
    [string] $ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path,
    [string] $PhpPath = "C:\xampp\php\php.exe",
    [string] $DailyBackupTime = "02:00",
    [int] $MaxLogBytes = 1048576,
    [int] $LogRetentionDays = 14,
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
$artisanPath = Join-Path $backendDir "artisan"
$composeFile = Join-Path $ProjectRoot "docker-compose.prod.yml"
$envFile = Join-Path $ProjectRoot ".env"
$isPhpMode = Test-Path -LiteralPath $artisanPath
$isDockerMode = (-not $isPhpMode) -and (Test-Path -LiteralPath $composeFile)

if (-not $isPhpMode -and -not $isDockerMode) {
    Write-Host "No se encontro backend\artisan ni docker-compose.prod.yml. Revise que esta carpeta sea una instalacion completa."
    exit 1
}

$stateDir = if ($isPhpMode) {
    Join-Path $backendDir "storage\app\private\backups"
} else {
    Join-Path $ProjectRoot "install-logs\backup-state"
}
$stateFile = Join-Path $stateDir ".last-scheduled-backup-date"
$logDir = if ($isPhpMode) {
    Join-Path $backendDir "storage\logs"
} else {
    Join-Path $ProjectRoot "install-logs"
}
$logFile = Join-Path $logDir "backup-automation.log"

function Invoke-BackupAutomationLogRotation {
    if (-not (Test-Path -LiteralPath $logDir)) {
        return
    }

    $cutoff = (Get-Date).AddDays(-[Math]::Max(1, $LogRetentionDays))
    Get-ChildItem -LiteralPath $logDir -Filter "backup-automation*.log" -File -ErrorAction SilentlyContinue |
        Where-Object { $_.LastWriteTime -lt $cutoff } |
        Remove-Item -Force -ErrorAction SilentlyContinue

    if ((Test-Path -LiteralPath $logFile) -and (Get-Item -LiteralPath $logFile).Length -ge [Math]::Max(65536, $MaxLogBytes)) {
        $archivePath = Join-Path $logDir ("backup-automation-{0}.log" -f (Get-Date -Format "yyyyMMdd-HHmmss"))
        Move-Item -LiteralPath $logFile -Destination $archivePath -Force
    }
}

function Get-SafeAutomationText([string] $Message) {
    $safe = $Message
    foreach ($path in @($ProjectRoot, $originalProjectRoot, $backendDir, $logDir, $stateDir, $composeFile, $envFile)) {
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
    Invoke-BackupAutomationLogRotation
    Add-Content -LiteralPath $logFile -Value "[$timestamp] $(Get-SafeAutomationText $Message)"
}

function Get-ValidatedDailyBackupTime([string] $value) {
    try {
        return [DateTime]::ParseExact($value, "HH:mm", [Globalization.CultureInfo]::InvariantCulture)
    } catch {
        return $null
    }
}

function Test-DockerBackupRuntime {
    if (-not (Test-Path -LiteralPath $envFile)) {
        throw "No se encontro .env productivo. Ejecute setup.bat antes de iniciar respaldos."
    }

    $docker = Get-Command "docker" -ErrorAction SilentlyContinue
    if ($null -eq $docker) {
        throw "No se encontro Docker. El paquete offline productivo requiere Docker Desktop o Docker Engine."
    }

    $configCommand = 'docker compose -f "' + $composeFile + '" --env-file "' + $envFile + '" config --quiet >nul 2>nul'
    & cmd.exe /c $configCommand
    if ($LASTEXITCODE -ne 0) {
        throw "docker-compose.prod.yml o .env no son validos para respaldos."
    }
}

function Get-ValidatedPhpPath([string] $value) {
    if (Test-Path -LiteralPath $value) {
        return (Resolve-Path -LiteralPath $value).Path
    }

    $phpCommand = Get-Command "php" -ErrorAction SilentlyContinue
    if ($null -eq $phpCommand) {
        throw "No se encontro PHP. Instale XAMPP/PHP o indique la ruta correcta antes de iniciar respaldos."
    }

    return $phpCommand.Source
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

try {
    if ($isPhpMode) {
        $PhpPath = Get-ValidatedPhpPath $PhpPath
        $runtimeSource = "PHP local"
    } else {
        Test-DockerBackupRuntime
        $runtimeSource = "Docker Compose"
    }
} catch {
    Write-Host (Get-SafeAutomationText $_.Exception.Message)
    exit 1
}

if ($WhatIfOnly) {
    Write-Host "Verificacion completada. No se inicio worker, no se ejecuto respaldo y no se escribieron archivos."
    Write-Host "Modo de respaldos: $runtimeSource"
    Write-Host "Hora diaria validada: $DailyBackupTime"
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

Write-AutomationLog "Starting backup automation loop. Runtime=$runtimeSource DailyBackupTime=$DailyBackupTime"

$workerArgs = @(
    "artisan",
    "queue:work",
    "--queue=backups",
    "--tries=1",
    "--timeout=600"
)

function Start-PhpBackupWorker {
    $process = Start-Process -FilePath $PhpPath -ArgumentList $workerArgs -WorkingDirectory $backendDir -WindowStyle Hidden -PassThru
    Write-AutomationLog "Backup queue worker started. Pid=$($process.Id)"

    return $process
}

function Ensure-DockerBackupWorker {
    $output = & docker compose -f $composeFile --env-file $envFile up -d queue-worker 2>&1
    $exitCode = $LASTEXITCODE
    foreach ($line in $output) {
        Write-AutomationLog "queue-worker: $line"
    }

    if ($exitCode -ne 0) {
        throw "Docker queue-worker exited with code $exitCode."
    }
}

if ($isPhpMode) {
    $workerProcess = Start-PhpBackupWorker
} else {
    Ensure-DockerBackupWorker
    $workerProcess = $null
}
$lastHeartbeat = Get-Date

while ($true) {
    try {
        if ($isPhpMode) {
            if ($null -eq $workerProcess -or $workerProcess.HasExited) {
                if ($null -ne $workerProcess) {
                    Write-AutomationLog "Backup queue worker stopped with code $($workerProcess.ExitCode). Restarting."
                }

                $workerProcess = Start-PhpBackupWorker
            }
        }

        $now = Get-Date
        if (($now - $lastHeartbeat).TotalMinutes -ge 5) {
            if ($isDockerMode) {
                Ensure-DockerBackupWorker
                Write-AutomationLog "Heartbeat. Docker queue-worker ensured."
            } else {
                Write-AutomationLog "Heartbeat. WorkerPid=$($workerProcess.Id) WorkerExited=$($workerProcess.HasExited)"
            }
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
            if ($isDockerMode) {
                $backupOutput = & docker compose -f $composeFile --env-file $envFile exec -T backend php artisan hospital:backup --type=scheduled 2>&1
            } else {
                $backupOutput = & $PhpPath artisan hospital:backup --type=scheduled 2>&1
            }
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
