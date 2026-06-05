param(
    [string] $ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path,
    [string] $Url = 'https://127.0.0.1',
    [switch] $InstallStartupTask,
    [switch] $WhatIfOnly
)

$ErrorActionPreference = 'Stop'

$scriptRoot = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
. (Join-Path $scriptRoot 'lib\operational_url_safety.ps1')

function Protect-ShortcutText([string] $value) {
    if ([string]::IsNullOrWhiteSpace($value)) {
        return $value
    }

    $protected = $value

    if (-not [string]::IsNullOrWhiteSpace($script:ProjectRoot)) {
        $protected = $protected -replace [regex]::Escape($script:ProjectRoot), "%PROJECT_ROOT%"
        $protected = $protected -replace [regex]::Escape(($script:ProjectRoot -replace "\\", "/")), "%PROJECT_ROOT%"
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
    Write-Host (Protect-ShortcutText $_.Exception.Message)
    Write-Host 'No borre datos, respaldos, archivos .env ni volumenes Docker. Revise la URL LAN y la carpeta instalada antes de repetir.'
    exit 1
}

$shortcutName = 'Abrir Sistema de Caja Hospitalaria.lnk'
$desktop = [Environment]::GetFolderPath('Desktop')
$shortcutPath = Join-Path $desktop $shortcutName
$openScript = Join-Path $ProjectRoot 'scripts\open_hospital_system.ps1'

$Url = Test-HospitalOperationalUrlInput $Url

if (-not (Test-Path -LiteralPath $ProjectRoot -PathType Container)) {
    throw 'No se encontro la carpeta instalada del sistema. Ejecute este script desde la carpeta de S_Hospital.'
}

if (-not (Test-Path -LiteralPath $openScript -PathType Leaf)) {
    throw 'No se encontro el script para abrir el sistema. Verifique que la instalacion este completa antes de crear el acceso directo.'
}

if ([string]::IsNullOrWhiteSpace($desktop) -or -not (Test-Path -LiteralPath $desktop -PathType Container)) {
    throw 'No se encontro el escritorio de Windows para crear el acceso directo.'
}

if ($WhatIfOnly) {
    Write-Host 'Validacion del acceso directo completada.'
    Write-Host "Carpeta del sistema: $(Protect-ShortcutText $ProjectRoot)"
    Write-Host "Destino del acceso directo: $(Protect-ShortcutText $shortcutPath)"
    Write-Host 'Modo WhatIf: no se creo acceso directo ni tarea de inicio.'
    exit 0
}

$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = 'powershell.exe'
$shortcut.Arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$openScript`" -Url `"$Url`""
$shortcut.WorkingDirectory = $ProjectRoot
$shortcut.IconLocation = "$env:SystemRoot\System32\shell32.dll,220"
$shortcut.Save()

Write-Host 'Acceso directo creado en el escritorio: Abrir Sistema de Caja Hospitalaria'

if ($InstallStartupTask) {
    $taskName = 'SistemaCajaHospitalaria-AbrirSistema'
    $action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$openScript`" -Url `"$Url`""
    $trigger = New-ScheduledTaskTrigger -AtLogOn
    $principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive
    Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Force | Out-Null
    Write-Host "Tarea de inicio de sesion creada: $taskName"
}
