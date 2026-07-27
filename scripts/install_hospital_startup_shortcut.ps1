#Requires -Version 5.1

param(
    [Parameter(Mandatory = $true)]
    [string] $ProjectRoot,

    [Parameter(Mandatory = $true)]
    [string] $Url,

    [string] $MaintenanceScript = '',
    [string] $OutputRoot = [Environment]::GetFolderPath('Desktop'),
    [string] $IconPath = '',
    [string] $MaintenanceIconPath = '',
    [switch] $WhatIfOnly
)

$ErrorActionPreference = 'Stop'

if ([string]::IsNullOrWhiteSpace($MaintenanceScript)) {
    $MaintenanceScript = Join-Path $ProjectRoot 'scripts\maintenance_hospital_windows.ps1'
}
if ([string]::IsNullOrWhiteSpace($IconPath)) {
    $IconPath = Join-Path $ProjectRoot 'frontend\public\icons\s-hospital-app.ico'
}
if ([string]::IsNullOrWhiteSpace($MaintenanceIconPath)) {
    $MaintenanceIconPath = Join-Path $ProjectRoot 'frontend\public\icons\s-hospital-maintenance.ico'
}

$libraryPath = Join-Path $PSScriptRoot 'lib\shortcut_installer.ps1'
if (-not (Test-Path -LiteralPath $libraryPath)) {
    throw "Shortcut installer module is missing: $libraryPath"
}
. $libraryPath

Install-HospitalShortcuts `
    -ProjectRoot $ProjectRoot `
    -Url $Url `
    -MaintenanceScript $MaintenanceScript `
    -OutputRoot $OutputRoot `
    -IconPath $IconPath `
    -MaintenanceIconPath $MaintenanceIconPath `
    -WhatIfOnly:$WhatIfOnly
