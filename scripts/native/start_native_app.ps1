#Requires -Version 5.1

[CmdletBinding()]
param(
    [string] $InstallRoot = (Join-Path $env:ProgramFiles 'S_Hospital'),
    [ValidatePattern('^http://127\.0\.0\.1:[0-9]+(?:/administracion/ajustes)?$')][string] $AppUrl = 'http://127.0.0.1:8000',
    [ValidateRange(10, 300)][int] $WaitSeconds = 150,
    [switch] $WhatIfOnly,
    [switch] $Json
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$appUri = [uri]$AppUrl
$plan = [pscustomobject]@{
    AppUrl = $AppUrl
    HealthUrl = $appUri.GetLeftPart([UriPartial]::Authority) + '/up'
    WaitSeconds = $WaitSeconds
    RetryWaitSeconds = [Math]::Min(30, $WaitSeconds)
    AutomaticLogin = $false
    CurrentRelease = Join-Path $InstallRoot 'current'
}
if ($WhatIfOnly) {
    if ($Json) { $plan | ConvertTo-Json -Depth 3 }
    else { $plan }
    exit 0
}

function Wait-NativeHospitalReady {
    param([int] $Seconds)
    $deadline = (Get-Date).AddSeconds($Seconds)
    do {
        try {
            $response = Invoke-WebRequest -Uri $plan.HealthUrl -UseBasicParsing -TimeoutSec 3
            if ($response.StatusCode -eq 200) { return $true }
        }
        catch { }
        Start-Sleep -Seconds 1
    } while ((Get-Date) -lt $deadline)
    $false
}

$healthy = Wait-NativeHospitalReady -Seconds $WaitSeconds
while (-not $healthy) {
    Add-Type -AssemblyName System.Windows.Forms
    $choice = [Windows.Forms.MessageBox]::Show(
        'S_Hospital todavía está iniciando. Puede reintentar en unos segundos o cerrar esta ventana.',
        'S_Hospital',
        [Windows.Forms.MessageBoxButtons]::RetryCancel,
        [Windows.Forms.MessageBoxIcon]::Warning
    )
    if ($choice -ne [Windows.Forms.DialogResult]::Retry) { exit 1 }
    $healthy = Wait-NativeHospitalReady -Seconds $plan.RetryWaitSeconds
}

$edgeCandidates = @(
    (Join-Path ${env:ProgramFiles(x86)} 'Microsoft\Edge\Application\msedge.exe'),
    (Join-Path $env:ProgramFiles 'Microsoft\Edge\Application\msedge.exe')
) | Where-Object { $_ -and (Test-Path -LiteralPath $_ -PathType Leaf) }
if ($edgeCandidates.Count -gt 0) {
    Start-Process -FilePath $edgeCandidates[0] -ArgumentList @('--app=' + $AppUrl)
}
else {
    Start-Process $AppUrl
}
