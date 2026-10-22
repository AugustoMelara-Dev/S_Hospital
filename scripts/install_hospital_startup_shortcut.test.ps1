#Requires -Version 5.1

$ErrorActionPreference = 'Stop'

$scriptPath = Join-Path $PSScriptRoot 'install_hospital_startup_shortcut.ps1'
$testRoot = Join-Path ([System.IO.Path]::GetTempPath()) ('s-hospital-shortcuts-' + [guid]::NewGuid().ToString('N'))
$projectRoot = Join-Path $testRoot 'Hospital con espacios'
$outputRoot = Join-Path $testRoot 'Escritorio de prueba'
$maintenanceScript = Join-Path $projectRoot 'scripts\maintenance_hospital_windows.ps1'
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
    Assert-ShortcutTest ($plan.Maintenance.Arguments -match '-File\s+"[^"]*Hospital con espacios[^"]*maintenance_hospital_windows\.ps1"') 'Maintenance path with spaces must be quoted.'
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
        Assert-ShortcutTest ($maintenanceShortcut.Arguments -match '-File\s+"[^"]*Hospital con espacios[^"]*maintenance_hospital_windows\.ps1"') 'Generated maintenance shortcut lost path quoting.'
    }
    else {
        Assert-ShortcutTest ($result.Warning -ne '') 'Fallback installation must report a warning.'
    }

    # El default del instalador (sin -MaintenanceScript) debe resolver la CONSOLA.
    $defaultPlan = & $scriptPath `
        -ProjectRoot $projectRoot `
        -Url 'http://127.0.0.1:8000' `
        -OutputRoot $outputRoot `
        -IconPath $iconPath `
        -MaintenanceIconPath $maintenanceIconPath `
        -WhatIfOnly
    Assert-ShortcutTest ($defaultPlan.Maintenance.ScriptPath -eq $maintenanceScript) 'Sin -MaintenanceScript el plan debe resolver la consola de mantenimiento.'
    Assert-ShortcutTest ($defaultPlan.Maintenance.Arguments -match 'maintenance_hospital_windows\.ps1') 'El default debe invocar la consola.'
    Assert-ShortcutTest (-not ($defaultPlan.Maintenance.Arguments -match 'restore_hospital_windows\.ps1')) 'El default NO debe apuntar al helper de restore.'

    # Call site real del deploy: el acceso "Mantenimiento" se instala con la consola.
    $deployPath = Join-Path (Split-Path $PSScriptRoot -Parent) 'scripts\deploy_hospital_lan.ps1'
    $deployTokens = $null
    $deployErrors = $null
    $deployAst = [System.Management.Automation.Language.Parser]::ParseFile($deployPath, [ref] $deployTokens, [ref] $deployErrors)
    Assert-ShortcutTest ($deployErrors.Count -eq 0) 'deploy_hospital_lan.ps1 debe parsear para auditar el call site.'

    $maintenanceAssignments = @($deployAst.FindAll({
        param($node)
        $node -is [System.Management.Automation.Language.AssignmentStatementAst] -and
        $node.Left -is [System.Management.Automation.Language.VariableExpressionAst] -and
        $node.Left.VariablePath.UserPath -eq 'maintenanceScript'
    }, $true))
    Assert-ShortcutTest ($maintenanceAssignments.Count -eq 1) 'El deploy debe asignar $maintenanceScript una sola vez.'
    $maintenanceAssignmentText = $maintenanceAssignments[0].Right.Extent.Text
    Assert-ShortcutTest ($maintenanceAssignmentText -match 'maintenance_hospital_windows\.ps1') 'El deploy debe apuntar el acceso de mantenimiento a la consola.'
    Assert-ShortcutTest (-not ($maintenanceAssignmentText -match 'restore_hospital_windows\.ps1')) 'El deploy no debe apuntar el acceso de mantenimiento al helper de restore.'

    $shortcutCalls = @($deployAst.FindAll({
        param($node)
        $node -is [System.Management.Automation.Language.CommandAst] -and
        $node.CommandElements.Count -gt 0 -and
        $node.CommandElements[0] -is [System.Management.Automation.Language.VariableExpressionAst] -and
        $node.CommandElements[0].VariablePath.UserPath -eq 'shortcutScript'
    }, $true))
    Assert-ShortcutTest ($shortcutCalls.Count -ge 1) 'El deploy debe invocar install_hospital_startup_shortcut.ps1.'
    $callSiteParameters = @($shortcutCalls[0].CommandElements |
        Where-Object { $_ -is [System.Management.Automation.Language.CommandParameterAst] } |
        ForEach-Object { $_.ParameterName })
    Assert-ShortcutTest ($callSiteParameters -contains 'MaintenanceScript') 'El call site debe pasar -MaintenanceScript.'
    Assert-ShortcutTest (-not ($callSiteParameters -contains 'RestoreScript')) 'El call site no debe usar un parametro de restore inexistente.'

    # El script que el acceso abre debe ejecutar la CONSOLA (y no saltar a restore).
    $repoScripts = Split-Path $PSScriptRoot -Parent
    $consoleSource = Join-Path $repoScripts 'scripts\maintenance_hospital_windows.ps1'
    $fixtureLibRoot = Join-Path $projectRoot 'scripts\lib'
    New-Item -ItemType Directory -Path $fixtureLibRoot -Force | Out-Null
    Copy-Item -LiteralPath $consoleSource -Destination $maintenanceScript -Force
    foreach ($library in @('recovery_contract.ps1', 'recovery_runtime.ps1', 'recovery_validation.ps1', 'recovery_docker.ps1')) {
        Copy-Item -LiteralPath (Join-Path $repoScripts "scripts\lib\$library") -Destination (Join-Path $fixtureLibRoot $library) -Force
    }
    Set-Content -LiteralPath (Join-Path $projectRoot 'docker-compose.prod.yml') -Value 'services: {}' -Encoding ASCII
    Set-Content -LiteralPath (Join-Path $projectRoot '.env') -Value 'DB_DATABASE=hospital_billing' -Encoding ASCII
    $fixtureBin = Join-Path $projectRoot 'bin'
    New-Item -ItemType Directory -Path $fixtureBin -Force | Out-Null
    $consoleDockerStub = @'
@echo off
echo %*>> "%~dp0docker-calls.log"
echo {"status":"success"}
exit /b 0
'@
    Set-Content -LiteralPath (Join-Path $fixtureBin 'docker.cmd') -Value $consoleDockerStub -Encoding ASCII
    $restoreMarker = Join-Path $projectRoot 'restore-invoked.marker'
    $restoreStub = "param([Parameter(ValueFromRemainingArguments=`$true)]`$Args)`r`nSet-Content -LiteralPath '$restoreMarker' -Value 'restore invoked'`r`nexit 0"
    Set-Content -LiteralPath (Join-Path $projectRoot 'scripts\restore_hospital_windows.ps1') -Value $restoreStub -Encoding ASCII

    $consoleProcessInfo = New-Object System.Diagnostics.ProcessStartInfo
    $consoleProcessInfo.FileName = Join-Path $PSHOME 'powershell.exe'
    $consoleProcessInfo.Arguments = '-NoProfile -ExecutionPolicy Bypass ' + $defaultPlan.Maintenance.Arguments + ' -Command Status'
    $consoleProcessInfo.UseShellExecute = $false
    $consoleProcessInfo.RedirectStandardOutput = $true
    $consoleProcessInfo.RedirectStandardError = $true
    $consoleProcessInfo.EnvironmentVariables['PATH'] = $fixtureBin + ';' + $consoleProcessInfo.EnvironmentVariables['PATH']
    $consoleProcess = [System.Diagnostics.Process]::Start($consoleProcessInfo)
    $consoleStdout = $consoleProcess.StandardOutput.ReadToEnd()
    $consoleStderr = $consoleProcess.StandardError.ReadToEnd()
    $consoleProcess.WaitForExit()
    $consoleExit = $consoleProcess.ExitCode
    $consoleProcess.Dispose()

    Assert-ShortcutTest ($consoleExit -eq 0) "El acceso de mantenimiento debe abrir la consola (exit 0). stderr=$consoleStderr"
    Assert-ShortcutTest ($consoleStdout -match 'ESTADO DEL SISTEMA S_HOSPITAL') 'El acceso de mantenimiento debe mostrar la consola, no iniciar un restore.'
    Assert-ShortcutTest ($consoleStdout -match 'Correlativos:') 'La consola debe mostrar el estado de correlativos.'
    Assert-ShortcutTest (-not (Test-Path -LiteralPath $restoreMarker)) 'Diagnostico no debe saltar directamente a restore.'

    Write-Host "Shortcut contract self-test passed: $script:Checks checks."
}
finally {
    if (Test-Path -LiteralPath $testRoot) {
        Remove-Item -LiteralPath $testRoot -Recurse -Force
    }
}
