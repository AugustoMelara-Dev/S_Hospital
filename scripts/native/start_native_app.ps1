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

function New-SplashForm {
    param([string] $Message)
    Add-Type -AssemblyName System.Windows.Forms
    Add-Type -AssemblyName System.Drawing
    $form = New-Object System.Windows.Forms.Form
    $form.Text = 'S_Hospital'
    $form.FormBorderStyle = [System.Windows.Forms.FormBorderStyle]::FixedToolWindow
    $form.StartPosition = [System.Windows.Forms.FormStartPosition]::CenterScreen
    $form.ClientSize = New-Object System.Drawing.Size(380, 120)
    $form.TopMost = $true
    $form.ShowInTaskbar = $true
    $form.ControlBox = $false
    $label = New-Object System.Windows.Forms.Label
    $label.Text = $Message
    $label.Dock = [System.Windows.Forms.DockStyle]::Fill
    $label.TextAlign = [System.Drawing.ContentAlignment]::MiddleCenter
    $label.Font = New-Object System.Drawing.Font('Segoe UI', 11)
    $form.Controls.Add($label)
    $form.Show()
    [System.Windows.Forms.Application]::DoEvents()
    return $form
}

function Wait-NativeHospitalReady {
    param([int] $Seconds, $Splash)
    $deadline = (Get-Date).AddSeconds($Seconds)
    do {
        try {
            $response = Invoke-WebRequest -Uri $plan.HealthUrl -UseBasicParsing -TimeoutSec 3
            if ($response.StatusCode -eq 200) { return $true }
        }
        catch { }
        if ($Splash -and -not $Splash.IsDisposed) { [System.Windows.Forms.Application]::DoEvents() }
        Start-Sleep -Seconds 1
    } while ((Get-Date) -lt $deadline)
    $false
}

$splash = $null
try {
    $splash = New-SplashForm -Message 'Iniciando S_Hospital... Espere unos segundos.'
    $healthy = Wait-NativeHospitalReady -Seconds $WaitSeconds -Splash $splash
    while (-not $healthy) {
        if ($splash -and -not $splash.IsDisposed) { $splash.Close(); [System.Windows.Forms.Application]::DoEvents() }
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
}
finally {
    if ($splash -and -not $splash.IsDisposed) { $splash.Close(); [System.Windows.Forms.Application]::DoEvents() }
}

$edgeCandidates = @(
    (Join-Path ${env:ProgramFiles(x86)} 'Microsoft\Edge\Application\msedge.exe'),
    (Join-Path $env:ProgramFiles 'Microsoft\Edge\Application\msedge.exe')
) | Where-Object { $_ -and (Test-Path -LiteralPath $_ -PathType Leaf) }
if ($edgeCandidates.Count -gt 0) {
    $edgeProfile = Join-Path $env:LOCALAPPDATA 'S_Hospital\edge'
    if (-not (Test-Path -LiteralPath $edgeProfile)) {
        New-Item -ItemType Directory -Path $edgeProfile -Force | Out-Null
    }
    Start-Process -FilePath $edgeCandidates[0] -ArgumentList @(
        ('--app=' + $AppUrl),
        ('--user-data-dir=' + $edgeProfile),
        '--no-first-run',
        '--no-default-browser-check',
        '--window-size=1366,768'
    )
}
else {
    Start-Process $AppUrl
}
