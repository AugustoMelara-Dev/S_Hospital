param(
    [string] $ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path,
    [string] $Url = 'http://127.0.0.1:8000',
    [switch] $InstallStartupTask
)

$ErrorActionPreference = 'Stop'

$shortcutName = 'Abrir Sistema de Caja Hospitalaria.lnk'
$desktop = [Environment]::GetFolderPath('Desktop')
$shortcutPath = Join-Path $desktop $shortcutName
$openScript = Join-Path $ProjectRoot 'scripts\open_hospital_system.ps1'

if (-not (Test-Path $openScript)) {
    throw "No existe $openScript"
}

$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = 'powershell.exe'
$shortcut.Arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$openScript`" -Url `"$Url`""
$shortcut.WorkingDirectory = $ProjectRoot
$shortcut.IconLocation = "$env:SystemRoot\System32\shell32.dll,220"
$shortcut.Save()

Write-Host "Acceso directo creado: $shortcutPath"

if ($InstallStartupTask) {
    $taskName = 'SistemaCajaHospitalaria-AbrirSistema'
    $action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$openScript`" -Url `"$Url`""
    $trigger = New-ScheduledTaskTrigger -AtLogOn
    $principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive
    Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Force | Out-Null
    Write-Host "Tarea de inicio de sesion creada: $taskName"
}
