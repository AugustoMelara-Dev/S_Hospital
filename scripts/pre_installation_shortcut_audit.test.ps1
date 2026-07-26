#Requires -Version 5.1

$ErrorActionPreference = 'Stop'

$installerScript = Join-Path $PSScriptRoot 'install_hospital_startup_shortcut.ps1'
$testRoot = Join-Path ([System.IO.Path]::GetTempPath()) ('s-hospital-audit-shortcut-' + [guid]::NewGuid().ToString('N'))
$projectRoot = Join-Path $testRoot 'Hospital'
$outputRoot = Join-Path $testRoot 'Escritorio'
$scriptsDir = Join-Path $projectRoot 'scripts'
$restoreStub = Join-Path $scriptsDir 'restore_hospital_windows.ps1'
$maintenanceStub = Join-Path $scriptsDir 'maintenance_hospital_windows.ps1'
$legacyIconPath = Join-Path (Split-Path $PSScriptRoot -Parent) 'frontend\public\icons\hospital-app.ico'
$appIconPath = Join-Path (Split-Path $PSScriptRoot -Parent) 'frontend\public\icons\s-hospital-app.ico'
$installerIconPath = Join-Path (Split-Path $PSScriptRoot -Parent) 'frontend\public\icons\s-hospital-installer.ico'
$maintenanceIconPath = Join-Path (Split-Path $PSScriptRoot -Parent) 'frontend\public\icons\s-hospital-maintenance.ico'

$script:Checks = 0
$script:Errors = @()

function Assert-ShortcutAuditTest {
    param([bool] $Condition, [string] $Message)
    $script:Checks++
    if (-not $Condition) {
        $script:Errors += $Message
    }
}

try {
    if (-not (Test-Path -LiteralPath $scriptsDir)) { New-Item -ItemType Directory -Path $scriptsDir -Force | Out-Null }
    if (-not (Test-Path -LiteralPath $outputRoot)) { New-Item -ItemType Directory -Path $outputRoot -Force | Out-Null }

    Set-Content -LiteralPath $restoreStub -Value '# stub' -Encoding ASCII
    Set-Content -LiteralPath $maintenanceStub -Value '# stub' -Encoding ASCII

    $iconPathForTest = if (Test-Path -LiteralPath $appIconPath) { $appIconPath } else { $legacyIconPath }

    $plan = & $installerScript `
        -ProjectRoot $projectRoot `
        -Url 'http://127.0.0.1:8000' `
        -OutputRoot $outputRoot `
        -IconPath $iconPathForTest `
        -WhatIfOnly

    Assert-ShortcutAuditTest ($null -ne $plan) 'WhatIfOnly debe devolver un plan de accesos directos.'
    Assert-ShortcutAuditTest ($plan.Application.Name -eq 'S_Hospital') 'El nombre del acceso directo de aplicacion debe ser S_Hospital.'
    Assert-ShortcutAuditTest ($plan.Maintenance.Name -eq 'Mantenimiento S_Hospital') 'El nombre del acceso directo de mantenimiento debe ser Mantenimiento S_Hospital.'
    Assert-ShortcutAuditTest ($plan.Maintenance.ScriptPath -like '*maintenance_hospital_windows.ps1*') 'El acceso directo de mantenimiento debe apuntar a maintenance_hospital_windows.ps1, no a restore_hospital_windows.ps1.'
    Assert-ShortcutAuditTest (-not ($plan.Maintenance.ScriptPath -like '*restore_hospital_windows.ps1*')) 'El acceso directo de mantenimiento NO debe seguir apuntando al helper de restore.'
    Assert-ShortcutAuditTest ($plan.Maintenance.TargetPath -eq (Join-Path $PSHOME 'powershell.exe')) 'El target del acceso directo de mantenimiento debe ser powershell.exe.'
    Assert-ShortcutAuditTest ($plan.Maintenance.Arguments -match '-File\s+"[^"]*maintenance_hospital_windows\.ps1"') 'Los argumentos del acceso directo de mantenimiento deben invocar el script de consola.'
    Assert-ShortcutAuditTest (Test-Path -LiteralPath $maintenanceStub) 'Debe existir scripts\maintenance_hospital_windows.ps1 como consola de mantenimiento.'

    Assert-ShortcutAuditTest (-not (Test-Path -LiteralPath $legacyIconPath) -or (Test-Path -LiteralPath $appIconPath)) 'El instalador debe preferir s-hospital-app.ico multirresolucion sobre hospital-app.ico legado.'

    if (Test-Path -LiteralPath $maintenanceIconPath) {
        Assert-ShortcutAuditTest ($plan.Maintenance.IconPath -eq (Resolve-Path -LiteralPath $maintenanceIconPath).Path) 'El acceso directo de mantenimiento debe usar s-hospital-maintenance.ico cuando exista.'
    } else {
        Assert-ShortcutAuditTest $false 'Debe existir frontend\public\icons\s-hospital-maintenance.ico multirresolucion.'
    }

    Assert-ShortcutAuditTest (Test-Path -LiteralPath $installerIconPath) 'Debe existir frontend\public\icons\s-hospital-installer.ico multirresolucion.'

    if ($script:Errors.Count -gt 0) {
        Write-Host ('Shortcut audit found {0} failing assertions:' -f $script:Errors.Count) -ForegroundColor Red
        foreach ($err in $script:Errors) {
            Write-Host ('  - {0}' -f $err) -ForegroundColor Red
        }
        throw 'Maintenance shortcut audit failed.'
    }

    Write-Host "Maintenance shortcut audit passed: $script:Checks checks."
}
finally {
    if (Test-Path -LiteralPath $testRoot) {
        Remove-Item -LiteralPath $testRoot -Recurse -Force
    }
}
