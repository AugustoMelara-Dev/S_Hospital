#Requires -Version 5.1

param(
    [Parameter(Mandatory = $true)]
    [string] $ProjectRoot,
    [string] $StartupDirectory = [Environment]::GetFolderPath('Startup'),
    [switch] $WhatIfOnly
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$resolvedProjectRoot = (Resolve-Path -LiteralPath $ProjectRoot).Path
$runnerPath = Join-Path $PSScriptRoot 'start_hospital_windows.ps1'
if (-not (Test-Path -LiteralPath $runnerPath -PathType Leaf)) {
    throw "No se encontro el iniciador automatico: $runnerPath"
}

$entryName = 'S_Hospital - Inicio automatico'
$startupPath = Join-Path $StartupDirectory ($entryName + '.cmd')
$plan = [pscustomobject]@{
    Name = $entryName
    ProjectRoot = $resolvedProjectRoot
    RunnerPath = $runnerPath
    StartupPath = $startupPath
}

if ($WhatIfOnly) {
    return $plan
}

New-Item -ItemType Directory -Force -Path $StartupDirectory | Out-Null
$startupCommand = ('start "" /min powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "{0}" -ProjectRoot "{1}"' -f $runnerPath, $resolvedProjectRoot)
$content = @(
    '@echo off',
    $startupCommand
) -join [Environment]::NewLine
Set-Content -LiteralPath $startupPath -Value $content -Encoding ASCII

if (-not (Test-Path -LiteralPath $startupPath -PathType Leaf)) {
    throw 'Windows no pudo crear la entrada de inicio automatico de S_Hospital.'
}

return [pscustomobject]@{
    Success = $true
    Name = $entryName
    ProjectRoot = $resolvedProjectRoot
    RunnerPath = $runnerPath
    StartupPath = $startupPath
}
