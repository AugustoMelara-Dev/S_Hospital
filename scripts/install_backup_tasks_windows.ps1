param(
    [string] $ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path,
    [string] $PhpPath = "php",
    [string] $TaskPrefix = "SistemaCajaHospitalaria",
    [string] $DailyBackupTime = "02:00",
    [switch] $WhatIfOnly,
    [switch] $UpdateExisting,
    [switch] $Uninstall,
    [switch] $Status,
    [switch] $Wizard
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

trap {
    Write-Host (Protect-TaskText $_.Exception.Message)
    Write-Host "No borre respaldos, archivos .env, volumenes Docker ni carpetas de datos para corregir las tareas de respaldo."
    exit 1
}

try {
    $ProjectRoot = (Resolve-Path -LiteralPath $ProjectRoot).Path
} catch {
    throw "No se pudo ubicar la carpeta del sistema. Ejecute este script desde la instalacion completa."
}

# -----------------------------------------------------------------------------
# Modo Wizard
# -----------------------------------------------------------------------------
# Activado con -Wizard, hace preguntas secuenciales con valores por
# defecto razonables. Pensado para operadores no tecnicos que no
# conocen los flags del script. La opcion por defecto se muestra
# entre corchetes y basta con presionar Enter para aceptarla.
if ($Wizard) {
    Write-Host "==================================================================="
    Write-Host " S_Hospital - Asistente de tareas de respaldo"
    Write-Host "==================================================================="
    Write-Host "Responda las preguntas. Presione Enter para aceptar el valor por defecto."
    Write-Host ""

    $response = Read-Host "Carpeta del sistema [$ProjectRoot]"
    if (-not [string]::IsNullOrWhiteSpace($response)) {
        $ProjectRoot = $response
        try {
            $ProjectRoot = (Resolve-Path -LiteralPath $ProjectRoot).Path
        } catch {
            throw "Carpeta invalida: $ProjectRoot"
        }
    }

    $response = Read-Host "Prefijo de tareas programadas [$TaskPrefix]"
    if (-not [string]::IsNullOrWhiteSpace($response)) {
        $TaskPrefix = $response
    }

    $response = Read-Host "Hora del respaldo diario (formato HH:MM) [$DailyBackupTime]"
    if (-not [string]::IsNullOrWhiteSpace($response)) {
        if ($response -notmatch '^\d{2}:\d{2}$') {
            throw "Formato de hora invalido. Use HH:MM, por ejemplo 02:00."
        }
        $DailyBackupTime = $response
    }

    Write-Host ""
    Write-Host "Accion a realizar:"
    Write-Host "  1) Instalar tareas (predeterminado)"
    Write-Host "  2) Simular (no hace cambios, solo muestra)"
    Write-Host "  3) Ver estado actual"
    Write-Host "  4) Desinstalar tareas"
    $action = Read-Host "Opcion [1]"
    switch ($action) {
        "" { $action = "1" }
        "2" {
            $WhatIfOnly = $true
            Write-Host "Modo simulacion activado."
        }
        "3" {
            $Status = $true
            $Uninstall = $false
            $WhatIfOnly = $false
        }
        "4" {
            $Uninstall = $true
            $Status = $false
            $WhatIfOnly = $false
            Write-Host "Modo desinstalar activado."
        }
        default {
            Write-Host "Opcion no valida. Continuando con instalacion."
        }
    }

    if (-not $Status -and -not $Uninstall -and -not $WhatIfOnly) {
        $response = Read-Host "Si las tareas ya existen, sobreescribirlas? (s/N)"
        if ($response -match '^[sS]$') {
            $UpdateExisting = $true
        }
    }

    Write-Host ""
    Write-Host "Resumen de la operacion:"
    Write-Host "  Carpeta:       $ProjectRoot"
    Write-Host "  Prefijo:       $TaskPrefix"
    Write-Host "  Hora diaria:   $DailyBackupTime"
    Write-Host "  Accion:        $(if ($Uninstall) { 'Desinstalar' } elseif ($Status) { 'Ver estado' } elseif ($WhatIfOnly) { 'Simular' } else { 'Instalar' })"
    $confirm = Read-Host "Continuar? (S/n)"
    if ($confirm -match '^[nN]$') {
        Write-Host "Operacion cancelada por el operador."
        exit 0
    }
    Write-Host ""
}

$backendDir = Join-Path $ProjectRoot "backend"
$artisanPath = Join-Path $backendDir "artisan"
$composeFile = Join-Path $ProjectRoot "docker-compose.prod.yml"
$envFile = Join-Path $ProjectRoot ".env"
$isPhpMode = Test-Path -LiteralPath $artisanPath
$isDockerMode = (-not $isPhpMode) -and (Test-Path -LiteralPath $composeFile)

if (-not $isPhpMode -and -not $isDockerMode) {
    throw "No se encontro backend\artisan ni docker-compose.prod.yml. Revise que esta carpeta sea una instalacion completa."
}

$workerTaskName = "$TaskPrefix-BackupWorker"
$dailyTaskName = "$TaskPrefix-DailyBackup"
$workerScript = Join-Path $ProjectRoot "scripts\run_backup_worker.cmd"
$dailyScript = Join-Path $ProjectRoot "scripts\run_scheduled_backup.cmd"

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
        throw "No se encontro .env productivo. Ejecute setup.bat antes de registrar tareas de respaldo Docker."
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

    return "Docker Compose"
}

$workerArgs = '/c "' + $workerScript + '" "' + $PhpPath + '"'
$backupArgs = '/c "' + $dailyScript + '" "' + $PhpPath + '"'
$safeWorkerArgs = '/c "%PROJECT_ROOT%\scripts\run_backup_worker.cmd" "[php-configurado]"'
$safeBackupArgs = '/c "%PROJECT_ROOT%\scripts\run_scheduled_backup.cmd" "[php-configurado]"'
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
Write-Host "Tarea worker: $workerTaskName"
if ($Status -or $Uninstall) {
    Write-Host "Tarea diaria: $dailyTaskName"
} else {
    Write-Host "Tarea diaria: $dailyTaskName a las $DailyBackupTime"
}

if ($Status) {
    Show-TaskStatus $workerTaskName
    Show-TaskStatus $dailyTaskName
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
    throw "Se requieren permisos de Administrador para registrar, actualizar o eliminar tareas programadas. Abra PowerShell como Administrador."
}

if ($Uninstall) {
    foreach ($taskName in @($workerTaskName, $dailyTaskName)) {
        if (Get-TaskIfExists $taskName) {
            Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
            Write-Host "Tarea programada eliminada: $taskName"
        } else {
            Write-Host "La tarea programada no estaba instalada: $taskName"
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
    foreach ($taskName in @($workerTaskName, $dailyTaskName)) {
        if (Get-TaskIfExists $taskName) {
            Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
            Write-Host "Tarea existente eliminada antes de actualizar: $taskName"
        }
    }
}

$workerAction = New-ScheduledTaskAction -Execute "cmd.exe" -Argument $workerArgs -WorkingDirectory $ProjectRoot
$workerTrigger = New-ScheduledTaskTrigger -AtLogOn
$workerSettings = New-ScheduledTaskSettingsSet -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 5) -ExecutionTimeLimit (New-TimeSpan -Hours 0)

Register-ScheduledTask `
    -TaskName $workerTaskName `
    -Action $workerAction `
    -Trigger $workerTrigger `
    -Settings $workerSettings `
    -Description "Sistema de Caja Hospitalaria continuous backup queue worker." | Out-Null

$dailyAction = New-ScheduledTaskAction -Execute "cmd.exe" -Argument $backupArgs -WorkingDirectory $ProjectRoot
$dailyTrigger = New-ScheduledTaskTrigger -Daily -At $dailyBackupAt
$dailySettings = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Hours 2)

Register-ScheduledTask `
    -TaskName $dailyTaskName `
    -Action $dailyAction `
    -Trigger $dailyTrigger `
    -Settings $dailySettings `
    -Description "Sistema de Caja Hospitalaria scheduled local database backup." | Out-Null

Write-Host "Tareas programadas registradas."
Write-Host "Inicie el worker con: Start-ScheduledTask -TaskName '$workerTaskName'"
Write-Host "Revise estado con: powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\install_backup_tasks_windows.ps1 -Status"
Write-Host "Actualice con: powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\install_backup_tasks_windows.ps1 -UpdateExisting"
Write-Host "Desinstale con: powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\install_backup_tasks_windows.ps1 -Uninstall"
Write-Host "Antes de entrega final, valide que un respaldo en la UI pasa de pendiente a completado."
