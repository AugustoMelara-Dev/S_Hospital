#Requires -RunAsAdministrator
<#
Retira una instalacion nativa de S_Hospital para reinstalar desde cero.
No borra datos: la carpeta de datos se MUEVE a un respaldo con fecha.
Uso (administrador):
  powershell -NoProfile -ExecutionPolicy Bypass -File remove_native_installation.ps1 [-BackupRoot C:\S_Hospital_respaldos]
#>
param(
    [string] $InstallRoot = (Join-Path $env:ProgramFiles 'S_Hospital'),
    [string] $DataRoot = (Join-Path $env:ProgramData 'S_Hospital'),
    [string] $BackupRoot = 'C:\S_Hospital_respaldos'
)
$ErrorActionPreference = 'Stop'
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$log = New-Object System.Collections.Generic.List[string]
function Note([string] $m) { $log.Add("$(Get-Date -Format s) $m"); Write-Host $m }

$services = Get-Service -Name 'SHospital*' -ErrorAction SilentlyContinue
foreach ($svc in $services) {
    if ($svc.Status -ne 'Stopped') { Stop-Service -Name $svc.Name -Force -ErrorAction SilentlyContinue; Note "Servicio detenido: $($svc.Name)" }
}
Start-Sleep -Seconds 3
foreach ($svc in $services) {
    & sc.exe delete $svc.Name | Out-Null
    Note "Servicio eliminado: $($svc.Name)"
}

foreach ($name in @('mariadbd','php-cgi','caddy')) {
    Get-Process -Name $name -ErrorAction SilentlyContinue | Where-Object { $_.Path -like "$InstallRoot*" } | ForEach-Object {
        Stop-Process -Id $_.Id -Force; Note "Proceso detenido: $($_.Name) $($_.Id)"
    }
}

$shortcuts = @(
    (Join-Path ([Environment]::GetFolderPath('CommonDesktopDirectory')) 'S_Hospital.lnk'),
    (Join-Path ([Environment]::GetFolderPath('CommonStartup')) 'S_Hospital.lnk'),
    (Join-Path ([Environment]::GetFolderPath('CommonPrograms')) 'S_Hospital')
)
foreach ($s in $shortcuts) { if (Test-Path -LiteralPath $s) { Remove-Item -LiteralPath $s -Recurse -Force; Note "Acceso eliminado: $s" } }

New-Item -ItemType Directory -Force -Path $BackupRoot | Out-Null
if (Test-Path -LiteralPath $DataRoot) {
    $dest = Join-Path $BackupRoot "datos-$stamp"
    Move-Item -LiteralPath $DataRoot -Destination $dest
    & icacls.exe $dest /grant "*S-1-5-32-544:(OI)(CI)F" /T /C /Q | Out-Null
    Note "Datos movidos a respaldo: $dest"
}
if (Test-Path -LiteralPath $InstallRoot) {
    Get-ChildItem -LiteralPath $InstallRoot -Force | Where-Object { $_.Attributes -band [IO.FileAttributes]::ReparsePoint } | ForEach-Object { $_.Delete() }
    Remove-Item -LiteralPath $InstallRoot -Recurse -Force
    Note "Programa eliminado: $InstallRoot"
}

$remaining = @(Get-Service -Name 'SHospital*' -ErrorAction SilentlyContinue).Count
Note "Servicios restantes: $remaining"
$logPath = Join-Path $BackupRoot "retiro-$stamp.log"
$log | Set-Content -LiteralPath $logPath -Encoding UTF8
Write-Host "Registro: $logPath"
