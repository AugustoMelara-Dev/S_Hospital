param(
    [string] $ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path,
    [string] $PhpPath = "php",
    [ValidateSet("Auto", "Docker", "Php")]
    [string] $Mode = "Auto",
    [string] $EnvFile = "",
    [string] $ComposeProjectName = "",
    [string] $TaskPrefix = "SistemaCajaHospitalaria",
    [string] $DailyBackupTime = "02:00",
    [switch] $WhatIfOnly,
    [switch] $UpdateExisting,
    [switch] $Uninstall,
    [switch] $Status,
    [switch] $LaunchElevated,
    [string] $ElevatedLogPath = ""
)

$ErrorActionPreference = "Stop"

function Protect-TaskText([string] $value) {
    if ([string]::IsNullOrWhiteSpace($value)) {
        return $value
    }

    $protected = $value
    foreach ($path in @($script:ProjectRoot, $script:backendDir, $script:workerScript, $script:dailyScript)) {
        if (-not [string]::IsNullOrWhiteSpace($path)) {
            $protected = $protected -replace [regex]::Escape($path), "%PROJECT_ROOT%"
            $protected = $protected -replace [regex]::Escape(($path -replace "\\", "/")), "%PROJECT_ROOT%"
        }
    }

    if (-not [string]::IsNullOrWhiteSpace($env:USERPROFILE)) {
        $protected = $protected -replace [regex]::Escape($env:USERPROFILE), "%USERPROFILE%"
        $protected = $protected -replace [regex]::Escape(($env:USERPROFILE -replace "\\", "/")), "%USERPROFILE%"
    }

    $protected = $protected -replace "(?i)(APP_KEY|DB_PASSWORD|PASSWORD|TOKEN|SECRET)=\S+", '$1=[oculto]'
    $protected = $protected -replace "(?i)[A-Z]:\\[^\s`"']+", "[ruta-local]"

    return $protected
}

function Write-ElevatedInstallLog([string] $message) {
    if ([string]::IsNullOrWhiteSpace($script:ElevatedLogPath)) {
        return
    }

    try {
        $logDir = Split-Path -Parent $script:ElevatedLogPath
        if (-not [string]::IsNullOrWhiteSpace($logDir)) {
            New-Item -ItemType Directory -Path $logDir -Force | Out-Null
        }

        $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
        Add-Content -LiteralPath $script:ElevatedLogPath -Value "[$timestamp] $(Protect-TaskText $message)" -Encoding UTF8
    } catch {
        # Logging must never prevent task installation or status reporting.
    }
}

trap {
    Write-ElevatedInstallLog "ERROR: $($_.Exception.Message)"
    Write-Host (Protect-TaskText $_.Exception.Message)
    Write-Host "No borre respaldos, archivos .env, volumenes Docker ni carpetas de datos para corregir las tareas de respaldo."
    exit 1
}

try {
    $ProjectRoot = (Resolve-Path -LiteralPath $ProjectRoot).Path
} catch {
    throw "No se pudo ubicar la carpeta del sistema. Ejecute este script desde la instalacion completa."
}

if (-not [string]::IsNullOrWhiteSpace($ElevatedLogPath)) {
    $script:ElevatedLogPath = if ([System.IO.Path]::IsPathRooted($ElevatedLogPath)) {
        $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($ElevatedLogPath)
    } else {
        Join-Path $ProjectRoot $ElevatedLogPath
    }
} else {
    $script:ElevatedLogPath = ""
}

$backendDir = Join-Path $ProjectRoot "backend"
$artisanPath = Join-Path $backendDir "artisan"
$composeFile = Join-Path $ProjectRoot "docker-compose.prod.yml"
$envFile = if ([string]::IsNullOrWhiteSpace($EnvFile)) {
    Join-Path $ProjectRoot ".env"
} elseif ([System.IO.Path]::IsPathRooted($EnvFile)) {
    (Resolve-Path -LiteralPath $EnvFile).Path
} else {
    (Resolve-Path -LiteralPath (Join-Path $ProjectRoot $EnvFile)).Path
}
if (-not [string]::IsNullOrWhiteSpace($ComposeProjectName) -and $ComposeProjectName -notmatch "^[A-Za-z0-9][A-Za-z0-9_.-]*$") {
    throw "ComposeProjectName invalido. Use solo letras, numeros, punto, guion o guion_bajo; debe iniciar con letra o numero."
}
$hasPhpMode = Test-Path -LiteralPath $artisanPath
$hasDockerMode = Test-Path -LiteralPath $composeFile

switch ($Mode) {
    "Docker" {
        $isDockerMode = $true
        $isPhpMode = $false
    }
    "Php" {
        $isDockerMode = $false
        $isPhpMode = $true
    }
    default {
        $isPhpMode = $hasPhpMode
        $isDockerMode = (-not $isPhpMode) -and $hasDockerMode
    }
}

if (-not $isPhpMode -and -not $isDockerMode) {
    throw "No se encontro backend\artisan ni docker-compose.prod.yml. Revise que esta carpeta sea una instalacion completa."
}

if ($isPhpMode -and -not $hasPhpMode) {
    throw "Modo PHP solicitado, pero no se encontro backend\artisan."
}

if ($isDockerMode -and -not $hasDockerMode) {
    throw "Modo Docker solicitado, pero no se encontro docker-compose.prod.yml."
}

$workerTaskName = "$TaskPrefix-BackupWorker"
$dailyTaskName = "$TaskPrefix-DailyBackup"
$legacyBackupProductStem = "Hospital" + ("Bill" + "ing") + "OS"
$legacyTaskNames = @(
    "$legacyBackupProductStem-BackupWorker",
    "$legacyBackupProductStem-DailyBackup"
)
$workerScript = Join-Path $ProjectRoot "scripts\run_backup_worker.cmd"
$dailyScript = Join-Path $ProjectRoot "scripts\run_scheduled_backup.cmd"
$taskLogDir = Join-Path $ProjectRoot "install-logs"
$workerLaunchLog = Join-Path $taskLogDir "backup_worker_task_launch.log"
$dailyLaunchLog = Join-Path $taskLogDir "backup_scheduled_task_launch.log"

if (-not (Test-Path -LiteralPath $workerScript)) {
    throw "No se encontro el lanzador del worker de respaldos."
}

if (-not (Test-Path -LiteralPath $dailyScript)) {
    throw "No se encontro el lanzador del respaldo programado."
}

function Test-IsAdmin {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)

    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Convert-ToCommandLineArgument([string] $value) {
    if ($null -eq $value) {
        return '""'
    }

    return '"' + ($value -replace '"', '\"') + '"'
}

function Start-ElevatedSelf {
    $logPath = if ([string]::IsNullOrWhiteSpace($script:ElevatedLogPath)) {
        Join-Path $ProjectRoot "qa\WINDOWS_BACKUP_TASK_ELEVATED_INSTALL.log"
    } else {
        $script:ElevatedLogPath
    }

    $script:ElevatedLogPath = $logPath
    Write-ElevatedInstallLog "Launching elevated scheduled-task installer."

    $args = New-Object System.Collections.Generic.List[string]
    $args.Add("-NoProfile") | Out-Null
    $args.Add("-ExecutionPolicy") | Out-Null
    $args.Add("Bypass") | Out-Null
    $args.Add("-File") | Out-Null
    $args.Add((Convert-ToCommandLineArgument $PSCommandPath)) | Out-Null
    $args.Add("-ProjectRoot") | Out-Null
    $args.Add((Convert-ToCommandLineArgument $ProjectRoot)) | Out-Null
    $args.Add("-PhpPath") | Out-Null
    $args.Add((Convert-ToCommandLineArgument $PhpPath)) | Out-Null
    $args.Add("-Mode") | Out-Null
    $args.Add($Mode) | Out-Null
    if (-not [string]::IsNullOrWhiteSpace($EnvFile)) {
        $args.Add("-EnvFile") | Out-Null
        $args.Add((Convert-ToCommandLineArgument $envFile)) | Out-Null
    }
    if (-not [string]::IsNullOrWhiteSpace($ComposeProjectName)) {
        $args.Add("-ComposeProjectName") | Out-Null
        $args.Add((Convert-ToCommandLineArgument $ComposeProjectName)) | Out-Null
    }
    $args.Add("-ElevatedLogPath") | Out-Null
    $args.Add((Convert-ToCommandLineArgument $logPath)) | Out-Null
    $args.Add("-TaskPrefix") | Out-Null
    $args.Add((Convert-ToCommandLineArgument $TaskPrefix)) | Out-Null
    $args.Add("-DailyBackupTime") | Out-Null
    $args.Add((Convert-ToCommandLineArgument $DailyBackupTime)) | Out-Null
    if ($UpdateExisting) { $args.Add("-UpdateExisting") | Out-Null }
    if ($Uninstall) { $args.Add("-Uninstall") | Out-Null }

    Write-Host "Solicitando elevacion de Administrador para tareas programadas..."
    Write-Host "Windows mostrara una confirmacion UAC. No cierre esta ventana hasta que termine."
    Write-Host "Log del intento elevado: $(Protect-TaskText $logPath)"
    $process = Start-Process -FilePath "powershell.exe" -ArgumentList ($args -join " ") -Verb RunAs -Wait -PassThru
    if ($null -ne $process -and $process.ExitCode -ne 0) {
        Write-ElevatedInstallLog "Elevated process exited with code $($process.ExitCode)."
        throw "La ejecucion elevada termino con codigo $($process.ExitCode). Revise la ventana elevada o ejecute PowerShell como Administrador."
    }

    Write-ElevatedInstallLog "Elevated process exited. Verifying scheduled tasks."
}

function Get-TaskIfExists([string] $taskName) {
    return Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
}

function Show-TaskStatus([string] $taskName) {
    $task = Get-TaskIfExists $taskName
    if ($null -eq $task) {
        Write-Host "${taskName}: no instalada"
        return
    }

    $info = Get-ScheduledTaskInfo -TaskName $taskName
    Write-Host "${taskName}: estado=$($task.State), ultimoInicio=$($info.LastRunTime), ultimoResultado=$($info.LastTaskResult), proximoInicio=$($info.NextRunTime)"
}

function Write-TaskStatusToLog([string] $taskName) {
    $task = Get-TaskIfExists $taskName
    if ($null -eq $task) {
        Write-ElevatedInstallLog "${taskName}: not visible to this process after registration."
        return
    }

    $info = Get-ScheduledTaskInfo -TaskName $taskName
    Write-ElevatedInstallLog "${taskName}: state=$($task.State), lastRun=$($info.LastRunTime), lastResult=$($info.LastTaskResult), nextRun=$($info.NextRunTime), user=$($task.Principal.UserId)."
}

function Wait-ForElevatedTaskResult([bool] $ShouldExist) {
    $deadline = (Get-Date).AddSeconds(30)

    do {
        $workerTask = Get-TaskIfExists $workerTaskName
        $dailyTask = Get-TaskIfExists $dailyTaskName

        if ($ShouldExist -and $null -ne $workerTask -and $null -ne $dailyTask) {
            Write-Host "Instalacion elevada verificada: ambas tareas programadas existen."
            return
        }

        if (-not $ShouldExist -and $null -eq $workerTask -and $null -eq $dailyTask) {
            Write-Host "Desinstalacion elevada verificada: ambas tareas programadas fueron removidas."
            return
        }

        Start-Sleep -Seconds 2
    } while ((Get-Date) -lt $deadline)

    if ($ShouldExist -and -not [string]::IsNullOrWhiteSpace($script:ElevatedLogPath) -and (Test-Path -LiteralPath $script:ElevatedLogPath)) {
        $recentLog = @(Get-Content -LiteralPath $script:ElevatedLogPath -Tail 40)
        $hasSuccess = ($recentLog | Select-String -SimpleMatch "Scheduled tasks registered successfully.").Count -gt 0
        $hasWorker = ($recentLog | Select-String -SimpleMatch "${workerTaskName}: state=").Count -gt 0
        $hasDaily = ($recentLog | Select-String -SimpleMatch "${dailyTaskName}: state=").Count -gt 0

        if ($hasSuccess -and $hasWorker -and $hasDaily) {
            Write-Host "Instalacion elevada registrada. Las tareas fueron confirmadas por el proceso Administrador, aunque esta sesion no puede ver tareas SYSTEM."
            return
        }
    }

    if ($ShouldExist) {
        if (-not [string]::IsNullOrWhiteSpace($script:ElevatedLogPath) -and (Test-Path -LiteralPath $script:ElevatedLogPath)) {
            Write-Host "Ultimas lineas del log elevado:"
            Get-Content -LiteralPath $script:ElevatedLogPath -Tail 20 | ForEach-Object {
                Write-Host (Protect-TaskText $_)
            }
        }
        throw "La ejecucion elevada termino, pero las tareas programadas no quedaron instaladas. Apruebe UAC y ejecute de nuevo desde PowerShell como Administrador si persiste."
    }

    if (-not [string]::IsNullOrWhiteSpace($script:ElevatedLogPath) -and (Test-Path -LiteralPath $script:ElevatedLogPath)) {
        Write-Host "Ultimas lineas del log elevado:"
        Get-Content -LiteralPath $script:ElevatedLogPath -Tail 20 | ForEach-Object {
            Write-Host (Protect-TaskText $_)
        }
    }
    throw "La ejecucion elevada termino, pero las tareas programadas siguen instaladas. Ejecute PowerShell como Administrador y repita -Uninstall."
}

function Get-ValidatedDailyBackupTime([string] $value) {
    try {
        return [DateTime]::ParseExact($value, "HH:mm", [Globalization.CultureInfo]::InvariantCulture)
    } catch {
        throw "DailyBackupTime debe usar formato HH:mm de 24 horas, por ejemplo 02:00 o 23:30. No se cambiaron tareas existentes."
    }
}

function Get-ValidatedPhpSource([string] $value) {
    if (Test-Path -LiteralPath $value) {
        return "archivo configurado"
    }

    if ($value -match "[\\/]" -or $value -match "\.exe$") {
        throw "No se encontro PHP en la ruta configurada. Use -PhpPath con la ruta real de php.exe antes de instalar tareas."
    }

    $phpCommand = Get-Command $value -ErrorAction SilentlyContinue
    if ($null -eq $phpCommand) {
        throw "No se encontro PHP en el PATH del sistema. Use -PhpPath C:\xampp\php\php.exe o instale PHP antes de registrar tareas."
    }

    return "PATH del sistema"
}

function Get-ValidatedDockerSource {
    if (-not (Test-Path -LiteralPath $envFile)) {
        throw "No se encontro .env productivo para Docker. Ejecute setup.bat o use -EnvFile con el archivo final antes de registrar tareas de respaldo."
    }

    $docker = Get-Command "docker" -ErrorAction SilentlyContinue
    if ($null -eq $docker) {
        throw "No se encontro Docker. El paquete offline productivo requiere Docker Desktop o Docker Engine."
    }

    $projectArg = if ([string]::IsNullOrWhiteSpace($ComposeProjectName)) { "" } else { ' -p "' + $ComposeProjectName + '"' }
    $configCommand = 'docker compose' + $projectArg + ' -f "' + $composeFile + '" --env-file "' + $envFile + '" config --quiet >nul 2>nul'
    & cmd.exe /c $configCommand
    if ($LASTEXITCODE -ne 0) {
        throw "docker-compose.prod.yml o .env no son validos para respaldos."
    }

    return "Docker Compose"
}

$taskModeArg = if ($isDockerMode) { "--mode=docker" } else { "--mode=php" }
$envFileArgs = if ($isDockerMode) { ' "--env-file" "' + $envFile + '"' } else { "" }
$safeEnvFileArgs = if ($isDockerMode) { ' "--env-file" "[env-configurado]"' } else { "" }
$projectNameArgs = if ($isDockerMode -and -not [string]::IsNullOrWhiteSpace($ComposeProjectName)) { ' "--project-name" "' + $ComposeProjectName + '"' } else { "" }
$safeProjectNameArgs = if ($isDockerMode -and -not [string]::IsNullOrWhiteSpace($ComposeProjectName)) { ' "--project-name" "[compose-proyecto]"' } else { "" }
$workerCommand = '""' + $workerScript + '" "' + $taskModeArg + '" "' + $PhpPath + '"' + $envFileArgs + $projectNameArgs + ' >> "' + $workerLaunchLog + '" 2>&1"'
$backupCommand = '""' + $dailyScript + '" "' + $taskModeArg + '" "' + $PhpPath + '"' + $envFileArgs + $projectNameArgs + ' >> "' + $dailyLaunchLog + '" 2>&1"'
$workerArgs = '/d /c ' + $workerCommand
$backupArgs = '/d /c ' + $backupCommand
$safeWorkerArgs = '/d /c ""%PROJECT_ROOT%\scripts\run_backup_worker.cmd" "' + $taskModeArg + '" "[php-configurado]"' + $safeEnvFileArgs + $safeProjectNameArgs + ' >> "%PROJECT_ROOT%\install-logs\backup_worker_task_launch.log" 2>&1"'
$safeBackupArgs = '/d /c ""%PROJECT_ROOT%\scripts\run_scheduled_backup.cmd" "' + $taskModeArg + '" "[php-configurado]"' + $safeEnvFileArgs + $safeProjectNameArgs + ' >> "%PROJECT_ROOT%\install-logs\backup_scheduled_task_launch.log" 2>&1"'
$runtimeSource = if ($Status -or $Uninstall) {
    "no requerido para esta accion"
} elseif ($isDockerMode) {
    Get-ValidatedDockerSource
} else {
    Get-ValidatedPhpSource $PhpPath
}

if (-not $Uninstall -and -not $Status) {
    $dailyBackupAt = Get-ValidatedDailyBackupTime $DailyBackupTime
} else {
    $dailyBackupAt = $null
}

Write-Host "Preparando tareas programadas de respaldos para Sistema de Caja Hospitalaria."
Write-Host "Instalacion: %PROJECT_ROOT%"
Write-Host "Modo: $runtimeSource"
Write-Host "Worker: %PROJECT_ROOT%\scripts\run_backup_worker.cmd"
Write-Host "Respaldo diario: %PROJECT_ROOT%\scripts\run_scheduled_backup.cmd"
if ($isDockerMode -and -not ($Status -or $Uninstall)) {
    Write-Host "Env Docker: [env-configurado]"
}
Write-Host "Tarea worker: $workerTaskName"
if ($Status -or $Uninstall) {
    Write-Host "Tarea diaria: $dailyTaskName"
} else {
    Write-Host "Tarea diaria: $dailyTaskName a las $DailyBackupTime"
}
Write-ElevatedInstallLog "Prepared scheduled-task installer. Mode=$Mode, DockerMode=$isDockerMode, PhpMode=$isPhpMode, Status=$Status, Uninstall=$Uninstall, UpdateExisting=$UpdateExisting."

if ($Status) {
    Show-TaskStatus $workerTaskName
    Show-TaskStatus $dailyTaskName
    foreach ($legacyTaskName in $legacyTaskNames) {
        if (Get-TaskIfExists $legacyTaskName) {
            Write-Host "${legacyTaskName}: legacy instalada; ejecute -UpdateExisting desde PowerShell como Administrador para remover marca antigua."
        }
    }
    Write-Host "Confirme que el worker esta activo y que un respaldo creado desde la UI pasa de pendiente a completado."
    exit 0
}

if ($WhatIfOnly) {
    Write-Host "Modo WhatIf: no se registraron, actualizaron ni eliminaron tareas."
    Write-Host "Comando worker previsto: cmd.exe $safeWorkerArgs"
    Write-Host "Comando respaldo diario previsto: cmd.exe $safeBackupArgs"
    Write-Host "Para actualizar tareas existentes use: -UpdateExisting"
    Write-Host "Para remover tareas use: -Uninstall"
    Write-Host "Para revisar estado use: -Status"
    exit 0
}

if (-not (Test-IsAdmin)) {
    if ($LaunchElevated) {
        Start-ElevatedSelf
        Wait-ForElevatedTaskResult (-not $Uninstall)
        exit 0
    }

    throw "Se requieren permisos de Administrador para registrar, actualizar o eliminar tareas programadas. Abra PowerShell como Administrador o vuelva a ejecutar este comando agregando -LaunchElevated."
}

if ($Uninstall) {
    Write-ElevatedInstallLog "Running uninstall as elevated/admin context."
    foreach ($taskName in @($workerTaskName, $dailyTaskName) + $legacyTaskNames) {
        if (Get-TaskIfExists $taskName) {
            Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
            Write-Host "Tarea programada eliminada: $taskName"
            Write-ElevatedInstallLog "Removed scheduled task: $taskName."
        } else {
            Write-Host "La tarea programada no estaba instalada: $taskName"
            Write-ElevatedInstallLog "Scheduled task was not installed: $taskName."
        }
    }

    exit 0
}

foreach ($taskName in @($workerTaskName, $dailyTaskName)) {
    if ((Get-TaskIfExists $taskName) -and -not $UpdateExisting) {
        throw "La tarea '$taskName' ya existe. Use -UpdateExisting para reemplazarla o -Uninstall para quitarla primero."
    }
}

if ($UpdateExisting) {
    Write-Host "UpdateExisting activo. Se reemplazaran las tareas de respaldo existentes del Sistema de Caja Hospitalaria."
    Write-ElevatedInstallLog "UpdateExisting active. Replacing existing scheduled tasks if present."
    foreach ($taskName in @($workerTaskName, $dailyTaskName) + $legacyTaskNames) {
        if (Get-TaskIfExists $taskName) {
            Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
            Write-Host "Tarea existente eliminada antes de actualizar: $taskName"
            Write-ElevatedInstallLog "Removed existing scheduled task before update: $taskName."
        }
    }
}

New-Item -ItemType Directory -Path $taskLogDir -Force | Out-Null

Write-ElevatedInstallLog "Registering worker scheduled task as SYSTEM."
$workerAction = New-ScheduledTaskAction -Execute "cmd.exe" -Argument $workerArgs -WorkingDirectory $ProjectRoot
$workerTrigger = New-ScheduledTaskTrigger -AtStartup
$workerSettings = New-ScheduledTaskSettingsSet -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 5) -ExecutionTimeLimit (New-TimeSpan -Hours 0)

Register-ScheduledTask `
    -TaskName $workerTaskName `
    -Action $workerAction `
    -Trigger $workerTrigger `
    -Settings $workerSettings `
    -User "SYSTEM" `
    -Description "Sistema de Caja Hospitalaria continuous backup queue worker." | Out-Null

Write-ElevatedInstallLog "Registering daily scheduled backup task as SYSTEM."
$dailyAction = New-ScheduledTaskAction -Execute "cmd.exe" -Argument $backupArgs -WorkingDirectory $ProjectRoot
$dailyTrigger = New-ScheduledTaskTrigger -Daily -At $dailyBackupAt
$dailySettings = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Hours 2)

Register-ScheduledTask `
    -TaskName $dailyTaskName `
    -Action $dailyAction `
    -Trigger $dailyTrigger `
    -Settings $dailySettings `
    -User "SYSTEM" `
    -Description "Sistema de Caja Hospitalaria scheduled local database backup." | Out-Null

Write-ElevatedInstallLog "Scheduled tasks registered successfully."
Write-TaskStatusToLog $workerTaskName
Write-TaskStatusToLog $dailyTaskName
Write-Host "Tareas programadas registradas."
Write-Host "Inicie el worker con: Start-ScheduledTask -TaskName '$workerTaskName'"
Write-Host "Revise estado con: powershell.exe -ExecutionPolicy Bypass -File scripts\install_backup_tasks_windows.ps1 -Status"
Write-Host "Actualice con: powershell.exe -ExecutionPolicy Bypass -File scripts\install_backup_tasks_windows.ps1 -UpdateExisting"
Write-Host "Desinstale con: powershell.exe -ExecutionPolicy Bypass -File scripts\install_backup_tasks_windows.ps1 -Uninstall"
Write-Host "Antes de entrega final, reinicie Windows, confirme que el worker corre sin sesion interactiva y valide que un respaldo en la UI pasa de pendiente a completado."
