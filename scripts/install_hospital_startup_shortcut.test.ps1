#Requires -Version 5.1

$ErrorActionPreference = 'Stop'

$scriptPath = Join-Path $PSScriptRoot 'install_hospital_startup_shortcut.ps1'
$testRoot = Join-Path ([System.IO.Path]::GetTempPath()) ('s-hospital-shortcuts-' + [guid]::NewGuid().ToString('N'))
$projectRoot = Join-Path $testRoot 'Hospital con espacios'
$outputRoot = Join-Path $testRoot 'Escritorio de prueba'
$maintenanceScript = Join-Path $projectRoot 'scripts\restore_hospital_windows.ps1'
$iconPath = Join-Path (Split-Path $PSScriptRoot -Parent) 'frontend\public\icons\s-hospital-app.ico'
$maintenanceIconPath = Join-Path (Split-Path $PSScriptRoot -Parent) 'frontend\public\icons\s-hospital-maintenance.ico'
$unrelatedShortcut = Join-Path $outputRoot 'Acceso ajeno.lnk'
$script:Checks = 0

function Assert-ShortcutTest {
    param([bool] $Condition, [string] $Message)
    $script:Checks++
    if (-not $Condition) {
        throw $Message
    }
}

try {
    New-Item -ItemType Directory -Path (Split-Path $maintenanceScript -Parent) -Force | Out-Null
    New-Item -ItemType Directory -Path $outputRoot -Force | Out-Null
    New-Item -ItemType File -Path $maintenanceScript -Force | Out-Null
    Set-Content -LiteralPath $unrelatedShortcut -Value 'do-not-touch' -Encoding ASCII

    $plan = & $scriptPath `
        -ProjectRoot $projectRoot `
        -Url 'http://127.0.0.1:8000' `
        -MaintenanceScript $maintenanceScript `
        -OutputRoot $outputRoot `
        -IconPath $iconPath `
        -MaintenanceIconPath $maintenanceIconPath `
        -WhatIfOnly

    Assert-ShortcutTest ($null -ne $plan) 'WhatIfOnly must return a shortcut plan.'
    Assert-ShortcutTest ($plan.Application.Name -eq 'S_Hospital') 'Application shortcut name is incorrect.'
    Assert-ShortcutTest ($plan.Application.Url -eq 'http://127.0.0.1:8000') 'Application URL is incorrect.'
    Assert-ShortcutTest ($plan.Maintenance.Name -eq 'Mantenimiento S_Hospital') 'Maintenance shortcut name is incorrect.'
    Assert-ShortcutTest ($plan.Maintenance.ScriptPath -eq $maintenanceScript) 'Maintenance script path is incorrect.'
    Assert-ShortcutTest ($plan.Application.IconPath -eq (Resolve-Path $iconPath).Path) 'Institutional icon path is incorrect.'
    Assert-ShortcutTest ($plan.Maintenance.IconPath -eq (Resolve-Path $maintenanceIconPath).Path) 'Maintenance icon path is incorrect.'
    Assert-ShortcutTest ($plan.Maintenance.Arguments -match '-File\s+"[^"]*Hospital con espacios[^"]*restore_hospital_windows\.ps1"') 'Maintenance path with spaces must be quoted.'
    Assert-ShortcutTest (-not (Test-Path -LiteralPath (Join-Path $outputRoot 'S_Hospital.lnk'))) 'WhatIfOnly must not create the application shortcut.'
    Assert-ShortcutTest ((Get-Content -LiteralPath $unrelatedShortcut -Raw).TrimEnd() -eq 'do-not-touch') 'Unrelated shortcuts must never be overwritten.'

    $result = & $scriptPath `
        -ProjectRoot $projectRoot `
        -Url 'http://127.0.0.1:8000' `
        -MaintenanceScript $maintenanceScript `
        -OutputRoot $outputRoot `
        -IconPath $iconPath `
        -MaintenanceIconPath $maintenanceIconPath

    Assert-ShortcutTest $result.Success 'Shortcut installation must report success.'
    Assert-ShortcutTest (Test-Path -LiteralPath $result.ApplicationPath) 'Application shortcut was not created.'
    Assert-ShortcutTest (Test-Path -LiteralPath $result.MaintenancePath) 'Maintenance shortcut was not created.'
    Assert-ShortcutTest ((Get-Content -LiteralPath $unrelatedShortcut -Raw).TrimEnd() -eq 'do-not-touch') 'Actual installation must preserve unrelated shortcuts.'

    if (-not $result.UsedFallback) {
        $shell = New-Object -ComObject WScript.Shell
        $applicationShortcut = $shell.CreateShortcut($result.ApplicationPath)
        $maintenanceShortcut = $shell.CreateShortcut($result.MaintenancePath)
        Assert-ShortcutTest ($applicationShortcut.IconLocation -like '*s-hospital-app.ico*') 'Generated application shortcut lost the institutional icon.'
        Assert-ShortcutTest ($maintenanceShortcut.IconLocation -like '*s-hospital-maintenance.ico*') 'Generated maintenance shortcut lost the dedicated maintenance icon.'
        Assert-ShortcutTest ($maintenanceShortcut.Arguments -match '-File\s+"[^"]*Hospital con espacios[^"]*restore_hospital_windows\.ps1"') 'Generated maintenance shortcut lost path quoting.'
    }
    else {
        Assert-ShortcutTest ($result.Warning -ne '') 'Fallback installation must report a warning.'
    }

    Write-Host "Shortcut contract self-test passed: $script:Checks checks."
}
finally {
    if (Test-Path -LiteralPath $testRoot) {
        Remove-Item -LiteralPath $testRoot -Recurse -Force
    }
}
