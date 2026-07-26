#Requires -Version 5.1

$ErrorActionPreference = 'Stop'

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$installerPath = Join-Path $PSScriptRoot 'install_hospital_autostart.ps1'
$runnerPath = Join-Path $PSScriptRoot 'start_hospital_windows.ps1'
$testRoot = Join-Path ([System.IO.Path]::GetTempPath()) ('s-hospital-autostart-' + [guid]::NewGuid().ToString('N'))

$script:Checks = 0
function Assert-Autostart {
    param([bool] $Condition, [string] $Message)
    $script:Checks++
    if (-not $Condition) {
        throw $Message
    }
}

try {
    New-Item -ItemType Directory -Force -Path $testRoot | Out-Null

    Assert-Autostart (Test-Path -LiteralPath $installerPath -PathType Leaf) 'Autostart installer script is missing.'
    Assert-Autostart (Test-Path -LiteralPath $runnerPath -PathType Leaf) 'Hospital startup runner script is missing.'

    $plan = & $installerPath `
        -ProjectRoot $projectRoot `
        -StartupDirectory $testRoot `
        -WhatIfOnly

    Assert-Autostart ($null -ne $plan) 'WhatIfOnly must return an autostart plan.'
    Assert-Autostart ($plan.Name -eq 'S_Hospital - Inicio automatico') 'Autostart entry name is incorrect.'
    Assert-Autostart ($plan.StartupPath -eq (Join-Path $testRoot 'S_Hospital - Inicio automatico.cmd')) 'Autostart path is incorrect.'
    Assert-Autostart ($plan.RunnerPath -eq $runnerPath) 'Autostart must use the versioned startup runner.'
    Assert-Autostart (-not (Test-Path -LiteralPath $plan.StartupPath)) 'WhatIfOnly must not write the startup entry.'

    $result = & $installerPath `
        -ProjectRoot $projectRoot `
        -StartupDirectory $testRoot

    Assert-Autostart $result.Success 'Autostart installation must report success.'
    Assert-Autostart (Test-Path -LiteralPath $result.StartupPath -PathType Leaf) 'Autostart entry was not created.'

    $startupContent = Get-Content -LiteralPath $result.StartupPath -Raw
    Assert-Autostart ($startupContent -match 'powershell\.exe') 'Autostart entry must invoke Windows PowerShell.'
    Assert-Autostart ($startupContent -match [regex]::Escape('start_hospital_windows.ps1')) 'Autostart entry must invoke the hospital runner.'
    Assert-Autostart ($startupContent -match '-WindowStyle Hidden') 'Autostart entry must stay hidden.'
    Assert-Autostart ($startupContent -match [regex]::Escape('"' + $projectRoot + '"')) 'Project root with spaces must be quoted.'
    Assert-Autostart ($startupContent -notmatch '(APP_KEY|DB_PASSWORD|HOSPITAL_BACKUP_ENCRYPTION_KEY)') 'Autostart entry must not contain secrets.'

    $runnerContent = Get-Content -LiteralPath $runnerPath -Raw
    Assert-Autostart ($runnerContent -match 'docker info') 'Runner must wait for Docker readiness.'
    Assert-Autostart ($runnerContent -match 'Docker Desktop\.exe') 'Runner must be able to start Docker Desktop.'
    Assert-Autostart ($runnerContent -match 'up.+-d.+--no-build') 'Runner must start the installed compose stack without rebuilding.'
    Assert-Autostart ($runnerContent -match '/up') 'Runner must verify the web health endpoint.'
    Assert-Autostart ($runnerContent -match 'Start-Process.+-WindowStyle Hidden') 'Runner helpers must start hidden.'

    Write-Host "Hospital autostart self-test passed: $script:Checks checks."
}
finally {
    if (Test-Path -LiteralPath $testRoot) {
        Remove-Item -LiteralPath $testRoot -Recurse -Force
    }
}
