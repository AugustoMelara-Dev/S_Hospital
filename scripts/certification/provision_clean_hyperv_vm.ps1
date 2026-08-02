[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string] $IsoPath,
    [Parameter(Mandatory = $true)]
    [string] $IsoSourceDeclaration,
    [Parameter(Mandatory = $true)]
    [string] $SwitchName,
    [string] $VMName = 'S-Hospital-Cert-Win11-2026',
    [string] $VmRoot = 'C:\Hyper-V\S-Hospital-Cert-Win11-2026',
    [UInt64] $MemoryBytes = 12GB,
    [int] $ProcessorCount = 4,
    [UInt64] $DiskSizeBytes = 100GB
)

$ErrorActionPreference = 'Stop'
$createdVm = $false
$vhdPath = Join-Path $VmRoot 'Virtual Hard Disks\S-Hospital-Cert-Win11-2026.vhdx'

function Stop-Provisioning {
    param([string] $Message)
    throw "PROVISIONING_BLOCKED: $Message"
}

if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Stop-Provisioning 'Abra PowerShell como administrador en un host Windows compatible con Hyper-V.'
}
foreach ($commandName in @('Get-VM', 'Get-VMHost', 'Get-VMSwitch', 'New-VM', 'New-VHD', 'Add-VMHardDiskDrive', 'Set-VMFirmware', 'Set-VMProcessor', 'Checkpoint-VM')) {
    if ($null -eq (Get-Command $commandName -ErrorAction SilentlyContinue)) {
        Stop-Provisioning "No esta disponible el cmdlet $commandName. Hyper-V no esta accesible en este host."
    }
}
if (-not (Test-Path -LiteralPath $IsoPath -PathType Leaf)) {
    Stop-Provisioning "No existe la ISO indicada: $IsoPath"
}
$iso = Get-Item -LiteralPath $IsoPath
if ($iso.Extension -ine '.iso') {
    Stop-Provisioning 'La ruta indicada no tiene extension .iso.'
}
if ([string]::IsNullOrWhiteSpace($IsoSourceDeclaration)) {
    Stop-Provisioning 'Debe declararse el origen oficial de la ISO; no se aceptan origenes no declarados.'
}
$parentRoot = Split-Path -Parent $VmRoot
if (-not (Test-Path -LiteralPath $parentRoot -PathType Container)) {
    Stop-Provisioning "El padre de VmRoot no existe; no se creara una ruta no verificada: $parentRoot"
}
if (Test-Path -LiteralPath $VmRoot) {
    Stop-Provisioning "VmRoot ya existe; no se reutilizaran carpetas: $VmRoot"
}
if (Get-VM -Name $VMName -ErrorAction SilentlyContinue) {
    Stop-Provisioning "Ya existe una VM con el nombre $VMName; no se reutilizaran VMs existentes."
}
if (Test-Path -LiteralPath $vhdPath) {
    Stop-Provisioning "Ya existe el VHDX destino; no se reutilizaran discos: $vhdPath"
}
if ($ProcessorCount -lt 4) {
    Stop-Provisioning 'La VM requiere al menos 4 procesadores virtuales.'
}
if ($MemoryBytes -lt 8GB) {
    Stop-Provisioning 'La VM requiere al menos 8 GB de RAM.'
}
if ($DiskSizeBytes -lt 100GB) {
    Stop-Provisioning 'La VM requiere un VHDX nuevo de al menos 100 GB.'
}

$switch = Get-VMSwitch -Name $SwitchName -ErrorAction SilentlyContinue
if ($null -eq $switch) {
    Stop-Provisioning "No existe el switch controlado indicado: $SwitchName. No se modificaran redes automaticamente."
}
$hostInfo = Get-CimInstance -ClassName Win32_ComputerSystem
$osInfo = Get-CimInstance -ClassName Win32_OperatingSystem
$freeMemoryBytes = [UInt64]$osInfo.FreePhysicalMemory * 1KB
if ($freeMemoryBytes -lt ($MemoryBytes + 2GB)) {
    Stop-Provisioning "Memoria libre insuficiente. Libre=$freeMemoryBytes, requerida con margen=$($MemoryBytes + 2GB)."
}
$driveName = ([System.IO.Path]::GetPathRoot($VmRoot)).TrimEnd(':\')
$drive = Get-PSDrive -Name $driveName -ErrorAction SilentlyContinue
if ($null -eq $drive) {
    Stop-Provisioning "No se pudo consultar el volumen de destino $driveName."
}
if ([UInt64]$drive.Free -lt ($DiskSizeBytes + 20GB)) {
    Stop-Provisioning "Espacio libre insuficiente en $driveName. Libre=$($drive.Free), requerido=$($DiskSizeBytes + 20GB)."
}

$isoHash = (Get-FileHash -LiteralPath $iso.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
$isoRecord = [ordered]@{
    path = $iso.FullName
    name = $iso.Name
    size_bytes = [int64]$iso.Length
    sha256 = $isoHash
    source_declared_by_operator = $IsoSourceDeclaration
}

try {
    New-Item -ItemType Directory -Path $VmRoot -Force | Out-Null
    New-Item -ItemType Directory -Path (Split-Path -Parent $vhdPath) -Force | Out-Null
    New-VM -Name $VMName -Generation 2 -MemoryStartupBytes $MemoryBytes -NoVHD -SwitchName $SwitchName | Out-Null
    $createdVm = $true
    Set-VMMemory -VMName $VMName -DynamicMemoryEnabled $false
    Set-VMProcessor -VMName $VMName -Count $ProcessorCount
    Set-VMProcessor -VMName $VMName -ExposeVirtualizationExtensions $true
    Set-VMFirmware -VMName $VMName -EnableSecureBoot On -SecureBootTemplate 'MicrosoftWindows'
    New-VHD -Path $vhdPath -SizeBytes $DiskSizeBytes -Dynamic | Out-Null
    Add-VMHardDiskDrive -VMName $VMName -Path $vhdPath
    $dvd = Get-VMDvdDrive -VMName $VMName -ErrorAction SilentlyContinue
    if ($null -eq $dvd) {
        Add-VMDvdDrive -VMName $VMName | Out-Null
        $dvd = Get-VMDvdDrive -VMName $VMName
    }
    Set-VMDvdDrive -VMName $VMName -ControllerNumber $dvd.ControllerNumber -ControllerLocation $dvd.ControllerLocation -Path $iso.FullName
    if ($null -ne (Get-Command Set-VMKeyProtector -ErrorAction SilentlyContinue) -and $null -ne (Get-Command Enable-VMTPM -ErrorAction SilentlyContinue)) {
        Set-VMKeyProtector -VMName $VMName -NewLocalKeyProtector
        Enable-VMTPM -VMName $VMName
    } else {
        Stop-Provisioning 'El host no expone soporte de TPM virtual requerido para Windows 11.'
    }
    Set-VM -Name $VMName -AutomaticStopAction ShutDown -AutomaticStartAction Nothing | Out-Null
    Checkpoint-VM -VMName $VMName -SnapshotName '00-Before-Windows-Install' | Out-Null
    $record = [ordered]@{
        timestamp_utc = (Get-Date).ToUniversalTime().ToString('o')
        vm_name = $VMName
        generation = 2
        processor_count = $ProcessorCount
        memory_bytes = [int64]$MemoryBytes
        vhdx_path = $vhdPath
        vhdx_size_bytes = [int64]$DiskSizeBytes
        switch_name = $SwitchName
        nested_virtualization_requested = $true
        secure_boot = $true
        virtual_tpm = $true
        checkpoint = '00-Before-Windows-Install'
        iso = $isoRecord
        host_name = $env:COMPUTERNAME
        host_model = $hostInfo.Model
        host_total_memory_bytes = [int64]$hostInfo.TotalPhysicalMemory
    }
    $record | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $VmRoot 'provisioning-record.json') -Encoding UTF8
    Start-VM -Name $VMName | Out-Null
    Write-Host '[ OK ] VM nueva creada y encendida.'
    Write-Host "VM_NAME=$VMName"
    Write-Host "ISO_SHA256=$isoHash"
    Write-Host 'CHECKPOINT=00-Before-Windows-Install'
    Write-Host 'NEXT_OPERATOR_ACTION=Instalar Windows desde la ISO oficial en VMConnect y detenerse en OOBE/UAC.'
} catch {
    if ($createdVm -and (Get-VM -Name $VMName -ErrorAction SilentlyContinue)) {
        Stop-VM -Name $VMName -TurnOff -Force -ErrorAction SilentlyContinue
        Remove-VM -Name $VMName -Force -ErrorAction SilentlyContinue
    }
    if (Test-Path -LiteralPath $VmRoot) {
        Remove-Item -LiteralPath $VmRoot -Recurse -Force -ErrorAction SilentlyContinue
    }
    throw
}
