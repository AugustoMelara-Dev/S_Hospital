param(
    [string] $ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path,
    [string] $TaskName = "SistemaCajaHospitalaria-StackAutostart",
    [switch] $WhatIfOnly,
    [switch] $UpdateExisting,
    [switch] $Uninstall,
    [switch] $Status
)

$ErrorActionPreference = "Stop"

function Protect-AutostartText([string] $value) {
    if ([string]::IsNullOrWhiteSpace($value)) {
        return $value
    }

    $protected = $value
    foreach ($path in @($script:ProjectRoot, $script:startScript)) {
        if (-not [string]::IsNullOrWhiteSpace($path)) {
            $protected = $protected -replace [regex]::Escape($path), "%PROJECT_ROOT%"
            $protected = $protected -replace [regex]::Escape(($path -replace "\\", "/")), "%PROJECT_ROOT%"
        }
    }

    if (-not [string]::IsNullOrWhiteSpace($env:USERPROFILE)) {
        $protected = $protected -replace [regex]::Escape($env:USERPROFILE), "%USERPROFILE%"
        $protected = $protected -replace [regex]::Escape(($env:USERPROFILE -replace "\\", "/")), "%USERPROFILE%"
    }

    $protected = $protected -replace "(?i)(APP_KEY|DB_PASSWORD|PASSWORD|TOKEN|SECRET|MAIL_PASSWORD)\s*[:=]\s*[^,\s\]\)]+", '$1=[redacted]'
    $protected = $protected -replace "(?i)[A-Z]:\\[^\s`"']+", "[ruta-local]"

    return $protected
}

trap {
    Write-Host (Protect-AutostartText $_.Exception.Message)
    Write-Host "No borre datos, respaldos, archivos .env ni volumenes Docker para corregir el autoarranque."
    exit 1
}

try {
    $ProjectRoot = (Resolve-Path -LiteralPath $ProjectRoot).Path
} catch {
    throw "No se pudo ubicar la carpeta del sistema. Ejecute este script desde la instalacion completa."
}

if ([string]::IsNullOrWhiteSpace($TaskName) -or $TaskName -notmatch '^[A-Za-z0-9_-]{3,80}$') {
    throw "TaskName debe tener 3 a 80 caracteres y usar solo letras, numeros, guion o guion bajo."
}

$startScript = Join-Path $ProjectRoot "scripts\start_hospital_services.ps1"

if (-not (Test-Path -LiteralPath $startScript -PathType Leaf)) {
    throw "No se encontro el script de arranque del sistema."
}

function Test-IsAdmin {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)

    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Get-TaskIfExists([string] $name) {
    return Get-ScheduledTask -TaskName $name -ErrorAction SilentlyContinue
}

Write-Host "Preparando autoarranque del Sistema de Caja Hospitalaria."
Write-Host "Instalacion: %PROJECT_ROOT%"
Write-Host "Tarea: $TaskName"
Write-Host "Accion: powershell.exe -NoProfile -ExecutionPolicy Bypass -File %PROJECT_ROOT%\scripts\start_hospital_services.ps1"

if ($Status) {
    $task = Get-TaskIfExists $TaskName
    if ($null -eq $task) {
        Write-Host "${TaskName}: no instalada"
        exit 0
    }

    $info = Get-ScheduledTaskInfo -TaskName $TaskName
    Write-Host "${TaskName}: estado=$($task.State), ultimoInicio=$($info.LastRunTime), ultimoResultado=$($info.LastTaskResult), proximoInicio=$($info.NextRunTime)"
    Write-Host "Confirme despues de reiniciar Windows que el sistema abre por la URL LAN sin levantar servicios manualmente."
    exit 0
}

if ($WhatIfOnly) {
    Write-Host "Modo WhatIf: no se registro, actualizo ni elimino la tarea de autoarranque."
    Write-Host "Trigger previsto: AtStartup."
    Write-Host "Para instalar o actualizar use PowerShell como Administrador con: -UpdateExisting"
    Write-Host "Para revisar estado use: -Status"
    exit 0
}

if (-not (Test-IsAdmin)) {
    throw "Se requieren permisos de Administrador para registrar, actualizar o eliminar la tarea de autoarranque del stack."
}

if ($Uninstall) {
    if (Get-TaskIfExists $TaskName) {
        Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
        Write-Host "Tarea de autoarranque eliminada: $TaskName"
    } else {
        Write-Host "La tarea de autoarranque no estaba instalada: $TaskName"
    }

    exit 0
}

if ((Get-TaskIfExists $TaskName) -and -not $UpdateExisting) {
    throw "La tarea '$TaskName' ya existe. Use -UpdateExisting para reemplazarla o -Uninstall para quitarla primero."
}

if ($UpdateExisting -and (Get-TaskIfExists $TaskName)) {
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
    Write-Host "Tarea existente eliminada antes de actualizar: $TaskName"
}

$action = New-ScheduledTaskAction `
    -Execute "powershell.exe" `
    -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$startScript`"" `
    -WorkingDirectory $ProjectRoot
$trigger = New-ScheduledTaskTrigger -AtStartup
$settings = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -RestartCount 3 `
    -RestartInterval (New-TimeSpan -Minutes 5) `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 20)

Register-ScheduledTask `
    -TaskName $TaskName `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -Description "Inicia los servicios locales del Sistema de Caja Hospitalaria cuando Windows arranca." | Out-Null

Write-Host "Tarea de autoarranque registrada: $TaskName"
Write-Host "Revise estado con: powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\install_stack_autostart_windows.ps1 -Status"
Write-Host "Despues de reiniciar, valide que el sistema abre desde otra computadora por la URL LAN."
